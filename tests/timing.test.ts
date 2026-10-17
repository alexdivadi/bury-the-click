import assert from 'node:assert/strict';
import test from 'node:test';
import { beatPosition, median, sessionMetrics, TimingGrid } from '../src/timing.ts';

test('matches early and late notes on the audio clock', () => {
  const grid = new TimingGrid(1, 80, 1);
  assert.equal(Math.round(grid.match(2.47, 0.2, 1)!.rawOffsetMs), -30);
  assert.equal(Math.round(grid.match(2.53, 0.2, 1)!.rawOffsetMs), 30);
  assert.equal(grid.match(0.5, 0.2, 1), null);
});

test('uses the selected subdivision and applies calibration once', () => {
  const grid = new TimingGrid(1, 120, 4, 12);
  const hit = grid.match(1.262, 0.2, 0.8)!;
  assert.equal(hit.beat, 1);
  assert.equal(hit.subdivision, 2);
  assert.equal(Math.round(hit.rawOffsetMs), 12);
  assert.equal(Math.round(hit.correctedOffsetMs), 0);
});

test('average error does not cancel early and late notes', () => {
  const grid = new TimingGrid(1, 60, 1);
  const events = [0.96, 2.04, 2.96, 4.04].map((time) => grid.match(time, 0.2, 1)!);
  assert.deepEqual(sessionMetrics(events), { averageError: 40, lock: 0 });
  assert.equal(median([12, 10, 40, 11]), 11.5);
});

test('beat indicator follows the same audio-clock anchor as the timing grid', () => {
  assert.equal(beatPosition(1, 120, 0.9), null);
  assert.deepEqual(beatPosition(1, 120, 1), { beat: 1, phase: 0 });
  assert.deepEqual(beatPosition(1, 120, 2.25), { beat: 3, phase: 0.5 });
});
