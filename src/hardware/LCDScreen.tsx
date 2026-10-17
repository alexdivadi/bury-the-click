import { useEffect, useRef } from 'react';
import { sessionMetrics } from '../timing/metrics.ts';
import type { Subdivision, TimingEvent } from '../timing/grid.ts';

const trail = [0.85, 0.5, 0.28, 0.16, 0.1];

function BeatTrack({
  running,
  bpm,
  getBeatPosition,
  tone,
  needlePosition,
  latest,
}: {
  running: boolean;
  bpm: number;
  getBeatPosition: () => { beat: number; phase: number } | null;
  tone: string;
  needlePosition: number;
  latest: TimingEvent | null;
}) {
  const runner = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previousStep = -1;
    const draw = () => {
      const position = getBeatPosition();
      const cells = runner.current?.children;
      const step = position ? Math.floor(((position.phase + 0.5) % 1) * 33) : -1;
      if (cells && step !== previousStep) {
        previousStep = step;
        for (let index = 0; index < cells.length; index++) {
          const distance = (step - index + cells.length) % cells.length;
          (cells[index] as HTMLElement).style.opacity =
            step < 0 ? '0' : String(trail[distance] ?? 0.08);
        }
      }
      if (strip.current)
        Array.from(strip.current.children).forEach((dot, index) => {
          dot.classList.toggle('current', position?.beat === index + 1);
          dot.classList.toggle(
            'pulse',
            position?.beat === index + 1 && position.phase < Math.min(0.35, bpm / 600),
          );
        });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [running, bpm, getBeatPosition]);
  return (
    <>
      <div className={`meter-track ${tone}`} aria-label="Timing position from early to late">
        <div className="meter-center" />
        <div className="meter-ideal" />
        <div
          key={latest?.timestamp ?? 'empty'}
          className={`meter-needle ${latest ? 'hit' : ''}`}
          style={{ left: `${needlePosition}%` }}
        />
        <div className="beat-runner" ref={runner} aria-hidden="true">
          {Array.from({ length: 33 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
      <div className="display-activity">
        <div className="beat-strip" ref={strip} aria-label="Four beat click">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </>
  );
}

export function LCDScreen({
  bpm,
  gain,
  grid,
  events,
  latest,
  inputName,
  status,
  running,
  getBeatPosition,
}: {
  bpm: number;
  gain: number;
  grid: Subdivision;
  events: TimingEvent[];
  latest: TimingEvent | null;
  inputName: string;
  status: string;
  running: boolean;
  getBeatPosition: () => { beat: number; phase: number } | null;
}) {
  const metrics = sessionMetrics(events);
  const offset = latest ? Math.round(latest.correctedOffsetMs) : null;
  const tone =
    offset === null ? '' : Math.abs(offset) <= 20 ? 'on-time' : offset < 0 ? 'early' : 'late';
  const needlePosition = latest ? 50 + Math.max(-50, Math.min(50, latest.correctedOffsetMs)) : 50;
  return (
    <>
      <div className="display-labels" aria-hidden="true">
        <span>OFFSET / MS</span>
        <span>CLICK / BPM</span>
      </div>
      <section className="display-window" aria-label="Live practice display">
        <div className="display-main">
          <div className={`timing-readout ${tone}`} aria-live="polite">
            <strong>{offset === null ? '--' : `${offset > 0 ? '+' : ''}${offset}`}</strong>
            <span>
              {offset === null
                ? running
                  ? 'Play with the click'
                  : 'Waiting for a note'
                : tone === 'on-time'
                  ? 'On time'
                  : tone === 'early'
                    ? 'Early'
                    : 'Late'}
            </span>
          </div>
          <div className="tempo-numeral">
            <span>{bpm}</span>
          </div>
        </div>
        <BeatTrack
          running={running}
          bpm={bpm}
          getBeatPosition={getBeatPosition}
          tone={tone}
          needlePosition={needlePosition}
          latest={latest}
        />
        <div className="display-footer">
          <span className="display-input-name">{inputName}</span>
          <span className="display-status" role="status">
            {status}
          </span>
        </div>
        <div className="display-stats">
          <strong>{events.length ? metrics.averageError : '--'}</strong>
          <strong>{events.length ? metrics.lock : '--'}</strong>
          <strong>{gain}</strong>
          <strong>{grid === 1 ? '1/4' : grid === 2 ? '1/8' : '1/16'}</strong>
        </div>
      </section>
      <div className="display-legend" aria-hidden="true">
        <span>AVG MS</span>
        <span>IN POCKET %</span>
        <span>GAIN %</span>
        <span>GRID</span>
      </div>
    </>
  );
}
