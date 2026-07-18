import type { NoteMemory } from '../../lib/fsrs'
import { INTRO_ORDER } from './types'

export const RETRO_CURRICULUM_KEY = 'retro_blaster_curriculum_v1'
export const RETRO_CURRICULUM_LOCK_NAME = 'retro-blaster-curriculum-v1'

export interface RetroCurriculumRecord {
  revision: 1
  unlockedNotes: string[]
  [forwardCompatibleField: string]: unknown
}

export type RetroCurriculumExtensionFields = Record<string, unknown>

export interface RetroCurriculumResolution {
  source: 'policy' | 'absent' | 'corrupt'
  sessionRoster: string[]
  durableRoster: string[]
  extensionFields: RetroCurriculumExtensionFields
  needsWrite: boolean
}

export interface RetroCurriculumCommitResult {
  ok: boolean
  durableRoster: string[]
  extensionFields: RetroCurriculumExtensionFields
  reason?: 'locks-unavailable' | 'invalid-candidate' | 'storage-failed'
}

export interface RetroCurriculumStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface RepairablePolicy {
  roster: string[]
  extensionFields: RetroCurriculumExtensionFields
  needsRewrite: boolean
}

const INTRO_SET = new Set<string>(INTRO_ORDER)

export function canonicalRetroRoster(notes: readonly string[]): string[] {
  const included = new Set(notes.filter(note => INTRO_SET.has(note)))
  return INTRO_ORDER.filter(note => included.has(note))
}

function sameRoster(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((note, index) => note === right[index])
}

function isPlayableRoster(roster: readonly string[]): boolean {
  return roster.length >= 2 && roster[0] === INTRO_ORDER[0]
}

function extensionFieldsOf(record: Record<string, unknown>): RetroCurriculumExtensionFields {
  const extensionFields: RetroCurriculumExtensionFields = {}
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'revision' && key !== 'unlockedNotes') extensionFields[key] = value
  }
  return extensionFields
}

function repairablePolicy(raw: string | null): RepairablePolicy | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (record.revision !== 1 || !Array.isArray(record.unlockedNotes) ||
      !record.unlockedNotes.every(note => typeof note === 'string')) return null
  const rawRoster = record.unlockedNotes as string[]
  const roster = canonicalRetroRoster(rawRoster)
  if (!isPlayableRoster(roster)) return null
  return {
    roster,
    extensionFields: extensionFieldsOf(record),
    needsRewrite: !sameRoster(rawRoster, roster),
  }
}

function reviewedCanonicalNotes(store: Record<string, NoteMemory>): string[] {
  return INTRO_ORDER.filter(note => {
    const memory = store[note]
    return Boolean(memory) && Number.isFinite(memory.lastReview) && memory.lastReview > 0
  })
}

function legacyEffectiveRoster(reviewed: readonly string[]): string[] {
  const reviewedSet = new Set(reviewed)
  const leading: string[] = []
  for (const note of INTRO_ORDER) {
    if (!reviewedSet.has(note)) break
    leading.push(note)
  }
  const deployedFloor = leading.length >= 4 ? leading : INTRO_ORDER.slice(0, 4)
  return canonicalRetroRoster([...deployedFloor, ...reviewed])
}

export function resolveRetroCurriculumSession(
  rawPolicy: string | null,
  activeLaneStore: Record<string, NoteMemory>,
): RetroCurriculumResolution {
  const reviewed = reviewedCanonicalNotes(activeLaneStore)
  const policy = repairablePolicy(rawPolicy)
  if (policy) {
    const sessionRoster = canonicalRetroRoster([...policy.roster, ...reviewed])
    return {
      source: 'policy',
      sessionRoster,
      durableRoster: [...policy.roster],
      extensionFields: { ...policy.extensionFields },
      needsWrite: policy.needsRewrite || !sameRoster(sessionRoster, policy.roster),
    }
  }

  return {
    source: rawPolicy === null ? 'absent' : 'corrupt',
    sessionRoster: reviewed.length === 0 ? INTRO_ORDER.slice(0, 2) : legacyEffectiveRoster(reviewed),
    durableRoster: [],
    extensionFields: {},
    needsWrite: true,
  }
}

function normalizedExtensions(fields: RetroCurriculumExtensionFields): RetroCurriculumExtensionFields {
  return extensionFieldsOf(fields)
}

function recordFor(
  roster: readonly string[],
  extensionFields: RetroCurriculumExtensionFields,
): RetroCurriculumRecord {
  return {
    ...normalizedExtensions(extensionFields),
    revision: 1,
    unlockedNotes: [...roster],
  }
}

export function deriveMonotonicCurriculumRecord(
  currentRaw: string | null,
  lastDurableRoster: readonly string[],
  sessionCandidateRoster: readonly string[],
  lastExtensionFields: RetroCurriculumExtensionFields,
): {
  record: RetroCurriculumRecord
  durableRoster: string[]
  extensionFields: RetroCurriculumExtensionFields
} {
  const current = repairablePolicy(currentRaw)
  const extensionFields = current
    ? { ...current.extensionFields }
    : normalizedExtensions(lastExtensionFields)
  const durableRoster = canonicalRetroRoster([
    ...(current?.roster ?? []),
    ...lastDurableRoster,
    ...sessionCandidateRoster,
  ])
  if (!isPlayableRoster(durableRoster)) throw new Error('Invalid Retro curriculum candidate roster')
  return {
    record: recordFor(durableRoster, extensionFields),
    durableRoster,
    extensionFields,
  }
}

