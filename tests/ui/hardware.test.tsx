import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dial } from '../../src/hardware/Dial.tsx';
import { Switch } from '../../src/hardware/Switch.tsx';
import { Manual } from '../../src/hardware/Manual.tsx';

afterEach(cleanup);

describe('hardware controls', () => {
  it('adjusts a dial with horizontal keys and resets it on double click', () => {
    const change = vi.fn();
    const { rerender } = render(
      <Dial
        label="Tempo"
        value={90}
        min={40}
        max={200}
        defaultValue={80}
        dragScale={0.9}
        onChange={change}
      />,
    );
    const dial = screen.getByRole('slider', { name: 'Tempo' });
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(91);
    rerender(
      <Dial
        label="Tempo"
        value={91}
        min={40}
        max={200}
        defaultValue={80}
        dragScale={0.9}
        onChange={change}
      />,
    );
    fireEvent.doubleClick(dial);
    expect(change).toHaveBeenLastCalledWith(80);
  });

  it('cycles a three position switch and clamps keyboard movement', () => {
    const change = vi.fn();
    const options = ['Quarter notes', 'Eighth notes', 'Sixteenth notes'] as const;
    const { rerender } = render(
      <Switch label="Note grid" options={options} value={0} onChange={change} />,
    );
    const lever = screen.getByRole('slider', { name: 'Note grid' });
    fireEvent.keyDown(lever, { key: ' ' });
    expect(change).toHaveBeenLastCalledWith(1);
    rerender(<Switch label="Note grid" options={options} value={2} onChange={change} />);
    fireEvent.keyDown(lever, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(lever, { key: 'Home' });
    expect(change).toHaveBeenLastCalledWith(0);
  });

  it('supports a two position switch with named states', () => {
    const change = vi.fn();
    const { rerender } = render(
      <Switch label="Mode" options={['Clean', 'Drive']} value={0} onChange={change} />,
    );
    const lever = screen.getByRole('slider', { name: 'Mode' });
    fireEvent.keyDown(lever, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith(1);
    rerender(<Switch label="Mode" options={['Clean', 'Drive']} value={1} onChange={change} />);
    expect(lever.getAttribute('aria-valuetext')).toBe('Drive');
  });

  it('puts focus in the manual and restores it on close', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const close = vi.fn();
    const { unmount } = render(
      <Manual title="Input" className="input-card" onClose={close}>
        <p>Audio source</p>
      </Manual>,
    );
    expect(screen.getByRole('button', { name: 'Close Input' })).toBe(document.activeElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
