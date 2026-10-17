import assert from 'node:assert/strict';
import test from 'node:test';
import { beatPosition, TimingGrid } from '../src/timing/grid.ts';
import { advancePocketState, initialPocketState, scorePocketWindow } from '../src/timing/pocket.ts';

test('pocket score waits for two completed measures and a short onset grace period', () => {
  const grid = new TimingGrid(1, 60, 1);
  const events = Array.from({ length: 8 }, (_, index) =>
    grid.match(1 + index + (index < 6 ? 0 : 0.04), 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(events, 0, 1), 75);

  const beforeBoundary = advancePocketState(
    events,
    beatPosition(1, 60, 8.9),
    60,
    1,
    initialPocketState,
  );
  assert.equal(beforeBoundary.percent, null);
  const duringGrace = advancePocketState(events, beatPosition(1, 60, 9.1), 60, 1, beforeBoundary);
  assert.equal(duringGrace.percent, null);
  const assessed = advancePocketState(events, beatPosition(1, 60, 9.25), 60, 1, duringGrace);
  assert.deepEqual(assessed, { completedWindow: 0, percent: 75 });
  assert.strictEqual(
    advancePocketState(events, beatPosition(1, 60, 12), 60, 1, assessed),
    assessed,
  );

  const nextWindow = Array.from({ length: 8 }, (_, index) => grid.match(9 + index + 0.04, 0.2, 1)!);
  assert.deepEqual(
    advancePocketState([...events, ...nextWindow], beatPosition(1, 60, 17.25), 60, 1, assessed),
    { completedWindow: 1, percent: 0 },
  );
});

test('sparse playing keeps the previous pocket score', () => {
  const grid = new TimingGrid(1, 60, 1);
  const sparse = [0, 1, 2, 4, 5].map((index) => grid.match(1 + index, 0.2, 1)!);
  assert.equal(scorePocketWindow(sparse, 0, 1), null);
  assert.deepEqual(
    advancePocketState(sparse, beatPosition(1, 60, 9.25), 60, 1, {
      completedWindow: -1,
      percent: 80,
    }),
    { completedWindow: 0, percent: 80 },
  );
});

test('coverage follows the selected note grid', () => {
  const eighths = new TimingGrid(1, 60, 2);
  const quarterRateNotes = Array.from({ length: 8 }, (_, index) =>
    eighths.match(1 + index, 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(quarterRateNotes, 0, 2), null);
});
