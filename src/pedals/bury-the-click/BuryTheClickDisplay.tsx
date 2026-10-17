import { useEffect, useRef } from 'react';
import { LCDScreen } from '../../hardware/LCDScreen.tsx';
import { averageOffset } from '../../timing/metrics.ts';
import type { Meter, TimingEvent } from '../../timing/grid.ts';
import { TEXT } from '../../text.ts';

const trail = [0.85, 0.5, 0.28, 0.16, 0.1];

function ScrollingLCDText({ text, className }: { text: string; className: string }) {
  const viewport = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const outer = viewport.current;
    const inner = content.current;
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return;
    let animation: Animation | undefined;
    const update = () => {
      animation?.cancel();
      animation = undefined;
      const overflow = inner.scrollWidth - outer.clientWidth;
      if (overflow <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const travel = (overflow / 35) * 1000;
      const duration = 2000 + travel + 1000;
      animation = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: 2000 / duration },
          { transform: `translateX(-${overflow}px)`, offset: (2000 + travel) / duration },
          { transform: `translateX(-${overflow}px)`, offset: 1 },
        ],
        { duration, iterations: Infinity },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    update();
    return () => {
      observer.disconnect();
      animation?.cancel();
    };
  }, [text]);

  return (
    <span className={className} ref={viewport} title={text}>
      <span className="display-scroll-text" ref={content}>
        {text}
      </span>
    </span>
  );
}

function BeatTrack({
  running,
  bpm,
  meter,
  getBeatPosition,
  tone,
  needlePosition,
  latest,
  inputFlashTimestamp,
}: {
  running: boolean;
  bpm: number;
  meter: Meter;
  getBeatPosition: () => { beat: number; phase: number } | null;
  tone: string;
  needlePosition: number;
  latest: TimingEvent | null;
  inputFlashTimestamp: number | null;
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
      <div className={`meter-track ${tone}`} aria-label={TEXT.display.timingPosition}>
        <div className="meter-center" />
        <div className="meter-ideal" />
        {inputFlashTimestamp !== null && (
          <div key={inputFlashTimestamp} className="meter-input-flash" aria-hidden="true" />
        )}
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
        <div className="beat-strip" ref={strip} aria-label={TEXT.display.beatClick(meter)}>
          {Array.from({ length: meter }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </>
  );
}

export function BuryTheClickDisplay({
  bpm,
  gain,
  meter,
  events,
  latest,
  pocketPercent,
  inputName,
  status,
  running,
  getBeatPosition,
}: {
  bpm: number;
  gain: number;
  meter: Meter;
  events: TimingEvent[];
  latest: TimingEvent | null;
  pocketPercent: number | null;
  inputName: string;
  status: string;
  running: boolean;
  getBeatPosition: () => { beat: number; phase: number } | null;
}) {
  const bias = averageOffset(events);
  const offset = latest ? Math.round(latest.subdivisionOffsetMs) : null;
  const tone =
    offset === null ? '' : Math.abs(offset) <= 20 ? 'on-time' : offset < 0 ? 'early' : 'late';
  // The full track spans ±200 ms, leaving visible room between a small miss and a large one.
  const needlePosition = latest
    ? 50 + Math.max(-50, Math.min(50, latest.subdivisionOffsetMs / 4))
    : 50;
  return (
    <>
      <div className="display-labels" aria-hidden="true">
        <span>{TEXT.display.offset}</span>
        <span>{TEXT.display.clickBpm}</span>
      </div>
      <LCDScreen label={TEXT.display.liveDisplay}>
        <div className="display-main">
          <div className={`timing-readout ${tone}`} aria-live="polite">
            <strong>
              {offset === null ? TEXT.display.noReading : `${offset > 0 ? '+' : ''}${offset}`}
            </strong>
            <span>
              {offset === null
                ? running
                  ? TEXT.display.playWithClick
                  : TEXT.display.waitingForNote
                : tone === 'on-time'
                  ? TEXT.display.onTime
                  : tone === 'early'
                    ? TEXT.display.early
                    : TEXT.display.late}
            </span>
          </div>
          <div className="tempo-numeral">
            <span>{bpm}</span>
          </div>
        </div>
        <BeatTrack
          running={running}
          bpm={bpm}
          meter={meter}
          getBeatPosition={getBeatPosition}
          tone={tone}
          needlePosition={needlePosition}
          latest={latest}
          inputFlashTimestamp={events.at(-1)?.timestamp ?? null}
        />
        <div className="display-footer">
          <ScrollingLCDText className="display-input-name" text={inputName} />
          <span className="display-status" role="status">
            <ScrollingLCDText className="display-status-text" text={status} />
          </span>
        </div>
        <div className="display-stats">
          <strong>
            {events.length ? `${bias > 0 ? '+' : ''}${bias}` : TEXT.display.noReading}
          </strong>
          <strong>{pocketPercent ?? TEXT.display.noReading}</strong>
          <strong>{gain}</strong>
          <strong>{meter}/4</strong>
        </div>
      </LCDScreen>
      <div className="display-legend" aria-hidden="true">
        <span>{TEXT.display.bias}</span>
        <span>{TEXT.display.pocket}</span>
        <span>{TEXT.display.gain}</span>
        <span>{TEXT.display.meter}</span>
      </div>
    </>
  );
}
