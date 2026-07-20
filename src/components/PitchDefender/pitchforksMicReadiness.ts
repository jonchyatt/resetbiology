export const PITCHFORKS_ROOM_CHECK_MS = 1200
export const PITCHFORKS_VOICE_COACH_MS = 3500

export type PitchforksRoomReadiness = 'checking-room' | 'ready-for-voice' | 'quieter-room'
export type PitchforksMicReadiness = PitchforksRoomReadiness | 'listening-for-voice' | 'move-closer' | 'ready'

export type PitchforksRoomResult = Readonly<{
  status: PitchforksRoomReadiness
  baselineDb: number | null
}>

export function assessPitchforksRoom(samples: readonly number[], noiseGateDb: number): PitchforksRoomResult {
  const valid = samples
    .filter(sample => Number.isFinite(sample) && sample <= 0)
    .sort((a, b) => a - b)

  if (valid.length < 8 || !Number.isFinite(noiseGateDb)) {
    return { status: 'checking-room', baselineDb: null }
  }

  // A percentile resists one clap or handling bump while still catching a room
  // that persistently sits inside the detector's measured activity gate.
  const p90Index = Math.max(0, Math.ceil(valid.length * 0.9) - 1)
  const baselineDb = valid[p90Index]
  return {
    status: baselineDb >= noiseGateDb ? 'quieter-room' : 'ready-for-voice',
    baselineDb,
  }
}

export function coachPitchforksVoice(args: Readonly<{
  room: PitchforksRoomReadiness
  voiceHeard: boolean
  elapsedMs: number
}>): PitchforksMicReadiness {
  if (args.voiceHeard) return 'ready'
  if (args.elapsedMs < PITCHFORKS_VOICE_COACH_MS) return 'listening-for-voice'
  return args.room === 'quieter-room' ? 'quieter-room' : 'move-closer'
}

export function pitchforksMicReadinessCopy(status: PitchforksMicReadiness): Readonly<{
  label: string
  guidance: string
}> {
  switch (status) {
    case 'checking-room':
      return { label: 'CHECKING ROOM', guidance: 'Stay quiet for a moment while we listen to the room.' }
    case 'ready-for-voice':
    case 'listening-for-voice':
      return { label: 'HUM ONE EASY NOTE', guidance: 'Hum one relaxed note. No reaching, grading, or pressure.' }
    case 'move-closer':
      return { label: 'MOVE CLOSER', guidance: 'Bring the phone about a handspan closer, then hum gently again.' }
    case 'quieter-room':
      return { label: 'QUIETER ROOM', guidance: 'Move away from fans or voices, or try headphones before cue notes.' }
    case 'ready':
      return { label: 'READY', guidance: 'We hear a steady note. Next we will find what feels comfortable today.' }
  }
}
