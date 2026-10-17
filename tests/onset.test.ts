import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { isConfidentOnset, MIN_ONSET_CONFIDENCE } from '../src/audio/onsetPolicy.ts';

function detect(
  onsetTimes: number[],
  clicks: { scheduled: number; delay: number; level?: number }[] = [],
): Array<{ timestamp: number; confidence: number; clickBleed: boolean }> {
  const messages: Array<{
    type: string;
    timestamp?: number;
    confidence?: number;
    clickBleed?: boolean;
  }> = [];
  let Processor: new () => {
    port: { onmessage: ((event: unknown) => void) | null };
    process: (input: Float32Array[][]) => boolean;
  };
  const scope = vm.createContext({
    sampleRate: 48000,
    currentFrame: 0,
    currentTime: 0,
    AudioWorkletProcessor: class {
      port = {
        onmessage: null,
        postMessage: (message: {
          type: string;
          timestamp?: number;
          confidence?: number;
          clickBleed?: boolean;
        }) => messages.push(message),
      };
    },
    registerProcessor: (_name: string, constructor: typeof Processor) => {
      Processor = constructor;
    },
  });
  vm.runInContext(
    readFileSync(new URL('../public/onset-worklet.js', import.meta.url), 'utf8'),
    scope,
  );
  const detector = new Processor!();
  for (const click of clicks)
    detector.port.onmessage?.({ data: { type: 'click', time: click.scheduled } });
  for (let frame = 0; frame < 57600; frame += 128) {
    const data = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      const time = (frame + i) / 48000;
      const tail = onsetTimes.reduce(
        (sum, onset) =>
          sum +
          (time >= onset
            ? 0.24 * Math.exp(-(time - onset) * 8) * Math.sin(2 * Math.PI * 82 * (time - onset))
            : 0),
        0,
      );
      const leakedClick = clicks.reduce((sum, click) => {
        const since = time - click.scheduled - click.delay;
        if (since < 0 || since >= 0.035) return sum;
        const envelope =
          since < 0.002
            ? Math.pow(700, since / 0.002 - 1)
            : Math.pow(0.0001 / 0.07, (since - 0.002) / 0.033);
        return (
          sum +
          (click.level ?? 0.05) *
            envelope *
            (Math.sin(2 * Math.PI * 3000 * since) +
              Math.sin(2 * Math.PI * 3750 * since) +
              0.8 * Math.sin(2 * Math.PI * 850 * since))
        );
      }, 0);
      data[i] = tail + leakedClick + 0.00001 * Math.sin(2 * Math.PI * 1200 * time);
    }
    scope.currentFrame = frame;
    scope.currentTime = frame / 48000;
    detector.process([[data]]);
  }
  return messages
    .filter((message) => message.type === 'onset')
    .map((message) => ({
      timestamp: message.timestamp!,
      confidence: message.confidence!,
      clickBleed: message.clickBleed!,
    }));
}

test('worklet detects one bass-like attack and rejects its sustained tail and low noise', () => {
  const onsets = detect([0.5]);
  assert.equal(onsets.length, 1, JSON.stringify(onsets));
  assert.ok(Math.abs(onsets[0].timestamp - 0.5) < 0.02);
  assert.ok(isConfidentOnset(onsets[0].confidence));
  assert.equal(onsets[0].clickBleed, false);
});

test('worklet detects a second attack at a 200 BPM sixteenth-note spacing', () => {
  const onsets = detect([0.5, 0.575]);
  assert.equal(onsets.length, 2, JSON.stringify(onsets));
  assert.ok(Math.abs(onsets[1].timestamp - 0.575) < 0.02);
});

test('near-zero confidence attacks cannot count as notes or calibration samples', () => {
  assert.equal(isConfidentOnset(0), false);
  assert.equal(isConfidentOnset(-0.4), false);
  assert.equal(isConfidentOnset(MIN_ONSET_CONFIDENCE - 0.01), false);
  assert.equal(isConfidentOnset(MIN_ONSET_CONFIDENCE), true);
});

test('tagged click leaking through the microphone is marked as bleed', () => {
  const onsets = detect([], [{ scheduled: 0.5, delay: 0.068 }]);
  assert.equal(onsets.length, 1, JSON.stringify(onsets));
  assert.equal(onsets[0].clickBleed, true);
});

test('an instrument attack on the leaked click is still eligible', () => {
  const onsets = detect([0.568], [{ scheduled: 0.5, delay: 0.068 }]);
  assert.ok(onsets.length > 0, JSON.stringify(onsets));
  assert.equal(onsets[0].clickBleed, false, JSON.stringify(onsets));
});

test('a click does not hide an instrument attack shortly afterward', () => {
  const onsets = detect([0.6], [{ scheduled: 0.5, delay: 0.068 }]);
  assert.ok(onsets.some((onset) => onset.clickBleed));
  assert.ok(
    onsets.some((onset) => !onset.clickBleed && Math.abs(onset.timestamp - 0.6) < 0.02),
    JSON.stringify(onsets),
  );
});

test('a normal instrument attack near a click is not suppressed by timing alone', () => {
  const onsets = detect([0.5], [{ scheduled: 0.5, delay: 0.068, level: 0 }]);
  assert.equal(onsets.length, 1, JSON.stringify(onsets));
  assert.equal(onsets[0].clickBleed, false);
});
