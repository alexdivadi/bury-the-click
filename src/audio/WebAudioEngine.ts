import { beatPosition, TimingGrid, type Meter, type TimingEvent } from '../timing/grid.ts';
import { TEXT } from '../text.ts';
export interface AudioCallbacks {
  onTiming: (event: TimingEvent) => void;
  onSignal: (level: number, clipping: boolean) => void;
  onError: (message: string) => void;
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
  private sessionStartTime: number | null = null;
  private bpm = 80;
  private meter: Meter = 4;
  private calibrationOffsetMs = 0;
  private startGeneration = 0;
  private callbacks: AudioCallbacks;

  constructor(callbacks: AudioCallbacks) {
    this.callbacks = callbacks;
  }

  get running(): boolean {
    return this.context !== null;
  }
  getBeatPosition(): { beat: number; phase: number; measureIndex: number } | null {
    return this.context && this.grid
      ? beatPosition(this.grid.anchor, this.bpm, this.context.currentTime, this.meter)
      : null;
  }
  getSessionElapsed(timestamp = this.context?.currentTime ?? 0): number {
    return this.sessionStartTime === null ? 0 : Math.max(0, timestamp - this.sessionStartTime);
  }

  async start(
    deviceId: string,
    bpm: number,
    meter: Meter,
    sensitivity: number,
    calibrationOffsetMs: number,
    mode: 'practice' | 'calibration' = 'practice',
  ): Promise<void> {
    this.stop();
    const generation = this.startGeneration;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode)
      throw new Error(TEXT.error.unsupportedBrowser);
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    try {
      await context.resume(); // Request playback while the Start tap still has user activation.
      if (generation !== this.startGeneration)
        throw new DOMException(TEXT.error.audioStartCancelled, 'AbortError');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (generation !== this.startGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException(TEXT.error.audioStartCancelled, 'AbortError');
      }
      this.stream = stream;
      await context.audioWorklet.addModule('/onset-worklet.js');
      if (generation !== this.startGeneration)
        throw new DOMException(TEXT.error.audioStartCancelled, 'AbortError');
      this.source = context.createMediaStreamSource(this.stream);
      this.detector = new AudioWorkletNode(context, 'note-onset');
      this.detector.port.postMessage({ type: 'sensitivity', value: sensitivity });
      this.detector.port.onmessage = (message: MessageEvent) => {
        if (message.data.type === 'signal')
          this.callbacks.onSignal(message.data.level, message.data.clipping);
        if (message.data.type === 'onset' && this.grid) {
          const event = this.grid.match(
            message.data.timestamp,
            message.data.amplitude,
            message.data.confidence,
          );
          if (event) this.callbacks.onTiming({ ...event, clickBleed: message.data.clickBleed });
        }
      };
      this.source.connect(this.detector);
      this.detector.connect(context.destination); // The worklet emits silence, but must remain in the rendering graph.
      this.stream
        .getAudioTracks()[0]
        .addEventListener('ended', () => this.callbacks.onError(TEXT.error.inputDisconnected), {
          once: true,
        });
      context.onstatechange = () => {
        if (context.state === 'suspended' && this.running)
          this.callbacks.onError(TEXT.error.audioPaused);
      };
      this.bpm = bpm;
      this.meter = meter;
      this.calibrationOffsetMs = calibrationOffsetMs;
      this.reanchor();
      if (mode === 'practice') this.startHum(context);
      this.scheduler = window.setInterval(() => this.scheduleClicks(), 25);
      this.scheduleClicks();
    } catch (error) {
      if (generation === this.startGeneration) this.stop();
      throw error;
    }
  }

  setTempo(bpm: number): void {
    this.bpm = bpm;
    if (this.context) this.reanchor();
  }
  setMeter(meter: Meter): void {
    this.meter = meter;
    if (this.context) this.reanchor();
  }
  setSensitivity(value: number): void {
    this.detector?.port.postMessage({ type: 'sensitivity', value });
  }
  setCalibration(value: number): void {
    this.calibrationOffsetMs = value;
    if (this.grid) this.grid = new TimingGrid(this.grid.anchor, this.bpm, this.meter, value);
  }

  private reanchor(): void {
    if (!this.context) return;
    this.nextClick = this.context.currentTime + 0.12;
    this.sessionStartTime ??= this.nextClick;
    this.clickIndex = 0;
    this.grid = new TimingGrid(this.nextClick, this.bpm, this.meter, this.calibrationOffsetMs);
  }

  private scheduleClicks(): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    while (this.nextClick < context.currentTime + 0.1) {
      if (this.nextClick >= context.currentTime)
        this.playClick(this.nextClick, this.clickIndex % this.meter === 0);
      this.nextClick += 60 / this.bpm;
      this.clickIndex++;
    }
  }

  private playClick(time: number, accent: boolean): void {
    const context = this.context;
    if (!context) return;
    this.detector?.port.postMessage({ type: 'click', time });
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1150 : 850, time);
    oscillator.frequency.exponentialRampToValueAtTime(accent ? 700 : 540, time + 0.035);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.075 : 0.055, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.065);
    for (const frequency of [3000, 3750]) {
      const tag = context.createOscillator();
      const tagGain = context.createGain();
      tag.type = 'sine';
      tag.frequency.setValueAtTime(frequency, time);
      tagGain.gain.setValueAtTime(0.0001, time);
      tagGain.gain.exponentialRampToValueAtTime(accent ? 0.09 : 0.07, time + 0.002);
      tagGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
      tag.connect(tagGain).connect(context.destination);
      tag.start(time);
      tag.stop(time + 0.04);
    }
  }

  private startHum(context: AudioContext): void {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.setTargetAtTime(0.0025, context.currentTime, 0.08);
    gain.connect(context.destination);
    this.humGain = gain;
    for (const [frequency, level] of [
      [60, 1],
      [120, 0.28],
      [180, 0.08],
    ]) {
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
    this.startGeneration++;
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.grid = null;
    this.sessionStartTime = null;
    if (this.context) this.humGain?.gain.setValueAtTime(0, this.context.currentTime);
    this.humOscillators.forEach((oscillator) => {
      oscillator.stop();
      oscillator.disconnect();
    });
    this.humOscillators = [];
    this.humGain?.disconnect();
    this.humGain = null;
    this.detector?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context) {
      void this.context.close();
      this.context.onstatechange = null;
    }
    this.detector = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
