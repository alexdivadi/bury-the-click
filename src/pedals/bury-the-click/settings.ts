import type { Meter } from '../../timing/grid.ts';

export interface PedalSettings {
  bpm: number;
  gain: number;
  meter: Meter;
  deviceId: string;
}

const key = 'pedal:bury-the-click:settings:v1';
const defaults: PedalSettings = { bpm: 80, gain: 55, meter: 4, deviceId: '' };

export function readSettings(): PedalSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      bpm: Number.isInteger(saved.bpm) && saved.bpm >= 40 && saved.bpm <= 200 ? saved.bpm : 80,
      gain: Number.isInteger(saved.gain) && saved.gain >= 0 && saved.gain <= 100 ? saved.gain : 55,
      meter: saved.meter === 3 || saved.meter === 4 || saved.meter === 5 ? saved.meter : 4,
      deviceId: typeof saved.deviceId === 'string' ? saved.deviceId : '',
    };
  } catch {
    return defaults;
  }
}

export function writeSettings(settings: PedalSettings): void {
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* Storage can be disabled. */
  }
}
