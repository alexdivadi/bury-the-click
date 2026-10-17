import { useCallback, useEffect, useRef, useState } from 'react';
import { cycleInputDevice, listInputs, type InputDevice } from '../../audio/inputDevices.ts';
import { WebAudioEngine } from '../../audio/WebAudioEngine.ts';
import { isConfidentOnset } from '../../audio/onsetPolicy.ts';
import { DEBUG_MENU_ENABLED } from '../../debug.ts';
import { median } from '../../timing/metrics.ts';
import { advancePocketState, initialPocketState, scorePocketWindow } from '../../timing/pocket.ts';
import type { PocketState } from '../../timing/pocket.ts';
import type { Meter, TimingEvent } from '../../timing/grid.ts';
import { TEXT } from '../../text.ts';
import { readCalibration, removeCalibration, writeCalibration } from './calibration.ts';
import type { DebugEntry } from './DebugOverlay.tsx';
import { emptySignal, signalLevel, useInputPreview } from './useInputPreview.ts';

type Mode = 'idle' | 'connecting' | 'running' | 'calibrating';
type Modal = 'input' | 'calibration' | null;
type Status = { text: string; tone: 'ready' | 'running' | 'warning' };

export function usePedalSession() {
  const [bpm, setBpm] = useState(80);
  const [gain, setGain] = useState(55);
  const [meter, setMeter] = useState<Meter>(4);
  const [mode, setModeState] = useState<Mode>('idle');
  const [modal, setModalState] = useState<Modal>(null);
  const [status, setStatus] = useState<Status>({ text: TEXT.status.ready, tone: 'ready' });
  const [events, setEvents] = useState<TimingEvent[]>([]);
  const [latest, setLatest] = useState<TimingEvent | null>(null);
  const [pocketPercent, setPocketPercent] = useState<number | null>(null);
  const [pocketMessage, setPocketMessage] = useState<string>(TEXT.status.pocket.collecting);
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [deviceNote, setDeviceNote] = useState('');
  const [calibration, setCalibration] = useState(() => readCalibration(''));
  const [samples, setSamples] = useState<number[]>([]);
  const [hint, setHint] = useState('');
  const [practiceSignal, setPracticeSignal] = useState(emptySignal);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const preview = useInputPreview();

  const modeRef = useRef<Mode>('idle');
  const modalRef = useRef<Modal>(null);
  const deviceRef = useRef('');
  const eventsRef = useRef<TimingEvent[]>([]);
  const pocketEventsRef = useRef<TimingEvent[]>([]);
  const pocketStateRef = useRef<PocketState>(initialPocketState);
  const bpmRef = useRef(80);
  const meterRef = useRef<Meter>(4);
  const samplesRef = useRef<number[]>([]);
  const lastSlot = useRef(Number.NEGATIVE_INFINITY);
  const lastAudible = useRef(0);
  const quietTimer = useRef<number | null>(null);
  const pocketTimer = useRef<number | null>(null);
  const request = useRef(0);
  const handlers = useRef<{
    timing: (event: TimingEvent) => void;
    signal: (level: number, clipping: boolean) => void;
    error: (message: string) => void;
  }>({
    timing: () => { },
    signal: () => { },
    error: () => { },
  });
  const [audio] = useState(
    () =>
      new WebAudioEngine({
        onTiming: (event) => handlers.current.timing(event),
        onSignal: (level, clipping) => handlers.current.signal(level, clipping),
        onError: (message) => handlers.current.error(message),
      }),
  );

  const setMode = (next: Mode) => {
    modeRef.current = next;
    setModeState(next);
  };
  const setModal = (next: Modal) => {
    modalRef.current = next;
    setModalState(next);
  };
  const stopQuietTimer = () => {
    if (quietTimer.current !== null) window.clearInterval(quietTimer.current);
    quietTimer.current = null;
  };
  const resetPocket = () => {
    pocketEventsRef.current = [];
    pocketStateRef.current = initialPocketState;
    setPocketPercent(null);
    setPocketMessage(TEXT.status.pocket.collecting);
  };
  const stopPocketTimer = () => {
    if (pocketTimer.current !== null) window.clearInterval(pocketTimer.current);
    pocketTimer.current = null;
  };

  const refreshDevices = useCallback(async () => {
    try {
      const inputs = (await listInputs()).filter(
        (input) => input.deviceId && input.deviceId !== 'default',
      );
      setDevices(inputs);
      if (deviceRef.current && !inputs.some((input) => input.deviceId === deviceRef.current)) {
        deviceRef.current = '';
        setDeviceId('');
        const saved = readCalibration('');
        setCalibration(saved);
        audio.setCalibration(saved.value);
        if (modeRef.current === 'running') handlers.current.error(TEXT.error.inputDisconnected);
      }
      const selectedName = deviceRef.current
        ? inputs.find((input) => input.deviceId === deviceRef.current)?.label ||
        TEXT.device.defaultInput
        : TEXT.device.defaultInput;
      setDeviceNote(
        /bluetooth|airpods|wireless/i.test(selectedName)
          ? TEXT.device.wirelessDelay
          : inputs.length
            ? TEXT.device.available(inputs.length)
            : TEXT.device.permissionNeeded,
      );
    } catch {
      setDeviceNote(TEXT.device.listUnavailable);
    }
  }, [audio]);

  const stopPractice = (message: string = TEXT.status.stopped) => {
    request.current++;
    audio.stop();
    stopQuietTimer();
    stopPocketTimer();
    setPracticeSignal(emptySignal);
    setMode('idle');
    setStatus({ text: message, tone: 'ready' });
  };

  const stopCalibration = () => {
    request.current++;
    audio.stop();
    setMode('idle');
    setPracticeSignal(emptySignal);
  };

  const closeInput = () => {
    preview.stop();
    setModal(null);
  };
  const openInput = () => {
    setModal('input');
    void refreshDevices();
    if (modeRef.current !== 'running')
      void preview.start(deviceRef.current, () => void refreshDevices());
  };
  const cancelCalibration = () => {
    stopCalibration();
    openInput();
  };
  const finishCalibration = (values: number[]) => {
    const value = median(values);
    stopCalibration();
    writeCalibration(deviceRef.current, value);
    setCalibration({ value, saved: true });
    audio.setCalibration(value);
    setStatus({ text: TEXT.status.calibrated(value), tone: 'ready' });
    openInput();
  };

  handlers.current = {
    timing: (event) => {
      if (modeRef.current !== 'running' && modeRef.current !== 'calibrating') return;
      const lowConfidence = !isConfidentOnset(event.confidence);
      const slot =
        modeRef.current === 'calibrating'
          ? event.expectedTimestamp
          : event.subdivisionExpectedTimestamp;
      const duplicate = slot === lastSlot.current;
      const result: DebugEntry['result'] = event.clickBleed
        ? 'click-bleed'
        : lowConfidence
          ? 'low-confidence'
          : duplicate
            ? 'duplicate'
            : modeRef.current === 'calibrating'
              ? 'calibration'
              : 'accepted';
      if (DEBUG_MENU_ENABLED)
        setDebugEntries((previous) =>
          [
            ...previous,
            {
              elapsed: audio.getSessionElapsed(event.timestamp),
              measure: event.subdivisionMeasureIndex + 1,
              beat: event.subdivisionBeat,
              subdivision: event.subdivision,
              rawOffsetMs: event.rawOffsetMs,
              subdivisionRawOffsetMs: event.subdivisionRawOffsetMs,
              subdivisionOffsetMs: event.subdivisionOffsetMs,
              amplitude: event.amplitude,
              confidence: event.confidence,
              result,
            },
          ].slice(-100),
        );
      // A ringing note can trigger the detector repeatedly in one subdivision.
      if (event.clickBleed || lowConfidence || duplicate) return;
      lastSlot.current = slot;
      if (modeRef.current === 'calibrating') {
        const next = [...samplesRef.current, event.rawOffsetMs];
        samplesRef.current = next;
        setSamples(next);
        if (next.length >= 8) finishCalibration(next);
        return;
      }
      if (modeRef.current !== 'running') return;
      const next = [...eventsRef.current, event].slice(-128);
      eventsRef.current = next;
      pocketEventsRef.current = [...pocketEventsRef.current, event].slice(-128);
      setEvents(next);
      setStatus((previous) =>
        previous.text === TEXT.status.noInputSignal
          ? { text: TEXT.status.grooving, tone: 'running' }
          : previous,
      );
      // Offbeat subdivisions inform the trace and pocket score, but the LCD
      // timing hit represents only the audible quarter-note click.
      if (event.subdivision !== 0) return;
      setLatest(event);
    },
    signal: (level, clipping) => {
      if (level > 0.0003) lastAudible.current = performance.now();
      setPracticeSignal(signalLevel(level, clipping));
      if (modeRef.current !== 'running') return;
      if (clipping) setStatus({ text: TEXT.status.clipping, tone: 'warning' });
      else if (level > 0.001 && level < 0.3)
        setStatus((previous) =>
          previous.tone === 'warning' &&
            (previous.text === TEXT.status.clipping || previous.text === TEXT.status.noInputSignal)
            ? { text: TEXT.status.grooving, tone: 'running' }
            : previous,
        );
    },
    error: (message) => {
      if (modeRef.current === 'calibrating') {
        stopCalibration();
        openInput();
      } else stopPractice(message);
      setStatus({ text: message, tone: 'warning' });
    },
  };

  const changeBpm = (value: number) => {
    setBpm(value);
    bpmRef.current = value;
    audio.setTempo(value);
    lastSlot.current = Number.NEGATIVE_INFINITY;
    resetPocket();
  };
  const changeGain = (value: number) => {
    setGain(value);
    audio.setSensitivity(value);
  };
  const changeMeter = (value: Meter) => {
    setMeter(value);
    meterRef.current = value;
    audio.setMeter(value);
    lastSlot.current = Number.NEGATIVE_INFINITY;
    resetPocket();
  };
  const changeDevice = (direction: -1 | 1) => {
    if (!devices.length) return;
    const next = cycleInputDevice(deviceRef.current, devices, direction);
    deviceRef.current = next;
    setDeviceId(next);
    const saved = readCalibration(next);
    setCalibration(saved);
    audio.setCalibration(saved.value);
    if (modeRef.current === 'running') stopPractice(TEXT.status.inputChanged);
    if (modalRef.current === 'input') void preview.start(next, () => void refreshDevices());
  };

  const togglePractice = async () => {
    if (modeRef.current === 'running') {
      stopPractice();
      return;
    }
    if (modeRef.current !== 'idle') return;
    preview.stop();
    setMode('connecting');
    setStatus({ text: TEXT.status.connectingAudio, tone: 'ready' });
    const currentRequest = ++request.current;
    try {
      await audio.start(deviceRef.current, bpm, meter, gain, calibration.value);
      if (currentRequest !== request.current) return;
      eventsRef.current = [];
      setDebugEntries([]);
      resetPocket();
      setEvents([]);
      setLatest(null);
      lastSlot.current = Number.NEGATIVE_INFINITY;
      lastAudible.current = performance.now();
      setMode('running');
      setStatus({ text: TEXT.status.pocket.collecting, tone: 'running' });
      void refreshDevices();
      quietTimer.current = window.setInterval(() => {
        if (!eventsRef.current.length && performance.now() - lastAudible.current > 8000)
          setStatus({ text: TEXT.status.noInputSignal, tone: 'warning' });
      }, 3000);
      pocketTimer.current = window.setInterval(() => {
        const next = advancePocketState(
          pocketEventsRef.current,
          audio.getBeatPosition(),
          bpmRef.current,
          meterRef.current,
          pocketStateRef.current,
        );
        if (next !== pocketStateRef.current) {
          const previous = pocketStateRef.current;
          pocketStateRef.current = next;
          setPocketPercent(next.percent);
          let message: string = TEXT.status.pocket.unchanged;
          if (next.percent === null) message = TEXT.status.pocket.needNotes;
          else if (previous.percent === null) message = TEXT.status.pocket.firstReading;
          else if (next.percent > previous.percent) message = TEXT.status.pocket.up;
          else if (next.percent < previous.percent) message = TEXT.status.pocket.down;
          else if (
            scorePocketWindow(pocketEventsRef.current, next.completedWindow, bpmRef.current) ===
            null
          )
            message = TEXT.status.pocket.holding;
          setPocketMessage(message);
        }
      }, 100);
    } catch (error) {
      if (currentRequest !== request.current) return;
      setMode('idle');
      const name = error instanceof DOMException ? error.name : '';
      setStatus({
        text:
          name === 'NotAllowedError'
            ? TEXT.error.microphoneAccessRequired
            : name === 'NotFoundError'
              ? TEXT.error.noAudioInput
              : error instanceof Error
                ? error.message
                : TEXT.error.audioCouldNotStart,
        tone: 'warning',
      });
    }
  };

  const beginCalibration = async () => {
    if (modeRef.current === 'connecting' || modeRef.current === 'calibrating') return;
    preview.stop();
    if (modeRef.current === 'running') stopPractice(TEXT.status.ready);
    setMode('calibrating');
    setModal('calibration');
    setStatus({ text: TEXT.status.ready, tone: 'ready' });
    samplesRef.current = [];
    setDebugEntries([]);
    setSamples([]);
    lastSlot.current = Number.NEGATIVE_INFINITY;
    setHint(TEXT.signal.connecting);
    const currentRequest = ++request.current;
    try {
      await audio.start(
        deviceRef.current,
        bpm,
        meterRef.current,
        gain,
        calibration.value,
        'calibration',
      );
      if (currentRequest !== request.current) return;
      setHint('');
    } catch (error) {
      if (currentRequest !== request.current) return;
      stopCalibration();
      openInput();
      const name = error instanceof DOMException ? error.name : '';
      preview.setSignal({
        ...emptySignal,
        label:
          name === 'NotAllowedError'
            ? TEXT.signal.microphoneAccessNeeded
            : name === 'NotFoundError'
              ? TEXT.error.noAudioInput
              : TEXT.signal.inputUnavailable,
      });
    }
  };

  const clearCalibration = () => {
    removeCalibration(deviceRef.current);
    const cleared = { value: 0, saved: false };
    setCalibration(cleared);
    audio.setCalibration(0);
    setStatus({
      text: TEXT.status.calibrationCleared,
      tone: modeRef.current === 'running' ? 'running' : 'ready',
    });
  };

  useEffect(() => {
    void refreshDevices();
    const changed = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', changed);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', changed);
      request.current++;
      audio.stop();
      if (quietTimer.current !== null) window.clearInterval(quietTimer.current);
      if (pocketTimer.current !== null) window.clearInterval(pocketTimer.current);
    };
  }, [audio, refreshDevices]);

  const getBeatPosition = useCallback(() => audio.getBeatPosition(), [audio]);
  const getSessionElapsed = useCallback(() => audio.getSessionElapsed(), [audio]);
  const deviceName = deviceId
    ? devices.find((device) => device.deviceId === deviceId)?.label || TEXT.device.defaultInput
    : TEXT.device.defaultInput;
  return {
    bpm,
    gain,
    meter,
    mode,
    modal,
    status:
      mode === 'running' && status.tone !== 'warning' ? { ...status, text: pocketMessage } : status,
    events,
    latest,
    pocketPercent,
    devices,
    deviceId,
    deviceName,
    deviceNote,
    calibration,
    samples,
    hint,
    signal: modal === 'input' && mode !== 'running' ? preview.signal : practiceSignal,
    getBeatPosition,
    getSessionElapsed,
    debugEntries,
    changeBpm,
    changeGain,
    changeMeter,
    changeDevice,
    togglePractice,
    beginCalibration,
    openInput,
    closeInput,
    cancelCalibration,
    clearCalibration,
  };
}
