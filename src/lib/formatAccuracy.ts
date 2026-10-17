// Accuracy as a percent string; a missing value renders as an en dash, never "0%".
export function formatAccuracy(accuracy: number | null | undefined): string {
  return typeof accuracy === 'number' && Number.isFinite(accuracy) ? `${Math.round(accuracy)}%` : '\u2013'
}
