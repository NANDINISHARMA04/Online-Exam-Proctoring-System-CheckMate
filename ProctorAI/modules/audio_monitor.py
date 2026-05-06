# modules/audio_monitor.py
# ══════════════════════════════════════════════════════════════════
#  AUDIO MONITOR — Sound Level Detection via Microphone
#  Uses PyAudio to sample mic input continuously in a background thread
# ══════════════════════════════════════════════════════════════════

import threading
import time
import math

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    print("[AudioMonitor] PyAudio not found — sound monitoring disabled")

class AudioMonitor:
    """
    Monitors microphone for abnormal sound levels.
    Runs in its own daemon thread so it never blocks the main server.
    """

    CHUNK      = 1024       # frames per buffer read
    FORMAT     = None       # set in __init__ if pyaudio available
    CHANNELS   = 1
    RATE       = 16000      # 16 kHz is enough for level detection
    THRESHOLD  = 1500       # RMS threshold for "noise event"
    CALM_FOR   = 2.0        # seconds of quiet before resetting alert

    def __init__(self):
        self.running       = False
        self.current_rms   = 0
        self.current_db    = 0.0
        self.noise_event   = False       # True when sound exceeds threshold
        self._pa           = None
        self._stream       = None
        self._thread       = None
        self._last_noise_t = 0
        self._available    = PYAUDIO_AVAILABLE

        if PYAUDIO_AVAILABLE:
            self.FORMAT = pyaudio.paInt16

    # ── Start monitoring ──────────────────────────────────────────
    def start(self):
        if not self._available:
            return False
        try:
            self._pa = pyaudio.PyAudio()
            self._stream = self._pa.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                frames_per_buffer=self.CHUNK
            )
            self.running = True
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
            return True
        except Exception as e:
            print(f"[AudioMonitor] start error: {e}")
            self._available = False
            return False

    def stop(self):
        self.running = False
        if self._stream:
            try:
                self._stream.stop_stream()
                self._stream.close()
            except Exception:
                pass
        if self._pa:
            try:
                self._pa.terminate()
            except Exception:
                pass

    # ── Background read loop ──────────────────────────────────────
    def _loop(self):
        """Continuously read mic chunks and compute RMS."""
        import struct
        while self.running:
            try:
                raw = self._stream.read(self.CHUNK, exception_on_overflow=False)
                # Unpack signed 16-bit samples
                count   = len(raw) // 2
                samples = struct.unpack(f'{count}h', raw)
                rms     = math.sqrt(sum(s*s for s in samples) / count)
                self.current_rms = int(rms)

                # Convert to dB (20*log10(rms/32768))
                if rms > 0:
                    self.current_db = round(20 * math.log10(rms / 32768.0) + 90, 1)
                else:
                    self.current_db = 0.0

                # Threshold check
                if rms > self.THRESHOLD:
                    self.noise_event   = True
                    self._last_noise_t = time.time()
                elif time.time() - self._last_noise_t > self.CALM_FOR:
                    self.noise_event = False

            except Exception:
                time.sleep(0.1)

    # ── Properties for the server to read ────────────────────────
    @property
    def available(self):
        return self._available

    def get_state(self):
        return {
            "rms":         self.current_rms,
            "db":          self.current_db,
            "noise_event": self.noise_event,
            "threshold":   self.THRESHOLD,
            "level_pct":   min(100, int(self.current_rms / self.THRESHOLD * 100)),
        }