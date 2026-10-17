import { AudioJack } from '../../hardware/AudioJack.tsx';
import { Dial } from '../../hardware/Dial.tsx';
import { Footswitch } from '../../hardware/Footswitch.tsx';
import { Light } from '../../hardware/Light.tsx';
import { Pedal } from '../../hardware/Pedal.tsx';
import { Switch } from '../../hardware/Switch.tsx';
import { DEBUG_MENU_ENABLED } from '../../debug.ts';
import type { Meter } from '../../timing/grid.ts';
import { TEXT } from '../../text.ts';
import { CalibrationManual } from './CalibrationManual.tsx';
import { BuryTheClickDisplay } from './BuryTheClickDisplay.tsx';
import { DebugOverlay } from './DebugOverlay.tsx';
import { InputManual } from './InputManual.tsx';
import { usePedalSession } from './usePedalSession.ts';

const meters = [3, 4, 5] as const satisfies readonly Meter[];

export function BuryTheClickPedal() {
  const session = usePedalSession();
  const running = session.mode === 'running';
  const meterPosition = meters.indexOf(session.meter);
  return (
    <>
      <Pedal texture="powder-coat" label={TEXT.pedal.label}>
        <AudioJack onPress={session.openInput} />
        <BuryTheClickDisplay
          bpm={session.bpm}
          gain={session.gain}
          meter={session.meter}
          events={session.events}
          latest={session.latest}
          pocketPercent={session.pocketPercent}
          inputName={session.deviceId ? session.deviceName : TEXT.pedal.defaultInput}
          status={session.status.text}
          running={running}
          getBeatPosition={session.getBeatPosition}
        />
        <section className="control-row" aria-label={TEXT.pedal.practiceControls}>
          <Dial
            label={TEXT.pedal.tempo}
            value={session.bpm}
            min={40}
            max={200}
            defaultValue={80}
            dragScale={0.9}
            onChange={session.changeBpm}
          />
          <Dial
            label={TEXT.pedal.inputGain}
            value={session.gain}
            min={0}
            max={100}
            defaultValue={55}
            dragScale={0.65}
            onChange={session.changeGain}
          />
        </section>
        <section className="routing-row" aria-label={TEXT.pedal.timeSignatureControl}>
          <Switch
            label={TEXT.pedal.timeSignature}
            options={TEXT.pedal.meterOptions}
            marks={TEXT.pedal.meterOptions}
            value={meterPosition}
            onChange={(position) => session.changeMeter(meters[position])}
          />
        </section>
        <footer className="pedal-footer">
          <Light color={session.status.tone === 'warning' ? 'warning' : running ? 'red' : 'off'} />
          <Footswitch
            running={running}
            disabled={session.mode === 'connecting' || session.mode === 'calibrating'}
            onPress={() => void session.togglePractice()}
          />
          <span className="switch-label">{TEXT.pedal.startStop}</span>
        </footer>
        <header className="brand">
          <h1>
            {TEXT.pedal.brandFirstLine}
            <br />
            {TEXT.pedal.brandSecondLine}
          </h1>
          <span className="model">{TEXT.pedal.model}</span>
        </header>
      </Pedal>
      {session.modal === 'input' && (
        <InputManual
          deviceName={session.deviceName}
          deviceNote={session.deviceNote}
          deviceCount={session.devices.length}
          signal={session.signal}
          calibration={session.calibration}
          busy={session.mode === 'connecting'}
          onClose={session.closeInput}
          onDevice={session.changeDevice}
          onCalibrate={() => void session.beginCalibration()}
          onClear={session.clearCalibration}
        />
      )}
      {session.modal === 'calibration' && (
        <CalibrationManual
          bpm={session.bpm}
          heard={session.samples.length}
          signalPercent={session.signal.percent}
          hint={session.hint}
          getBeatPosition={session.getBeatPosition}
          onCancel={session.cancelCalibration}
        />
      )}
      {DEBUG_MENU_ENABLED && (
        <DebugOverlay
          entries={session.debugEntries}
          mode={session.mode}
          inputName={session.deviceName}
          signal={session.signal}
          getSessionElapsed={session.getSessionElapsed}
        />
      )}
    </>
  );
}
