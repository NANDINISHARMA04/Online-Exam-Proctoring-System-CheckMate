# ProctorAI — Smart Online Exam Proctoring System
> Real-time AI proctoring using OpenCV, MediaPipe, Flask, SocketIO, and face-api.js

---

## 📁 Folder Structure

```
ProctorAI/
│
├── app.py                    ← Flask server + SocketIO entry point
├── requirements.txt          ← Python dependencies
├── README.md                 ← This file
│
├── modules/
│   ├── __init__.py           ← Makes 'modules' a Python package
│   ├── video_monitor.py      ← OpenCV + MediaPipe face/gaze/head detection
│   ├── audio_monitor.py      ← PyAudio microphone noise detection
│   └── logger.py             ← Violation logger (JSON + CSV)
│
├── templates/
│   └── index.html            ← Main HTML (served by Flask)
│
├── static/
│   ├── css/
│   │   └── style.css         ← Cyberpunk dark UI stylesheet
│   └── js/
│       ├── questions.js      ← 10 sample CS exam questions
│       ├── proctor.js        ← Browser-side AI proctoring engine (face-api.js)
│       └── exam.js           ← Exam controller (timer, answers, submit)
│
├── logs/                     ← Auto-created: JSON + CSV violation logs
└── screenshots/              ← Auto-created: snapshots on high violations
```

---

## 🔧 Setup Instructions

### Step 1 — Prerequisites

- **Python 3.9+** (check: `python --version`)
- **pip** (check: `pip --version`)
- **Webcam** connected
- **Microphone** connected (optional but recommended)
- **VS Code** with the Python extension installed

---

### Step 2 — Install Python Dependencies

Open a terminal in the `ProctorAI/` folder and run:

```bash
pip install -r requirements.txt
```

> ⚠️ **PyAudio on Windows** may need a pre-built wheel:
> ```bash
> pip install pipwin
> pipwin install pyaudio
> ```
>
> ⚠️ **PyAudio on Mac (Apple Silicon)**:
> ```bash
> brew install portaudio
> pip install pyaudio
> ```
>
> ⚠️ **Linux** (Ubuntu/Debian):
> ```bash
> sudo apt-get install portaudio19-dev python3-pyaudio
> pip install pyaudio
> ```

---

### Step 3 — Run the Server

```bash
python app.py
```

You should see:

```
═══════════════════════════════════════════════════════
  ProctorAI — Secure Exam Proctoring System
  Open your browser at:  http://localhost:5000
═══════════════════════════════════════════════════════
```

---

### Step 4 — Open in Browser

Navigate to: **http://localhost:5000**

> Use **Chrome** or **Edge** for best camera/microphone compatibility.

---

## 🎯 Features

| Feature | Technology |
|---|---|
| Face Detection | OpenCV + MediaPipe (Python) + face-api.js (Browser) |
| Head Pose Estimation | MediaPipe FaceMesh landmarks |
| Gaze Direction | Facial landmark geometry |
| Sound Detection | PyAudio RMS analysis |
| Tab Switch Detection | JavaScript `visibilitychange` + `blur` events |
| Fullscreen Enforcement | Browser Fullscreen API |
| Violation Logging | JSON + CSV files in `/logs` |
| Screenshot on Violation | OpenCV JPEG capture in `/screenshots` |
| Trust Score | Penalty-based 0-100 score |
| Auto-Terminate | Triggers at trust < 10% or 5 warnings |
| Real-time Dashboard | Flask-SocketIO + live camera feed |
| Download Report | JSON export of full session |

---

## 🔴 Violation Types Detected

- **No face** in frame (sustained 3+ seconds)
- **Multiple faces** in frame
- **Head turned** left / right / up
- **Gaze directed** away from screen (sustained 2.5+ seconds)
- **Loud noise** above threshold
- **Tab switching** / window minimisation
- **Fullscreen exit**
- **Suspicious object** detected (phone heuristic)
- **Right-click** disabled
- **Copy/Paste shortcuts** blocked

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| Camera not found | Check camera index in `video_monitor.py` (default: `0`) |
| PyAudio install fails | See platform-specific instructions above |
| Models not loading | Check internet connection (face-api.js loads from CDN) |
| Port 5000 in use | Change port in `app.py`: `socketio.run(app, port=5001)` |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` again |

---

## 📝 Notes

- The system works in **two layers**:
  1. **Python backend** (OpenCV + MediaPipe) — processes camera frames server-side
  2. **Browser frontend** (face-api.js) — runs AI directly in the browser as backup
- Both layers log violations and sync via **SocketIO**
- Logs are saved to `logs/session_YYYYMMDD_HHMMSS.json` and `.csv`
- Screenshots are saved to `screenshots/` on high-severity violations

---

## 🚀 Quick Start (Summary)

```bash
cd ProctorAI
pip install -r requirements.txt
python app.py
# Open http://localhost:5000 in Chrome
```
