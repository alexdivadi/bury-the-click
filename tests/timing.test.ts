import assert from 'node:assert/strict';
import test from 'node:test';
import { beatPosition, TimingGrid } from '../src/timing/grid.ts';
import { averageOffset, median } from '../src/timing/metrics.ts';

test('matches early and late notes on the audio clock', () => {
  const grid = new TimingGrid(1, 80, 4);
  assert.equal(Math.round(grid.match(2.47, 0.2, 1)!.rawOffsetMs), -30);
  assert.equal(Math.round(grid.match(2.53, 0.2, 1)!.rawOffsetMs), 30);
  assert.equal(grid.match(0.5, 0.2, 1), null);
});

test('matches quarter-note clicks and applies calibration once', () => {
  const grid = new TimingGrid(1, 120, 4, 12);
  const hit = grid.match(1.512, 0.2, 0.8)!;
  assert.equal(hit.beat, 2);
  assert.equal(Math.round(hit.rawOffsetMs), 12);
  assert.equal(Math.round(hit.correctedOffsetMs), 0);
  assert.equal(Math.round(hit.subdivisionOffsetMs), 0);
});

test('the nearest sixteenth target stays consistent across a sixteenth-note run', () => {
  const grid = new TimingGrid(1, 80, 4);
  const attacks = [1.486, 1.674, 1.864, 2.047].map((time) => grid.match(time, 0.2, 1)!);
  assert.deepEqual(
    attacks.map((attack) => [attack.subdivisionBeat, attack.subdivision]),
    [
      [1, 3],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  );
  assert.deepEqual(
    attacks.map((attack) => Math.round(attack.rawOffsetMs)),
    [-264, -76, 114, 297],
  );
  assert.deepEqual(
    attacks.map((attack) => Math.round(attack.subdivisionOffsetMs)),
    [-77, -76, -73, -78],
  );
  assert.equal(new Set(attacks.map((attack) => attack.subdivisionExpectedTimestamp)).size, 4);
});

test('saved input delay is applied before choosing the nearest sixteenth', () => {
  const grid = new TimingGrid(1, 80, 4, -76);
  const attack = grid.match(1.486, 0.2, 1)!;
  assert.equal(attack.subdivision, 3);
  assert.equal(Math.round(attack.subdivisionOffsetMs), -1);
});

test('average offset shows timing bias separately from the pocket score', () => {
  const grid = new TimingGrid(1, 60, 4);
  const events = [0.96, 2.04, 2.96, 4.04].map((time) => grid.match(time, 0.2, 1)!);
  assert.equal(averageOffset(events), 0);
  assert.equal(averageOffset([events[0], events[2]]), -40);
  assert.equal(median([12, 10, 40, 11]), 11.5);
});

test('beat indicator follows the same audio-clock anchor as the timing grid', () => {
  assert.equal(beatPosition(1, 120, 0.9, 4), null);
  assert.deepEqual(beatPosition(1, 120, 1, 4), { beat: 1, phase: 0, measureIndex: 0 });
  assert.deepEqual(beatPosition(1, 120, 2.25, 4), { beat: 3, phase: 0.5, measureIndex: 0 });
  assert.deepEqual(beatPosition(1, 120, 3, 4), { beat: 1, phase: 0, measureIndex: 1 });
});

test('3/4 and 5/4 wrap beats at their own bar line', () => {
  for (const meter of [3, 5] as const) {
    const grid = new TimingGrid(1, 60, meter);
    assert.equal(grid.match(meter, 0.2, 1)?.beat, meter);
    assert.deepEqual(beatPosition(1, 60, meter + 1, meter), {
      beat: 1,
      phase: 0,
      measureIndex: 1,
    });
    assert.equal(grid.match(meter + 1, 0.2, 1)?.measureIndex, 1);
  }
});
