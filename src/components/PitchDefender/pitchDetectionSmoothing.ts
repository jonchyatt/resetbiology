export interface PitchStabilizationProfile {
  fftSize: 2048 | 4096
  noiseGateDb: number
  clarityFloor: number
  medianWindow: number
  emaAlpha: number
  hysteresisFrames: number
  dropoutResetFrames: number
}

export interface PitchStabilizerSample {
  frequency: number
  clarity: number
  db: number
}

export interface StabilizedPitch {
  active: boolean
  frequency: number
  note: string
  cents: number
}

export const PITCHFORKS_PITCH_PROFILE: Readonly<PitchStabilizationProfile> = Object.freeze({
  fftSize: 4096,
  noiseGateDb: -47,
  clarityFloor: 0.8,
  medianWindow: 3,
  emaAlpha: 0.55,
  hysteresisFrames: 3,
  dropoutResetFrames: 3,
})

export const PITCHFORKS_AUDIO_CONSTRAINTS: Readonly<MediaTrackConstraints> = Object.freeze({
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
})

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function noteForFrequency(frequency: number): { note: string; cents: number } {
  const midi = 69 + 12 * Math.log2(frequency / 440)
  const nearestMidi = Math.round(midi)
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const noteIndex = ((nearestMidi % 12) + 12) % 12
  return {
    note: `${names[noteIndex]}${Math.floor(nearestMidi / 12) - 1}`,
    cents: Math.round((midi - nearestMidi) * 100),
  }
}

export function createPitchStabilizer(profile: PitchStabilizationProfile) {
  let smoothedLogFrequency = 0
  let candidateNote = ''
  let consecutiveFrames = 0
  let dropoutFrames = 0
  const history: number[] = []

  const clearSignalState = () => {
    smoothedLogFrequency = 0
    candidateNote = ''
    consecutiveFrames = 0
    history.length = 0
  }

  return {
    reset() {
      clearSignalState()
      dropoutFrames = 0
    },
    push(sample: PitchStabilizerSample): StabilizedPitch {
      const valid = sample.frequency > 0 &&
        sample.clarity >= profile.clarityFloor &&
        sample.db >= profile.noiseGateDb

      if (!valid) {
        dropoutFrames += 1
        if (dropoutFrames >= profile.dropoutResetFrames) clearSignalState()
        return { active: false, frequency: 0, note: '', cents: 0 }
      }

      dropoutFrames = 0
      history.push(Math.log2(sample.frequency))
      if (history.length > profile.medianWindow) history.shift()

      const filtered = median(history)
      smoothedLogFrequency = smoothedLogFrequency === 0
        ? filtered
        : profile.emaAlpha * filtered + (1 - profile.emaAlpha) * smoothedLogFrequency
      const frequency = 2 ** smoothedLogFrequency
      const nearest = noteForFrequency(frequency)

      if (nearest.note === candidateNote) consecutiveFrames += 1
      else {
        candidateNote = nearest.note
        consecutiveFrames = 1
      }

      return {
        active: consecutiveFrames >= profile.hysteresisFrames,
        frequency,
        note: nearest.note,
        cents: nearest.cents,
      }
    },
  }
}
