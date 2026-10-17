import type { TimingEvent } from './grid.ts';

export function sessionMetrics(
  events: TimingEvent[],
  toleranceMs = 20,
): { averageError: number; lock: number } {
  if (!events.length) return { averageError: 0, lock: 0 };
  return {
    averageError: Math.round(
      events.reduce((sum, event) => sum + Math.abs(event.correctedOffsetMs), 0) / events.length,
    ),
    lock: Math.round(
      (100 * events.filter((event) => Math.abs(event.correctedOffsetMs) <= toleranceMs).length) /
        events.length,
    ),
  };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
