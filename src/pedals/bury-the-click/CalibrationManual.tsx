import { useEffect, useRef } from 'react';
import { Manual } from '../../hardware/Manual.tsx';
import { TEXT } from '../../text.ts';

function CalibrationBeat({
  bpm,
  getBeatPosition,
}: {
  bpm: number;
  getBeatPosition: () => { beat: number; phase: number } | null;
}) {
  const face = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const position = getBeatPosition();
      if (number.current) number.current.textContent = String(position?.beat ?? 1);
      face.current?.classList.toggle(
        'pulse',
        position !== null && position.phase < Math.min(0.35, bpm / 600),
      );
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bpm, getBeatPosition]);
  return (
    <div className="cal-beat" ref={face}>
      <small>{TEXT.calibration.click}</small>
      <strong ref={number}>1</strong>
    </div>
  );
}

export function CalibrationManual({
  bpm,
  heard,
  signalPercent,
  hint,
  getBeatPosition,
  onCancel,
}: {
  bpm: number;
  heard: number;
  signalPercent: number;
  hint: string;
  getBeatPosition: () => { beat: number; phase: number } | null;
  onCancel: () => void;
}) {
  return (
    <Manual title={TEXT.calibration.title} className="calibration-card" onClose={onCancel}>
      <h2>{TEXT.calibration.title}</h2>
      <p className="overlay-copy">
        {TEXT.calibration.instructionBeforeTempo} <strong>{TEXT.calibration.tempo(bpm)}</strong>
        {TEXT.calibration.instructionAfterTempo}
      </p>
      <div className="calibration-face">
        <CalibrationBeat bpm={bpm} getBeatPosition={getBeatPosition} />
        <div className="cal-count">
          <strong>{heard}</strong>
          <span>{TEXT.calibration.notesHeard}</span>
        </div>
      </div>
      <div
        className="cal-progress"
        role="progressbar"
        aria-label={TEXT.calibration.progress}
        aria-valuemin={0}
        aria-valuemax={8}
        aria-valuenow={heard}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className={index < heard ? 'heard' : ''} />
        ))}
      </div>
      <div className="cal-monitor">
        <span>{TEXT.calibration.input}</span>
        <div className="cal-monitor-track">
          <i style={{ width: `${signalPercent}%` }} />
        </div>
      </div>
      <p className="cal-hint">{hint}</p>
    </Manual>
  );
}
