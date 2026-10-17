import assert from 'node:assert/strict';
import test from 'node:test';
import { isConfidentOnset } from '../src/audio/onsetPolicy.ts';
import { beatPosition, TimingGrid, type Meter, type TimingEvent } from '../src/timing/grid.ts';
import { averageOffset } from '../src/timing/metrics.ts';
import { advancePocketState, initialPocketState } from '../src/timing/pocket.ts';
import { detect } from './audioHarness.ts';

const bpm = 80;
const anchor = 1;
const sixteenth = 60 / bpm / 4;
const goodOffsets = [5, -7, 9, -6, 4, -8, 7, -5, 3, -4, 6, -9];

// Each pattern spans two measures. Slots are sixteenth-note positions; missing slots are rests.
const rhythms: { name: string; meter: Meter; slots: number[] }[] = [
  { name: 'simple quarter notes', meter: 4, slots: [0, 4, 8, 12, 16, 20, 24, 28] },
  { name: 'steady eighth notes', meter: 4, slots: [0, 2, 4, 6, 8, 10, 12, 14] },
  {
    name: 'syncopated sixteenths and rests',
    meter: 4,
    slots: [0, 3, 7, 8, 11, 16, 19, 23, 27, 31],
  },
  { name: '4:3 cross-rhythm', meter: 4, slots: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30] },
  { name: '3/4 quarter notes', meter: 3, slots: [0, 4, 8, 12, 16, 20] },
  { name: '5/4 quarter notes', meter: 5, slots: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36] },
];

function eventsFor(slots: number[], meter: Meter, offsets: number[]): TimingEvent[] {
  const grid = new TimingGrid(anchor, bpm, meter);
  return slots.map((slot, index) =>
    grid.match(anchor + slot * sixteenth + offsets[index % offsets.length] / 1000, 0.2, 1)!,
  );
}

function score(events: TimingEvent[], meter: Meter): number {
  const end = anchor + 2 * meter * (60 / bpm) + 0.25;
  return advancePocketState(
    events,
    beatPosition(anchor, bpm, end, meter),
    bpm,
    meter,
    initialPocketState,
  ).percent!;
}

for (const { name, meter, slots } of rhythms) {
  test(`gold standard: ${name} beats consistently late playing`, () => {
    const good = eventsFor(slots, meter, goodOffsets);
    const bad = eventsFor(slots, meter, [65]);
    assert.equal(score(good, meter), 100);
    assert.ok(score(bad, meter) < 40);
    assert.ok(Math.abs(averageOffset(good)) < 10);
    assert.ok(averageOffset(bad) >= 60);
  });
}

test('gold standard: mixed early and late misses lower pocket despite near-zero bias', () => {
  const slots = rhythms[0].slots;
  const good = eventsFor(slots, 4, goodOffsets);
  const bad = eventsFor(slots, 4, [65, -65]);
  assert.ok(score(good, 4) > score(bad, 4));
  assert.equal(averageOffset(bad), 0); // Bias is signed, not a measure of overall accuracy.
});

for (const { name, meter, slots } of [rhythms[0], rhythms[2]]) {
  test(`gold standard audio: ${name} scores better when played on time`, () => {
    const grid = new TimingGrid(anchor, bpm, meter);
    const play = (offsets: number[]) => {
      const times = slots.map(
        (slot, index) => anchor + slot * sixteenth + offsets[index % offsets.length] / 1000,
      );
      const toneHz = name === 'simple quarter notes' ? 82 : 220;
      const detected = detect(times, [], () => 0, times.at(-1)! + 0.4, toneHz).filter(
        (onset) => !onset.clickBleed && isConfidentOnset(onset.confidence),
      );
      const unique = new Map<number, TimingEvent>();
      for (const onset of detected) {
        const event = grid.match(onset.timestamp, 0.2, onset.confidence);
        if (event) unique.set(event.subdivisionIndex, event);
      }
      assert.ok(unique.size >= 6, `${name}: only ${unique.size} notes detected`);
      return [...unique.values()];
    };
    const good = play(goodOffsets);
    const bad = play([65]);
    assert.ok(score(good, meter) > score(bad, meter));
    assert.ok(Math.abs(averageOffset(good)) < Math.abs(averageOffset(bad)));
  });
}
