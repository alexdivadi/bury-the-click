import { useRef, type PointerEvent, type KeyboardEvent } from 'react';

export function Dial({
  label,
  value,
  min,
  max,
  defaultValue,
  dragScale,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  dragScale: number;
  onChange: (value: number) => void;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const change = (next: number) => onChange(Math.max(min, Math.min(max, Math.round(next))));
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, value };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) change(drag.current.value + (event.clientX - drag.current.x) * dragScale);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (delta) {
      event.preventDefault();
      change(value + delta);
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      change(event.key === 'Home' ? min : max);
    }
  };
  return (
    <div className="knob-control">
      <span className="control-label">{label}</span>
      <div
        className="knob"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={
          {
            '--rotation': `${-135 + ((value - min) / (max - min)) * 270}deg`,
          } as React.CSSProperties
        }
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onDoubleClick={() => change(defaultValue)}
        onKeyDown={key}
      >
        <span className="knob-indicator" />
      </div>
    </div>
  );
}
