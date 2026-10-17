import { act, render, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BuryTheClickDisplay } from '../../src/pedals/bury-the-click/BuryTheClickDisplay.tsx';
import { usePedalSession } from '../../src/pedals/bury-the-click/usePedalSession.ts';
import { TimingGrid, type TimingEvent } from '../../src/timing/grid.ts';
import { TEXT } from '../../src/text.ts';

const engine = vi.hoisted(() => ({
  emitTiming: null as ((event: TimingEvent) => void) | null,
  position: null as { beat: number; phase: number; measureIndex: number } | null,
}));

vi.mock('../../src/audio/WebAudioEngine.ts', () => ({
  WebAudioEngine: class {
    constructor(callbacks: { onTiming: (event: TimingEvent) => void }) {
      engine.emitTiming = callbacks.onTiming;
    }
    async start() {}
    stop() {}
    setTempo() {}
    setMeter() {}
    setSensitivity() {}
    setCalibration() {}
    getSessionElapsed() {
      return 0;
    }
    getBeatPosition() {
      return engine.position;
    }
  },
}));

it('keeps sixteenth hits for scoring without moving the quarter-note display', async () => {
  engine.position = null;
  const { result, unmount } = renderHook(() => usePedalSession());
  await act(async () => {
    await result.current.togglePractice();
  });
  const grid = new TimingGrid(1, 80, 4);
  const offbeat = grid.match(1.1875, 0.2, 1)!;
  act(() => engine.emitTiming!(offbeat));
  expect(result.current.events).toHaveLength(1);
  expect(result.current.latest).toBeNull();

  const beat = grid.match(1.75, 0.2, 1)!;
  act(() => engine.emitTiming!(beat));
  expect(result.current.latest?.timestamp).toBe(beat.timestamp);
  expect(result.current.status.text).toBe(TEXT.status.pocket.collecting);

  act(() => engine.emitTiming!(grid.match(1.9375, 0.2, 1)!));
  expect(result.current.events).toHaveLength(3);
  expect(result.current.latest?.timestamp).toBe(beat.timestamp);
  expect(result.current.status.text).toBe(TEXT.status.pocket.collecting);
  expect(result.current.debugEntries).toHaveLength(0);
  unmount();
});

it('reports pocket score changes only after completed two-measure windows', async () => {
  engine.position = null;
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => usePedalSession());
  await act(async () => {
    await result.current.togglePractice();
  });
  const grid = new TimingGrid(1, 80, 4);
  for (let index = 0; index < 6; index++)
    act(() => engine.emitTiming!(grid.match(1 + index * 0.75, 0.2, 1)!));
  expect(result.current.status.text).toBe(TEXT.status.pocket.collecting);

  try {
    engine.position = { beat: 1, phase: 0.4, measureIndex: 2 };
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.pocketPercent).toBe(100);
    expect(result.current.status.text).toBe(TEXT.status.pocket.firstReading);

    for (let index = 0; index < 6; index++)
      act(() => engine.emitTiming!(grid.match(7 + index * 0.75 + 0.04, 0.2, 1)!));
    engine.position = { beat: 1, phase: 0.4, measureIndex: 4 };
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.pocketPercent).toBeLessThan(100);
    expect(result.current.status.text).toBe(TEXT.status.pocket.down);
  } finally {
    vi.useRealTimers();
    engine.position = null;
    unmount();
  }
});

it('flashes for each accepted offbeat note without changing the quarter-note readout', () => {
  const grid = new TimingGrid(1, 80, 4);
  const first = grid.match(1.1875, 0.2, 1)!;
  const second = grid.match(1.375, 0.2, 1)!;
  const props = {
    bpm: 80,
    gain: 55,
    meter: 4 as const,
    latest: null,
    pocketPercent: null,
    inputName: 'Test input',
    status: 'Listening',
    running: false,
    getBeatPosition: () => null,
  };
  const { container, rerender, unmount } = render(
    <BuryTheClickDisplay {...props} events={[first]} />,
  );
  const firstFlash = container.querySelector('.meter-input-flash');
  expect(firstFlash).not.toBeNull();
  expect(container.querySelector('.timing-readout strong')?.textContent).toBe('--');

  rerender(<BuryTheClickDisplay {...props} events={[first, second]} />);
  expect(container.querySelector('.meter-input-flash')).not.toBe(firstFlash);
  expect(container.querySelector('.timing-readout strong')?.textContent).toBe('--');
  unmount();
});
