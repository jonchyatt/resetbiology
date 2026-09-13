/** A short struck-metal envelope; caller owns the AudioContext and echo suppression. */
export const PITCHFORKS_BELL_RING_MS = 1200

export function schedulePitchforksBellRing(
  ctx: AudioContext,
  output: AudioNode,
  frequency: number,
): void {
  if (!Number.isFinite(frequency) || frequency <= 0
    || !Number.isFinite(ctx.currentTime) || ctx.state === 'closed') return
  const now = ctx.currentTime
  const end = now + PITCHFORKS_BELL_RING_MS / 1000
  // Keep the earned note as the strongest partial, with quiet metallic overtones.
  const partials = [[1, 0.12], [2.01, 0.045], [2.74, 0.025], [4.07, 0.012]] as const
  for (const [ratio, level] of partials) {
    const hz = frequency * ratio
    if (!Number.isFinite(hz) || hz >= ctx.sampleRate / 2) continue
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(hz, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(level, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.015)
    gain.gain.linearRampToValueAtTime(0, end)
    oscillator.connect(gain)
    gain.connect(output)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(now)
    oscillator.stop(end)
  }
}
