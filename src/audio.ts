import { beatPosition, TimingGrid, type Subdivision, type TimingEvent } from './timing.ts';

export interface InputDevice { deviceId: string; label: string }
export function cycleInputDevice(current: string, devices: InputDevice[], direction: -1 | 1): string {
  const ids = ['', ...devices.map((device) => device.deviceId)];
  return ids[(Math.max(0, ids.indexOf(current)) + direction + ids.length) % ids.length];
}
export interface AudioCallbacks {
  onTiming: (event: TimingEvent) => void;
  onSignal: (level: number, clipping: boolean) => void;
  onError: (message: string) => void;
}

export async function listInputs(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput').map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label || `Audio input ${index + 1}`,
  }));
}

export class WebAudioEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private detector: AudioWorkletNode | null = null;
  private humOscillators: OscillatorNode[] = [];
  private humGain: GainNode | null = null;
  private scheduler: number | null = null;
  private nextClick = 0;
  private clickIndex = 0;
  private grid: TimingGrid | null = null;
  private bpm = 80;
  private subdivision: Subdivision = 1;
  private calibrationOffsetMs = 0;
  private callbacks: AudioCallbacks;

  constructor(callbacks: AudioCallbacks) { this.callbacks = callbacks; }

  get running(): boolean { return this.context !== null; }
  getBeatPosition(): { beat: number; phase: number } | null {
    return this.context && this.grid ? beatPosition(this.grid.anchor, this.bpm, this.context.currentTime) : null;
  }

  async start(deviceId: string, bpm: number, subdivision: Subdivision, sensitivity: number, calibrationOffsetMs: number): Promise<void> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error('This browser cannot process live audio. Use a current browser over HTTPS or localhost.');
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    try {
      await context.resume(); // Request playback while the Start tap still has user activation.
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      } });
      await context.audioWorklet.addModule('/onset-worklet.js');
      this.source = context.createMediaStreamSource(this.stream);
      this.detector = new AudioWorkletNode(context, 'bass-onset');
      this.detector.port.postMessage({ type: 'sensitivity', value: sensitivity });
      this.detector.port.onmessage = (message: MessageEvent) => {
        if (message.data.type === 'signal') this.callbacks.onSignal(message.data.level, message.data.clipping);
        if (message.data.type === 'onset' && this.grid) {
          const event = this.grid.match(message.data.timestamp, message.data.amplitude, message.data.confidence);
          if (event) this.callbacks.onTiming(event);
        }
      };
      this.source.connect(this.detector);
      this.detector.connect(context.destination); // The worklet emits silence, but must remain in the rendering graph.
      this.stream.getAudioTracks()[0].addEventListener('ended', () => this.callbacks.onError('Input disconnected. Select an input and start again.'), { once: true });
      context.onstatechange = () => {
        if (context.state === 'suspended' && this.running) this.callbacks.onError('Audio paused by the browser. Tap the switch to restart.');
      };
      this.bpm = bpm;
      this.subdivision = subdivision;
      this.calibrationOffsetMs = calibrationOffsetMs;
      this.reanchor();
      this.startHum(context);
      this.scheduler = window.setInterval(() => this.scheduleClicks(), 25);
      this.scheduleClicks();
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  setTempo(bpm: number): void { this.bpm = bpm; if (this.context) this.reanchor(); }
  setSubdivision(subdivision: Subdivision): void { this.subdivision = subdivision; if (this.context) this.reanchor(); }
  setSensitivity(value: number): void { this.detector?.port.postMessage({ type: 'sensitivity', value }); }
  setCalibration(value: number): void {
    this.calibrationOffsetMs = value;
    if (this.grid) this.grid = new TimingGrid(this.grid.anchor, this.bpm, this.subdivision, value);
  }

  private reanchor(): void {
    if (!this.context) return;
    this.nextClick = this.context.currentTime + 0.12;
    this.clickIndex = 0;
    this.grid = new TimingGrid(this.nextClick, this.bpm, this.subdivision, this.calibrationOffsetMs);
  }

  private scheduleClicks(): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    while (this.nextClick < context.currentTime + 0.1) {
      if (this.nextClick >= context.currentTime) this.playClick(this.nextClick, this.clickIndex % 4 === 0);
      this.nextClick += 60 / this.bpm;
      this.clickIndex++;
    }
  }

  private playClick(time: number, accent: boolean): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1150 : 850, time);
    oscillator.frequency.exponentialRampToValueAtTime(accent ? 700 : 540, time + 0.035);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.065);
  }

  private startHum(context: AudioContext): void {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.setTargetAtTime(0.0025, context.currentTime, 0.08);
    gain.connect(context.destination);
    this.humGain = gain;
    for (const [frequency, level] of [[60, 1], [120, 0.28], [180, 0.08]]) {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      partial.gain.value = level;
      oscillator.connect(partial).connect(gain);
      oscillator.start();
      this.humOscillators.push(oscillator);
    }
  }

  stop(): void {
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.grid = null;
    if (this.context) this.humGain?.gain.setValueAtTime(0, this.context.currentTime);
    this.humOscillators.forEach((oscillator) => { oscillator.stop(); oscillator.disconnect(); });
    this.humOscillators = [];
    this.humGain?.disconnect();
    this.humGain = null;
    this.detector?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context) { void this.context.close(); this.context.onstatechange = null; }
    this.detector = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
