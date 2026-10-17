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
    this.candidate = null;
    this.lastOnset = -1;
    this.lastSignalReport = 0;
    this.sensitivity = 55;
    this.clicks = [];
    this.port.onmessage = ({ data }) => {
      if (data.type === 'sensitivity') this.sensitivity = data.value;
      if (data.type === 'click') this.clicks.push(data.time);
    };
  }

  // The generated click contains both of these fixed tones. A leaked click has
  // most of its attack energy in the pair; an instrument attack is broadband.
  // Timing only limits where we inspect the signature, never rejects a note by itself.
  isClickBleed(samples, timestamp) {
    if (!this.clicks.some((time) => timestamp >= time - 0.015 && timestamp <= time + 0.18))
      return false;
    const count = samples.length;
    if (count < sampleRate * 0.008) return false;
    let energy = 0;
    const tones = [3000, 3750].map((frequency) => {
      const step = (2 * Math.PI * frequency) / sampleRate;
      let real = 0;
      let imaginary = 0;
      for (let index = 0; index < count; index++) {
        real += samples[index] * Math.cos(step * index);
        imaginary += samples[index] * Math.sin(step * index);
      }
      return (2 * (real * real + imaginary * imaginary)) / count;
    });
    for (const sample of samples) energy += sample * sample;
    if (energy === 0) return false;
    return (
      tones[0] / energy > 0.1 && tones[1] / energy > 0.1 && (tones[0] + tones[1]) / energy > 0.45
    );
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let peak = 0;
    let energy = 0;
    const gate = 0.0002 + Math.pow(1 - this.sensitivity / 100, 2) * 0.008;
    const ratio = 3.4 - this.sensitivity / 100;
    this.clicks = this.clicks.filter((time) => time >= currentTime - 0.2);
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
      if (this.candidate) {
        this.candidate.samples.push(input);
        this.candidate.peak = Math.max(this.candidate.peak, this.fast);
        if (time - this.candidate.timestamp >= 0.012) {
          const { timestamp, peak, threshold: attackThreshold, samples } = this.candidate;
          const clickBleed = this.isClickBleed(samples, timestamp);
          this.port.postMessage({
            type: 'onset',
            timestamp,
            amplitude: peak,
            confidence: Math.max(0, Math.min(1, peak / attackThreshold - 1)),
            clickBleed,
          });
          // A leaked click must not consume the refractory period for a real note
          // that arrives just after it.
          if (clickBleed) this.lastOnset = timestamp - 0.07;
          this.candidate = null;
        }
      }
      if (
        time - this.lastOnset > 0.07 &&
        ((this.armed && this.fast > threshold) || (!this.armed && freshAttack))
      ) {
        this.armed = false;
        this.lastOnset = time;
        this.onsetPeak = this.fast;
        this.candidate = { timestamp: time, peak: this.fast, threshold, samples: [input] };
      }
      if (!this.armed) {
        this.onsetPeak = Math.max(this.onsetPeak, this.fast);
        if (
          this.fast < this.onsetPeak * 0.25 &&
          this.fast < threshold * 0.7 &&
          time - this.lastOnset > 0.075
        )
          this.armed = true;
      }
    }
    if (currentTime - this.lastSignalReport > 0.12) {
      this.port.postMessage({
        type: 'signal',
        level: Math.sqrt(energy / channel.length),
        clipping: peak > 0.98,
      });
      this.lastSignalReport = currentTime;
    }
    return true;
  }
}

registerProcessor('note-onset', NoteOnsetProcessor);
