import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleInputDevice } from '../src/audio/inputDevices.ts';

test('input buttons cycle through sources and wrap to the default', () => {
  const devices = [
    { deviceId: 'interface', label: 'USB interface' },
    { deviceId: 'mic', label: 'Microphone' },
  ];
  assert.equal(cycleInputDevice('', devices, 1), 'interface');
  assert.equal(cycleInputDevice('mic', devices, 1), '');
  assert.equal(cycleInputDevice('', devices, -1), 'mic');
});
