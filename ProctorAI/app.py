# app.py
# ══════════════════════════════════════════════════════════════════
#  ProctorAI — Flask + SocketIO Server
#  Entry point: python app.py
# ══════════════════════════════════════════════════════════════════

import os
import sys
import time
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit

# ── Add project root to path so modules import cleanly ────────────
sys.path.insert(0, os.path.dirname(__file__))
from modules.video_monitor import VideoMonitor
from modules.audio_monitor  import AudioMonitor
from modules.logger         import ViolationLogger

# ══════════════════════════════════════════════════════════════════
#  App Setup
# ══════════════════════════════════════════════════════════════════
app     = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SECRET_KEY'] = 'proctorai-secret-2024'
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins='*')

# ── Singletons ────────────────────────────────────────────────────
video  = VideoMonitor()
audio  = AudioMonitor()
logger = ViolationLogger(logs_dir='logs', screenshots_dir='screenshots')

# ── Exam session state ────────────────────────────────────────────
session = {
    "active":     False,
    "candidate":  "",
    "exam_id":    "",
    "subject":    "",
    "started_at": None,
}

# ── Throttle: don't log the same violation type more than once/2s ─
_last_logged: dict = {}
THROTTLE_SECS = 2.5

def should_log(vtype: str) -> bool:
    now = time.time()
    if now - _last_logged.get(vtype, 0) > THROTTLE_SECS:
        _last_logged[vtype] = now
        return True
    return False

# ══════════════════════════════════════════════════════════════════
#  Background Monitoring Loop
# ══════════════════════════════════════════════════════════════════
def monitoring_loop():
    """
    Runs in a daemon thread.
    Every ~100 ms: grab a video frame, check audio, push updates via SocketIO.
    """
    while True:
        if not session["active"]:
            time.sleep(0.2)
            continue

        try:
            # ── Video ─────────────────────────────────────────────
            v_violations, metrics = video.process_frame()

            # ── Audio ─────────────────────────────────────────────
            audio_state = audio.get_state()
            if audio_state["noise_event"] and should_log("noise"):
                v_violations.append({
                    "type": "noise", "severity": "medium",
                    "msg":  f"Loud noise detected ({audio_state['db']} dB)"
                })

            # ── Log violations & maybe snapshot ───────────────────
            new_entries = []
            for v in v_violations:
                if should_log(v["type"]):
                    snap = ""
                    if v["severity"] == "high":
                        snap = f"screenshots/{v['type']}_{int(time.time())}.jpg"
                        video.capture_snapshot(snap)
                    entry = logger.log(v["type"], v["severity"], v["msg"], snap)
                    new_entries.append(entry)

            trust = logger.trust_score()

            # Auto-terminate if trust too low
            if trust < 10 and session["active"]:
                session["active"] = False
                socketio.emit('terminated', {"reason": "Trust score critically low"})

            # ── Push update to browser ────────────────────────────
            socketio.emit('update', {
                "frame":       video.last_frame_b64,
                "face_count":  metrics.get("face_count", 0),
                "head_pose":   metrics.get("head_pose", "—"),
                "gaze_dir":    metrics.get("gaze_dir", "—"),
                "head_mv":     metrics.get("head_movement", 0),
                "phone":       metrics.get("phone_detected", False),
                "sound_db":    audio_state["db"],
                "sound_pct":   audio_state["level_pct"],
                "noise_event": audio_state["noise_event"],
                "trust":       trust,
                "warnings":    logger.warning_count,
                "violations":  logger.recent(20),
                "new_violations": new_entries,
            })

        except Exception as e:
            print(f"[MonitorLoop] error: {e}")

        time.sleep(0.1)   # ~10 fps analysis, camera runs at its own rate


# ══════════════════════════════════════════════════════════════════
#  Routes
# ══════════════════════════════════════════════════════════════════
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start', methods=['POST'])
def api_start():
    """Start a new proctored exam session."""
    data = request.get_json() or {}
    session["candidate"]  = data.get("candidate", "Candidate")
    session["exam_id"]    = data.get("exam_id",   "EX-001")
    session["subject"]    = data.get("subject",   "General")
    session["started_at"] = datetime.now().isoformat()
    session["active"]     = True

    logger.candidate = session["candidate"]
    logger.exam_id   = session["exam_id"]

    # Start hardware
    cam_ok = video.start()
    audio.start()   # non-fatal if mic missing

    return jsonify({"ok": cam_ok, "message": "Session started" if cam_ok else "Camera unavailable"})

@app.route('/api/stop', methods=['POST'])
def api_stop():
    """Stop the session (exam submitted)."""
    session["active"] = False
    video.stop()
    audio.stop()
    return jsonify({
        "ok":       True,
        "trust":    logger.trust_score(),
        "warnings": logger.warning_count,
        "summary":  logger.summary(),
        "log_csv":  logger.csv_path,
        "log_json": logger.json_path,
    })

@app.route('/api/violations')
def api_violations():
    return jsonify(logger.recent(100))

@app.route('/api/trust')
def api_trust():
    return jsonify({"trust": logger.trust_score(), "warnings": logger.warning_count})

@app.route('/api/log_tab_switch', methods=['POST'])
def api_tab_switch():
    """Called from JavaScript when user switches tabs."""
    if should_log("tab_switch"):
        logger.log("tab_switch", "high", "User switched tab / minimised window")
    return jsonify({"ok": True})

@app.route('/logs/<path:filename>')
def serve_log(filename):
    return send_from_directory('logs', filename)

@app.route('/screenshots/<path:filename>')
def serve_screenshot(filename):
    return send_from_directory('screenshots', filename)

# ══════════════════════════════════════════════════════════════════
#  SocketIO events
# ══════════════════════════════════════════════════════════════════
@socketio.on('connect')
def on_connect():
    emit('connected', {"msg": "ProctorAI ready"})

@socketio.on('tab_hidden')
def on_tab_hidden(data):
    if should_log("tab_switch"):
        logger.log("tab_switch", "high", "Browser tab hidden / focus lost")

# ══════════════════════════════════════════════════════════════════
#  Entry Point
# ══════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    # Start monitoring thread
    t = threading.Thread(target=monitoring_loop, daemon=True)
    t.start()

    print("\n" + "═"*55)
    print("  ProctorAI — Secure Exam Proctoring System")
    print("  Open your browser at:  http://localhost:5000")
    print("═"*55 + "\n")

    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
