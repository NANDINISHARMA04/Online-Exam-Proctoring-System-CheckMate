# modules/video_monitor.py
# ══════════════════════════════════════════════════════════════════
#  VIDEO MONITOR — Face Detection, Head Movement, Gaze, Object Detection
#  Uses OpenCV + MediaPipe for real-time analysis
# ══════════════════════════════════════════════════════════════════

import cv2
import numpy as np
import time
import base64
from datetime import datetime

class VideoMonitor:
    """
    Handles all camera-based monitoring:
    - Face detection (present / absent / multiple)
    - Head pose estimation (looking away detection)
    - Basic gaze direction
    - Phone/object detection via color+shape heuristics
    """

    # Landmark indices for gaze estimation
    LEFT_EYE_OUTER  = 33
    LEFT_EYE_INNER  = 133
    RIGHT_EYE_OUTER = 362
    RIGHT_EYE_INNER = 263
    NOSE_TIP        = 4
    CHIN            = 152
    FOREHEAD        = 10
    LEFT_CHEEK      = 234
    RIGHT_CHEEK     = 454

    def __init__(self):
        self.cap            = None
        self.running        = False
        self.last_frame     = None
        self.last_frame_b64 = ""

        # State tracked per-frame
        self.face_count     = 0
        self.head_pose      = "FORWARD"
        self.gaze_dir       = "CENTER"
        self.head_movement  = 0.0
        self.phone_detected = False

        # MediaPipe handles (initialised in start())
        self._face_mesh     = None
        self._face_detect   = None
        self._mp_face_mesh  = None
        self._mp_drawing    = None

        # Frame-skip for performance
        self._frame_skip    = 0

    # ── Initialise camera ─────────────────────────────────────────
    def start(self):
        """Open webcam and initialise MediaPipe."""
        try:
            # Import here so errors are caught cleanly
            import mediapipe as mp

            # Store module references on the instance
            self._mp_face_mesh  = mp.solutions.face_mesh
            self._mp_face_detect = mp.solutions.face_detection
            self._mp_drawing    = mp.solutions.drawing_utils

            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                raise RuntimeError("Cannot open camera (index 0)")
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, 15)

            self._face_mesh = self._mp_face_mesh.FaceMesh(
                max_num_faces=3,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self._face_detect = self._mp_face_detect.FaceDetection(
                model_selection=0,
                min_detection_confidence=0.5
            )
            self.running = True
            return True
        except Exception as e:
            print(f"[VideoMonitor] start error: {e}")
            return False

    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()
        if self._face_mesh:
            self._face_mesh.close()
        if self._face_detect:
            self._face_detect.close()

    # ── Main processing loop (called by server thread) ────────────
    def process_frame(self):
        """
        Read one frame, run all detections, update state, return violations list.
        Returns: (violations: list[dict], metrics: dict)
        """
        if not self.running or not self.cap:
            return [], {}

        ret, frame = self.cap.read()
        if not ret:
            return [], {}

        # Flip so it mirrors the user
        frame = cv2.flip(frame, 1)
        h, w  = frame.shape[:2]
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        violations = []
        metrics    = {}

        # ── 1. Face Detection ─────────────────────────────────────
        face_results = self._face_detect.process(rgb)
        self.face_count = len(face_results.detections) if face_results.detections else 0

        if self.face_count == 0:
            violations.append({"type": "no_face", "severity": "high",
                                "msg": "No face detected in frame"})
            cv2.putText(frame, "NO FACE DETECTED", (20, 60),
                        cv2.FONT_HERSHEY_DUPLEX, 0.9, (0, 0, 255), 2)
        elif self.face_count > 1:
            violations.append({"type": "multi_face", "severity": "high",
                                "msg": f"{self.face_count} faces detected"})
            cv2.putText(frame, f"MULTIPLE FACES: {self.face_count}", (20, 60),
                        cv2.FONT_HERSHEY_DUPLEX, 0.9, (0, 0, 255), 2)

        # ── 2. Face Mesh → Head Pose + Gaze ───────────────────────
        if self.face_count == 1:
            mesh_results = self._face_mesh.process(rgb)
            if mesh_results.multi_face_landmarks:
                lm = mesh_results.multi_face_landmarks[0].landmark
                vio, hp_metrics = self._analyse_head_and_gaze(lm, w, h, frame)
                violations.extend(vio)
                metrics.update(hp_metrics)

                # Draw minimal overlay on face
                self._mp_drawing.draw_landmarks(
                    frame,
                    mesh_results.multi_face_landmarks[0],
                    self._mp_face_mesh.FACEMESH_CONTOURS,
                    landmark_drawing_spec=None,
                    connection_drawing_spec=self._mp_drawing.DrawingSpec(
                        color=(0, 212, 255), thickness=1, circle_radius=0)
                )

        # ── 3. Phone / Object Detection (lightweight heuristic) ───
        phone_vio = self._detect_phone_heuristic(frame, rgb)
        if phone_vio:
            violations.append(phone_vio)

        # ── 4. Annotate and encode frame ──────────────────────────
        self._draw_overlay(frame)
        self._encode_frame(frame)

        metrics.update({
            "face_count":     self.face_count,
            "head_pose":      self.head_pose,
            "gaze_dir":       self.gaze_dir,
            "head_movement":  round(self.head_movement, 1),
            "phone_detected": self.phone_detected,
        })
        return violations, metrics

    # ── Head pose & gaze ──────────────────────────────────────────
    def _analyse_head_and_gaze(self, lm, w, h, frame):
        """Use facial landmarks to estimate head tilt and gaze direction."""
        violations = []
        metrics    = {}

        def pt(idx): return (int(lm[idx].x * w), int(lm[idx].y * h))

        nose     = pt(self.NOSE_TIP)
        chin     = pt(self.CHIN)
        forehead = pt(self.FOREHEAD)
        l_cheek  = pt(self.LEFT_CHEEK)
        r_cheek  = pt(self.RIGHT_CHEEK)
        l_eye_o  = pt(self.LEFT_EYE_OUTER)
        r_eye_o  = pt(self.RIGHT_EYE_OUTER)

        # ── Head roll / yaw via cheek distance ratio ──────────────
        face_width  = r_cheek[0] - l_cheek[0]
        nose_offset = nose[0] - (l_cheek[0] + r_cheek[0]) / 2
        yaw_ratio   = nose_offset / max(face_width, 1)

        # ── Pitch via nose-forehead vertical ──────────────────────
        face_height   = chin[1] - forehead[1]
        nose_v_offset = nose[1] - (forehead[1] + chin[1]) / 2
        pitch_ratio   = nose_v_offset / max(face_height, 1)

        # Classify direction
        if yaw_ratio < -0.15:
            self.head_pose = "RIGHT"
        elif yaw_ratio > 0.15:
            self.head_pose = "LEFT"
        elif pitch_ratio < 0.35:
            self.head_pose = "UP"
        else:
            self.head_pose = "FORWARD"

        # Movement score (0-100) based on deviation from centre
        self.head_movement = min(100, abs(yaw_ratio) * 200 + abs(pitch_ratio - 0.5) * 100)

        if self.head_pose != "FORWARD":
            violations.append({
                "type":     "head_turn",
                "severity": "medium",
                "msg":      f"Head turned {self.head_pose}"
            })

        # ── Basic gaze: compare eye outer corners relative to face ─
        eye_center_x  = (l_eye_o[0] + r_eye_o[0]) / 2
        face_center_x = (l_cheek[0] + r_cheek[0]) / 2
        gaze_offset   = (eye_center_x - face_center_x) / max(face_width, 1)

        if gaze_offset < -0.08:
            self.gaze_dir = "RIGHT"
        elif gaze_offset > 0.08:
            self.gaze_dir = "LEFT"
        else:
            self.gaze_dir = "CENTER"

        metrics = {
            "yaw_ratio":   round(yaw_ratio, 3),
            "pitch_ratio": round(pitch_ratio, 3),
        }

        # Draw head pose label on frame
        colour = (0, 255, 0) if self.head_pose == "FORWARD" else (0, 80, 255)
        cv2.putText(frame, f"HEAD: {self.head_pose}", (20, 30),
                    cv2.FONT_HERSHEY_DUPLEX, 0.7, colour, 1)
        cv2.putText(frame, f"GAZE: {self.gaze_dir}", (20, 55),
                    cv2.FONT_HERSHEY_DUPLEX, 0.55, (0, 200, 200), 1)

        return violations, metrics

    # ── Phone detection heuristic ─────────────────────────────────
    def _detect_phone_heuristic(self, frame, rgb):
        """
        Lightweight phone detection: look for rectangular dark objects
        with aspect ratios consistent with smartphones.
        """
        self.phone_detected = False
        gray     = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurred  = cv2.GaussianBlur(gray, (5, 5), 0)
        edges    = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 3000:
                continue
            x, y, cw, ch = cv2.boundingRect(cnt)
            aspect = ch / max(cw, 1)
            if 1.5 < aspect < 2.5 and 40 < cw < 200 and 80 < ch < 400:
                if cw * ch < (frame.shape[1] * frame.shape[0]) * 0.15:
                    self.phone_detected = True
                    cv2.rectangle(frame, (x, y), (x+cw, y+ch), (0, 0, 255), 2)
                    cv2.putText(frame, "OBJECT?", (x, y - 6),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    return {
                        "type":     "object_detected",
                        "severity": "medium",
                        "msg":      "Suspicious object detected in frame"
                    }
        return None

    # ── Frame annotation overlay ──────────────────────────────────
    def _draw_overlay(self, frame):
        h, w = frame.shape[:2]
        br   = 20
        col  = (0, 212, 255)
        for (cx, cy) in [(0, 0), (w, 0), (0, h), (w, h)]:
            sx = 1 if cx == 0 else -1
            sy = 1 if cy == 0 else -1
            cv2.line(frame, (cx, cy), (cx + sx*br, cy), col, 2)
            cv2.line(frame, (cx, cy), (cx, cy + sy*br), col, 2)

        cv2.rectangle(frame, (0, h-28), (w, h), (0, 0, 0), -1)
        ts = datetime.now().strftime("%H:%M:%S")
        cv2.putText(frame, f"ProctorAI  {ts}  Faces:{self.face_count}", (8, h-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 212, 255), 1)

    # ── Encode frame to base64 JPEG ───────────────────────────────
    def _encode_frame(self, frame):
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
        self.last_frame_b64 = base64.b64encode(buf).decode('utf-8')

    # ── Snapshot for violations ───────────────────────────────────
    def capture_snapshot(self, path: str):
        """Save current frame as JPEG to path."""
        if not self.cap:
            return
        ret, frame = self.cap.read()
        if ret:
            cv2.imwrite(path, cv2.flip(frame, 1))