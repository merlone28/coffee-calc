// ===== Timer guidato =====
const LS_TIMER_KEY = 'coffee-timer-coldbrew-v1';
const RING_C = 565.48;
let timer = { type: null, intervalId: null, cbInterval: null, wakeLock: null };

function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
}
function setRing(fraction) {
  $('ringFg').style.strokeDashoffset = RING_C - RING_C * Math.min(1, Math.max(0, fraction));
}
function beep(freq, duration, vol) {
  freq = freq || 880; duration = duration || 150; vol = vol || 0.15;
  try {
    const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = freq; osc.type = 'sine'; gain.gain.value = vol;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000 + 0.02);
  } catch (e) {}
}
function buzz(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }
function lockWake() { try { if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then(l => timer.wakeLock = l).catch(() => {}); } catch (e) {} }
function unlockWake() { if (timer.wakeLock) { timer.wakeLock.release().catch(() => {}); timer.wakeLock = null; } }

function showPanel(id) {
  ['timerGuidedPanel', 'timerManualPanel', 'timerLongformPanel'].forEach(p =>
    $(p).style.display = p === id ? 'flex' : 'none');
}

function openTimer() {
  const key = state.method;
  const m = METHODS[key];
  const v = getVals(key);
  const water = Math.round(v.dose * v.ratio);
  const cfg = mTimerCfg(key, v.dose, water, state.cbMode);
  timer.type = cfg.type;
  const snapRec = activeRecipe(key);
  timer.snapshot = { method: key, methodName: m.name, dose: v.dose, water: water, ratio: v.ratio, temp: m.temp ? v.temp : undefined, cbMode: m.coldbrew ? state.cbMode : undefined, recipe: snapRec ? snapRec.id : undefined, recipeTag: snapRec ? snapRec.chip : undefined };
  $('timerOverlay').classList.add('show');
  $('timerMethodName').textContent = m.name;
  document.body.style.overflow = 'hidden';
  $('timerSaveDiaryGuided').classList.add('hidden');
  $('timerSaveDiaryManual').classList.add('hidden');
  $('timerSaveDiaryLongform').classList.add('hidden');

  if (cfg.type === 'guided') {
    showPanel('timerGuidedPanel');
    timer.steps = cfg.steps; timer.total = cfg.total; timer.currentIdx = -1;
    timer.startTs = Date.now(); timer.pausedElapsed = 0; timer.paused = false;
    $('timerPlayPause').innerHTML = ICON.pause;
    lockWake();
    timer.intervalId = setInterval(tickGuided, 200);
    tickGuided();
  } else if (cfg.type === 'manual') {
    showPanel('timerManualPanel');
    timer.steps = cfg.steps; timer.currentIdx = 0;
    timer.startTs = Date.now(); timer.pausedElapsed = 0;
    lockWake();
    renderManualStep();
    timer.intervalId = setInterval(tickManual, 500);
    tickManual();
  } else if (cfg.type === 'longform') {
    showPanel('timerLongformPanel');
    timer.hours = cfg.hours; timer.dose = cfg.dose; timer.water = cfg.water;
    const saved = loadColdbrewTimer();
    if (saved) {
      showLongformActive(saved);
    } else {
      $('timerLongformIdle').classList.remove('hidden');
      $('timerLongformActive').classList.add('hidden');
      $('timerLongformInfo').textContent = t('longformInfo')(cfg.hours);
    }
  }
}

function closeTimer() {
  $('timerOverlay').classList.remove('show');
  document.body.style.overflow = '';
  if (timer.intervalId) { clearInterval(timer.intervalId); timer.intervalId = null; }
  if (timer.cbInterval) { clearInterval(timer.cbInterval); timer.cbInterval = null; }
  unlockWake();
}

// --- Guidato (pour-over / AeroPress / Switch) ---
function guidedElapsed() {
  return (timer.paused ? 0 : (Date.now() - timer.startTs) / 1000) + timer.pausedElapsed;
}
function tickGuided() {
  const elapsed = guidedElapsed();
  const remaining = timer.total - elapsed;
  $('timerTime').textContent = fmtTime(Math.max(0, remaining));
  setRing(elapsed / timer.total);
  let idx = 0;
  for (let i = 0; i < timer.steps.length; i++) { if (elapsed >= timer.steps[i].at) idx = i; }
  if (idx !== timer.currentIdx) {
    timer.currentIdx = idx; beep(880, 150); buzz(120); renderGuidedStep();
    if (document.hidden) notifyUser('⏱️ ' + timer.steps[idx].title, timer.steps[idx].detail);
  }
  if (elapsed >= timer.total) finishGuided();
}
function renderGuidedStep() {
  const s = timer.steps[timer.currentIdx];
  $('timerStepTitle').textContent = s.title;
  $('timerStepDetail').textContent = s.detail;
  const nxt = timer.steps[timer.currentIdx + 1];
  $('timerNext').textContent = nxt ? `${t('timerNextPrefix')} ${nxt.title} ${t('timerNextAt')} ${fmtTime(nxt.at)}` : t('timerLastStep');
}
function finishGuided() {
  if (timer.intervalId) { clearInterval(timer.intervalId); timer.intervalId = null; }
  $('timerTime').textContent = '0:00'; setRing(1);
  $('timerStepTitle').textContent = t('timerDone');
  $('timerStepDetail').textContent = t('timerExtractionDone');
  $('timerNext').textContent = '';
  $('timerSaveDiaryGuided').classList.remove('hidden');
  beep(1200, 120); setTimeout(() => beep(1200, 120), 180); setTimeout(() => beep(1200, 220), 360);
  buzz([150, 80, 150, 80, 300]);
  notifyUser(t('notifExtractionTitle'), t('notifExtractionBody')(timer.snapshot ? timer.snapshot.methodName : t('yourCoffee')));
  unlockWake();
}
$('timerPlayPause').addEventListener('click', () => {
  if (timer.type !== 'guided') return;
  if (timer.paused) {
    timer.paused = false; timer.startTs = Date.now();
    timer.intervalId = setInterval(tickGuided, 200);
    $('timerPlayPause').innerHTML = ICON.pause;
  } else {
    timer.pausedElapsed = guidedElapsed(); timer.paused = true;
    if (timer.intervalId) { clearInterval(timer.intervalId); timer.intervalId = null; }
    $('timerPlayPause').innerHTML = ICON.play;
  }
});
$('timerRestart').addEventListener('click', () => {
  if (timer.type !== 'guided') return;
  timer.startTs = Date.now(); timer.pausedElapsed = 0; timer.paused = false; timer.currentIdx = -1;
  $('timerPlayPause').innerHTML = ICON.pause;
  if (!timer.intervalId) timer.intervalId = setInterval(tickGuided, 200);
  tickGuided();
});
$('timerSkip').addEventListener('click', () => {
  if (timer.type !== 'guided') return;
  const nextIdx = timer.currentIdx + 1;
  const targetAt = nextIdx < timer.steps.length ? timer.steps[nextIdx].at : timer.total;
  timer.pausedElapsed = targetAt; timer.startTs = Date.now();
  tickGuided();
});

