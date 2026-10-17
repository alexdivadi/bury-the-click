// Confidence is measured from the attack peak, not the first threshold crossing.
export const MIN_ONSET_CONFIDENCE = 0.2;

export function isConfidentOnset(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= MIN_ONSET_CONFIDENCE;
}
