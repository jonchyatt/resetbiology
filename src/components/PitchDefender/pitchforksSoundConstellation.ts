import type { PitchforksMasteryProjection, PitchforksMasteryNoteProjection } from './pitchforksMasteryProjection'

export type PitchforksConstellationTrack = 'voice' | 'stormcraft' | 'music'
export type PitchforksConstellationStatus = 'locked' | 'ready' | 'due' | 'earned'

export type PitchforksConstellationNode = Readonly<{
  id: string
  track: PitchforksConstellationTrack
  title: string
  note: string | null
  status: PitchforksConstellationStatus
  rune: string
  evidenceIds: readonly string[]
  detail: string
  due: boolean
}>

export type PitchforksSoundConstellation = Readonly<{
  nodes: readonly PitchforksConstellationNode[]
  dueNodes: readonly PitchforksConstellationNode[]
  evidenceNodeTotal: number
}>

function noteEvidence(note: PitchforksMasteryNoteProjection, track: 'voice' | 'ear'): string[] {
  const ids = [
    `${track}-fsrs:${note.note}`,
    `${track}-status:${note[track === 'voice' ? 'voiceStatus' : 'earStatus']}`,
  ]
  if (track === 'voice') {
    ids.push(...note.voiceMastery.sessionIds.map(session => `voice-session:${session}`))
    if (note.voiceMastery.masteredAt !== null) ids.push(`voice-mastery:${note.note}:${note.voiceMastery.masteredAt}`)
  }
  if (note[track === 'voice' ? 'voiceDue' : 'earDue']) ids.push(`${track}-due:${note.note}`)
  return [...new Set(ids)]
}

function statusForNote(note: PitchforksMasteryNoteProjection, track: 'voice' | 'ear'): PitchforksConstellationStatus {
  const due = track === 'voice' ? note.voiceDue : note.earDue
  const status = track === 'voice' ? note.voiceStatus : note.earStatus
  if (due) return 'due'
  if (track === 'voice' && note.voiceEverMastered) return 'earned'
  if (status === 'missing' || status === 'invalid' || status === 'new') return 'locked'
  return 'ready'
}

function node(note: PitchforksMasteryNoteProjection, track: 'voice' | 'ear'): PitchforksConstellationNode {
  const status = statusForNote(note, track)
  const title = track === 'voice' ? 'Voice' : 'Listening'
  return Object.freeze({
    id: `constellation:${track}:${note.note}`,
    track,
    title,
    note: note.note,
    status,
    rune: status === 'due' ? '◈' : status === 'earned' ? '✦' : status === 'ready' ? '◇' : '○',
    evidenceIds: Object.freeze(noteEvidence(note, track)),
    detail: status === 'due' ? 'A supportive review is ready.' : status === 'earned' ? 'Earned history retained; current due state stays separate.' : status === 'ready' ? 'Evidence is present; practice can continue.' : 'Practice evidence is not available yet.',
    due: status === 'due',
  })
}

export function projectPitchforksSoundConstellation(projection: PitchforksMasteryProjection | null | undefined): PitchforksSoundConstellation {
  const notes = Array.isArray(projection?.notes) ? projection.notes : []
  const noteNodes = notes.flatMap(note => [node(note, 'voice'), node(note, 'ear')])
  const masteredVoice = notes.filter(note => note.voiceEverMastered)
  const stormcraft: PitchforksConstellationNode = Object.freeze({
    id: 'constellation:stormcraft', track: 'stormcraft', title: 'Stormcraft', note: null,
    status: masteredVoice.length > 0 ? 'earned' : 'locked', rune: masteredVoice.length > 0 ? '✹' : '△',
    evidenceIds: Object.freeze(masteredVoice.flatMap(note => noteEvidence(note, 'voice'))),
    detail: masteredVoice.length > 0 ? 'Earned abilities project from voice mastery evidence.' : 'Voice mastery evidence is needed before storm abilities can appear.',
    due: false,
  })
  const music: PitchforksConstellationNode = Object.freeze({
    id: 'constellation:music', track: 'music', title: 'Music', note: null,
    status: notes.length > 0 ? 'ready' : 'locked', rune: notes.length > 0 ? '♫' : '△',
    evidenceIds: Object.freeze(notes.flatMap(note => [...noteEvidence(note, 'voice'), ...noteEvidence(note, 'ear')])),
    detail: notes.length > 0 ? 'Read-only songs and exercises use your admitted notes.' : 'Admit a comfortable note to open music practice.',
    due: false,
  })
  const all = [...noteNodes, stormcraft, music]
  return Object.freeze({ nodes: Object.freeze(all), dueNodes: Object.freeze(all.filter(item => item.due)), evidenceNodeTotal: all.length })
}
