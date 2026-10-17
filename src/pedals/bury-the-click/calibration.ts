export function readCalibration(deviceId: string): { value: number; saved: boolean } {
  try {
    const key = `btc-calibration:${deviceId || 'default'}`;
    const stored = localStorage.getItem(key);
    const saved =
      stored !== null &&
      (stored !== '0' || localStorage.getItem(`btc-calibrated:${deviceId || 'default'}`) === '1');
    return { value: saved ? Number(stored) || 0 : 0, saved };
  } catch {
    return { value: 0, saved: false };
  }
}

export function writeCalibration(deviceId: string, value: number): void {
  try {
    localStorage.setItem(`btc-calibration:${deviceId || 'default'}`, String(value));
    localStorage.setItem(`btc-calibrated:${deviceId || 'default'}`, '1');
  } catch {
    /* Storage can be disabled. */
  }
}

export function removeCalibration(deviceId: string): void {
  try {
    localStorage.removeItem(`btc-calibration:${deviceId || 'default'}`);
    localStorage.removeItem(`btc-calibrated:${deviceId || 'default'}`);
  } catch {
    /* Storage can be disabled. */
  }
}
