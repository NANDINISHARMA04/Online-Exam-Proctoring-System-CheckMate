# modules/logger.py
# ══════════════════════════════════════════════════════════════════
#  VIOLATION LOGGER
#  Writes incidents to JSON + CSV, tracks warning counts, screenshots
# ══════════════════════════════════════════════════════════════════

import json
import csv
import os
import time
from datetime import datetime

class ViolationLogger:
    """
    Persists all proctoring violations to disk and keeps an in-memory
    list for the live dashboard.
    """

    SEVERITY_WEIGHT = {"low": 1, "medium": 2, "high": 3}

    def __init__(self, logs_dir="logs", screenshots_dir="screenshots"):
        self.logs_dir        = logs_dir
        self.screenshots_dir = screenshots_dir
        os.makedirs(logs_dir, exist_ok=True)
        os.makedirs(screenshots_dir, exist_ok=True)

        # Session-level paths
        session_id      = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.json_path  = os.path.join(logs_dir, f"session_{session_id}.json")
        self.csv_path   = os.path.join(logs_dir, f"session_{session_id}.csv")

        self.violations    = []   # in-memory list
        self.warning_count = 0
        self.session_start = datetime.now().isoformat()
        self.candidate     = ""
        self.exam_id       = ""

        # Init CSV header
        with open(self.csv_path, 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(["timestamp", "type", "severity", "message"])

    # ── Log one violation ─────────────────────────────────────────
    def log(self, vtype: str, severity: str, msg: str, snapshot_path: str = ""):
        ts = datetime.now().strftime("%H:%M:%S")
        entry = {
            "timestamp":     ts,
            "type":          vtype,
            "severity":      severity,
            "msg":           msg,
            "snapshot":      snapshot_path,
        }
        self.violations.append(entry)

        # Append to CSV
        with open(self.csv_path, 'a', newline='') as f:
            csv.writer(f).writerow([ts, vtype, severity, msg])

        # Rewrite full JSON
        self._flush_json()

        # Bump warning counter for medium/high
        if severity in ("medium", "high"):
            self.warning_count += 1

        return entry

    # ── Helpers ───────────────────────────────────────────────────
    def _flush_json(self):
        data = {
            "session_start": self.session_start,
            "candidate":     self.candidate,
            "exam_id":       self.exam_id,
            "violations":    self.violations,
        }
        with open(self.json_path, 'w') as f:
            json.dump(data, f, indent=2)

    def recent(self, n=50):
        """Return the last n violations (newest first)."""
        return list(reversed(self.violations[-n:]))

    def summary(self):
        counts = {}
        for v in self.violations:
            counts[v["type"]] = counts.get(v["type"], 0) + 1
        return counts

    def trust_score(self):
        """
        Compute a 0-100 trust score: starts at 100, penalised per violation.
        """
        penalty = 0
        for v in self.violations:
            penalty += self.SEVERITY_WEIGHT.get(v["severity"], 1) * 2
        return max(0, 100 - penalty)