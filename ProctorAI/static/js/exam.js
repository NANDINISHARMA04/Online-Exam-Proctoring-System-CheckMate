// static/js/exam.js  ── v4.0 (Multi-field + Auto-advance)
// ══════════════════════════════════════════════════════════════════
//  EXAM CONTROLLER — wires UI ↔ Proctor engine (proctor.js)
//  v4 additions:
//    • Rebuilds QUESTIONS from QUESTION_BANK on every exam start
//    • Auto-advance to next question 1.2 s after an answer is chosen
//    • Shows category badge on each question card
//    • Populates subject dropdown from EXAM_SUBJECTS
// ══════════════════════════════════════════════════════════════════

// ── Exam State ─────────────────────────────────────────────────────
const ExamState = {
  candidate: '', examId: '', subject: '', durationSecs: 1800,
  currentQ: 0, answers: {}, timerInterval: null,
  remainingSecs: 0, startTimestamp: null, submitted: false,
  tabSwitches: 0,
  autoAdvanceTimer: null,   // NEW: handle for the 1.2-s auto-advance
};

// ── Utility ────────────────────────────────────────────────────────
const $$ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = $$(id);
  if (sc) sc.classList.add('active');
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ══════════════════════════════════════════════════════════════════
//  PAGE LOAD
// ══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  Proctor.init();
  checkPermissions();
  _populateSubjectDropdown();  // NEW: fill dropdown from EXAM_SUBJECTS
});

