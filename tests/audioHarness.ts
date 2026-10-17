import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function detect(
  onsetTimes: number[],
  clicks: { scheduled: number; delay: number; level?: number }[] = [],
  extraSignal: (time: number) => number = () => 0,
  durationSeconds = 1.2,
  toneHz = 82,
): Array<{ timestamp: number; confidence: number; clickBleed: boolean }> {
  const messages: Array<{
    type: string;
    timestamp?: number;
    confidence?: number;
    clickBleed?: boolean;
  }> = [];
  let Processor: new () => {
    port: { onmessage: ((event: unknown) => void) | null };
    process: (input: Float32Array[][]) => boolean;
  };
  const scope = vm.createContext({
    sampleRate: 48000,
    currentFrame: 0,
    currentTime: 0,
    AudioWorkletProcessor: class {
      port = {
        onmessage: null,
        postMessage: (message: {
          type: string;
          timestamp?: number;
          confidence?: number;
          clickBleed?: boolean;
        }) => messages.push(message),
      };
    },
    registerProcessor: (_name: string, constructor: typeof Processor) => {
      Processor = constructor;
    },
  });
  vm.runInContext(
    readFileSync(new URL('../public/onset-worklet.js', import.meta.url), 'utf8'),
    scope,
  );
  const detector = new Processor!();
  for (const click of clicks)
    detector.port.onmessage?.({ data: { type: 'click', time: click.scheduled } });
  for (let frame = 0; frame < durationSeconds * 48000; frame += 128) {
    const data = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      const time = (frame + i) / 48000;
      const tail = onsetTimes.reduce(
        (sum, onset) =>
          sum +
          (time >= onset
            ? 0.24 * Math.exp(-(time - onset) * 8) * Math.sin(2 * Math.PI * toneHz * (time - onset))
            : 0),
        0,
      );
      const leakedClick = clicks.reduce((sum, click) => {
        const since = time - click.scheduled - click.delay;
        if (since < 0 || since >= 0.035) return sum;
        const envelope =
          since < 0.002
            ? Math.pow(700, since / 0.002 - 1)
            : Math.pow(0.0001 / 0.07, (since - 0.002) / 0.033);
        return (
          sum +
          (click.level ?? 0.05) *
            envelope *
            (Math.sin(2 * Math.PI * 3000 * since) +
              Math.sin(2 * Math.PI * 3750 * since) +
              0.8 * Math.sin(2 * Math.PI * 850 * since))
        );
      }, 0);
      data[i] =
        tail + leakedClick + extraSignal(time) + 0.00001 * Math.sin(2 * Math.PI * 1200 * time);
    }
    scope.currentFrame = frame;
    scope.currentTime = frame / 48000;
    detector.process([[data]]);
  }
  return messages
    .filter((message) => message.type === 'onset')
    .map((message) => ({
      timestamp: message.timestamp!,
      confidence: message.confidence!,
      clickBleed: message.clickBleed!,
    }));
}
