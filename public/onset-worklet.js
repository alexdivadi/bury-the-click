// AudioWorklet globals are supplied by the browser's audio rendering thread.
class NoteOnsetProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.previousInput = 0;
    this.highPass = 0;
    this.fast = 0;
    this.fastHistory = new Float32Array(Math.round(sampleRate * 0.01));
    this.historyIndex = 0;
    this.slow = 0.0001;
    this.armed = true;
    this.onsetPeak = 0;
    this.lastOnset = -1;
    this.lastSignalReport = 0;
    this.sensitivity = 55;
    this.port.onmessage = ({ data }) => { if (data.type === 'sensitivity') this.sensitivity = data.value; };
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let peak = 0;
    let energy = 0;
    const gate = 0.0002 + Math.pow(1 - this.sensitivity / 100, 2) * 0.008;
    const ratio = 3.4 - this.sensitivity / 100;
    for (let i = 0; i < channel.length; i++) {
      const input = channel[i];
      this.highPass = input - this.previousInput + 0.995 * this.highPass;
      this.previousInput = input;
      const magnitude = Math.abs(this.highPass);
      this.fast += (magnitude - this.fast) * 0.003;
      const earlierFast = this.fastHistory[this.historyIndex];
      this.fastHistory[this.historyIndex] = this.fast;
      this.historyIndex = (this.historyIndex + 1) % this.fastHistory.length;
      this.slow += (magnitude - this.slow) * 0.00008;
      peak = Math.max(peak, Math.abs(input));
      energy += input * input;
      const time = (currentFrame + i) / sampleRate;
      const threshold = Math.max(gate, this.slow * ratio);
      const freshAttack = this.fast > earlierFast * 1.35 && this.fast > threshold * 0.6;
      if (time - this.lastOnset > 0.07 && (this.armed && this.fast > threshold || !this.armed && freshAttack)) {
        this.armed = false;
        this.lastOnset = time;
        this.onsetPeak = this.fast;
        this.port.postMessage({ type: 'onset', timestamp: time, amplitude: this.fast, confidence: Math.min(1, this.fast / threshold - 1) });
      }
      if (!this.armed) {
        this.onsetPeak = Math.max(this.onsetPeak, this.fast);
        if (this.fast < this.onsetPeak * 0.25 && this.fast < threshold * 0.7 && time - this.lastOnset > 0.075) this.armed = true;
      }
    }
    if (currentTime - this.lastSignalReport > 0.12) {
      this.port.postMessage({ type: 'signal', level: Math.sqrt(energy / channel.length), clipping: peak > 0.98 });
      this.lastSignalReport = currentTime;
    }
    return true;
  }
}

registerProcessor('note-onset', NoteOnsetProcessor);
