export type Meter = 3 | 4 | 5;

export interface TimingEvent {
  timestamp: number;
  // Nearest audible quarter-note click (kept for calibration and diagnostics).
  expectedTimestamp: number;
  rawOffsetMs: number;
  correctedOffsetMs: number;
  beat: number;
  measureIndex: number;
  // Nearest sixteenth-note target after applying the saved input delay.
  subdivisionExpectedTimestamp: number;
  subdivisionRawOffsetMs: number;
  subdivisionOffsetMs: number;
  subdivisionIndex: number;
  subdivision: 0 | 1 | 2 | 3;
  subdivisionBeat: number;
  subdivisionMeasureIndex: number;
  confidence: number;
  amplitude: number;
  clickBleed?: boolean;
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
    const subdivisionIndex = Math.max(
      0,
      Math.round(
        (timestamp - this.calibrationOffsetMs / 1000 - this.anchor) / (this.stepSeconds / 4),
      ),
    );
    const subdivisionExpectedTimestamp = this.anchor + (subdivisionIndex * this.stepSeconds) / 4;
    const subdivisionRawOffsetMs = (timestamp - subdivisionExpectedTimestamp) * 1000;
    const subdivisionBeatIndex = Math.floor(subdivisionIndex / 4);
    return {
      timestamp,
      expectedTimestamp,
      rawOffsetMs,
      correctedOffsetMs: rawOffsetMs - this.calibrationOffsetMs,
      beat: (index % this.meter) + 1,
      measureIndex: Math.floor(index / this.meter),
      subdivisionExpectedTimestamp,
      subdivisionRawOffsetMs,
      subdivisionOffsetMs: subdivisionRawOffsetMs - this.calibrationOffsetMs,
      subdivisionIndex,
      subdivision: (subdivisionIndex % 4) as 0 | 1 | 2 | 3,
      subdivisionBeat: (subdivisionBeatIndex % this.meter) + 1,
      subdivisionMeasureIndex: Math.floor(subdivisionBeatIndex / this.meter),
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
