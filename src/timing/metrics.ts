import type { TimingEvent } from './grid.ts';

export function averageAbsoluteError(events: TimingEvent[]): number {
  if (!events.length) return 0;
  return Math.round(
    events.reduce((sum, event) => sum + Math.abs(event.correctedOffsetMs), 0) / events.length,
  );
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
