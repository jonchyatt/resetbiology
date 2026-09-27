type AudioSessionHost = { audioSession?: { type: string } }

/** Request the browser's playback route. iOS still owns the physical speaker choice. */
export function setPitchforksSpeakerPlayback(enabled: boolean, host: object): boolean {
  const session = (host as AudioSessionHost).audioSession
  if (!session) return false
  const requested = enabled ? 'playback' : 'auto'
  try {
    session.type = requested
    return session.type === requested
  } catch {
    return false
  }
}
