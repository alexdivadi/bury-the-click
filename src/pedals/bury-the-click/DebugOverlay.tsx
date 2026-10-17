import { useEffect, useRef, useState } from 'react';
import { MIN_ONSET_CONFIDENCE } from '../../audio/onsetPolicy.ts';
import { TEXT } from '../../text.ts';
import type { SignalLevel } from './useInputPreview.ts';

export interface DebugEntry {
  elapsed: number;
  measure: number;
  beat: number;
  subdivision: 0 | 1 | 2 | 3;
  rawOffsetMs: number;
  subdivisionRawOffsetMs: number;
  subdivisionOffsetMs: number;
  amplitude: number;
  confidence: number;
  result: 'accepted' | 'duplicate' | 'calibration' | 'low-confidence' | 'click-bleed';
}

function elapsedLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}

export function DebugOverlay({
  entries,
  mode,
  inputName,
  signal,
  getSessionElapsed,
}: {
  entries: readonly DebugEntry[];
  mode: keyof typeof TEXT.trace.mode;
  inputName: string;
  signal: SignalLevel;
  getSessionElapsed: () => number;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [elapsed, setElapsed] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const active = mode === 'running' || mode === 'calibrating';

  useEffect(() => {
    if (!open || !active) return;
    const tick = () => setElapsed(getSessionElapsed());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [open, active, getSessionElapsed]);

  const moveTo = (x: number, y: number) => {
    const width = panel.current?.offsetWidth ?? 0;
    const height = panel.current?.offsetHeight ?? 0;
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
  };

  if (!open)
    return (
      <button type="button" className="debug-toggle" onClick={() => setOpen(true)}>
        {TEXT.trace.title}
      </button>
    );

  return (
    <aside
      ref={panel}
      className="debug-panel"
      style={{ left: position.x, top: position.y }}
      aria-label={TEXT.trace.title}
    >
      <div className="debug-heading">
        <button
          type="button"
          className="debug-handle"
          aria-label={TEXT.trace.drag}
          onPointerDown={(event) => {
            drag.current = { pointerX: event.clientX, pointerY: event.clientY, ...position };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            moveTo(
              drag.current.x + event.clientX - drag.current.pointerX,
              drag.current.y + event.clientY - drag.current.pointerY,
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const steps: Record<string, [number, number]> = {
              ArrowLeft: [-20, 0],
              ArrowRight: [20, 0],
              ArrowUp: [0, -20],
              ArrowDown: [0, 20],
            };
            const step = steps[event.key];
            if (!step) return;
            event.preventDefault();
            moveTo(position.x + step[0], position.y + step[1]);
          }}
        >
          ⋮⋮ {TEXT.trace.title}
        </button>
        <button
          type="button"
          className="debug-close"
          aria-label={TEXT.trace.close}
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>
      <div className="debug-summary">
        <span>{TEXT.trace.mode[mode]}</span>
        <span>{active ? elapsedLabel(elapsed) : TEXT.trace.stopped}</span>
        <span>{TEXT.trace.level(signal.percent)}</span>
      </div>
      <p className="debug-source" title={inputName}>
        {inputName}
      </p>
      <div className="debug-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{TEXT.trace.sinceStart}</th>
              <th>{TEXT.trace.sixteenthTarget}</th>
              <th>{TEXT.trace.clickMs}</th>
              <th>{TEXT.trace.sixteenthRaw}</th>
              <th>{TEXT.trace.sixteenthAdjusted}</th>
              <th>{TEXT.trace.attack}</th>
              <th>{TEXT.trace.confidence}</th>
              <th>{TEXT.trace.result}</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((entry, index) => (
              <tr key={`${entry.elapsed}-${index}`} className={`debug-${entry.result}`}>
                <td>{elapsedLabel(entry.elapsed)}</td>
                <td>
                  {entry.measure} · {entry.beat}
                  {TEXT.trace.subdivisionMarks[entry.subdivision]}
                </td>
                <td>{Math.round(entry.rawOffsetMs)}</td>
                <td>{Math.round(entry.subdivisionRawOffsetMs)}</td>
                <td>{Math.round(entry.subdivisionOffsetMs)}</td>
                <td>{entry.amplitude.toFixed(4)}</td>
                <td>{entry.confidence.toFixed(2)}</td>
                <td>{TEXT.trace.results[entry.result]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length && <p className="debug-empty">{TEXT.trace.empty}</p>}
      </div>
      <p className="debug-note">{TEXT.trace.note(MIN_ONSET_CONFIDENCE.toFixed(2))}</p>
    </aside>
  );
}
