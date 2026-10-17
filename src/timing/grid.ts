export type Meter = 3 | 4 | 5;

export interface TimingEvent {
  timestamp: number;
  expectedTimestamp: number;
  rawOffsetMs: number;
  correctedOffsetMs: number;
  beat: number;
  measureIndex: number;
  confidence: number;
  amplitude: number;
}

export class TimingGrid {
  readonly anchor: number;
  readonly bpm: number;
  readonly meter: Meter;
  readonly calibrationOffsetMs: number;

  constructor(anchor: number, bpm: number, meter: Meter, calibrationOffsetMs = 0) {
    this.anchor = anchor;
    this.bpm = bpm;
    this.meter = meter;
    this.calibrationOffsetMs = calibrationOffsetMs;
  }

  get stepSeconds(): number {
    return 60 / this.bpm;
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
      beat: (index % this.meter) + 1,
      measureIndex: Math.floor(index / this.meter),
      confidence,
      amplitude,
    };
  }
}

export function beatPosition(
  anchor: number,
  bpm: number,
  timestamp: number,
  meter: Meter,
): { beat: number; phase: number; measureIndex: number } | null {
  if (timestamp < anchor) return null;
  const beats = ((timestamp - anchor) * bpm) / 60;
  const index = Math.floor(beats);
  return {
    beat: (index % meter) + 1,
    phase: beats - index,
    measureIndex: Math.floor(index / meter),
  };
}
