import './style.css';
import { cycleInputDevice, listInputs, WebAudioEngine, type InputDevice } from './audio.ts';
import { median, sessionMetrics, type Subdivision, type TimingEvent } from './timing.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="pedal" aria-label="Bury the Click bass timing trainer">
    <div class="screw screw-tl"></div><div class="screw screw-tr"></div>
    <div class="screw screw-bl"></div><div class="screw screw-br"></div>
    <div class="input-port"><span class="control-label">INPUT</span><button type="button" class="input-jack" id="input-button" aria-label="Input setup" title="Audio input and calibration"></button></div>

    <div class="display-labels" aria-hidden="true"><span>OFFSET / MS</span><span>CLICK / BPM</span></div>
    <section class="display-window" aria-label="Live practice display">
      <div class="display-main">
        <div class="timing-readout" id="timing-readout" aria-live="polite"><strong id="offset-value">--</strong><span id="offset-label">Waiting for a note</span></div>
        <div class="tempo-numeral"><span id="bpm-readout">80</span></div>
      </div>
      <div class="meter-track" id="meter-track" aria-label="Timing position from early to late"><div class="meter-center"></div><div class="meter-ideal"></div><div class="meter-needle" id="meter-needle"></div><div class="beat-runner" id="beat-runner" aria-hidden="true"></div></div>
      <div class="display-activity"><div class="beat-strip" id="beat-strip" aria-label="Four beat click"><span></span><span></span><span></span><span></span></div><div class="history" id="history" aria-label="Recent notes"></div></div>
      <div class="display-footer"><span id="input-name">Default input</span><span id="status-text" role="status">Ready</span></div>
      <div class="display-stats"><strong id="average-error">--</strong><strong id="lock-value">--</strong><strong id="sens-value">55</strong><strong id="subdivision-value">1/4</strong></div>
    </section>
    <div class="display-legend" aria-hidden="true"><span>AVG MS</span><span>IN POCKET %</span><span>GAIN %</span><span>GRID</span></div>

    <section class="control-row" aria-label="Practice controls">
      <div class="knob-control"><span class="control-label">TEMPO</span><div class="knob" id="tempo-knob" role="slider" tabindex="0" aria-label="Tempo" aria-orientation="horizontal" aria-valuemin="40" aria-valuemax="200" aria-valuenow="80"><span class="knob-indicator"></span></div></div>
      <div class="knob-control"><span class="control-label">INPUT GAIN</span><div class="knob" id="sens-knob" role="slider" tabindex="0" aria-label="Input sensitivity" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="55"><span class="knob-indicator"></span></div></div>
    </section>

    <section class="routing-row" aria-label="Note grid control">
      <div class="routing-group"><div class="lever-selector" data-position="0"><div class="lever-marks" aria-hidden="true"><span>¼</span><span>⅛</span><span>¹⁄₁₆</span></div><div class="lever-hardware" aria-hidden="true"></div><div id="subdivision-switch" role="slider" tabindex="0" aria-label="Note grid" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="2" aria-valuenow="0" aria-valuetext="Quarter notes"></div></div><span class="control-label">NOTE GRID</span></div>
    </section>

    <footer class="pedal-footer"><span class="status-light" id="status-light"></span><button type="button" class="footswitch" id="footswitch" aria-label="Start practice" aria-pressed="false"></button><span class="switch-label">START / STOP</span></footer>
    <header class="brand"><h1>Bury the<br/>Click</h1><span class="model">No. 01</span></header>

    <div class="overlay" id="overlay" hidden><div class="overlay-card" role="dialog" aria-modal="true" aria-labelledby="overlay-title"><button class="close-button" id="close-overlay" aria-label="Close">×</button><h2 id="overlay-title">Input</h2><p class="overlay-copy">Choose the mic or interface you're playing through. Use headphones so the click stays out of the mic.</p><div class="field-heading"><span>Audio source</span><span id="device-note"></span></div><div class="device-picker"><button type="button" id="device-prev" aria-label="Previous audio source">‹</button><span id="device-name">System default input</span><button type="button" id="device-next" aria-label="Next audio source">›</button></div><div class="signal-section"><div class="signal-heading"><span>Input level</span><span id="signal-label">Starts with the pedal</span></div><div class="signal-meter" id="signal-meter" role="progressbar" aria-label="Input level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="signal-fill"></span><i></i></div></div><div class="calibration-block"><div class="calibration-heading"><h3>Timing adjustment</h3><span id="calibration-value">Not set</span></div><p>Play eight notes with the click to account for delay in your input.</p><div class="cal-actions"><button type="button" id="calibrate-button" class="calibrate-button">Calibrate with 8 notes</button><button type="button" id="reset-calibration" class="text-button">Clear</button></div></div></div></div>
    <div class="overlay" id="calibration-overlay" hidden><div class="overlay-card calibration-card" role="dialog" aria-modal="true" aria-labelledby="cal-title"><button class="close-button" id="close-calibration" aria-label="Cancel calibration">×</button><h2 id="cal-title">Play on the click</h2><p class="overlay-copy">One note on each quarter-note click at <strong id="cal-bpm">80 bpm</strong>. Keep playing until all eight notes are heard.</p><div class="calibration-face"><div class="cal-beat" id="cal-beat"><small>Beat</small><strong id="cal-beat-number">1</strong></div><div class="cal-count"><strong id="cal-count">0</strong><span>of 8 notes heard</span></div></div><div class="cal-progress" id="cal-progress" role="progressbar" aria-label="Calibration progress" aria-valuemin="0" aria-valuemax="8" aria-valuenow="0"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="cal-monitor"><span>Input</span><div class="cal-monitor-track"><i id="cal-signal-fill"></i></div></div><p class="cal-hint">Listen to the click. Pluck when it sounds.</p></div></div>
  </main>`;

const element = <T extends HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
const engine = new WebAudioEngine({ onTiming: receiveTiming, onSignal: updateSignal, onError: audioError });
let bpm = 80;
let sensitivity = 55;
let subdivision: Subdivision = 1;
let selectedDevice = '';
let devices: InputDevice[] = [];
let calibration = 0;
let calibrating = false;
let calibrationSamples: number[] = [];
let events: TimingEvent[] = [];
let lastSlot = Number.NEGATIVE_INFINITY;
let lastAudibleSignalAt = 0;
let quietTimer: number | null = null;
let connecting = false;
let beatFrame = 0;
let runnerStep = -1;
const runner = element<HTMLElement>('#beat-runner');
const runnerCells = Array.from({ length: 33 }, () => document.createElement('span'));
runner.append(...runnerCells);

function calibrationKey(): string { return `btc-calibration:${selectedDevice || 'default'}`; }
function calibrationMarker(): string { return `btc-calibrated:${selectedDevice || 'default'}`; }

function loadCalibration(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(calibrationKey());
    if (stored === '0' && localStorage.getItem(calibrationMarker()) !== '1') stored = null;
  } catch { /* Storage may be disabled. */ }
  calibration = stored === null ? 0 : Number(stored) || 0;
  engine.setCalibration(calibration);
  element<HTMLElement>('#calibration-value').textContent = stored === null ? 'Not set' : `${Math.round(calibration)} ms`;
}

function saveCalibration(value: number): void {
  calibration = value;
  engine.setCalibration(value);
  element<HTMLElement>('#calibration-value').textContent = `${Math.round(value)} ms`;
  try {
    localStorage.setItem(calibrationKey(), String(value));
    localStorage.setItem(calibrationMarker(), '1');
  } catch { /* Storage may be disabled. */ }
}

function clearCalibration(): void {
  try { localStorage.removeItem(calibrationKey()); localStorage.removeItem(calibrationMarker()); } catch { /* Storage may be disabled. */ }
  loadCalibration();
}

function setStatus(message: string, state: 'ready' | 'running' | 'warning' = 'ready'): void {
  element<HTMLElement>('#status-text').textContent = message;
  element<HTMLElement>('#status-light').className = `status-light ${state}`;
}

async function refreshDevices(): Promise<void> {
  try {
    devices = (await listInputs()).filter((device) => device.deviceId && device.deviceId !== 'default');
    if (selectedDevice && !devices.some((device) => device.deviceId === selectedDevice)) {
      selectedDevice = '';
      loadCalibration();
      if (engine.running) audioError('Input disconnected. Select an input and start again.');
    }
    const name = selectedDevice ? devices.find((device) => device.deviceId === selectedDevice)?.label || 'System default input' : 'System default input';
    element<HTMLElement>('#input-name').textContent = selectedDevice ? name : 'Default input';
    element<HTMLElement>('#device-name').textContent = name;
    element<HTMLButtonElement>('#device-prev').disabled = devices.length === 0;
    element<HTMLButtonElement>('#device-next').disabled = devices.length === 0;
    const bluetooth = /bluetooth|airpods|wireless/i.test(name);
    element<HTMLElement>('#device-note').textContent = bluetooth ? 'Wireless delay may affect timing' : devices.length ? `${devices.length} available` : 'Permission needed to list inputs';
  } catch { element<HTMLElement>('#device-note').textContent = 'Unable to list audio inputs.'; }
}

function cycleDevice(direction: -1 | 1): void {
  if (!devices.length) return;
  selectedDevice = cycleInputDevice(selectedDevice, devices, direction);
  loadCalibration();
  void refreshDevices();
  if (engine.running) { engine.stop(); updateRunning(false); setStatus('Input changed · tap to start'); }
}

function renderHistory(): void {
  const history = element<HTMLElement>('#history');
  history.replaceChildren();
  const recent = events.slice(-12);
  for (let i = 0; i < 12; i++) {
    const event = recent[i];
    const cell = document.createElement('div');
    cell.className = `history-hit ${event ? (Math.abs(event.correctedOffsetMs) <= 20 ? 'on-time' : event.correctedOffsetMs < 0 ? 'early' : 'late') : 'empty'}`;
    const dot = document.createElement('span');
    dot.className = 'history-dot';
    if (event) dot.style.transform = `translateX(${Math.max(-12, Math.min(12, event.correctedOffsetMs * 0.24))}px)`;
    cell.append(dot);
    cell.title = event ? `${event.correctedOffsetMs >= 0 ? '+' : ''}${Math.round(event.correctedOffsetMs)} ms` : 'No hit yet';
    history.append(cell);
  }
  const metrics = sessionMetrics(events);
  element<HTMLElement>('#average-error').textContent = events.length ? String(metrics.averageError) : '--';
  element<HTMLElement>('#lock-value').textContent = events.length ? String(metrics.lock) : '--';
}

function receiveTiming(event: TimingEvent): void {
  // One result per expected grid position rejects repeated triggers from a ringing string.
  if (event.expectedTimestamp === lastSlot) return;
  lastSlot = event.expectedTimestamp;
  if (calibrating) {
    calibrationSamples.push(event.rawOffsetMs);
    element<HTMLElement>('#cal-count').textContent = String(calibrationSamples.length);
    element<HTMLElement>('#cal-progress').setAttribute('aria-valuenow', String(calibrationSamples.length));
    element<HTMLElement>('#cal-progress').querySelectorAll('span').forEach((step, index) => step.classList.toggle('heard', index < calibrationSamples.length));
    if (calibrationSamples.length >= 8) finishCalibration();
    return;
  }
  events.push(event);
  if (events.length > 128) events.shift();
  const offset = Math.round(event.correctedOffsetMs);
  const onTime = Math.abs(offset) <= 20;
  const position = Math.max(-50, Math.min(50, event.correctedOffsetMs));
  const needle = element<HTMLElement>('#meter-needle');
  needle.style.left = `${50 + position}%`;
  needle.classList.remove('hit');
  void needle.offsetWidth;
  needle.classList.add('hit');
  element<HTMLElement>('#meter-track').className = `meter-track ${onTime ? 'on-time' : offset < 0 ? 'early' : 'late'}`;
  element<HTMLElement>('#offset-value').textContent = `${offset > 0 ? '+' : ''}${offset}`;
  element<HTMLElement>('#offset-label').textContent = onTime ? 'On time' : offset < 0 ? 'Early' : 'Late';
  element<HTMLElement>('#timing-readout').className = `timing-readout ${onTime ? 'on-time' : offset < 0 ? 'early' : 'late'}`;
  renderHistory();
  setStatus(`Beat ${event.beat} · ${onTime ? 'In the pocket' : offset < 0 ? 'Ahead of the click' : 'Behind the click'}`, 'running');
}

function updateSignal(level: number, clipping: boolean): void {
  if (level > 0.0003) lastAudibleSignalAt = performance.now();
  const percent = Math.round(Math.max(0, Math.min(100, (20 * Math.log10(Math.max(level, 0.00001)) + 60) / 54 * 100)));
  element<HTMLElement>('#signal-fill').style.width = `${percent}%`;
  element<HTMLElement>('#cal-signal-fill').style.width = `${percent}%`;
  element<HTMLElement>('#signal-meter').setAttribute('aria-valuenow', String(percent));
  element<HTMLElement>('#signal-meter').classList.toggle('clipping', clipping);
  element<HTMLElement>('#signal-label').textContent = clipping ? 'Clipping — lower gain' : level < 0.001 ? 'Very quiet' : 'Signal present';
  if (clipping) setStatus('Input clipping · lower your gain', 'warning');
  if (level > 0.001 && level < 0.3 && !clipping && !events.length) setStatus('Listening · play with the click', 'running');
}

function audioError(message: string): void {
  engine.stop();
  calibrating = false;
  element<HTMLElement>('#calibration-overlay').hidden = true;
  updateRunning(false);
  setStatus(message, 'warning');
}

function updateRunning(running: boolean): void {
  element<HTMLElement>('#footswitch').setAttribute('aria-pressed', String(running));
  element<HTMLElement>('#footswitch').setAttribute('aria-label', running ? 'Stop practice' : 'Start practice');
  app.classList.toggle('is-running', running);
  if (running) beatFrame = requestAnimationFrame(renderBeat);
  if (!running) {
    cancelAnimationFrame(beatFrame);
    element<HTMLElement>('#meter-needle').classList.remove('hit');
    renderRunner(null);
    element<HTMLElement>('#beat-strip').querySelectorAll('span').forEach((dot) => dot.classList.remove('current', 'pulse'));
    element<HTMLElement>('#signal-fill').style.width = '0%';
    element<HTMLElement>('#cal-signal-fill').style.width = '0%';
    element<HTMLElement>('#signal-meter').setAttribute('aria-valuenow', '0');
    element<HTMLElement>('#signal-label').textContent = 'Starts with the pedal';
    if (quietTimer !== null) window.clearInterval(quietTimer);
    quietTimer = null;
  }
}

function renderRunner(phase: number | null): void {
  // The center segment meets the click; the sweep wraps halfway between beats.
  const step = phase === null ? -1 : Math.floor(((phase + 0.5) % 1) * runnerCells.length);
  if (step === runnerStep) return;
  runnerStep = step;
  const trail = [0.85, 0.5, 0.28, 0.16, 0.1];
  runnerCells.forEach((cell, index) => {
    const distance = (step - index + runnerCells.length) % runnerCells.length;
    cell.style.opacity = step < 0 ? '0' : String(trail[distance] ?? 0.08);
  });
}

function renderBeat(): void {
  const position = engine.getBeatPosition();
  renderRunner(position?.phase ?? null);
  const pulse = position !== null && position.phase < Math.min(0.35, bpm / 600);
  element<HTMLElement>('#beat-strip').querySelectorAll('span').forEach((dot, index) => {
    dot.classList.toggle('current', position?.beat === index + 1);
    dot.classList.toggle('pulse', position?.beat === index + 1 && pulse);
  });
  element<HTMLElement>('#cal-beat-number').textContent = String(position?.beat ?? 1);
  element<HTMLElement>('#cal-beat').classList.toggle('pulse', pulse);
  beatFrame = requestAnimationFrame(renderBeat);
}

async function togglePractice(): Promise<void> {
  if (connecting) return;
  if (engine.running) {
    engine.stop();
    updateRunning(false);
    setStatus('Stopped · tap to start');
    return;
  }
  connecting = true;
  element<HTMLButtonElement>('#footswitch').disabled = true;
  element<HTMLButtonElement>('#calibrate-button').disabled = true;
  try {
    setStatus('Connecting audio…');
    await engine.start(selectedDevice, bpm, subdivision, sensitivity, calibration);
    lastAudibleSignalAt = performance.now();
    lastSlot = Number.NEGATIVE_INFINITY;
    events = [];
    renderHistory();
    element<HTMLElement>('#offset-value').textContent = '--';
    element<HTMLElement>('#offset-label').textContent = 'Play with the click';
    element<HTMLElement>('#timing-readout').className = 'timing-readout';
    element<HTMLElement>('#meter-needle').style.left = '50%';
    element<HTMLElement>('#meter-needle').classList.remove('hit');
    element<HTMLElement>('#meter-track').className = 'meter-track';
    updateRunning(true);
    setStatus('Listening · play with the click', 'running');
    void refreshDevices();
    quietTimer = window.setInterval(() => {
      if (!events.length && performance.now() - lastAudibleSignalAt > 8000) setStatus('No input signal · check connection', 'warning');
    }, 3000);
  } catch (error) {
    updateRunning(false);
    const name = error instanceof DOMException ? error.name : '';
    setStatus(name === 'NotAllowedError' ? 'Mic access required · allow microphone' : name === 'NotFoundError' ? 'No audio input found' : error instanceof Error ? error.message : 'Audio could not start', 'warning');
  } finally {
    connecting = false;
    element<HTMLButtonElement>('#footswitch').disabled = false;
    element<HTMLButtonElement>('#calibrate-button').disabled = false;
  }
}

function updateKnob(kind: 'tempo' | 'sens', value: number): void {
  if (kind === 'tempo') {
    bpm = Math.max(40, Math.min(200, Math.round(value)));
    element<HTMLElement>('#bpm-readout').textContent = String(bpm);
    engine.setTempo(bpm);
    lastSlot = Number.NEGATIVE_INFINITY;
  } else {
    sensitivity = Math.max(0, Math.min(100, Math.round(value)));
    element<HTMLElement>('#sens-value').textContent = String(sensitivity);
    engine.setSensitivity(sensitivity);
  }
  const knob = element<HTMLElement>(kind === 'tempo' ? '#tempo-knob' : '#sens-knob');
  const min = kind === 'tempo' ? 40 : 0;
  const max = kind === 'tempo' ? 200 : 100;
  knob.style.setProperty('--rotation', `${-135 + ((kind === 'tempo' ? bpm : sensitivity) - min) / (max - min) * 270}deg`);
  knob.setAttribute('aria-valuenow', String(kind === 'tempo' ? bpm : sensitivity));
}

function installKnob(kind: 'tempo' | 'sens'): void {
  const knob = element<HTMLElement>(kind === 'tempo' ? '#tempo-knob' : '#sens-knob');
  const current = () => kind === 'tempo' ? bpm : sensitivity;
  knob.addEventListener('dblclick', () => updateKnob(kind, kind === 'tempo' ? 80 : 55));
  knob.addEventListener('pointerdown', (event) => {
    knob.setPointerCapture(event.pointerId);
    const originX = event.clientX;
    const originValue = current();
    const move = (moveEvent: PointerEvent) => updateKnob(kind, originValue + (moveEvent.clientX - originX) * (kind === 'tempo' ? 0.9 : 0.65));
    const stop = () => { knob.removeEventListener('pointermove', move); knob.removeEventListener('pointerup', stop); knob.removeEventListener('pointercancel', stop); };
    knob.addEventListener('pointermove', move);
    knob.addEventListener('pointerup', stop);
    knob.addEventListener('pointercancel', stop);
  });
  knob.addEventListener('keydown', (event) => {
    const delta = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0;
    if (delta) { event.preventDefault(); updateKnob(kind, current() + delta); }
  });
  updateKnob(kind, current());
}

function openOverlay(id: string): void { element<HTMLElement>(id).hidden = false; }
function closeOverlay(id: string): void { element<HTMLElement>(id).hidden = true; }

async function beginCalibration(): Promise<void> {
  if (connecting) return;
  if (!engine.running) await togglePractice();
  if (!engine.running) { element<HTMLElement>('#signal-label').textContent = 'Check microphone access'; return; }
  closeOverlay('#overlay');
  if (subdivision !== 1) {
    subdivision = 1;
    engine.setSubdivision(1);
    renderSubdivision();
  }
  calibrating = true;
  calibrationSamples = [];
  lastSlot = Number.NEGATIVE_INFINITY;
  element<HTMLElement>('#cal-count').textContent = '0';
  element<HTMLElement>('#cal-progress').setAttribute('aria-valuenow', '0');
  element<HTMLElement>('#cal-bpm').textContent = `${bpm} bpm`;
  element<HTMLElement>('#cal-progress').querySelectorAll('span').forEach((step) => step.classList.remove('heard'));
  openOverlay('#calibration-overlay');
}

function finishCalibration(): void {
  calibrating = false;
  const value = median(calibrationSamples);
  saveCalibration(value);
  closeOverlay('#calibration-overlay');
  openOverlay('#overlay');
  setStatus(`Calibrated · ${Math.round(value)} ms offset`, 'running');
}

function renderSubdivision(): void {
  element<HTMLElement>('#subdivision-value').textContent = subdivision === 1 ? '1/4' : subdivision === 2 ? '1/8' : '1/16';
  const position = subdivision === 1 ? 0 : subdivision === 2 ? 1 : 2;
  element<HTMLElement>('.lever-selector').dataset.position = String(position);
  const lever = element<HTMLElement>('#subdivision-switch');
  lever.setAttribute('aria-valuenow', String(position));
  lever.setAttribute('aria-valuetext', ['Quarter notes', 'Eighth notes', 'Sixteenth notes'][position]);
}

function setSubdivision(position: number): void {
  subdivision = [1, 2, 4][Math.max(0, Math.min(2, position))] as Subdivision;
  engine.setSubdivision(subdivision);
  lastSlot = Number.NEGATIVE_INFINITY;
  renderSubdivision();
}

function installSubdivisionSwitch(): void {
  const lever = element<HTMLElement>('#subdivision-switch');
  const currentPosition = () => subdivision === 1 ? 0 : subdivision === 2 ? 1 : 2;
  let originX = 0;
  let originPosition = 0;
  let dragged = false;
  lever.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    lever.setPointerCapture(event.pointerId);
    originX = event.clientX;
    originPosition = currentPosition();
    dragged = false;
  });
  lever.addEventListener('pointermove', (event) => {
    if (!lever.hasPointerCapture(event.pointerId)) return;
    const distance = event.clientX - originX;
    if (Math.abs(distance) < 7) return;
    dragged = true;
    const steps = Math.max(1, Math.round(Math.abs(distance) / 42));
    setSubdivision(originPosition + Math.sign(distance) * steps);
  });
  lever.addEventListener('pointerup', (event) => {
    if (!lever.hasPointerCapture(event.pointerId)) return;
    if (!dragged) setSubdivision((currentPosition() + 1) % 3);
    lever.releasePointerCapture(event.pointerId);
  });
  lever.addEventListener('keydown', (event) => {
    let position: number;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') position = currentPosition() - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') position = currentPosition() + 1;
    else if (event.key === 'Home') position = 0;
    else if (event.key === 'End') position = 2;
    else if (event.key === ' ' || event.key === 'Enter') position = (currentPosition() + 1) % 3;
    else return;
    event.preventDefault();
    setSubdivision(position);
  });
}

installKnob('tempo');
installKnob('sens');
renderSubdivision();
installSubdivisionSwitch();
renderHistory();
void refreshDevices();
loadCalibration();
element<HTMLButtonElement>('#footswitch').addEventListener('click', () => void togglePractice());
element<HTMLButtonElement>('#input-button').addEventListener('click', () => { void refreshDevices(); openOverlay('#overlay'); });
element<HTMLButtonElement>('#close-overlay').addEventListener('click', () => closeOverlay('#overlay'));
element<HTMLButtonElement>('#close-calibration').addEventListener('click', () => { calibrating = false; closeOverlay('#calibration-overlay'); openOverlay('#overlay'); });
element<HTMLButtonElement>('#calibrate-button').addEventListener('click', () => void beginCalibration());
element<HTMLButtonElement>('#reset-calibration').addEventListener('click', () => { clearCalibration(); setStatus('Calibration cleared', engine.running ? 'running' : 'ready'); });
element<HTMLButtonElement>('#device-prev').addEventListener('click', () => cycleDevice(-1));
element<HTMLButtonElement>('#device-next').addEventListener('click', () => cycleDevice(1));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeOverlay('#overlay'); calibrating = false; closeOverlay('#calibration-overlay'); }
});
navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshDevices());
