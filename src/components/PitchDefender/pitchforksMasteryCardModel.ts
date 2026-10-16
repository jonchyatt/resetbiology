import type { PitchforksPresentationJourney } from './pitchforksCurriculum'
import type {
  PitchforksMasteryNoteProjection,
  PitchforksMasteryProjection,
} from './pitchforksMasteryProjection'

export const PITCHFORKS_MASTERY_CARD_SCHEMA = 'pitchforks-share-safe-mastery-card/v1'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type PitchforksMasteryCardStatus =
  | 'practice-needed'
  | 'learning'
  | 'review-due'
  | 'in-review'
  | 'retained'
  | 'guided-only'
  | 'unavailable'

export type PitchforksMasteryCardRow = Readonly<{
  evidenceId: string
  note: string
  voice: PitchforksMasteryCardStatus
  ear: PitchforksMasteryCardStatus
  retainedMastery: boolean
  duePractice: boolean
  evidenceIds: readonly string[]
}>

export type PitchforksMasteryCardProgress = Readonly<{
  id: string
  label: string
  status: 'completed' | 'not-started'
  evidenceIds: readonly string[]
}>

export type PitchforksMasteryCardAbility = Readonly<{
  id: string
  label: string
  status: 'earned' | 'not-recorded'
  evidenceIds: readonly string[]
}>

export type PitchforksMasteryCard = Readonly<{
  schema: typeof PITCHFORKS_MASTERY_CARD_SCHEMA
  title: 'Weekly learning card'
  audienceNote: string
  rows: readonly PitchforksMasteryCardRow[]
  worlds: readonly PitchforksMasteryCardProgress[]
  abilities: readonly PitchforksMasteryCardAbility[]
  nextActions: readonly string[]
  privacy: readonly string[]
}>

export type PitchforksMasteryCardInput = Readonly<{
  projection: PitchforksMasteryProjection
  journey: PitchforksPresentationJourney
  nowMs: number
  abilityEvidence?: readonly Readonly<{
    id: string
    label: string
    earned: boolean
    evidenceIds: readonly string[]
  }>[]
}>

function noteStatus(
  status: PitchforksMasteryNoteProjection['voiceStatus'] | PitchforksMasteryNoteProjection['earStatus'],
  due: boolean,
  retained: boolean,
  guidedOnly: boolean,
): PitchforksMasteryCardStatus {
  if (status === 'missing' || status === 'invalid') return 'unavailable'
  if (guidedOnly && !retained) return 'guided-only'
  if (status === 'new') return 'practice-needed'
  if (status === 'learning') return due ? 'practice-needed' : 'learning'
  if (due) return 'review-due'
  return retained ? 'retained' : 'in-review'
}

function statusLabel(status: PitchforksMasteryCardStatus): string {
  switch (status) {
    case 'practice-needed': return 'Practice needed'
    case 'learning': return 'Learning'
    case 'review-due': return 'Review due'
    case 'in-review': return 'In review'
    case 'retained': return 'Retained mastery'
    case 'guided-only': return 'Guided practice only'
    case 'unavailable': return 'Unavailable'
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(value => value.trim().length > 0))]
}

function noteEvidenceIds(note: PitchforksMasteryNoteProjection): string[] {
  return unique([
    `evidence:note:${note.note}`,
    `evidence:source:pitch_fsrs_memory`,
    `evidence:source:pitch_fsrs_memory_ear`,
    `evidence:source:pitchforks3_mastery_progress`,
    ...note.voiceMastery.sessionIds.map(id => `evidence:voice-session:${id}`),
  ])
}

function progressEvidenceIds(id: string, journey: PitchforksPresentationJourney): string[] {
  const receipt = id === 'dungeon'
    ? journey.dungeonClear
    : id === 'village-gate'
      ? journey.villageClear
      : id === 'bell-tower'
        ? journey.bellTowerClear
        : journey.cathedralClear
  return receipt ? [`evidence:journey:${id}:clear`] : []
}

function buildWorlds(journey: PitchforksPresentationJourney): PitchforksMasteryCardProgress[] {
  return [
    ['dungeon', 'Dungeon'],
    ['village-gate', 'Village Gate'],
    ['bell-tower', 'Bell Tower'],
    ['cathedral', 'Cathedral'],
  ].map(([id, label]) => {
    const evidenceIds = progressEvidenceIds(id, journey)
    return Object.freeze({
      id,
      label,
      status: evidenceIds.length > 0 ? 'completed' as const : 'not-started' as const,
      evidenceIds: Object.freeze(evidenceIds),
    })
  })
}

