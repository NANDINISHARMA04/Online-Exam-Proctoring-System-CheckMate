// static/js/proctor.js  ── ProctorAI Engine v3.1 (fixed)
// ══════════════════════════════════════════════════════════════════
//  Features: Face, Gaze, Sound, Head, Tab, Fullscreen, Auto-Terminate
//  Fixes: state properly resets on re-use; terminateExam triggers
//         submitExam; gaze badge class corrected; stop() is idempotent
// ══════════════════════════════════════════════════════════════════

const Proctor = (() => {

  // ── State ──────────────────────────────────────────────────────
  let state = makeState();

  function makeState() {
    return {
      active: false,
      faceDetectionInterval: null,
      audioContext: null,
      analyser: null,
      audioStream: null,
      videoStream: null,
      trustScore: 100,
      violations: [],
      warningCount: 0,
      stats: {
        tabs: 0,
        lookAways: 0,
        noiseEvents: 0,
        noFaceEvents: 0,
        headMoveEvents: 0,
        keyBlocks: 0,
        fullscreenExits: 0,
      },
      modelsLoaded: false,
      warningQueue: [],
      warningActive: false,
      lastGazeState: 'center',
      gazeAwayStart: null,
      noFaceStart: null,
      consecutiveNoFace: 0,
      headMoveBuffer: [],
      lastHeadPos: null,
      terminated: false,
      startTime: null,
    };
  }

  // ── Constants ──────────────────────────────────────────────────
  const FACE_DETECT_INTERVAL = 800;
  const SOUND_THRESHOLD_DB   = -33;
  const GAZE_AWAY_LIMIT_MS   = 2500;
  const NO_FACE_LIMIT_MS     = 3000;
  const HEAD_MOVE_THRESHOLD  = 20;
  const MAX_WARNINGS         = 5;
  const TRUST_DEDUCT         = { low: 2, medium: 5, high: 10, critical: 20 };
  const AUTO_TERM_TRUST      = 30;

  // ── DOM refs ───────────────────────────────────────────────────
  const $  = id => document.getElementById(id);

  // ── These IDs match the actual HTML elements ───────────────────
  const $vid       = () => $('cam-video');
  const $canvas    = () => $('face-canvas');
  const $faceBadge = () => $('face-status');   // HTML id="face-status"
  const $gazeBadge = () => $('gaze-status');   // HTML id="gaze-status"
  const $soundBar  = () => $('sound-bar');
  const $soundVal  = () => $('sound-val');
  const $headBar   = () => $('head-bar');
  const $headVal   = () => $('head-val');
  const $gazeBar   = () => $('gaze-bar');
  const $gazeVal   = () => $('gaze-val');
  const $vioList   = () => $('vio-list');
  const $vioCount  = () => $('vio-count');
  const $trustEl   = () => $('trust-score');
  const $alertBadge= () => $('alert-badge');
  const $statTabs  = () => $('stat-tabs');
  const $statLooks = () => $('stat-lookaways');
  const $statNoise = () => $('stat-noise');
  const $flash     = () => $('violation-flash');
  const $modal     = () => $('warning-modal');
  const $modalTitle= () => $('modal-title');
  const $modalMsg  = () => $('modal-msg');
  const $modalCount= () => $('modal-warning-count');
  const $warnBar   = () => $('warn-progress-bar');

  // ══════════════════════════════════════════════════════════════
  //  INIT — Load AI Models (idempotent)
  // ══════════════════════════════════════════════════════════════
  async function init() {
    if (state.modelsLoaded) {
      // Already loaded — just mark the badge
      _markAIReady(true);
      return;
    }
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      ]);
      state.modelsLoaded = true;
      _markAIReady(true);
      console.log('[ProctorAI] AI models loaded ✓');
    } catch (e) {
      console.warn('[ProctorAI] Face-API fallback mode (CDN unreachable?)', e);
      state.modelsLoaded = false;
      _markAIReady(false);
    }
  }

  function _markAIReady(ok) {
    const el = $('perm-ai');
    if (!el) return;
    el.classList.toggle('ok', ok);
    el.classList.toggle('fail', !ok);
    el.querySelector('.perm-icon').textContent = ok ? '✓' : '✗';
  }

  // ══════════════════════════════════════════════════════════════
  //  START  (called after exam screen is shown so DOM elements exist)
  // ══════════════════════════════════════════════════════════════
  async function start(videoEl) {
    // Reset state for new session (preserves modelsLoaded flag)
    const wasLoaded = state.modelsLoaded;
    state = makeState();
    state.modelsLoaded = wasLoaded;

    state.active    = true;
    state.startTime = Date.now();

    // Cooldown flags (module-level so they survive state reset)
    noiseCooldown   = false;
    gazeCooldown    = false;
    tabCooldown     = false;
    blurCooldown    = false;
    fbNoFaceCount   = 0;

    // ── Camera ────────────────────────────────────────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      videoEl.srcObject = stream;
      state.videoStream = stream;
      videoEl.onloadedmetadata = () => videoEl.play();
      _markPerm('perm-camera', true);
    } catch (e) {
      console.error('[ProctorAI] Camera error:', e);
      _markPerm('perm-camera', false);
      logViolation('Camera access denied or unavailable', 'high');
    }

    // ── Microphone ─────────────────────────────────────────────
    await initAudio();

    // ── Detection loops ────────────────────────────────────────
    state.faceDetectionInterval = setInterval(() => detectFace(videoEl), FACE_DETECT_INTERVAL);
    requestAnimationFrame(audioLoop);

    // ── Global event listeners ─────────────────────────────────
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
  }

  function _markPerm(id, ok) {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('ok', ok);
    el.classList.toggle('fail', !ok);
    el.querySelector('.perm-icon').textContent = ok ? '✓' : '✗';
  }

  // ══════════════════════════════════════════════════════════════
  //  AUDIO ENGINE
  // ══════════════════════════════════════════════════════════════
  async function initAudio() {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = state.audioContext.createMediaStreamSource(micStream);
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 512;
      state.analyser.smoothingTimeConstant = 0.75;
      source.connect(state.analyser);
      state.audioStream = micStream;
      _markPerm('perm-mic', true);
    } catch (e) {
      console.warn('[ProctorAI] Microphone unavailable:', e);
      _markPerm('perm-mic', false);
    }
  }

  let noiseCooldown = false;

  function audioLoop() {
    if (!state.active || state.terminated) return;
    if (state.analyser) {
      const buf = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      const db  = avg === 0 ? -100 : (20 * Math.log10(avg / 255));
      const pct = Math.max(0, Math.min(100, ((db + 80) / 80) * 100));

      const sb = $soundBar();
      if (sb) { sb.style.width = pct + '%'; }
      const sv = $soundVal();
      if (sv) sv.textContent = db < -80 ? 'Silent' : Math.round(db) + ' dB';

      if (sb) {
        if (db > SOUND_THRESHOLD_DB) sb.style.background = '#ff3355';
        else if (db > -50)           sb.style.background = '#ffcc00';
        else                         sb.style.background = '';
      }

      if (db > SOUND_THRESHOLD_DB && !noiseCooldown) {
        noiseCooldown = true;
        state.stats.noiseEvents++;
        updateStats();
        logViolation(`🔊 Noise detected (${Math.round(db)} dB)`, 'medium');
        deductTrust(TRUST_DEDUCT.medium);
        showWarning('🔊 Noise Detected',
          `Loud sound detected (${Math.round(db)} dB). Please ensure a quiet environment.`,
          false);
        setTimeout(() => { noiseCooldown = false; }, 6000);
      }
    }
    requestAnimationFrame(audioLoop);
  }

  // ══════════════════════════════════════════════════════════════
  //  FACE + GAZE DETECTION
  // ══════════════════════════════════════════════════════════════
  async function detectFace(videoEl) {
    if (!state.active || state.terminated) return;
    if (!videoEl || videoEl.readyState < 2) return;

    const canvas = $canvas();
    if (!canvas) return;

    canvas.width  = videoEl.videoWidth  || videoEl.offsetWidth  || 320;
    canvas.height = videoEl.videoHeight || videoEl.offsetHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.modelsLoaded && typeof faceapi !== 'undefined') {
      try {
        const detections = await faceapi
          .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks(true);
        handleFaceResults(detections, canvas, ctx, videoEl);
        return;
      } catch (e) { /* fall through to fallback */ }
    }
    fallbackDetect(videoEl, ctx, canvas);
  }

  function handleFaceResults(detections, canvas, ctx, videoEl) {
    const W = canvas.width, H = canvas.height;
    const now = Date.now();

    if (detections.length === 0) {
      state.consecutiveNoFace++;
      if (!state.noFaceStart) state.noFaceStart = now;
      const elapsed = now - state.noFaceStart;
      updateFaceBadge('missing', '⚠ NO FACE');
      drawNoFaceIndicator(ctx, W, H);

      if (elapsed > NO_FACE_LIMIT_MS) {
        state.noFaceStart = now;
        state.stats.noFaceEvents++;
        state.stats.lookAways++;
        updateStats();
        logViolation('👤 Face not detected — candidate may have looked away', 'high');
        deductTrust(TRUST_DEDUCT.high);
        showWarning('👤 Face Not Detected',
          'Your face is not visible in the camera. Please ensure your face is clearly in frame.',
          true);
      }
      return;
    }

    state.consecutiveNoFace = 0;
    state.noFaceStart = null;

    if (detections.length > 1) {
      logViolation(`👥 Multiple faces detected (${detections.length})`, 'critical');
      deductTrust(TRUST_DEDUCT.critical);
      showWarning('👥 Multiple Faces Detected',
        `${detections.length} faces were detected. Only the registered candidate should be present.`,
        true);
    }

    const det       = detections[0];
    const box       = det.detection.box;
    const landmarks = det.landmarks;

    const color = detections.length > 1 ? '#ff3355' : '#00d4ff';
    drawCorners(ctx, box.x, box.y, box.width, box.height, color);
    updateFaceBadge('ok', detections.length > 1 ? '⚠ MULTI-FACE' : '✓ FACE OK');

    // ── Head Movement ──────────────────────────────────────────
    const nose    = landmarks.getNose();
    const noseTip = nose[3];
    const headPos = { x: noseTip.x, y: noseTip.y };

    if (state.lastHeadPos) {
      const dx    = Math.abs(headPos.x - state.lastHeadPos.x);
      const dy    = Math.abs(headPos.y - state.lastHeadPos.y);
      const delta = Math.sqrt(dx * dx + dy * dy);

      state.headMoveBuffer.push(delta);
      if (state.headMoveBuffer.length > 5) state.headMoveBuffer.shift();
      const avgDelta = state.headMoveBuffer.reduce((a, b) => a + b, 0) / state.headMoveBuffer.length;

      const headPct = Math.min(100, (avgDelta / HEAD_MOVE_THRESHOLD) * 100);
      const hb = $headBar(); if (hb) hb.style.width = headPct + '%';
      const hv = $headVal(); if (hv) hv.textContent = Math.round(avgDelta) + 'px';

      if (avgDelta > HEAD_MOVE_THRESHOLD * 2.5) {
        state.stats.headMoveEvents++;
        updateStats();
        logViolation(`🙆 Excessive head movement (Δ${Math.round(avgDelta)}px)`, 'medium');
        deductTrust(TRUST_DEDUCT.medium);
      }
    }
    state.lastHeadPos = headPos;

    // ── Gaze ──────────────────────────────────────────────────
    const leftEye  = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const gazeState = estimateGaze(leftEye, rightEye, box, W);
    updateGazeDisplay(gazeState, W, H, leftEye, rightEye, ctx);
    handleGaze(gazeState, now);
  }

  function estimateGaze(leftEye, rightEye, box, W) {
    const lc         = centroid(leftEye);
    const rc         = centroid(rightEye);
    const eyeCenterX = (lc.x + rc.x) / 2;
    const norm       = (eyeCenterX - box.x) / box.width;

    if (norm < 0.35) return 'left';
    if (norm > 0.65) return 'right';

    const lEyeY      = centroid(leftEye).y;
    const rEyeY      = centroid(rightEye).y;
    const eyeCenterY = (lEyeY + rEyeY) / 2;
    const normY      = (eyeCenterY - box.y) / box.height;
    if (normY < 0.20) return 'up';
    if (normY > 0.55) return 'down';

    return 'center';
  }

  function updateGazeDisplay(gazeState, W, H, leftEye, rightEye, ctx) {
    const gb = $gazeBar(); const gv = $gazeVal(); const gz = $gazeBadge();

    const labels = { center: 'CENTER ✓', left: 'LEFT ◄', right: '► RIGHT', up: '▲ UP', down: '▼ DOWN' };
    const pcts   = { center: 5, left: 85, right: 85, up: 60, down: 60 };

    if (gb) gb.style.width = (pcts[gazeState] || 10) + '%';
    if (gv) gv.textContent = gazeState.toUpperCase();
    if (gz) {
      gz.textContent = 'GAZE: ' + (labels[gazeState] || gazeState.toUpperCase());
      // Use CSS class that exists in stylesheet: 'ok' vs 'away'
      gz.className = 'gaze-badge ' + (gazeState === 'center' ? 'ok' : 'away');
    }

    ctx.fillStyle = gazeState === 'center' ? 'rgba(0,255,136,0.8)' : 'rgba(255,204,0,0.8)';
    const drawEyeDot = eye => {
      const c = centroid(eye);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
    };
    drawEyeDot(leftEye);
    drawEyeDot(rightEye);
  }

  let gazeCooldown = false;
  function handleGaze(gazeState, now) {
    if (gazeState !== 'center') {
      if (!state.gazeAwayStart) state.gazeAwayStart = now;
      const elapsed = now - state.gazeAwayStart;

      if (elapsed > GAZE_AWAY_LIMIT_MS && !gazeCooldown) {
        gazeCooldown = true;
        state.stats.lookAways++;
        updateStats();
        logViolation(`👁 Gaze away — looking ${gazeState} for ${Math.round(elapsed / 1000)}s`, 'medium');
        deductTrust(TRUST_DEDUCT.medium);
        showWarning('👁 Gaze Violation',
          `Your gaze was detected moving ${gazeState} for too long. Please keep your eyes on the screen.`,
          false);
        state.gazeAwayStart = now;
        setTimeout(() => { gazeCooldown = false; }, 5000);
      }
    } else {
      state.gazeAwayStart = null;
    }
    state.lastGazeState = gazeState;
  }

  // ── Fallback: brightness detection ────────────────────────────
  let fbNoFaceCount = 0;
  function fallbackDetect(videoEl, ctx, canvas) {
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, 80, 60).data;
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    brightness /= (data.length / 4);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (brightness < 5) {
      fbNoFaceCount++;
      if (fbNoFaceCount > 4) updateFaceBadge('missing', 'NO CAMERA');
    } else {
      fbNoFaceCount = 0;
      updateFaceBadge('ok', 'CAMERA OK');
      ctx.strokeStyle = 'rgba(0,212,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(canvas.width * .25, canvas.height * .1, canvas.width * .5, canvas.height * .8);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  TAB / WINDOW BLUR / FULLSCREEN
  // ══════════════════════════════════════════════════════════════
  let tabCooldown = false;
  function onVisibilityChange() {
    if (document.hidden && !tabCooldown && state.active && !state.terminated) {
      tabCooldown = true;
      state.stats.tabs++;
      updateStats();
      logViolation('⇆ Tab switch / window hidden detected', 'high');
      deductTrust(TRUST_DEDUCT.high);
      showWarning('⇆ Tab Switch Detected',
        'You switched away from the exam window. This is recorded. Further switches will terminate your exam.',
        true);
      setTimeout(() => { tabCooldown = false; }, 4000);
    }
  }

  let blurCooldown = false;
  function onWindowBlur() {
    if (!blurCooldown && state.active && !state.terminated && !document.hidden) {
      blurCooldown = true;
      state.stats.tabs++;
      updateStats();
      logViolation('⇆ Window lost focus', 'medium');
      deductTrust(TRUST_DEDUCT.medium);
      setTimeout(() => { blurCooldown = false; }, 5000);
    }
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement && state.active && !state.terminated) {
      state.stats.fullscreenExits++;
      logViolation('⛶ Exited fullscreen mode', 'medium');
      deductTrust(TRUST_DEDUCT.medium);
      showWarning('⛶ Fullscreen Exited',
        'You have exited fullscreen mode. Please return to fullscreen to continue.',
        false);
    }
  }

  function onKeyDown(e) {
    const blocked = ['F12', 'F11', 'F5'];
    const blockedCombos = (e.ctrlKey || e.metaKey) &&
      ['c', 'v', 'a', 'u', 'j', 'i', 's', 'p', 'r', 't', 'w'].includes(e.key.toLowerCase());
    if (blocked.includes(e.key) || blockedCombos) {
      e.preventDefault();
      state.stats.keyBlocks++;
      logViolation(`⌨ Blocked shortcut: ${e.ctrlKey ? 'Ctrl+' : e.metaKey ? 'Cmd+' : ''}${e.key}`, 'low');
      deductTrust(TRUST_DEDUCT.low);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  TRUST SCORE
  // ══════════════════════════════════════════════════════════════
  function deductTrust(amount) {
    if (state.terminated) return;
    state.trustScore = Math.max(0, state.trustScore - amount);
    const el = $trustEl();
    if (el) {
      el.textContent = Math.round(state.trustScore);
      el.className = 'trust-score' +
        (state.trustScore < 40 ? ' low' : state.trustScore < 70 ? ' medium' : '');
    }

    if (state.trustScore <= AUTO_TERM_TRUST && !state.terminated) {
      terminateExam('Trust score critically low — exam auto-terminated');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  AUTO-TERMINATE
  // ══════════════════════════════════════════════════════════════
  function terminateExam(reason) {
    if (state.terminated) return;
    state.terminated = true;
    state.active = false;
    logViolation(`🚫 EXAM TERMINATED: ${reason}`, 'critical');
    stop();

    // Show termination modal and wire button to submitExam
    const modal = $modal();
    if (modal) {
      const mt = $modalTitle(); if (mt) mt.textContent = '🚫 Exam Terminated';
      const mm = $modalMsg();
      if (mm) mm.textContent =
        `Your exam has been automatically terminated.\n\nReason: ${reason}\n\nThis incident has been recorded.`;
      const okBtn = modal.querySelector('.btn-modal-ok');
      if (okBtn) {
        okBtn.textContent = 'View Report';
        okBtn.onclick = () => {
          modal.classList.add('hidden');
          // Call exam.js submitExam (defined globally)
          if (typeof submitExam === 'function') submitExam(false);
        };
      }
      modal.classList.remove('hidden');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  VIOLATION LOGGER
  // ══════════════════════════════════════════════════════════════
  function logViolation(msg, severity = 'medium') {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    state.violations.push({ msg, severity, ts });

    const list = $vioList();
    if (list) {
      const li = document.createElement('li');
      li.className = 'vio-item ' + severity;
      li.innerHTML = `<span class="vio-time">${ts}</span><span class="vio-msg">${msg}</span>`;
      list.prepend(li);
      // Keep list trimmed
      while (list.children.length > 25) list.removeChild(list.lastChild);
    }

    const cnt = $vioCount();
    if (cnt) cnt.textContent = state.violations.length;

    triggerFlash(severity);

    const badge = $alertBadge();
    if (badge) {
      badge.classList.remove('hidden');
      clearTimeout(badge._timer);
      badge._timer = setTimeout(() => badge.classList.add('hidden'), 3000);
    }
  }

  function triggerFlash(severity = 'medium') {
    const f = $flash();
    if (!f) return;
    f.className = 'violation-flash ' + severity;
    f.classList.remove('hidden');
    f.style.animation = 'none';
    requestAnimationFrame(() => {
      f.style.animation = '';
      setTimeout(() => f.classList.add('hidden'), 400);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  WARNING MODAL
  // ══════════════════════════════════════════════════════════════
  function showWarning(title, msg, force = false) {
    if (state.terminated) return;
    state.warningQueue.push({ title, msg });
    if (!state.warningActive) processWarningQueue();
  }

  function processWarningQueue() {
    if (state.warningQueue.length === 0) { state.warningActive = false; return; }
    if (state.terminated) return;

    state.warningActive = true;
    state.warningCount++;
    const { title, msg } = state.warningQueue.shift();

    const m = $modal();
    if (!m) return;

    const mt = $modalTitle(); if (mt) mt.textContent = title;
    const mm = $modalMsg();   if (mm) mm.textContent = msg;

    const wc = $modalCount();
    if (wc) {
      wc.textContent = `Warning ${state.warningCount} of ${MAX_WARNINGS}`;
      wc.className = 'modal-warn-count' + (state.warningCount >= MAX_WARNINGS - 1 ? ' danger' : '');
    }

    const wb = $warnBar();
    if (wb) {
      const pct = (state.warningCount / MAX_WARNINGS) * 100;
      wb.style.width = pct + '%';
      wb.style.background = pct >= 80 ? '#ff3355' : pct >= 60 ? '#ffcc00' : '#00d4ff';
    }

    m.classList.remove('hidden', 'terminated');
    m.classList.add('active');

    if (state.warningCount >= MAX_WARNINGS) {
      const okBtn = m.querySelector('.btn-modal-ok');
      if (okBtn) {
        okBtn.textContent = 'View Report';
        okBtn.onclick = () => terminateExam(`Maximum warnings (${MAX_WARNINGS}) reached`);
      }
      setTimeout(() => terminateExam(`Maximum warnings (${MAX_WARNINGS}) reached`), 4000);
    }
  }

  function dismissWarning() {
    const m = $modal();
    if (m) {
      m.classList.add('hidden');
      m.classList.remove('active');
      const okBtn = m.querySelector('.btn-modal-ok');
      if (okBtn) { okBtn.textContent = 'I Understand'; okBtn.onclick = dismissWarning; }
    }
    setTimeout(() => {
      state.warningActive = false;
      processWarningQueue();
    }, 300);
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════
  function updateFaceBadge(cls, text) {
    const el = $faceBadge();
    if (el) { el.className = 'face-badge ' + cls; el.textContent = text; }
  }

  function updateStats() {
    const t  = $statTabs();  if (t)  t.textContent  = state.stats.tabs;
    const l  = $statLooks(); if (l)  l.textContent  = state.stats.lookAways;
    const n  = $statNoise(); if (n)  n.textContent  = state.stats.noiseEvents;
  }

  function centroid(pts) {
    return {
      x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
      y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
    };
  }

  function drawCorners(ctx, x, y, w, h, color) {
    const s = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    [
      [x, y + s, x, y, x + s, y],
      [x + w - s, y, x + w, y, x + w, y + s],
      [x, y + h - s, x, y + h, x + s, y + h],
      [x + w - s, y + h, x + w, y + h, x + w, y + h - s],
    ].forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
    });
  }

  function drawNoFaceIndicator(ctx, W, H) {
    ctx.strokeStyle = 'rgba(255,51,85,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(W * .15, H * .08, W * .7, H * .84);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,51,85,0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(W * .38, H * .32); ctx.lineTo(W * .62, H * .68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * .62, H * .32); ctx.lineTo(W * .38, H * .68); ctx.stroke();
  }

  // ══════════════════════════════════════════════════════════════
  //  STOP / CLEANUP  (idempotent)
  // ══════════════════════════════════════════════════════════════
  function stop() {
    state.active = false;
    clearInterval(state.faceDetectionInterval);
    state.faceDetectionInterval = null;

    if (state.videoStream) {
      state.videoStream.getTracks().forEach(t => t.stop());
      state.videoStream = null;
    }
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(t => t.stop());
      state.audioStream = null;
    }
    if (state.audioContext && state.audioContext.state !== 'closed') {
      state.audioContext.close().catch(() => {});
      state.audioContext = null;
    }

    document.removeEventListener('visibilitychange', onVisibilityChange);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', onWindowBlur);
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    init,
    start,
    stop,
    dismissWarning,
    terminateExam,
    getState:        () => ({ ...state }),
    getTrustScore:   () => state.trustScore,
    getViolations:   () => [...state.violations],
    getStats:        () => ({ ...state.stats }),
    isTerminated:    () => state.terminated,
    getWarningCount: () => state.warningCount,
    getElapsedTime:  () => state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
  };

})();