import { Manual } from '../../hardware/Manual.tsx';
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
    <Manual title="Input" className="input-card" onClose={onClose}>
      <div className="manual-intro">
        <h2>Input</h2>
        <p className="overlay-copy">Use headphones to keep the click out of the mic.</p>
      </div>
      <section className="manual-section">
        <div className="field-heading">
          <span>Audio source</span>
          <span>{deviceNote}</span>
        </div>
        <div className="device-picker">
          <button
            type="button"
            aria-label="Previous audio source"
            disabled={!deviceCount}
            onClick={() => onDevice(-1)}
          >
            ‹
          </button>
          <span className="device-name">{deviceName}</span>
          <button
            type="button"
            aria-label="Next audio source"
            disabled={!deviceCount}
            onClick={() => onDevice(1)}
          >
            ›
          </button>
        </div>
      </section>
      <section className="manual-section signal-section">
        <div className="signal-heading">
          <span>Input level</span>
          <span>{signal.label}</span>
        </div>
        <div
          className={`signal-meter ${signal.clipping ? 'clipping' : ''}`}
          role="progressbar"
          aria-label="Input level"
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
          <h3>Timing adjustment</h3>
          <span className="calibration-value">
            {calibration.saved ? `${Math.round(calibration.value)} ms` : 'Not set'}
          </span>
        </div>
        <div className="cal-actions">
          <button type="button" className="calibrate-button" disabled={busy} onClick={onCalibrate}>
            Calibrate with 8 notes
          </button>
          <button type="button" className="text-button" onClick={onClear}>
            Clear
          </button>
        </div>
      </section>
    </Manual>
  );
}
