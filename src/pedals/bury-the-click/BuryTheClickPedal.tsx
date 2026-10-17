import { AudioJack } from '../../hardware/AudioJack.tsx';
import { Dial } from '../../hardware/Dial.tsx';
import { Footswitch } from '../../hardware/Footswitch.tsx';
import { Light } from '../../hardware/Light.tsx';
import { Pedal } from '../../hardware/Pedal.tsx';
import { Switch } from '../../hardware/Switch.tsx';
import type { Meter } from '../../timing/grid.ts';
import { CalibrationManual } from './CalibrationManual.tsx';
import { BuryTheClickDisplay } from './BuryTheClickDisplay.tsx';
import { InputManual } from './InputManual.tsx';
import { usePedalSession } from './usePedalSession.ts';

const meters = [3, 4, 5] as const satisfies readonly Meter[];

export function BuryTheClickPedal() {
  const session = usePedalSession();
  const running = session.mode === 'running';
  const meterPosition = meters.indexOf(session.meter);
  return (
    <>
      <Pedal texture="powder-coat" label="Bury the Click timing trainer">
        <AudioJack onPress={session.openInput} />
        <BuryTheClickDisplay
          bpm={session.bpm}
          gain={session.gain}
          meter={session.meter}
          events={session.events}
          latest={session.latest}
          pocketPercent={session.pocketPercent}
          inputName={session.deviceId ? session.deviceName : 'Default input'}
          status={session.status.text}
          running={running}
          getBeatPosition={session.getBeatPosition}
        />
        <section className="control-row" aria-label="Practice controls">
          <Dial
            label="Tempo"
            value={session.bpm}
            min={40}
            max={200}
            defaultValue={80}
            dragScale={0.9}
            onChange={session.changeBpm}
          />
          <Dial
            label="Input gain"
            value={session.gain}
            min={0}
            max={100}
            defaultValue={55}
            dragScale={0.65}
            onChange={session.changeGain}
          />
        </section>
        <section className="routing-row" aria-label="Time signature control">
          <Switch
            label="Time signature"
            options={['3/4', '4/4', '5/4']}
            marks={['3/4', '4/4', '5/4']}
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
          <span className="switch-label">START / STOP</span>
        </footer>
        <header className="brand">
          <h1>
            Bury the
            <br />
            Click
          </h1>
          <span className="model">No. 01</span>
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
    </>
  );
}
