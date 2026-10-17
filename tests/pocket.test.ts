import assert from 'node:assert/strict';
import test from 'node:test';
import { beatPosition, TimingGrid } from '../src/timing/grid.ts';
import { advancePocketState, initialPocketState, scorePocketWindow } from '../src/timing/pocket.ts';

test('pocket score waits for two completed measures and a short onset grace period', () => {
  const grid = new TimingGrid(1, 60, 4);
  const events = Array.from({ length: 8 }, (_, index) =>
    grid.match(1 + index + (index < 6 ? 0 : 0.04), 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(events, 0, 4), 75);

  const beforeBoundary = advancePocketState(
    events,
    beatPosition(1, 60, 8.9, 4),
    60,
    4,
    initialPocketState,
  );
  assert.equal(beforeBoundary.percent, null);
  const duringGrace = advancePocketState(
    events,
    beatPosition(1, 60, 9.1, 4),
    60,
    4,
    beforeBoundary,
  );
  assert.equal(duringGrace.percent, null);
  const assessed = advancePocketState(events, beatPosition(1, 60, 9.25, 4), 60, 4, duringGrace);
  assert.deepEqual(assessed, { completedWindow: 0, percent: 75 });
  assert.strictEqual(
    advancePocketState(events, beatPosition(1, 60, 12, 4), 60, 4, assessed),
    assessed,
  );

  const nextWindow = Array.from({ length: 8 }, (_, index) => grid.match(9 + index + 0.04, 0.2, 1)!);
  assert.deepEqual(
    advancePocketState([...events, ...nextWindow], beatPosition(1, 60, 17.25, 4), 60, 4, assessed),
    { completedWindow: 1, percent: 0 },
  );
});

test('sparse playing keeps the previous pocket score', () => {
  const grid = new TimingGrid(1, 60, 4);
  const sparse = [0, 1, 2, 4, 5].map((index) => grid.match(1 + index, 0.2, 1)!);
  assert.equal(scorePocketWindow(sparse, 0, 4), null);
  assert.deepEqual(
    advancePocketState(sparse, beatPosition(1, 60, 9.25, 4), 60, 4, {
      completedWindow: -1,
      percent: 80,
    }),
    { completedWindow: 0, percent: 80 },
  );
});

test('two-measure coverage follows the selected meter', () => {
  for (const meter of [3, 5] as const) {
    const grid = new TimingGrid(1, 60, meter);
    const notes = Array.from({ length: 2 * meter }, (_, index) => grid.match(1 + index, 0.2, 1)!);
    assert.equal(scorePocketWindow(notes, 0, meter), 100);
    assert.deepEqual(
      advancePocketState(
        notes,
        beatPosition(1, 60, 1 + 2 * meter + 0.25, meter),
        60,
        meter,
        initialPocketState,
      ),
      { completedWindow: 0, percent: 100 },
    );
  }
});
