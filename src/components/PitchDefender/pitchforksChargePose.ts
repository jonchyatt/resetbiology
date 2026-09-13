export const PITCHFORKS_IDLE_FPS = 4
export const PITCHFORKS_CHARGE_FRAME_DWELL_SECONDS = 1.5

export type PitchforksChargePoseName = 'idle' | 'charge'
export type PitchforksChargeFrame = 0 | 1 | 2 | 3

export type PitchforksChargePose = Readonly<{
  pose: PitchforksChargePoseName
  frame: PitchforksChargeFrame
}>

function frameIndex(value: number): PitchforksChargeFrame {
  return (Math.floor(value) % 4) as PitchforksChargeFrame
}

export function selectPitchforksChargePose(
  progress: number,
  animClock: number,
  reducedMotion: boolean,
  chargeAvailable: boolean,
): PitchforksChargePose {
  if (
    typeof reducedMotion !== 'boolean' ||
    typeof chargeAvailable !== 'boolean' ||
    !Number.isFinite(progress) ||
    !Number.isFinite(animClock)
  ) {
    return { pose: 'idle', frame: 0 }
  }

  const pose = progress > 0 && chargeAvailable ? 'charge' : 'idle'
  if (reducedMotion) return { pose, frame: 0 }

  const clock = Math.max(0, animClock)
  return {
    pose,
    frame: pose === 'charge'
      ? frameIndex(clock / PITCHFORKS_CHARGE_FRAME_DWELL_SECONDS)
      : frameIndex(clock * PITCHFORKS_IDLE_FPS),
  }
}
