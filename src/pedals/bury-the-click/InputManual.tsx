import { Manual } from '../../hardware/Manual.tsx';
import { TEXT } from '../../text.ts';
import type { SignalLevel } from './useInputPreview.ts';

export function InputManual({
  deviceName,
  deviceNote,
  deviceCount,
  signal,
  calibration,
  busy,
  onClose,
  onDevice,
  onCalibrate,
  onClear,
}: {
  deviceName: string;
  deviceNote: string;
  deviceCount: number;
  signal: SignalLevel;
  calibration: { value: number; saved: boolean };
  busy: boolean;
  onClose: () => void;
  onDevice: (direction: -1 | 1) => void;
  onCalibrate: () => void;
  onClear: () => void;
}) {
  return (
    <Manual title={TEXT.input.title} className="input-card" onClose={onClose}>
      <div className="manual-intro">
        <h2>{TEXT.input.title}</h2>
        <p className="overlay-copy">{TEXT.input.headphones}</p>
      </div>
      <section className="manual-section">
        <div className="field-heading">
          <span>{TEXT.input.audioSource}</span>
          <span>{deviceNote}</span>
        </div>
        <div className="device-picker">
          <button
            type="button"
            aria-label={TEXT.input.previousSource}
            disabled={!deviceCount}
            onClick={() => onDevice(-1)}
          >
            ‹
          </button>
          <span className="device-name">{deviceName}</span>
          <button
            type="button"
            aria-label={TEXT.input.nextSource}
            disabled={!deviceCount}
            onClick={() => onDevice(1)}
          >
            ›
          </button>
        </div>
      </section>
      <section className="manual-section signal-section">
        <div className="signal-heading">
          <span>{TEXT.input.inputLevel}</span>
          <span>{signal.label}</span>
        </div>
        <div
          className={`signal-meter ${signal.clipping ? 'clipping' : ''}`}
          role="progressbar"
          aria-label={TEXT.input.inputLevel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={signal.percent}
        >
          <span style={{ width: `${signal.percent}%` }} />
          <i />
        </div>
      </section>
      <section className="manual-section calibration-block">
        <div className="calibration-heading">
          <h3>{TEXT.input.timingAdjustment}</h3>
          <span className="calibration-value">
            {calibration.saved ? TEXT.input.calibrationValue(calibration.value) : TEXT.input.notSet}
          </span>
        </div>
        <div className="cal-actions">
          <button type="button" className="calibrate-button" disabled={busy} onClick={onCalibrate}>
            {TEXT.input.calibrate}
          </button>
          <button type="button" className="text-button" onClick={onClear}>
            {TEXT.input.clear}
          </button>
        </div>
      </section>
    </Manual>
  );
}
