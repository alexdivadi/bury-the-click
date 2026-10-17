import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function detect(onsetTimes: number[]): number[] {
  const messages: Array<{ type: string; timestamp?: number }> = [];
  let Processor: new () => { port: { onmessage: ((event: unknown) => void) | null }; process: (input: Float32Array[][]) => boolean };
  const scope = vm.createContext({
    sampleRate: 48000,
    currentFrame: 0,
    currentTime: 0,
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage: (message: { type: string; timestamp?: number }) => messages.push(message) }; },
    registerProcessor: (_name: string, constructor: typeof Processor) => { Processor = constructor; },
  });
  vm.runInContext(readFileSync(new URL('../public/onset-worklet.js', import.meta.url), 'utf8'), scope);
  const detector = new Processor!();
  for (let frame = 0; frame < 57600; frame += 128) {
    const data = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      const time = (frame + i) / 48000;
      const tail = onsetTimes.reduce((sum, onset) => sum + (time >= onset ? 0.24 * Math.exp(-(time - onset) * 8) * Math.sin(2 * Math.PI * 82 * (time - onset)) : 0), 0);
      data[i] = tail + 0.00001 * Math.sin(2 * Math.PI * 1200 * time);
    }
    scope.currentFrame = frame;
    scope.currentTime = frame / 48000;
    detector.process([[data]]);
  }
  return messages.filter((message) => message.type === 'onset').map((message) => message.timestamp!);
}

test('worklet detects one bass-like attack and rejects its sustained tail and low noise', () => {
  const onsets = detect([0.5]);
  assert.equal(onsets.length, 1, JSON.stringify(onsets));
  assert.ok(Math.abs(onsets[0] - 0.5) < 0.02);
});

test('worklet detects a second attack at a 200 BPM sixteenth-note spacing', () => {
  const onsets = detect([0.5, 0.575]);
  assert.equal(onsets.length, 2, JSON.stringify(onsets));
  assert.ok(Math.abs(onsets[1] - 0.575) < 0.02);
});
