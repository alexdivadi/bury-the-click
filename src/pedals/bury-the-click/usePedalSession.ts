import { useCallback, useEffect, useRef, useState } from 'react';
import { cycleInputDevice, listInputs, type InputDevice } from '../../audio/inputDevices.ts';
import { WebAudioEngine } from '../../audio/WebAudioEngine.ts';
import { median } from '../../timing/metrics.ts';
import { advancePocketState, initialPocketState } from '../../timing/pocket.ts';
import type { PocketState } from '../../timing/pocket.ts';
import type { Subdivision, TimingEvent } from '../../timing/grid.ts';
import { readCalibration, removeCalibration, writeCalibration } from './calibration.ts';
import { emptySignal, signalLevel, useInputPreview } from './useInputPreview.ts';

type Mode = 'idle' | 'connecting' | 'running' | 'calibrating';
type Modal = 'input' | 'calibration' | null;
type Status = { text: string; tone: 'ready' | 'running' | 'warning' };

export function usePedalSession() {
  const [bpm, setBpm] = useState(80);
  const [gain, setGain] = useState(55);
  const [grid, setGrid] = useState<Subdivision>(1);
  const [mode, setModeState] = useState<Mode>('idle');
  const [modal, setModalState] = useState<Modal>(null);
  const [status, setStatus] = useState<Status>({ text: 'Ready', tone: 'ready' });
  const [events, setEvents] = useState<TimingEvent[]>([]);
  const [latest, setLatest] = useState<TimingEvent | null>(null);
  const [pocketPercent, setPocketPercent] = useState<number | null>(null);
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [deviceNote, setDeviceNote] = useState('');
  const [calibration, setCalibration] = useState(() => readCalibration(''));
  const [samples, setSamples] = useState<number[]>([]);
  const [hint, setHint] = useState('');
  const [practiceSignal, setPracticeSignal] = useState(emptySignal);
  const preview = useInputPreview();

  const modeRef = useRef<Mode>('idle');
  const modalRef = useRef<Modal>(null);
  const deviceRef = useRef('');
  const eventsRef = useRef<TimingEvent[]>([]);
  const pocketEventsRef = useRef<TimingEvent[]>([]);
  const pocketStateRef = useRef<PocketState>(initialPocketState);
  const bpmRef = useRef(80);
  const gridRef = useRef<Subdivision>(1);
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
    timing: () => {},
    signal: () => {},
    error: () => {},
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
        if (modeRef.current === 'running')
          handlers.current.error('Input disconnected. Select an input and start again.');
      }
      const selectedName = deviceRef.current
        ? inputs.find((input) => input.deviceId === deviceRef.current)?.label ||
          'System default input'
        : 'System default input';
      setDeviceNote(
        /bluetooth|airpods|wireless/i.test(selectedName)
          ? 'Wireless delay may affect timing'
          : inputs.length
            ? `${inputs.length} available`
            : 'Permission needed to list inputs',
      );
    } catch {
      setDeviceNote('Unable to list audio inputs.');
    }
  }, [audio]);

  const stopPractice = (message = 'Stopped · tap to start') => {
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
    setStatus({ text: `Calibrated · ${Math.round(value)} ms offset`, tone: 'ready' });
    openInput();
  };

  handlers.current = {
    timing: (event) => {
      // A ringing note can trigger the detector repeatedly within one grid slot.
      if (event.expectedTimestamp === lastSlot.current) return;
      lastSlot.current = event.expectedTimestamp;
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
      setLatest(event);
      const offset = Math.round(event.correctedOffsetMs);
      const onTime = Math.abs(offset) <= 20;
      setStatus({
        text: `Beat ${event.beat} · ${onTime ? 'On time' : offset < 0 ? 'Ahead of the click' : 'Behind the click'}`,
        tone: 'running',
      });
    },
    signal: (level, clipping) => {
      if (level > 0.0003) lastAudible.current = performance.now();
      setPracticeSignal(signalLevel(level, clipping));
      if (modeRef.current !== 'running') return;
      if (clipping) setStatus({ text: 'Input clipping · lower your gain', tone: 'warning' });
      else if (level > 0.001 && level < 0.3 && !eventsRef.current.length)
        setStatus({ text: 'Listening · play with the click', tone: 'running' });
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
  const changeGrid = (value: Subdivision) => {
    setGrid(value);
    gridRef.current = value;
    audio.setSubdivision(value);
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
    if (modeRef.current === 'running') stopPractice('Input changed · tap to start');
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
    setStatus({ text: 'Connecting audio…', tone: 'ready' });
    const currentRequest = ++request.current;
    try {
      await audio.start(deviceRef.current, bpm, grid, gain, calibration.value);
      if (currentRequest !== request.current) return;
      eventsRef.current = [];
      resetPocket();
      setEvents([]);
      setLatest(null);
      lastSlot.current = Number.NEGATIVE_INFINITY;
      lastAudible.current = performance.now();
      setMode('running');
      setStatus({ text: 'Listening · play with the click', tone: 'running' });
      void refreshDevices();
      quietTimer.current = window.setInterval(() => {
        if (!eventsRef.current.length && performance.now() - lastAudible.current > 8000)
          setStatus({ text: 'No input signal · check connection', tone: 'warning' });
      }, 3000);
      pocketTimer.current = window.setInterval(() => {
        const next = advancePocketState(
          pocketEventsRef.current,
          audio.getBeatPosition(),
          bpmRef.current,
          gridRef.current,
          pocketStateRef.current,
        );
        if (next !== pocketStateRef.current) {
          pocketStateRef.current = next;
          setPocketPercent(next.percent);
        }
      }, 100);
    } catch (error) {
      if (currentRequest !== request.current) return;
      setMode('idle');
      const name = error instanceof DOMException ? error.name : '';
      setStatus({
        text:
          name === 'NotAllowedError'
            ? 'Mic access required · allow microphone'
            : name === 'NotFoundError'
              ? 'No audio input found'
              : error instanceof Error
                ? error.message
                : 'Audio could not start',
        tone: 'warning',
      });
    }
  };

  const beginCalibration = async () => {
    if (modeRef.current === 'connecting' || modeRef.current === 'calibrating') return;
    preview.stop();
    if (modeRef.current === 'running') stopPractice('Ready');
    setMode('calibrating');
    setModal('calibration');
    setStatus({ text: 'Ready', tone: 'ready' });
    samplesRef.current = [];
    setSamples([]);
    lastSlot.current = Number.NEGATIVE_INFINITY;
    setHint('Connecting input…');
    const currentRequest = ++request.current;
    try {
      await audio.start(deviceRef.current, bpm, 1, gain, calibration.value, 'calibration');
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
            ? 'Microphone access needed'
            : name === 'NotFoundError'
              ? 'No audio input found'
              : 'Input unavailable',
      });
    }
  };

  const clearCalibration = () => {
    removeCalibration(deviceRef.current);
    const cleared = { value: 0, saved: false };
    setCalibration(cleared);
    audio.setCalibration(0);
    setStatus({
      text: 'Calibration cleared',
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
  const deviceName = deviceId
    ? devices.find((device) => device.deviceId === deviceId)?.label || 'System default input'
    : 'System default input';
  return {
    bpm,
    gain,
    grid,
    mode,
    modal,
    status,
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
    changeBpm,
    changeGain,
    changeGrid,
    changeDevice,
    togglePractice,
    beginCalibration,
    openInput,
    closeInput,
    cancelCalibration,
    clearCalibration,
  };
}
