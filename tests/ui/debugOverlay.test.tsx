import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DebugOverlay } from '../../src/pedals/bury-the-click/DebugOverlay.tsx';
import { TEXT } from '../../src/text.ts';

afterEach(cleanup);

it('shows detected attacks and can be dragged or moved with arrow keys', () => {
  render(
    <DebugOverlay
      entries={[
        {
          elapsed: 0.75,
          measure: 1,
          beat: 1,
          subdivision: 0,
          rawOffsetMs: 68,
          subdivisionRawOffsetMs: 68,
          subdivisionOffsetMs: 68,
          amplitude: 0.0088,
          confidence: 0.01,
          result: 'low-confidence',
        },
        {
          elapsed: 1.25,
          measure: 1,
          beat: 2,
          subdivision: 1,
          rawOffsetMs: -61,
          subdivisionRawOffsetMs: -61,
          subdivisionOffsetMs: -48,
          amplitude: 0.003,
          confidence: 0.8,
          result: 'accepted',
        },
      ]}
      mode="idle"
      inputName="Audio interface"
      signal={{ percent: 32, clipping: false, label: TEXT.signal.present }}
      getSessionElapsed={() => 0}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: TEXT.trace.title }));
  const panel = screen.getByRole('complementary', { name: TEXT.trace.title });
  expect(screen.getByText('0:01.250')).toBeDefined();
  expect(screen.getByText('1 · 2e')).toBeDefined();
  expect(screen.getByText(TEXT.trace.results.accepted)).toBeDefined();
  expect(screen.getByText(TEXT.trace.results['low-confidence'])).toBeDefined();

  const handle = screen.getByRole('button', { name: TEXT.trace.drag });
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 60, clientY: 40 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(panel.style.left).toBe('56px');
  expect(panel.style.top).toBe('36px');
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(panel.style.left).toBe('76px');
});
