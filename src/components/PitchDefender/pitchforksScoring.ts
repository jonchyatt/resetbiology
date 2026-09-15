export function speedBonusForLatencyMs(latencyMs: number): number {
  if (latencyMs < 800) return 15
  if (latencyMs < 1500) return 8
  return 0
}
