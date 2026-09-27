type AudioSessionHost = { audioSession?: { type: string } }

/** Keep capture eligible while requesting speaker-friendly playback on iOS. */
export function setPitchforksSpeakerPlayback(enabled: boolean, host: object): boolean {
  const session = (host as AudioSessionHost).audioSession
  if (!session) return false
  // Playback-only can preempt getUserMedia on iPhone. The game needs both paths.
  const requested = enabled ? 'play-and-record' : 'auto'
  try {
    session.type = requested
    return session.type === requested
  } catch {
    return false
  }
}