function buildNextActions(
  rows: readonly PitchforksMasteryCardRow[],
  worlds: readonly PitchforksMasteryCardProgress[],
): string[] {
  const actions: string[] = []
  const dueVoice = rows.filter(row => row.voice === 'review-due' || row.voice === 'practice-needed')
  const dueEar = rows.filter(row => row.ear === 'review-due' || row.ear === 'practice-needed')
  if (dueVoice.length > 0) actions.push('Choose a comfortable singing note to revisit.')
  if (dueEar.length > 0) actions.push('Try a listening round for the notes marked ready to revisit.')
  if (rows.some(row => row.voice === 'guided-only')) actions.push('Return without the hint when you feel ready; guided practice is not counted as retained singing mastery.')
  const nextWorld = worlds.find(world => world.status === 'not-started')
  if (nextWorld && worlds.some(world => world.status === 'completed')) actions.push(`Keep exploring: ${nextWorld.label} is the next adventure path when its in-game requirement is met.`)
  if (actions.length === 0) actions.push('Keep making music at your own pace. You can revisit any available note or world.')
  return unique(actions)
}

export function buildPitchforksMasteryCard(input: PitchforksMasteryCardInput): PitchforksMasteryCard {
  const nowMs = Number.isFinite(input.nowMs) && input.nowMs >= 0 ? input.nowMs : 0
  const guidedNotes = new Set(input.journey.guidedNotes)
  const rows = (Array.isArray(input.projection?.notes) ? input.projection.notes : []).map(note => {
    const retained = note.voiceEverMastered === true
    const guidedOnly = guidedNotes.has(note.note)
    const voice = noteStatus(note.voiceStatus, note.voiceDue, retained, guidedOnly)
    const ear = noteStatus(note.earStatus, note.earDue, false, false)
    const recentlyRetained = retained
      && note.voiceMastery.masteredAt !== null
      && note.voiceMastery.masteredAt >= nowMs - WEEK_MS
      && note.voiceMastery.masteredAt <= nowMs
    return Object.freeze({
      evidenceId: `card-row:${note.note}`,
      note: note.note,
      voice,
      ear,
      retainedMastery: retained,
      duePractice: note.voiceDue || note.earDue,
      evidenceIds: Object.freeze(unique([
        ...noteEvidenceIds(note),
        ...(recentlyRetained ? [`evidence:weekly-retention:${note.note}`] : []),
      ])),
    })
  })

  const worlds = buildWorlds(input.journey)
  const abilities = (input.abilityEvidence ?? []).map(ability => Object.freeze({
    id: ability.id,
    label: ability.label,
    status: ability.earned ? 'earned' as const : 'not-recorded' as const,
    evidenceIds: Object.freeze(unique(ability.evidenceIds)),
  }))

  return Object.freeze({
    schema: PITCHFORKS_MASTERY_CARD_SCHEMA,
    title: 'Weekly learning card',
    audienceNote: 'A supportive snapshot for you, or someone you choose to share it with. Nothing is posted or sent. It describes learning evidence, not effort or performance pressure.',
    rows: Object.freeze(rows),
    worlds: Object.freeze(worlds),
    abilities: Object.freeze(abilities),
    nextActions: Object.freeze(buildNextActions(rows, worlds)),
    privacy: Object.freeze([
      'Shows learning evidence only: no microphone recording, raw audio, practice timestamps, health or journal information.',
      'Listening (EAR) and singing (VOICE) evidence stay separate.',
      'Hints and guided practice are labeled and do not become unaided retained mastery.',
      'Missing or skipped practice creates no negative label.',
    ]),
  })
}

export function pitchforksMasteryCardStatusLabel(status: PitchforksMasteryCardStatus): string {
  return statusLabel(status)
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function serializePitchforksMasteryCardCsv(card: PitchforksMasteryCard): string {
  const lines = [
    ['section', 'item', 'voice', 'ear', 'retained mastery', 'due practice', 'evidence ids'].map(csvCell).join(','),
    ...card.rows.map(row => [
      'notes', row.note, statusLabel(row.voice), statusLabel(row.ear), row.retainedMastery ? 'yes' : 'no', row.duePractice ? 'yes' : 'no', row.evidenceIds.join(' | '),
    ].map(csvCell).join(',')),
    ...card.worlds.map(world => ['worlds', world.label, world.status === 'completed' ? 'Completed' : 'Not started', '', '', '', world.evidenceIds.join(' | ')].map(csvCell).join(',')),
    ...card.abilities.map(ability => ['abilities', ability.label, ability.status === 'earned' ? 'Earned' : 'Not recorded', '', '', '', ability.evidenceIds.join(' | ')].map(csvCell).join(',')),
  ]
  return `${lines.join('\n')}\n`
}

export function serializePitchforksMasteryCardJson(card: PitchforksMasteryCard): string {
  return `${JSON.stringify(card, null, 2)}\n`
}
