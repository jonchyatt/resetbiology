import { noteToFreq } from './pitchMath'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'

type VillageLessonCandidate = {
  objective: 'minor-third' | 'major-third' | 'perfect-fifth'
  contextNote: string
  targetNote: string
  bothVoiceAdmitted: boolean
}

type VillageLessonSelectorArgs = {
  admittedNotes: readonly string[]
  introducedNotes: readonly string[]
  comfortableRange: {
    lowNote: string
    highNote: string
  }
}

const INTERVAL_OBJECTIVES = {
  3: 'minor-third',
  4: 'major-third',
  7: 'perfect-fifth',
} as const

function isStringArray(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== 'string') return false
  }
  return true
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getVillageLessonCandidates(
  args: VillageLessonSelectorArgs,
): readonly VillageLessonCandidate[] {
  if (
    !isObject(args) ||
    !isStringArray(args.admittedNotes) ||
    !isStringArray(args.introducedNotes) ||
    !isObject(args.comfortableRange) ||
    typeof args.comfortableRange.lowNote !== 'string' ||
    typeof args.comfortableRange.highNote !== 'string'
  ) return []

  const noteIndexes = new Map(PITCHFORKS_RANGE_NOTES.map((note, index) => [note, index]))
  const lowIndex = noteIndexes.get(args.comfortableRange.lowNote)
  const highIndex = noteIndexes.get(args.comfortableRange.highNote)
  if (lowIndex === undefined || highIndex === undefined || lowIndex >= highIndex) return []

  const knownNotes = (notes: readonly string[]) => [
    ...new Set(notes.filter(note => noteIndexes.has(note))),
  ]
  const admittedNotes = knownNotes(args.admittedNotes)
  const introducedNotes = new Set(knownNotes(args.introducedNotes))
  for (const note of admittedNotes) introducedNotes.add(note)

  const candidates: VillageLessonCandidate[] = []
  for (const contextNote of introducedNotes) {
    const contextIndex = noteIndexes.get(contextNote)
    if (contextIndex === undefined || contextIndex < lowIndex || contextIndex > highIndex) continue

    for (const targetNote of admittedNotes) {
      const targetIndex = noteIndexes.get(targetNote)
      if (targetIndex === undefined || targetIndex < lowIndex || targetIndex > highIndex) continue

      const semitones = Math.round(Math.abs(
        12 * Math.log2(noteToFreq(targetNote) / noteToFreq(contextNote)),
      ))
      const objective = INTERVAL_OBJECTIVES[semitones as keyof typeof INTERVAL_OBJECTIVES]
      if (!objective) continue

      candidates.push({
        objective,
        contextNote,
        targetNote,
        bothVoiceAdmitted: admittedNotes.includes(contextNote),
      })
    }
  }

  const intervalSize: Record<VillageLessonCandidate['objective'], number> = {
    'minor-third': 3,
    'major-third': 4,
    'perfect-fifth': 7,
  }
  return candidates.sort((left, right) =>
    intervalSize[left.objective] - intervalSize[right.objective] ||
    noteIndexes.get(left.targetNote)! - noteIndexes.get(right.targetNote)! ||
    noteIndexes.get(left.contextNote)! - noteIndexes.get(right.contextNote)!,
  )
}

export function selectVillageLessonCandidate(
  args: VillageLessonSelectorArgs & { targetNote: string; encounterIndex: number },
): VillageLessonCandidate | undefined {
  if (!isObject(args) || !Number.isSafeInteger(args.encounterIndex) || args.encounterIndex < 0) return undefined

  const eligible = getVillageLessonCandidates(args).filter(candidate => candidate.targetNote === args.targetNote)
  return eligible.length === 0 ? undefined : eligible[args.encounterIndex % eligible.length]
}
