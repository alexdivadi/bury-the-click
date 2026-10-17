import assert from 'node:assert/strict';
import test from 'node:test';
import { isConfidentOnset, MIN_ONSET_CONFIDENCE } from '../src/audio/onsetPolicy.ts';
import { detect } from './audioHarness.ts';

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

test('worklet detects a connected pitch change without a new volume spike', () => {
  const onsets = detect([], [], (time) => {
    if (time < 0.25) return 0;
    const since = time - 0.25;
    const change = Math.max(0, time - 0.65);
    const ramp = Math.min(change, 0.05);
    const cycles = 82 * since + 28 * ((ramp * ramp) / 0.1 + Math.max(0, change - 0.05));
    return 0.15 * Math.min(1, since / 0.08) * Math.sin(2 * Math.PI * cycles);
  });
  assert.ok(
    onsets.some((onset) => Math.abs(onset.timestamp - 0.65) < 0.03),
    JSON.stringify(onsets),
  );
  assert.ok(onsets.length <= 2, JSON.stringify(onsets));
  assert.equal(onsets.filter((onset) => onset.timestamp > 0.5).length, 1, JSON.stringify(onsets));
});

test('a sustained note with gentle vibrato does not create new notes', () => {
  const onsets = detect([], [], (time) => {
    if (time < 0.25) return 0;
    const since = time - 0.25;
    const cycles = 82 * since + Math.sin(2 * Math.PI * 5 * since) / (2 * Math.PI * 5);
    return 0.15 * Math.min(1, since / 0.08) * Math.sin(2 * Math.PI * cycles);
  });
  assert.equal(onsets.filter((onset) => onset.timestamp > 0.5).length, 0, JSON.stringify(onsets));
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
