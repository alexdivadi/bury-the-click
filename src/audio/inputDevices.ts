export interface InputDevice {
  deviceId: string;
  label: string;
}

export function cycleInputDevice(
  current: string,
  devices: InputDevice[],
  direction: -1 | 1,
): string {
  const ids = ['', ...devices.map((device) => device.deviceId)];
  return ids[(Math.max(0, ids.indexOf(current)) + direction + ids.length) % ids.length];
}

export async function listInputs(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Audio input ${index + 1}`,
    }));
}
