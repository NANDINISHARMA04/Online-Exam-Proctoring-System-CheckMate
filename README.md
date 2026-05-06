# ⬡ Check-Mate — AI-Powered Online Exam Proctoring System

> Real-time exam proctoring using OpenCV, MediaPipe, Flask, SocketIO, and face-api.js — with a built-in multi-field question bank and auto-advancing exam interface.

![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-2.3+-black?style=flat-square&logo=flask)
![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-green?style=flat-square&logo=opencv)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## 📌 What is Check-Mate?

Check-Mate is a full-stack online examination system with built-in AI proctoring. It monitors candidates in real time during an exam using both a **Python backend** (OpenCV + MediaPipe) and a **browser frontend** (face-api.js), logging all suspicious activity and computing a live trust score.

It was built as a college project to explore how AI and computer vision can make online exams more secure and fair — without expensive third-party proctoring services.

---

## 🎯 Features

### 🔒 Proctoring Engine
| Feature | Technology |
|---|---|
| Face Detection | OpenCV + MediaPipe + face-api.js |
| Head Pose Estimation | MediaPipe FaceMesh landmarks |
| Gaze Direction Tracking | Facial landmark geometry |
| Multiple Face Detection | OpenCV FaceDetection model |
| Sound / Noise Detection | PyAudio RMS analysis |
| Tab Switch Detection | JS `visibilitychange` + `blur` events |
| Fullscreen Enforcement | Browser Fullscreen API |
| Copy/Paste/DevTools Block | JavaScript key intercept |
| Right-click Disabled | JS `contextmenu` intercept |
| Auto-Terminate | Triggers at trust score < 30% or max warnings |
| Violation Logging | JSON + CSV session files |
| Screenshot on Violation | OpenCV JPEG capture |
| Live Trust Score (0–100) | Penalty-based scoring system |
| Real-time Dashboard | Flask-SocketIO + live camera feed |

### 📝 Exam Interface
- **70+ question bank** across 7 fields — Computer Science, Mathematics, Science, English, Logical Reasoning, General Knowledge, Current Affairs
- **Branch/field selector** dropdown — choose a specific subject or Mixed mode for a balanced spread
- **Auto-advance** — questions move forward automatically 1.2 seconds after an answer is selected
- **Field badge** on every question showing which subject it belongs to
- **Live progress bar** and dot navigator
- **Shuffled questions** — every exam session gets a fresh random set, candidates never see the same paper twice
- **Results screen** with score, trust score, proctor status (CLEAN / FLAGGED / SUSPICIOUS), and full incident log

---

## 📁 Project Structure

```
Check-Mate/
│
├── app.py                    ← Flask + SocketIO server entry point
├── requirements.txt          ← Python dependencies
├── README.md
│
├── modules/
│   ├── __init__.py
│   ├── video_monitor.py      ← OpenCV + MediaPipe face/gaze/head detection
│   ├── audio_monitor.py      ← PyAudio microphone noise detection
│   └── logger.py             ← Violation logger (JSON + CSV)
│
├── templates/
│   └── index.html            ← Full exam UI (setup → exam → results)
│
├── static/
│   ├── css/
│   │   └── style.css         ← Cyberpunk dark UI stylesheet
│   └── js/
│       ├── questions.js      ← 70-question multi-field bank + shuffle logic
│       ├── proctor.js        ← Browser-side AI proctoring (face-api.js)
│       └── exam.js           ← Exam controller (timer, answers, auto-advance)
│
├── logs/                     ← Auto-created: JSON + CSV violation logs
└── screenshots/              ← Auto-created: snapshots on high violations
```

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/NANDINISHARMA04/Online-Exam-Proctoring-System-CheckMate<img width="1442" height="824" alt="Screenshot 2026-05-06 at 10 43 43 AM" src="https://github.com/user-attachments/assets/d330133a-c222-48dc-b7ea-9d781af7034f" />

cd check-mate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

> **PyAudio on Mac (Apple Silicon):**
> ```bash
> brew install portaudio && pip install pyaudio
> ```
> **PyAudio on Windows:**
> ```bash
> pip install pipwin && pipwin install pyaudio
> ```
> **PyAudio on Linux:**
> ```bash
> sudo apt-get install portaudio19-dev python3-pyaudio
> ```

### 3. Run the server
```bash
python3 app.py
```

### 4. Open in browser
Navigate to **http://localhost:5000** — use Chrome or Edge for best camera/mic compatibility.

---

## 🖥️ How It Works

Check-Mate operates in two parallel layers:

**Layer 1 — Python Backend (server-side)**
- OpenCV captures webcam frames at ~10 fps
- MediaPipe FaceMesh estimates head pose and gaze direction from 468 facial landmarks
- PyAudio continuously reads microphone input and computes RMS noise levels
- All violations are throttled, logged to JSON/CSV, and pushed to the browser via SocketIO

**Layer 2 — Browser Frontend (client-side)**
- face-api.js runs TinyFaceDetector + 68-point landmark model directly in the browser
- Detects no-face, multi-face, head turns, and gaze deviation
- Monitors tab switches, fullscreen exits, and keyboard shortcuts
- Both layers sync violations to the same trust score

---

## 📊 Trust Score System

The exam starts at **100% trust**. Each violation deducts points:

| Violation | Severity | Deduction |
|---|---|---|
| Tab switch / window hidden | High | −10 |
| No face detected (3+ sec) | High | −10 |
| Multiple faces | Critical | −20 |
| Head turned away | Medium | −5 |
| Gaze away (2.5+ sec) | Medium | −5 |
| Noise detected | Medium | −5 |
| Keyboard shortcut blocked | Low | −2 |

- Trust < 70% → **FLAGGED**
- Trust < 40% → **SUSPICIOUS**
- Trust < 30% → **Auto-terminated**

---

## 🛠️ Tech Stack

- **Backend:** Python 3.9+, Flask, Flask-SocketIO, OpenCV, MediaPipe, PyAudio, NumPy
- **Frontend:** Vanilla JS, face-api.js (@vladmandic build), Web Audio API, Fullscreen API
- **Styling:** Custom CSS (cyberpunk dark theme, IBM Plex Mono, Space Grotesk)
- **Logging:** JSON + CSV via Python's built-in `csv` and `json` modules

---

## 🔮 Future Improvements

- [ ] Deploy to cloud (Render / Railway) for remote access
- [ ] Admin dashboard to review all session logs
- [ ] Question bank database (SQLite / PostgreSQL)
- [ ] Custom question upload (CSV import)
- [ ] LTI integration for Moodle / Canvas
- [ ] Email report to examiner on submission
- [ ] Mobile-responsive layout

---

## 👩‍💻 Author

Built by **Nandini** as a college project exploring AI-based exam integrity systems.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
