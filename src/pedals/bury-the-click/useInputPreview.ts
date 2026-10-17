import { useEffect, useRef, useState } from 'react';

export interface SignalLevel {
  percent: number;
  clipping: boolean;
  label: string;
}
export const emptySignal: SignalLevel = { percent: 0, clipping: false, label: '' };

export function signalLevel(level: number, clipping: boolean): SignalLevel {
  const percent = Math.round(
    Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(level, 0.00001)) + 60) / 54) * 100)),
  );
  return {
    percent,
    clipping,
    label: clipping ? 'Clipping — lower gain' : level < 0.001 ? 'Very quiet' : 'Signal present',
  };
}

export function useInputPreview() {
  const [signal, setSignal] = useState<SignalLevel>(emptySignal);
  const generation = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  const stop = () => {
    generation.current++;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (context.current) void context.current.close();
    context.current = null;
    setSignal(emptySignal);
  };

  const start = async (deviceId: string, onConnected?: () => void) => {
    stop();
    const request = generation.current;
    setSignal({ ...emptySignal, label: 'Connecting input…' });
    if (!navigator.mediaDevices?.getUserMedia) {
      setSignal({ ...emptySignal, label: 'Microphone unavailable' });
      return;
    }
    const audioContext = new AudioContext({ latencyHint: 'interactive' });
    context.current = audioContext;
    try {
      await audioContext.resume();
      if (request !== generation.current) return;
      const input = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (request !== generation.current) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(input).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      timer.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        let peak = 0;
        for (const sample of samples) {
          energy += sample * sample;
          peak = Math.max(peak, Math.abs(sample));
        }
        setSignal(signalLevel(Math.sqrt(energy / samples.length), peak > 0.98));
      }, 80);
      onConnected?.();
    } catch (error) {
      if (request !== generation.current) return;
      stop();
      setSignal({
        ...emptySignal,
        label:
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Microphone access needed'
            : 'Input unavailable',
      });
    }
  };

  useEffect(
    () => () => {
      generation.current++;
      if (timer.current !== null) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      if (context.current) void context.current.close();
    },
    [],
  );

  return { signal, setSignal, start, stop };
}
