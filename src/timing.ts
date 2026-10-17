export type Subdivision = 1 | 2 | 4;

export interface TimingEvent {
  timestamp: number;
  expectedTimestamp: number;
  rawOffsetMs: number;
  correctedOffsetMs: number;
  beat: number;
  subdivision: number;
  confidence: number;
  amplitude: number;
}

export class TimingGrid {
  readonly anchor: number;
  readonly bpm: number;
  readonly subdivision: Subdivision;
  readonly calibrationOffsetMs: number;

  constructor(
    anchor: number,
    bpm: number,
    subdivision: Subdivision,
    calibrationOffsetMs = 0,
  ) {
    this.anchor = anchor;
    this.bpm = bpm;
    this.subdivision = subdivision;
    this.calibrationOffsetMs = calibrationOffsetMs;
  }

  get stepSeconds(): number {
    return 60 / this.bpm / this.subdivision;
  }

  match(timestamp: number, amplitude: number, confidence: number): TimingEvent | null {
    if (timestamp < this.anchor - this.stepSeconds / 2) return null;
    const index = Math.max(0, Math.round((timestamp - this.anchor) / this.stepSeconds));
    const expectedTimestamp = this.anchor + index * this.stepSeconds;
    const rawOffsetMs = (timestamp - expectedTimestamp) * 1000;
    return {
      timestamp,
      expectedTimestamp,
      rawOffsetMs,
      correctedOffsetMs: rawOffsetMs - this.calibrationOffsetMs,
      beat: Math.floor(index / this.subdivision) % 4 + 1,
      subdivision: index % this.subdivision,
      confidence,
      amplitude,
    };
  }
}

export function sessionMetrics(events: TimingEvent[], toleranceMs = 20): { averageError: number; lock: number } {
  if (!events.length) return { averageError: 0, lock: 0 };
  return {
    averageError: Math.round(events.reduce((sum, event) => sum + Math.abs(event.correctedOffsetMs), 0) / events.length),
    lock: Math.round(100 * events.filter((event) => Math.abs(event.correctedOffsetMs) <= toleranceMs).length / events.length),
  };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function beatPosition(anchor: number, bpm: number, timestamp: number): { beat: number; phase: number } | null {
  if (timestamp < anchor) return null;
  const beats = (timestamp - anchor) * bpm / 60;
  const index = Math.floor(beats);
  return { beat: index % 4 + 1, phase: beats - index };
}
