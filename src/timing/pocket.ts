import type { Meter, TimingEvent } from './grid.ts';

export interface PocketState {
  completedWindow: number;
  percent: number | null;
}

export const initialPocketState: PocketState = { completedWindow: -1, percent: null };

// Each assessment covers two complete measures. A few isolated hits are not enough
// to describe a player's pocket, so require notes in at least 75% of grid slots.
export const POCKET_MEASURES = 2;
export const POCKET_TOLERANCE_MS = 20;
export const POCKET_MIN_COVERAGE = 0.75;
export const POCKET_SETTLE_MS = 200;

export function scorePocketWindow(
  events: readonly TimingEvent[],
  windowIndex: number,
  meter: Meter,
): number | null {
  const firstMeasure = windowIndex * POCKET_MEASURES;
  const hits = new Map<number, TimingEvent>();
  for (const event of events) {
    if (event.measureIndex >= firstMeasure && event.measureIndex < firstMeasure + POCKET_MEASURES)
      hits.set(event.expectedTimestamp, event);
  }
  const expectedSlots = meter * POCKET_MEASURES;
  if (hits.size < Math.ceil(expectedSlots * POCKET_MIN_COVERAGE)) return null;
  return Math.round(
    (100 *
      [...hits.values()].filter((event) => Math.abs(event.correctedOffsetMs) <= POCKET_TOLERANCE_MS)
        .length) /
      hits.size,
  );
}

export function advancePocketState(
  events: readonly TimingEvent[],
  position: { beat: number; phase: number; measureIndex: number } | null,
  bpm: number,
  meter: Meter,
  previous: PocketState,
): PocketState {
  if (!position) return previous;
  const elapsedInMeasureMs = ((position.beat - 1 + position.phase) * 60_000) / bpm;
  const settledMeasure = position.measureIndex - (elapsedInMeasureMs < POCKET_SETTLE_MS ? 1 : 0);
  const newestCompletedWindow = Math.floor(settledMeasure / POCKET_MEASURES) - 1;
  if (newestCompletedWindow <= previous.completedWindow) return previous;

  let percent = previous.percent;
  for (let window = previous.completedWindow + 1; window <= newestCompletedWindow; window++) {
    const score = scorePocketWindow(events, window, meter);
    if (score !== null) percent = score;
  }
  return { completedWindow: newestCompletedWindow, percent };
}
