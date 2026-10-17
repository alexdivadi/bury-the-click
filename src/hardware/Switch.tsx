import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

export type SwitchOptions = readonly [string, string] | readonly [string, string, string];

export function Switch({
  label,
  options,
  marks,
  value,
  onChange,
}: {
  label: string;
  options: SwitchOptions;
  marks?: SwitchOptions;
  value: number;
  onChange: (position: number) => void;
}) {
  const gesture = useRef<{ x: number; value: number; dragged: boolean } | null>(null);
  const set = (position: number) => onChange(Math.max(0, Math.min(options.length - 1, position)));
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    gesture.current = { x: event.clientX, value, dragged: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start) return;
    const distance = event.clientX - start.x;
    if (Math.abs(distance) < 7) return;
    start.dragged = true;
    set(start.value + Math.sign(distance) * Math.max(1, Math.round(Math.abs(distance) / 42)));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    if (!gesture.current.dragged) onChange((value + 1) % options.length);
    gesture.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value + 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === ' ' || event.key === 'Enter') next = (value + 1) % options.length;
    else return;
    event.preventDefault();
    set(next);
  };
  return (
    <div className="routing-group">
      <div className={`lever-selector lever-selector--${options.length}`} data-position={value}>
        <div className="lever-marks" aria-hidden="true">
          {(marks ?? options).map((option) => (
            <span key={option}>{option}</span>
          ))}
        </div>
        <div className="lever-hardware" aria-hidden="true" />
        <div
          className="lever-hit-area"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={options.length - 1}
          aria-valuenow={value}
          aria-valuetext={options[value]}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            gesture.current = null;
          }}
          onKeyDown={key}
        />
      </div>
      <span className="control-label">{label}</span>
    </div>
  );
}