// --- Manuale (moka: cronometro + step a mano) ---
function tickManual() {
  const elapsed = (Date.now() - timer.startTs) / 1000 + timer.pausedElapsed;
  $('timerManualTime').textContent = fmtTime(elapsed);
}
function renderManualStep() {
  $('timerManualTitle').textContent = timer.steps[timer.currentIdx];
  $('timerManualCount').textContent = `${t('manualStepPrefix')} ${timer.currentIdx + 1} ${t('manualStepOf')} ${timer.steps.length}`;
  $('timerPrevStep').disabled = timer.currentIdx === 0;
  $('timerNextStep').innerHTML = timer.currentIdx === timer.steps.length - 1 ? ICON.check : ICON.next;
  $('timerNextStep').classList.remove('hidden');
  $('timerSaveDiaryManual').classList.add('hidden');
}
$('timerPrevStep').addEventListener('click', () => {
  if (timer.type !== 'manual' || timer.currentIdx <= 0) return;
  timer.currentIdx--; renderManualStep();
});
$('timerNextStep').addEventListener('click', () => {
  if (timer.type !== 'manual') return;
  if (timer.currentIdx < timer.steps.length - 1) { timer.currentIdx++; buzz(100); renderManualStep(); }
  else {
    beep(1200, 150); buzz([150, 80, 200]);
    $('timerManualTitle').textContent = t('timerDone');
    $('timerManualCount').textContent = t('manualDone');
    $('timerNextStep').classList.add('hidden');
    $('timerSaveDiaryManual').classList.remove('hidden');
    notifyUser(t('notifMokaTitle'), t('notifMokaBody'));
  }
});

// --- Longform (cold brew) ---
function loadColdbrewTimer() {
  try { const s = JSON.parse(localStorage.getItem(LS_TIMER_KEY)); if (s && s.end > 0) return s; } catch (e) {}
  return null;
}
function saveColdbrewTimer(s) { try { localStorage.setItem(LS_TIMER_KEY, JSON.stringify(s)); } catch (e) {} }
function clearColdbrewTimer() { try { localStorage.removeItem(LS_TIMER_KEY); } catch (e) {} }
function showLongformActive(s) {
  $('timerLongformIdle').classList.add('hidden');
  $('timerLongformActive').classList.remove('hidden');
  $('timerSaveDiaryLongform').classList.remove('hidden');
  const endStr = new Date(s.end).toLocaleString(t('localeCode'), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  function tickLong() {
    const rem = s.end - Date.now();
    if (rem <= 0) {
      $('timerLongformRemaining').textContent = t('longformReady');
      $('timerLongformEndInfo').textContent = t('longformReadyInfo');
      if (timer.cbInterval) { clearInterval(timer.cbInterval); timer.cbInterval = null; }
      beep(1200, 150); setTimeout(() => beep(1200, 200), 200);
      buzz([200, 100, 200, 100, 400]);
      notifyUser(t('notifColdbrewTitle'), t('notifColdbrewBody'));
      return;
    }
    const h = Math.floor(rem / 3600000), mnt = Math.floor((rem % 3600000) / 60000);
    $('timerLongformRemaining').textContent = `${h}h ${mnt}m`;
    $('timerLongformEndInfo').textContent = `${t('longformReadyAt')} ${endStr}`;
  }
  tickLong();
  timer.cbInterval = setInterval(tickLong, 30000);
}
$('timerLongformStart').addEventListener('click', () => {
  const start = Date.now(), end = start + timer.hours * 3600 * 1000;
  const s = { start, end, hours: timer.hours, dose: timer.dose, water: timer.water };
  saveColdbrewTimer(s);
  showLongformActive(s);
});
$('timerLongformReset').addEventListener('click', () => {
  clearColdbrewTimer();
  if (timer.cbInterval) { clearInterval(timer.cbInterval); timer.cbInterval = null; }
  $('timerLongformIdle').classList.remove('hidden');
  $('timerLongformActive').classList.add('hidden');
});

$('openTimerBtn').addEventListener('click', openTimer);
$('timerClose').addEventListener('click', closeTimer);