export function deriveCurriculumExtensionRecord(
  currentRaw: string | null,
  fallbackRoster: readonly string[],
  fallbackExtensionFields: RetroCurriculumExtensionFields,
  extensionPatch: RetroCurriculumExtensionFields,
): {
  record: RetroCurriculumRecord
  durableRoster: string[]
  extensionFields: RetroCurriculumExtensionFields
} {
  const current = repairablePolicy(currentRaw)
  const durableRoster = canonicalRetroRoster(current?.roster ?? fallbackRoster)
  if (!isPlayableRoster(durableRoster)) throw new Error('Invalid Retro curriculum extension roster')
  const currentFields = current?.extensionFields ?? {}
  const normalizedPatch = normalizedExtensions(extensionPatch)
  const currentPlacement = currentFields.retroPlacement
  const patchPlacement = normalizedPatch.retroPlacement
  if (currentPlacement && patchPlacement &&
      typeof currentPlacement === 'object' && !Array.isArray(currentPlacement) &&
      typeof patchPlacement === 'object' && !Array.isArray(patchPlacement)) {
    const currentRecord = currentPlacement as Record<string, unknown>
    const patchRecord = patchPlacement as Record<string, unknown>
    if (currentRecord.version === 1 && patchRecord.version === 1 &&
        currentRecord.lanes && patchRecord.lanes &&
        typeof currentRecord.lanes === 'object' && !Array.isArray(currentRecord.lanes) &&
        typeof patchRecord.lanes === 'object' && !Array.isArray(patchRecord.lanes)) {
      normalizedPatch.retroPlacement = {
        ...currentRecord,
        ...patchRecord,
        lanes: {
          ...(currentRecord.lanes as Record<string, unknown>),
          ...(patchRecord.lanes as Record<string, unknown>),
        },
      }
    }
  }
  const extensionFields = {
    ...normalizedExtensions(fallbackExtensionFields),
    ...currentFields,
    ...normalizedPatch,
  }
  return {
    record: recordFor(durableRoster, extensionFields),
    durableRoster,
    extensionFields,
  }
}

export function commitRetroCurriculum(options: {
  storage: RetroCurriculumStorage
  locks: LockManager | undefined
  signal: AbortSignal
  sessionCandidateRoster: readonly string[]
  getLastDurableRoster: () => readonly string[]
  getLastExtensionFields: () => RetroCurriculumExtensionFields
}): Promise<RetroCurriculumCommitResult> {
  const candidate = canonicalRetroRoster(options.sessionCandidateRoster)
  if (!isPlayableRoster(candidate)) {
    return Promise.resolve({
      ok: false,
      durableRoster: [...options.getLastDurableRoster()],
      extensionFields: { ...options.getLastExtensionFields() },
      reason: 'invalid-candidate',
    })
  }
  if (!options.locks) {
    return Promise.resolve({
      ok: false,
      durableRoster: [...options.getLastDurableRoster()],
      extensionFields: { ...options.getLastExtensionFields() },
      reason: 'locks-unavailable',
    })
  }

  return options.locks.request(
    RETRO_CURRICULUM_LOCK_NAME,
    { mode: 'exclusive', signal: options.signal },
    () => {
      // Deliberately synchronous: no await/promise boundary may split read/union/write.
      try {
        const currentRaw = options.storage.getItem(RETRO_CURRICULUM_KEY)
        const merged = deriveMonotonicCurriculumRecord(
          currentRaw,
          options.getLastDurableRoster(),
          candidate,
          options.getLastExtensionFields(),
        )
        options.storage.setItem(RETRO_CURRICULUM_KEY, JSON.stringify(merged.record))
        return { ok: true, ...merged }
      } catch {
        return {
          ok: false,
          durableRoster: [...options.getLastDurableRoster()],
          extensionFields: { ...options.getLastExtensionFields() },
          reason: 'storage-failed' as const,
        }
      }
    },
  )
}

export function commitRetroCurriculumExtension(options: {
  storage: RetroCurriculumStorage
  locks: LockManager | undefined
  signal: AbortSignal
  extensionPatch: RetroCurriculumExtensionFields
  getLastDurableRoster: () => readonly string[]
  getLastExtensionFields: () => RetroCurriculumExtensionFields
}): Promise<RetroCurriculumCommitResult> {
  if (!options.locks) {
    return Promise.resolve({
      ok: false,
      durableRoster: [...options.getLastDurableRoster()],
      extensionFields: { ...options.getLastExtensionFields() },
      reason: 'locks-unavailable',
    })
  }
  return options.locks.request(
    RETRO_CURRICULUM_LOCK_NAME,
    { mode: 'exclusive', signal: options.signal },
    () => {
      // Deliberately synchronous: placement and roster share the same union-on-commit lock.
      try {
        const merged = deriveCurriculumExtensionRecord(
          options.storage.getItem(RETRO_CURRICULUM_KEY),
          options.getLastDurableRoster(),
          options.getLastExtensionFields(),
          options.extensionPatch,
        )
        options.storage.setItem(RETRO_CURRICULUM_KEY, JSON.stringify(merged.record))
        return { ok: true, ...merged }
      } catch {
        return {
          ok: false,
          durableRoster: [...options.getLastDurableRoster()],
          extensionFields: { ...options.getLastExtensionFields() },
          reason: 'storage-failed' as const,
        }
      }
    },
  )
}
