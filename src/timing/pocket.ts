import type { Meter, TimingEvent } from './grid.ts';

export interface PocketState {
  completedWindow: number;
  percent: number | null;
}

export const initialPocketState: PocketState = { completedWindow: -1, percent: null };

// Rests are free. Wait for enough distinct attacks before reporting a window.
export const POCKET_MEASURES = 2;
export const POCKET_MIN_NOTES = 6;
export const POCKET_SETTLE_MS = 200;

export function scorePocketOffset(offsetMs: number, bpm: number): number {
  const sixteenthMs = 15_000 / bpm;
  const fullCreditMs = Math.min(20, Math.max(10, sixteenthMs * 0.12));
  const zeroCreditMs = Math.min(80, Math.max(35, sixteenthMs * 0.45));
  const error = Math.abs(offsetMs);
  if (error <= fullCreditMs) return 100;
  if (error >= zeroCreditMs) return 0;
  return (100 * (zeroCreditMs - error)) / (zeroCreditMs - fullCreditMs);
}

export function scorePocketWindow(
  events: readonly TimingEvent[],
  windowIndex: number,
  bpm: number,
): number | null {
  const firstMeasure = windowIndex * POCKET_MEASURES;
  const hits = new Map<number, TimingEvent>();
  for (const event of events) {
    if (
      event.subdivisionMeasureIndex >= firstMeasure &&
      event.subdivisionMeasureIndex < firstMeasure + POCKET_MEASURES
    ) {
      hits.set(event.subdivisionIndex, event);
    }
  }
  if (hits.size < POCKET_MIN_NOTES) return null;
  return Math.round(
    [...hits.values()].reduce(
      (sum, event) => sum + scorePocketOffset(event.subdivisionOffsetMs, bpm),
      0,
    ) / hits.size,
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
    const score = scorePocketWindow(events, window, bpm);
    if (score !== null) percent = score;
  }
  return { completedWindow: newestCompletedWindow, percent };
}
