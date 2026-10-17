import assert from 'node:assert/strict';
import test from 'node:test';
import { beatPosition, TimingGrid } from '../src/timing/grid.ts';
import {
  advancePocketState,
  initialPocketState,
  scorePocketOffset,
  scorePocketWindow,
} from '../src/timing/pocket.ts';

test('pocket score waits for two completed measures and a short onset grace period', () => {
  const grid = new TimingGrid(1, 60, 4);
  const events = Array.from({ length: 8 }, (_, index) =>
    grid.match(1 + index + (index < 6 ? 0 : 0.04), 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(events, 0, 60), 92);

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
  assert.deepEqual(assessed, { completedWindow: 0, percent: 92 });
  assert.strictEqual(
    advancePocketState(events, beatPosition(1, 60, 12, 4), 60, 4, assessed),
    assessed,
  );

  const nextWindow = Array.from({ length: 8 }, (_, index) => grid.match(9 + index + 0.04, 0.2, 1)!);
  assert.deepEqual(
    advancePocketState([...events, ...nextWindow], beatPosition(1, 60, 17.25, 4), 60, 4, assessed),
    { completedWindow: 1, percent: 67 },
  );
});

test('sparse playing keeps the previous pocket score', () => {
  const grid = new TimingGrid(1, 60, 4);
  const sparse = [0, 1, 2, 4, 5].map((index) => grid.match(1 + index, 0.2, 1)!);
  assert.equal(scorePocketWindow(sparse, 0, 60), null);
  assert.deepEqual(
    advancePocketState(sparse, beatPosition(1, 60, 9.25, 4), 60, 4, {
      completedWindow: -1,
      percent: 80,
    }),
    { completedWindow: 0, percent: 80 },
  );
});

test('two-measure scoring follows the selected meter', () => {
  for (const meter of [3, 5] as const) {
    const grid = new TimingGrid(1, 60, meter);
    const notes = Array.from({ length: 2 * meter }, (_, index) => grid.match(1 + index, 0.2, 1)!);
    assert.equal(scorePocketWindow(notes, 0, 60), 100);
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

test('sixteenth notes use their own targets and all count toward the pocket score', () => {
  const grid = new TimingGrid(1, 80, 4);
  const notes = Array.from({ length: 32 }, (_, index) =>
    grid.match(1 + index * (60 / 80 / 4) + 0.01, 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(notes, 0, 80), 100);
  assert.equal(new Set(notes.map((note) => note.subdivisionExpectedTimestamp)).size, 32);
});

test('rests do not lower the score once enough distinct notes were played', () => {
  const grid = new TimingGrid(1, 80, 4);
  const notes = [0, 2, 5, 8, 11, 19].map((slot) => grid.match(1 + slot * (60 / 80 / 4), 0.2, 1)!);
  assert.equal(scorePocketWindow(notes, 0, 80), 100);
});

test('poor timing gets partial or no credit, with tighter limits at high tempos', () => {
  assert.equal(scorePocketOffset(0, 80), 100);
  assert.equal(Math.round(scorePocketOffset(40, 80)), 67);
  assert.equal(scorePocketOffset(80, 80), 0);
  assert.ok(scorePocketOffset(30, 200) < scorePocketOffset(30, 80));
  const grid = new TimingGrid(1, 80, 4);
  const notes = [0, 4, 8, 12, 16, 20].map((slot) =>
    grid.match(1 + slot * (60 / 80 / 4) + 0.07, 0.2, 1)!,
  );
  assert.equal(scorePocketWindow(notes, 0, 80), 17);
});