// ── Populate subject <select> from questions.js EXAM_SUBJECTS ─────
function _populateSubjectDropdown() {
  const sel = $$('inp-subject');
  if (!sel || typeof EXAM_SUBJECTS === 'undefined') return;
  sel.innerHTML = '';
  EXAM_SUBJECTS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

// ── Light permission pre-check ─────────────────────────────────────
async function checkPermissions() {
  if (navigator.permissions) {
    try {
      const cam = await navigator.permissions.query({ name: 'camera' });
      if (cam.state === 'granted') markPerm('perm-camera', true);
      const mic = await navigator.permissions.query({ name: 'microphone' });
      if (mic.state === 'granted') markPerm('perm-mic', true);
    } catch (_) {}
  }
  if (document.fullscreenEnabled) markPerm('perm-screen', true);
}

function markPerm(id, ok) {
  const el = $$(id);
  if (!el) return;
  el.classList.add(ok ? 'ok' : 'fail');
  el.querySelector('.perm-icon').textContent = ok ? '✓' : '✗';
}

// ══════════════════════════════════════════════════════════════════
//  START EXAM
// ══════════════════════════════════════════════════════════════════
async function startExam() {
  const name = $$('inp-name').value.trim();
  if (!name) {
    $$('inp-name').style.borderColor = '#ff3355';
    $$('inp-name').focus();
    return;
  }
  $$('inp-name').style.borderColor = '';

  ExamState.candidate      = name;
  ExamState.examId         = $$('inp-examid').value  || 'EX-2024-001';
  ExamState.subject        = $$('inp-subject').value || 'Mixed';
  ExamState.durationSecs   = parseInt($$('inp-duration').value || '30') * 60;
  ExamState.remainingSecs  = ExamState.durationSecs;
  ExamState.startTimestamp = Date.now();
  ExamState.answers        = {};
  ExamState.currentQ       = 0;
  ExamState.submitted      = false;
  ExamState.tabSwitches    = 0;
  ExamState.autoAdvanceTimer = null;

  // ── NEW: Rebuild QUESTIONS for this exam session ──────────────
  if (typeof buildExamQuestions !== 'undefined') {
    // How many questions?  Use duration as a rough guide (1 q per 2 min, min 5, max 20)
    const questionCount = Math.min(20, Math.max(5, Math.floor(ExamState.durationSecs / 120)));
    window.QUESTIONS = buildExamQuestions(ExamState.subject, questionCount);
  }

  const btn = $$('btn-start');
  btn.disabled = true;
  btn.innerHTML = '<span>Initialising…</span>';

  showScreen('screen-exam');
  $$('hdr-subject').textContent = ExamState.subject;
  $$('hdr-examid').textContent  = ExamState.examId;

  renderQuestion();
  renderDots();
  startTimer();

  const videoEl = $$('cam-video');
  if (videoEl) await Proctor.start(videoEl);

  document.documentElement.requestFullscreen().catch(() => markPerm('perm-screen', false));
  document.addEventListener('visibilitychange', _onTabSwitch);
}

// ── Tab switch counter ────────────────────────────────────────────
function _onTabSwitch() {
  if (document.hidden && !ExamState.submitted) {
    ExamState.tabSwitches++;
    const el = $$('stat-tabs');
    if (el) el.textContent = ExamState.tabSwitches;
  }
}

// ══════════════════════════════════════════════════════════════════
//  TIMER
// ══════════════════════════════════════════════════════════════════
function startTimer() {
  updateTimerDisplay();
  ExamState.timerInterval = setInterval(() => {
    ExamState.remainingSecs--;
    updateTimerDisplay();

    const trust = Proctor.getTrustScore();
    const ts = $$('trust-score');
    if (ts) {
      ts.textContent = Math.round(trust);
      ts.className = 'trust-score' +
        (trust < 40 ? ' low' : trust < 70 ? ' medium' : '');
    }

    if (Proctor.isTerminated() && !ExamState.submitted) {
      clearInterval(ExamState.timerInterval);
      return;
    }

    if (ExamState.remainingSecs <= 0) {
      clearInterval(ExamState.timerInterval);
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = $$('timer-display');
  if (!el) return;
  el.textContent = fmtTime(ExamState.remainingSecs);
  const pct = ExamState.remainingSecs / ExamState.durationSecs;
  el.className = 'timer-display' +
    (pct < 0.1 ? ' danger' : pct < 0.25 ? ' warning' : '');
}

// ══════════════════════════════════════════════════════════════════
//  QUESTIONS
// ══════════════════════════════════════════════════════════════════

// ── Field → colour mapping for category badges ────────────────────
const FIELD_COLOURS = {
  "Computer Science": "#00d4ff",
  "Mathematics":      "#ff9f00",
  "General Knowledge":"#a78bfa",
  "Science":          "#34d399",
  "English":          "#f472b6",
  "Logical Reasoning":"#fb923c",
  "Current Affairs":  "#60a5fa",
  "Mixed":            "#94a3b8",
};

function _fieldFromId(qid) {
  // qid strings like "cs3", "ma2", "gk1", "sc4", "en5", "lr6", "ca7"
  // After rebuild, id is a number — fall back to original string id on q object.
  // We store originalId in buildExamQuestions; if not available, return "".
  if (typeof qid === 'string') {
    const prefix = qid.match(/^([a-z]+)/)?.[1];
    const map = { cs:"Computer Science", ma:"Mathematics", gk:"General Knowledge",
                  sc:"Science", en:"English", lr:"Logical Reasoning", ca:"Current Affairs" };
    return map[prefix] || "";
  }
  return "";
}

function renderQuestion() {
  const q       = QUESTIONS[ExamState.currentQ];
  const letters = ['A', 'B', 'C', 'D'];
  const isAnswered  = ExamState.answers[q.id] !== undefined;
  const isAutoAdv   = ExamState.autoAdvanceTimer !== null;

  // Category badge
  const field = q._field || "";
  const badgeColour = FIELD_COLOURS[field] || "#94a3b8";
  const badge = field
    ? `<span class="q-field-badge" style="background:${badgeColour}22;color:${badgeColour};border:1px solid ${badgeColour}66;">${field}</span>`
    : '';

  // Auto-advance countdown hint
  const autoHint = isAnswered && ExamState.currentQ < QUESTIONS.length - 1
    ? `<div class="q-auto-hint">Moving to next question…</div>`
    : '';

  $$('question-container').innerHTML = `
    <div class="question-block">
      <div class="q-num">
        Question ${ExamState.currentQ + 1} <span>/ ${QUESTIONS.length}</span>
        ${badge}
      </div>
      <div class="q-text">${q.text}</div>
      <ul class="options-list">
        ${q.options.map((opt, i) => {
          const sel   = ExamState.answers[q.id] === i;
          const right = isAnswered && i === q.correct;  // never reveal during exam — keep blank; only show tick
          return `
          <li class="option-item ${sel ? 'selected' : ''} ${isAnswered && !sel ? 'dimmed' : ''}"
              onclick="selectOption(${i})" ${isAnswered ? 'style="pointer-events:none"' : ''}>
            <span class="opt-letter">${letters[i]}</span>
            <span class="opt-text">${opt}</span>
            ${sel ? '<span class="opt-check">✓</span>' : ''}
          </li>`;
        }).join('')}
      </ul>
      ${autoHint}
    </div>`;

  const answered = Object.keys(ExamState.answers).length;
  const fill = $$('q-progress-fill');
  if (fill) fill.style.width = (answered / QUESTIONS.length * 100) + '%';

  $$('btn-prev').disabled = ExamState.currentQ === 0;
  $$('btn-next').style.display = ExamState.currentQ < QUESTIONS.length - 1 ? '' : 'none';
  $$('submit-row').classList.toggle('hidden', ExamState.currentQ < QUESTIONS.length - 1);
  renderDots();
}

function renderDots() {
  const dots = $$('q-dots');
  if (!dots) return;
  dots.innerHTML = QUESTIONS.map((q, i) => `
    <div class="q-dot ${i === ExamState.currentQ ? 'active' : ''} ${ExamState.answers[q.id] !== undefined ? 'answered' : ''}"
         onclick="goToQuestion(${i})" title="Q${i + 1}"></div>`).join('');
}

// ── Select an option — then auto-advance after 1.2 s ─────────────
function selectOption(idx) {
  const q = QUESTIONS[ExamState.currentQ];
  if (ExamState.answers[q.id] !== undefined) return; // already answered
  ExamState.answers[q.id] = idx;
  renderQuestion();

  // Clear any previous timer
  if (ExamState.autoAdvanceTimer) clearTimeout(ExamState.autoAdvanceTimer);

  // Auto-advance to next if not last question
  if (ExamState.currentQ < QUESTIONS.length - 1) {
    ExamState.autoAdvanceTimer = setTimeout(() => {
      ExamState.autoAdvanceTimer = null;
      nextQuestion();
    }, 1200);
  } else {
    ExamState.autoAdvanceTimer = null;
  }
}

function nextQuestion() {
  if (ExamState.currentQ < QUESTIONS.length - 1) {
    if (ExamState.autoAdvanceTimer) { clearTimeout(ExamState.autoAdvanceTimer); ExamState.autoAdvanceTimer = null; }
    ExamState.currentQ++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (ExamState.currentQ > 0) {
    if (ExamState.autoAdvanceTimer) { clearTimeout(ExamState.autoAdvanceTimer); ExamState.autoAdvanceTimer = null; }
    ExamState.currentQ--;
    renderQuestion();
  }
}

function goToQuestion(idx) {
  if (ExamState.autoAdvanceTimer) { clearTimeout(ExamState.autoAdvanceTimer); ExamState.autoAdvanceTimer = null; }
  ExamState.currentQ = idx;
  renderQuestion();
}

// ══════════════════════════════════════════════════════════════════
//  SUBMIT
// ══════════════════════════════════════════════════════════════════
async function submitExam(timeUp = false) {
  if (ExamState.submitted) return;
  ExamState.submitted = true;
  clearInterval(ExamState.timerInterval);
  if (ExamState.autoAdvanceTimer) { clearTimeout(ExamState.autoAdvanceTimer); ExamState.autoAdvanceTimer = null; }
  document.removeEventListener('visibilitychange', _onTabSwitch);

  Proctor.stop();

  let correct = 0;
  QUESTIONS.forEach(q => { if (ExamState.answers[q.id] === q.correct) correct++; });
  const score = Math.round((correct / QUESTIONS.length) * 100);

  const trustScore   = Proctor.getTrustScore();
  const proctorStats = Proctor.getStats();
  const violations   = Proctor.getViolations();
  const warnings     = Proctor.getWarningCount();
  const timeTaken    = Math.floor((Date.now() - ExamState.startTimestamp) / 1000);

  let status = 'CLEAN';
  if (trustScore < 40 || warnings > 8) status = 'SUSPICIOUS';
  else if (trustScore < 70 || warnings > 3) status = 'FLAGGED';

  $$('res-candidate').textContent  = `${ExamState.candidate} · ${ExamState.examId} · ${ExamState.subject}`;
  $$('res-score').textContent      = score;
  $$('res-trust').textContent      = Math.round(trustScore);
  $$('res-correct') && ($$('res-correct').textContent = `${correct} / ${QUESTIONS.length}`);
  $$('res-status').textContent     = status;
  $$('res-status').className       = 'res-status ' + status;
  $$('rstat-tabs').textContent     = ExamState.tabSwitches;
  $$('rstat-time').textContent     = fmtTime(timeTaken);
  $$('rstat-answered').textContent = `${Object.keys(ExamState.answers).length} / ${QUESTIONS.length}`;

  const rLooks = $$('rstat-looks'); if (rLooks) rLooks.textContent = proctorStats.lookAways;
  const rNoise = $$('rstat-noise'); if (rNoise) rNoise.textContent = proctorStats.noiseEvents;
  const rVio   = $$('rstat-vio');  if (rVio)   rVio.textContent   = violations.length;
  const rWarn  = $$('rstat-warns');if (rWarn)  rWarn.textContent  = warnings;

  if (timeUp) {
    const b = $$('res-timeup-banner');
    if (b) b.classList.remove('hidden');
  }

  const list = $$('res-incidents');
  if (list) {
    if (violations.length === 0) {
      list.innerHTML = '<li class="clean-entry">No violations recorded — exam completed cleanly. ✓</li>';
    } else {
      list.innerHTML = violations.slice(-30).reverse().map(v =>
        `<li class="${v.severity || 'low'}"><span class="inc-time">${v.ts}</span> ${v.msg}</li>`
      ).join('');
    }
  }

  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  showScreen('screen-results');
}

// ══════════════════════════════════════════════════════════════════
//  DISMISSAL / WARNING from Proctor modal
// ══════════════════════════════════════════════════════════════════
function dismissWarning() {
  Proctor.dismissWarning();
}

// ══════════════════════════════════════════════════════════════════
//  NEW EXAM — clean reset
// ══════════════════════════════════════════════════════════════════
function startNewExam() {
  ['perm-camera', 'perm-mic', 'perm-screen', 'perm-ai'].forEach(id => {
    const el = $$(id);
    if (el) {
      el.classList.remove('ok', 'fail');
      el.querySelector('.perm-icon').textContent = '◎';
    }
  });

  const btn = $$('btn-start');
  if (btn) { btn.disabled = false; btn.innerHTML = '<span>Initialize Proctoring</span><span class="btn-arrow">→</span>'; }

  const nameEl = $$('inp-name');
  if (nameEl) nameEl.value = '';

  Proctor.init();
  checkPermissions();
  showScreen('screen-setup');
}