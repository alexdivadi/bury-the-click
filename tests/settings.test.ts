import assert from 'node:assert/strict';
import test from 'node:test';
import { readSettings, writeSettings } from '../src/pedals/bury-the-click/settings.ts';

test('pedal controls and selected input survive a reload', () => {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  } as Storage;
  writeSettings({ bpm: 126, gain: 71, meter: 5, deviceId: 'interface' });
  assert.deepEqual(readSettings(), { bpm: 126, gain: 71, meter: 5, deviceId: 'interface' });
  values.set('pedal:bury-the-click:settings:v1', '{"bpm":999,"gain":-1,"meter":7,"deviceId":12}');
  assert.deepEqual(readSettings(), { bpm: 80, gain: 55, meter: 4, deviceId: '' });
  delete (globalThis as { localStorage?: Storage }).localStorage;
});
