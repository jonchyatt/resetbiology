'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import Link from 'next/link'
import { Mic, RotateCcw } from 'lucide-react'
import PitchforksCloseSmashGuide from './PitchforksCloseSmashGuide'
import PitchforksPracticeArcade, { type PitchforksPracticeWorld } from './PitchforksPracticeArcade'
import { PitchforksVillageLesson } from './PitchforksVillageLesson'
import PitchforksBellTowerLesson from './PitchforksBellTowerLesson'
import { renderBossChamber } from './PitchforksBossChamberView'
import PitchforksMasteryPanel from './PitchforksMasteryPanel'
import PitchforksCampaignJournal from './PitchforksCampaignJournal'
import PitchforksWorldUnlockProgress from './PitchforksWorldUnlockProgress'
import PitchforksSongcraft, { observePitchforksSongcraftGeneration, type PitchforksSongcraftGenerationState } from './PitchforksSongcraft'
import { advancePitchforksCampaignProgress, bindPitchforksVillageCurriculum, advancePitchforksVillageProgress, advancePitchforksExaminationProgress, projectPitchforksWorldGates } from './pitchforksCampaignProgress'
import { projectPitchforksMastery } from './pitchforksMasteryProjection'
import { usePitchDetection, type PitchInfo } from './usePitchDetection'
import { createPitchforksMicrophoneOwner, type PitchforksMicrophoneOwner } from './pitchforksMicrophoneOwner'
import { PITCHFORKS_AUDIO_CONSTRAINTS, PITCHFORKS_PITCH_PROFILE } from './pitchDetectionSmoothing'
import {
  PITCHFORKS_ROOM_CHECK_MS,
  assessPitchforksRoom,
  coachPitchforksVoice,
  pitchforksMicReadinessCopy,
  type PitchforksMicReadiness,
  type PitchforksRoomReadiness,
} from './pitchforksMicReadiness'
import { advanceExactPitchHold, exactCents, exactPitchSampleState, noteToFreq } from './pitchMath'
import {
  initAudio,
  loadPianoSamples,
  markToneEmitted,
  playPianoNote,
  setPianoVolume,
  isWithinToneSuppressionWindow,
} from './audioEngine'
import {
  NOTE_COLORS,
  autoGrade,
  createNote,
  currentR,
  pickNextNote,
  retrievability,
  reviewNote,
  type NoteMemory,
} from '@/lib/fsrs'
import {
  FSRS_EAR_DEBUG_KEY,
  FSRS_EAR_KEY,
  FSRS_VOICE_KEY,
  gradeEar,
  gradeVoice,
  loadStore,
  migrate,
  saveStore,
} from '@/lib/fsrsFamily'
import {
  createPitchforksBossRecital,
  type PitchforksBossRecitalController,
  type PitchforksBossRecitalState,
  type PitchforksBossRecitalResult,
  type PitchforksBossRecitalReceipt,
  type PitchforksBossRecitalStorage,
} from './pitchforksBossRecital'
import { INTRO_ORDER } from './types'
import { selectPitchforksChargePose } from './pitchforksChargePose'
import { drawStormHeart, selectStormHeartState } from './pitchforksStormHeart'
import { getPitchforksThunderheadPathPosition, getPitchforksThunderheadCaptionRect, PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y } from './pitchforksThunderheadPath'
import { WORLD_REGISTRY, isWorldUnlocked, isBossAvailable, type WorldId } from './pitchforks3WorldRegistry'
import {
  PITCHFORKS_RANGE_NOTES,
  PITCHFORKS_RANGE_PROFILE_KEY,
  adjacentRangeNote,
  createPitchforksRangeProfile,
  nearestPitchforksRangeNote,
  parsePitchforksRangeProfile,
  presentationOrderForRange,
  starterPairForRange,
  type PitchforksRangeProfile,
} from './pitchforksRange'
import {
  EMPTY_CUE_SUPPORT_PROFILE,
  PITCHFORKS_PRESENTATION_JOURNEY_KEY,
  admissionRecallReady,
  advancePitchforksJourneyLevel,
  attackTimeForCurriculum,
  createPitchforksPresentationJourney,
  cueSupportForNote,
  curriculumStageForWave,
  deterministicPairNotes,
  firstMinuteCoachCopy,
  parseCueSupportProfile,
  parsePitchforksPresentationJourney,
  patientTineCountsForWave,
  recordCueSupportOutcome,
  replayLabelForCueSupport,
  stepChainCandidatePool,
  villagerEntryX,
  waitForClearBeforeSpawn,
  type CueSupportLevel,
  type CueSupportProfile,
  type FirstMinuteBeat,
  type PitchforksPresentationJourney,
  type TineCount,
} from './pitchforksCurriculum'
import { selectVillageLessonCandidate } from './villageLessonSelector'
import { recordVillagePractice } from './villagePractice'
import {
  createVillageReturnQueue,
  enqueueVillageReturn,
  selectVillageReturnOffer,
  resolveVillageReturnOffer,
  type VillageReturnOffer,
} from './villageReturnQueue'
import {
  pitchforksApproaching,
  pitchforksMicUnreliable,
  pitchforksTunerFeedback,
  pitchforksVoiceBreak,
  type PitchforksTunerFeedback,
} from './pitchforksTunerFeedback'
import {
  PITCHFORKS_SPARK_MAX_AUTO_PULSES,
  advancePitchforksSparkGuide,
  createPitchforksSparkGuideState,
  pausePitchforksSparkGuide,
  type PitchforksSparkGuideStatus,
} from './pitchforksSparkGuide'
import {
  PITCHFORKS_INPUT_MODE_KEY,
  createPitchforksButtonTrial,
  decidePitchforksButtonAnswer,
  parsePitchforksInputMode,
  replayPitchforksButtonTrial,
  resolvePitchforksAttackTimeout,
  shouldPausePitchforksAttackTimer,
  type PitchforksButtonTrial,
  type PitchforksInputMode,
} from './pitchforksInputLane'
import {
  loadHashedComposedSongs,
  type HashedSongOption,
} from './pitchforks3SongSequence'
import {
  loadPitchforksSettings,
  normalizePitchforksSettings,
  savePitchforksSettings,
  type PitchforksSettingsSnapshot,
} from './pitchforksSettings'
import {
  PITCHFORKS_LEVEL_ACCURACY_GOAL_PERCENT,
  createPitchforksLevelProgress,
  pitchforksLevelAccuracyPercent,
  pitchforksLevelResult,
  pitchforksNewNoteAccuracyEligible,
  recordPitchforksLevelOutcome,
  type PitchforksLevelCredit,
  type PitchforksLevelProgress,
  type PitchforksLevelResult,
} from './pitchforksLevelProgress'
import {
  acceptPitchforksRainCombatResponse,
  createRainState,
  createTorchState,
  deriveRainEffects,
  RAINCALL_REQUIRED_RESPONSES,
  RAINCALL_TIMINGS,
  stepRain,
  stepTorch,
  TORCH_EXACT_HOLD_MS,
  type RainState,
  type TorchState,
} from './pitchforksRainEcology'
import { drawRainArchitecture, drawVillagerTorch } from './pitchforksRainView'
import { drawPitchforksTargetContour, type PitchforksTargetContourDescriptor } from './pitchforksTargetContourView'
import {
  armPitchforksCloseSmash,
  completePitchforksCloseSmashSettle,
  consumePitchforksCloseSmash,
  createPitchforksCloseSmashState,
  presentPitchforksCloseSmashContact,
  settlePitchforksCloseSmash,
  type PitchforksCloseSmashReceipt,
  type PitchforksCloseSmashState,
} from './pitchforksCloseSmash'
import {
  advancePitchforksThunderhead,
  createPitchforksThunderheadState,
  getPitchforksThunderheadDebugProjection,
  type PitchforksThunderheadDebugProjection,
  type PitchforksThunderheadEvent,
  type PitchforksThunderheadLockReceipt,
  type PitchforksThunderheadState,
  type PitchforksThunderheadTarget,
  type PitchforksThunderheadTransition,
  type PitchforksThunderheadTransitionReason,
} from './pitchforksThunderhead'
import {
  createPitchforksGalvanicState,
  planPitchforksGalvanicSweep,
  type PitchforksGalvanicLock,
  type PitchforksGalvanicOutcome,
  type PitchforksGalvanicPlanReason,
  type PitchforksGalvanicState,
} from './pitchforksGalvanic'
import {
  advancePitchforksBellWave,
  createPitchforksBellWaveState,
  projectPitchforksBellWave,
  releasePitchforksBellWave,
  resetPitchforksBellWaveState,
  type PitchforksBellWaveAdvanceDecision,
  type PitchforksBellWaveProjection,
  type PitchforksBellWaveState,
  type PitchforksBellWaveVillager,
} from './pitchforksBellWave'
import {
  acceptPitchforksBellPowerActivationNote,
  acceptPitchforksBellPowerCombatResponse,
  acknowledgePitchforksBellPowerWaveRelease,
  cancelPitchforksBellPowerActivation,
  createPitchforksBellPowerState,
  startPitchforksBellPowerActivation,
  type PitchforksBellPowerState,
} from './pitchforksBellPower'
import { drawPitchforksBellWave } from './pitchforksBellWaveView'
import { drawPitchforksBellSwing } from './pitchforksBellSwingView'
import { PITCHFORKS_BELL_RING_MS, schedulePitchforksBellRing } from './pitchforksBellAudio'
import {
  PITCHFORKS_VICTORY_ACTIVE_END_MS,
  PITCHFORKS_VICTORY_CLEAR_MS,
  PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS,
  PITCHFORKS_VICTORY_START_MS,
  selectPitchforksVictoryPose,
  type PitchforksVictoryAssetAvailability,
  type PitchforksVictoryPose,
} from './pitchforksVictoryPose'

const W = 720
const H = 405
const MAX_CANVAS_DISPLAY_W = 1280
const MAX_CANVAS_DISPLAY_H = 720
// Keep the 16:9 battlefield useful when the fixed result band and learning dock
// exhaust a short viewport. This floor is the existing canvas aspect ratio,
// capped at the native canvas height, leaving room for controls on a laptop.
const STAGE_MIN_HEIGHT_VW = (H / W) * 100
const STAGE_MIN_HEIGHT_CSS = `min(${H}px, ${STAGE_MIN_HEIGHT_VW}vw)`
const STAFF_BAND_RENDER_SCALE = 3
const SPRITE_SCALE = 3
// Frankenstein's native sprite resolution was bumped 3x (32x48 -> 96x144, C11
// 2026-07-09) to hold more detail while rendering at the SAME on-screen size as
// before -- so Frankenstein-specific anchor/draw math divides SPRITE_SCALE by 3
// instead of using it directly. Villager sprites are UNCHANGED native resolution
// and must keep using SPRITE_SCALE directly. Do not use FRANK_SPRITE_SCALE for
// anything villager-related, and do not use SPRITE_SCALE directly for anything
// that reads from assets.frankMeta / frankMeta.
const FRANK_SPRITE_SCALE = SPRITE_SCALE / 3
const ASSET_BASE = '/images/pitchforks'
export const PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC = '/images/pitchforks/village_gate_plate.png'
export const PITCHFORKS_BELLRINGER_REST_SRC = '/images/pitchforks/bellringer_rest.png'
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FSRS_DEBUG_KEY = 'pitch_fsrs_debug'
const MASTERY_PROGRESS_KEY = 'pitchforks3_mastery_progress'
const MASTERY_PROGRESS_DEBUG_KEY = 'pitchforks3_mastery_progress_debug'
const CUE_SUPPORT_KEY = 'pitchforks3_cue_support_v1'
const CUE_SUPPORT_DEBUG_KEY = 'pitchforks3_cue_support_debug_v1'
const STARTING_NOTES = [INTRO_ORDER[0], INTRO_ORDER[1]]

export type PitchforksBossId = 'torchmaster' | 'bellringer' | 'choirmaster'

export type PitchforksBossEntryAssets = Readonly<{
  torchmasterChamberPlate: boolean
  bellringerChamberPlate: boolean
  bellringerRest: boolean
}>

export type PitchforksBossEntryReason = 'ready' | 'demo-only' | 'unknown-boss' | 'missing-art' | 'fewer-than-two-notes' | 'no-admitted-notes'

export type PitchforksBossEntryStatus = Readonly<{
  bossId: PitchforksBossId | null
  available: boolean
  reason: PitchforksBossEntryReason
  sequence: readonly string[]
  missingAssets: readonly ('chamber-plate' | 'rest')[]
}>

export function isPitchforksBossId(value: unknown): value is PitchforksBossId {
  return value === 'torchmaster' || value === 'bellringer' || value === 'choirmaster'
}

/** Preserve literal note identity and admitted order; no octave folding or transposition. */
export function distinctPitchforksAdmittedNotes(admittedNotes: readonly string[]): string[] {
  const seen = new Set<string>()
  return admittedNotes.filter(note => {
    if (seen.has(note)) return false
    seen.add(note)
    return true
  })
}

/** Select only the bounded private sequence; the caller still passes the full admitted arsenal to the controller. */
export function selectPitchforksBossSequence(bossId: unknown, admittedNotes: readonly string[]): readonly string[] | null {
  if (!isPitchforksBossId(bossId) || !Array.isArray(admittedNotes)) return null
  const snapshot = [...admittedNotes]
  const sequence = bossId === 'choirmaster' ? distinctPitchforksAdmittedNotes(snapshot).slice(0, 3) : bossId === 'bellringer'
    ? distinctPitchforksAdmittedNotes(snapshot).slice(0, 2)
    : snapshot.slice(0, 2)
  return sequence.length > 0 ? Object.freeze(sequence) : null
}

export function assessPitchforksBossEntry(
  bossId: unknown,
  demo: boolean,
  assets: PitchforksBossEntryAssets,
  admittedNotes: readonly string[],
): PitchforksBossEntryStatus {
  if (!isPitchforksBossId(bossId)) {
    return { bossId: null, available: false, reason: 'unknown-boss', sequence: [], missingAssets: [] }
  }
  if (!demo) {
    return { bossId, available: false, reason: 'demo-only', sequence: [], missingAssets: [] }
  }

  const missingAssets: Array<'chamber-plate' | 'rest'> = []
  if (bossId === 'torchmaster') {
    if (!assets.torchmasterChamberPlate) missingAssets.push('chamber-plate')
  } else {
    if (!assets.bellringerChamberPlate) missingAssets.push('chamber-plate')
    if (!assets.bellringerRest) missingAssets.push('rest')
  }
  if (missingAssets.length > 0) {
    return { bossId, available: false, reason: 'missing-art', sequence: [], missingAssets }
  }

  const sequence = selectPitchforksBossSequence(bossId, admittedNotes) ?? []
  if (bossId === 'bellringer' && distinctPitchforksAdmittedNotes(admittedNotes).length < 2) {
    return { bossId, available: false, reason: 'fewer-than-two-notes', sequence, missingAssets: [] }
  }
  if (sequence.length === 0) {
    return { bossId, available: false, reason: 'no-admitted-notes', sequence, missingAssets: [] }
  }
  return { bossId, available: true, reason: 'ready', sequence, missingAssets: [] }
}

export function pitchforksBossEntryCopy(status: PitchforksBossEntryStatus): string {
  if (status.available) return 'Ready for this private demo.'
  if (status.reason === 'demo-only') return 'Private demo only. This room is not an ordinary world route.'
  if (status.reason === 'unknown-boss') return 'This recital is unavailable.'
  if (status.reason === 'missing-art') return 'Artwork is preparing. Entry stays disabled until the Village Gate plate and Bellringer rest pose are ready.'
  if (status.reason === 'fewer-than-two-notes') return 'Unavailable: two distinct admitted notes are required for two-note interval practice.'
  return 'Unavailable until an admitted note is ready.'
}

export function selectPitchforksPrivatePlateAsset(search: URLSearchParams): string | null {
  if (search.get('demo') !== '1') return null
  switch (search.get('worldProof')) {
    case 'village-gate':
      return 'village_gate_plate.png'
    case 'bell-tower':
      return 'bell_tower_plate.png'
    case 'cathedral':
      return 'cathedral_plate.png'
    default:
      return null
  }
}

export type PitchforksJourneySaveStorage = Pick<Storage, 'setItem' | 'getItem'>
export type PitchforksJourneySaveStorageSource = PitchforksJourneySaveStorage | (() => PitchforksJourneySaveStorage)
export type PitchforksJourneySaveReason =
  | 'no-journey'
  | 'demo'
  | 'fsrs-debug'
  | 'serialize-failed'
  | 'write-failed'
  | 'readback-failed'
  | 'readback-mismatch'
export type PitchforksJourneySaveResult = Readonly<{
  status: 'confirmed' | 'not-confirmed' | 'skipped'
  journey: PitchforksPresentationJourney | null
  reason?: PitchforksJourneySaveReason
}>

/**
 * Confirm a normal journey only after the storage write can be read back
 * byte-for-byte. The caller owns the in-memory journey, so every failure keeps
 * that snapshot available for a later retry.
 */
export function persistPitchforksPresentationJourney(
  storageSource: PitchforksJourneySaveStorageSource,
  journey: PitchforksPresentationJourney | null,
  options: Readonly<{ demo?: boolean; fsrsDebug?: boolean; key?: string }> = {},
): PitchforksJourneySaveResult {
  if (!journey) return { status: 'skipped', journey, reason: 'no-journey' }
  if (options.demo) return { status: 'skipped', journey, reason: 'demo' }
  if (options.fsrsDebug) return { status: 'skipped', journey, reason: 'fsrs-debug' }

  const key = options.key ?? PITCHFORKS_PRESENTATION_JOURNEY_KEY
  let storage: PitchforksJourneySaveStorage
  try {
    storage = typeof storageSource === 'function' ? storageSource() : storageSource
  } catch {
    return { status: 'not-confirmed', journey, reason: 'write-failed' }
  }
  let serialized: string
  try {
    serialized = JSON.stringify(journey)
  } catch {
    return { status: 'not-confirmed', journey, reason: 'serialize-failed' }
  }

  try {
    storage.setItem(key, serialized)
  } catch {
    return { status: 'not-confirmed', journey, reason: 'write-failed' }
  }

  let readback: string | null
  try {
    readback = storage.getItem(key)
  } catch {
    return { status: 'not-confirmed', journey, reason: 'readback-failed' }
  }
  if (readback !== serialized) {
    return { status: 'not-confirmed', journey, reason: 'readback-mismatch' }
  }
  return { status: 'confirmed', journey }
}

export type PitchforksMasterySaveStorage = Pick<Storage, 'getItem'>
export type PitchforksMasterySaveReason =
  | 'serialize-failed'
  | 'write-failed'
  | 'readback-failed'
  | 'readback-mismatch'
export type PitchforksMasterySaveResult = Readonly<{
  status: 'confirmed' | 'not-confirmed'
  store: Record<string, NoteMemory>
  reason?: PitchforksMasterySaveReason
}>

/**
 * Confirm an FSRS mastery write without changing the shared fsrsFamily API.
 * The caller retains the live store ref on every failure so a later retry can
 * persist whatever the player has most recently learned.
 */
export function persistPitchforksMasteryStore(
  storageSource: () => PitchforksMasterySaveStorage,
  key: string,
  store: Record<string, NoteMemory>,
  write: () => boolean,
): PitchforksMasterySaveResult {
  let serialized: string
  try {
    const next = JSON.stringify(store)
    if (typeof next !== 'string') throw new Error('FSRS mastery store did not serialize')
    serialized = next
  } catch {
    return { status: 'not-confirmed', store, reason: 'serialize-failed' }
  }

  try {
    if (!write()) return { status: 'not-confirmed', store, reason: 'write-failed' }
  } catch {
    return { status: 'not-confirmed', store, reason: 'write-failed' }
  }

  let readback: string | null
  try {
    readback = storageSource().getItem(key)
  } catch {
    return { status: 'not-confirmed', store, reason: 'readback-failed' }
  }
  if (readback !== serialized) return { status: 'not-confirmed', store, reason: 'readback-mismatch' }
  return { status: 'confirmed', store }
}

// ported from Pitchforks.tsx:430-432
const CONFIDENCE_FLOOR = 0.75
// ported from Pitchforks.tsx:440-448
const MATCH_TOLERANCE_CENTS = 70
const HOLD_MS = 300

const FRANK_X = 54
const FRANK_Y = 196
const FRANK_REACH_X = 138
const GROUND_Y = 330
const STARTING_HEALTH = 5
const TONE_MS = 1000
const TONE_SPACING_MS = 1200
const ECHO_TAIL_MS = 350
const TONE_SUPPRESS_MS = TONE_MS + ECHO_TAIL_MS
const NEW_NOTE_CEREMONY_MS = 2400
const NOTE_MASTERED_CEREMONY_MS = 2400
const WAVE_RECEIPT_MS = 1900
const SHAKE_PEAK_PX = 4
const SHAKE_MS = 200
// The full cloud -> Frank -> fork circuit must remain readable at a glance on
// both 60 Hz phones and sampled proof video. Keep the outgoing leg visible for
// at least one full second; this is a teaching receipt, not a muzzle flash.
const BOLT_LIFE_S = 1.5
const STRIKE_LEADER_END = 0.12
const STRIKE_RECEIPT_END = 0.22
const STRIKE_IMPACT_START = 0.42
const CHARGE_LEADER_START = 0.18
const CHARGE_DISCHARGE_START = 0.42
const CHARGE_PRELOCK_REVEAL_MAX = 0.86
const CIRCUIT_RELAY_X = 18
const CIRCUIT_RELAY_Y = 2
const CIRCUIT_BUCKET_S = 0.05
const FRANK_CLOUD_X_OFFSET = 26
const FRANK_CLOUD_Y = 88
const FRANK_REACTION_MS = 260
const VICTORY_SPRITE_W = 96
const VICTORY_SPRITE_H = 144
// Private integration policy carried forward from the staged grammar. Keep this
// tunable while the hosted timing/latency gate remains open.
const CLOSE_SMASH_FALLBACK_MS = 1600
const CLOSE_SMASH_CONTACT_DELAY_MS = 200
const CLOSE_SMASH_SETTLE_MS = 250
const CLOSE_SMASH_RECOIL_MS = 280
const CLOSE_SMASH_RECOIL_RADIUS_X = 128
const CLOSE_SMASH_RECOIL_RADIUS_Y = 84
// Native authored contact cell is 96x144; this point is the joined-hand mass
// used as the deterministic energy origin for the contact-only presentation.
const CLOSE_SMASH_HANDS_X = 68
const CLOSE_SMASH_HANDS_Y = 88
// Thunderhead shares one receipt lifecycle between demo and earned Village-clear
// access. Rune naming remains unresolved. The cloud uses the existing
// Storm Heart envelope and deterministic circuit renderer; no new asset or
// timer engine is introduced.
const THUNDERHEAD_CEILING_Y = PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y
const THUNDERHEAD_BANK_X_OFFSET = -8
const THUNDERHEAD_TRAVEL_MS = 820
const THUNDERHEAD_MATCH_SETTLE_MS = 120
const THUNDERHEAD_RUNE_STATUS = 'unresolved-canonical-rune'
const GALVANIC_BANK_CAPACITY = 2 as const
const GALVANIC_PROOF_FIRST_NOTES = ['C4', 'C4', 'E4'] as const
const GALVANIC_PROOF_X = [220, 395, 570] as const
// Bell Tower is a private proof route only. The measured anchor comes from
// the original plate metadata; this wave never grants ordinary tine credit.
const BELL_WAVE_ORIGIN = Object.freeze({ x: 274.5, y: 61.5 })
const BELL_WAVE_SPEED = 0.34
const BELL_WAVE_DURATION_MS = 1400
// A full actor-width shove remains readable at the 390px phone floor.
const BELL_KNOCKBACK_DISTANCE = 72
const BELL_KNOCKBACK_MS = 320
const MASTERY_STABILITY_DAYS = 21

export type PitchforksCuePromptTiming = Readonly<{
  /** The authored piano tone is still audible. */
  cuePlaying: boolean
  /** The existing cue/echo suppression window is still active. */
  matchingSuppressed: boolean
}>

/**
 * Sing/Now is an action prompt, so it must not outrun either side of the
 * existing tuner presentation gate. Returning null lets the caller retain its
 * current Listen/status copy until the same target is safe to ask for.
 */
export function selectPitchforksCuePrompt(
  note: string,
  burned: number,
  timing: PitchforksCuePromptTiming,
): string | null {
  if (timing.cuePlaying || timing.matchingSuppressed) return null
  return `${burned === 0 ? 'Sing' : 'Now'}: ${note}`
}

/** The existing receipt window is also the canonical next-wave schedule. */
export const PITCHFORKS_VICTORY_NEXT_WAVE_MS = WAVE_RECEIPT_MS

export type PitchforksVictoryReceiptClaim = Readonly<{
  receiptId: string
  /** Authoritative wave ordinal captured at receipt claim time. */
  receiptOrdinal: number
  /** Parity-selected micro-presentation, captured once per receipt. */
  variant: 'neutral' | 'eyeLift'
  /** Reduced-motion preference captured once per receipt. */
  reducedMotion: boolean
  /** Whether the accepted original sprites were available at claim time. */
  assetAvailability: PitchforksVictoryAssetAvailability
  /** Absolute position on the existing runtime.animClock. */
  claimedAtMs: number
}>

export function selectPitchforksVictoryPoseForClaim(
  claim: PitchforksVictoryReceiptClaim | null,
  elapsedMs: number,
  cancelled = false,
): PitchforksVictoryPose {
  if (!claim || cancelled) return 'none'
  return selectPitchforksVictoryPose({
    elapsedMs,
    eligible: true,
    reducedMotion: claim.reducedMotion,
    // Use the immutable claim variant rather than re-deriving it during a
    // rerender. The ordinal remains in the receipt for audit parity.
    wave: claim.variant === 'eyeLift' ? 1 : 0,
    assets: claim.assetAvailability,
  })
}

export type PitchforksWaveReceiptClockInput = Readonly<{
  logicalNowMs: number
  receiptStartedAtMs: number
}>

/**
 * Derive a bounded receipt age from the existing rAF logical clock. This is
 * deliberately pure so timing tests exercise the same arithmetic as runtime.
 */
export function pitchforksWaveReceiptAgeMs({ logicalNowMs, receiptStartedAtMs }: PitchforksWaveReceiptClockInput): number {
  if (!Number.isFinite(logicalNowMs) || !Number.isFinite(receiptStartedAtMs)) return 0
  return clamp(logicalNowMs - receiptStartedAtMs, 0, PITCHFORKS_VICTORY_NEXT_WAVE_MS)
}

/** Advance the existing logical clock; a paused receipt must not accrue age. */
export function advancePitchforksLogicalClock(logicalNowMs: number, dtMs: number, paused: boolean): number {
  const now = Number.isFinite(logicalNowMs) ? Math.max(0, logicalNowMs) : 0
  if (paused || !Number.isFinite(dtMs) || dtMs <= 0) return now
  return now + dtMs
}
export type PitchforksPauseGate = Readonly<{
  paused: boolean
  generation: number
  fence: number
}>

export function createPitchforksPauseGate(generation = 0): PitchforksPauseGate {
  return { paused: false, generation, fence: 0 }
}

export function transitionPitchforksPauseGate(
  gate: PitchforksPauseGate,
  action: 'pause' | 'resume',
): PitchforksPauseGate {
  return {
    paused: action === 'pause',
    generation: action === 'resume' ? gate.generation + 1 : gate.generation,
    fence: gate.fence + 1,
  }
}

export function acceptsPitchforksPauseCallback(
  gate: PitchforksPauseGate,
  generation: number,
  fence: number,
): boolean {
  return !gate.paused && gate.generation === generation && gate.fence === fence
}

export function schedulePitchforksBossCueCompletion(
  schedule: (callback: () => void, delayMs: number) => unknown,
  isCurrent: () => boolean,
  isPaused: () => boolean,
  complete: () => void,
  initialDelayMs = 1800,
  retryDelayMs = 100,
): void {
  const finish = () => {
    if (!isCurrent()) return
    if (isPaused()) {
      schedule(finish, retryDelayMs)
      return
    }
    complete()
  }
  schedule(finish, initialDelayMs)
}

export function pitchforksPracticeBossForWorld(world: PitchforksPracticeWorld): PitchforksBossId {
  return world === 'dungeon' ? 'torchmaster' : world === 'village-gate' ? 'choirmaster' : 'bellringer'
}

export type PitchforksBossMicrophoneStartInput = Readonly<{
  lane: 'voice' | 'ear'
  earnedWorld: WorldId | null
  practiceWorld: WorldId | null
}>

/** EAR answers are deliberate, but they never authorize microphone capture. */
export function shouldStartPitchforksBossMicrophone({
  lane,
  earnedWorld,
  practiceWorld,
}: PitchforksBossMicrophoneStartInput): boolean {
  return lane === 'voice' && Boolean(earnedWorld || practiceWorld)
}

function clonePitchforksPracticeStore(store: Record<string, NoteMemory>): Record<string, NoteMemory> {
  const copy: Record<string, NoteMemory> = {}
  for (const [note, memory] of Object.entries(store)) copy[note] = { ...memory }
  return copy
}

export type PitchforksEphemeralBossPracticeStorage = PitchforksBossRecitalStorage & Readonly<{
  snapshot: () => Record<string, NoteMemory>
}>

/** Keep practice reviews alive for this recital only; no browser key is involved. */
export function createPitchforksEphemeralBossPracticeStorage(): PitchforksEphemeralBossPracticeStorage {
  const practiceStore: Record<string, NoteMemory> = {}
  const snapshot = (): Record<string, NoteMemory> => clonePitchforksPracticeStore(practiceStore)
  return {
    loadStore: () => snapshot(),
    saveStore: (_, store) => {
      for (const note of Object.keys(practiceStore)) delete practiceStore[note]
      Object.assign(practiceStore, clonePitchforksPracticeStore(store))
      return true
    },
    readback: (_, note) => practiceStore[note] ? { ...practiceStore[note] } : null,
    snapshot,
  }
}

export function selectPitchforksBossRecitalStorage(
  practiceOnly: boolean,
  durableStorage: PitchforksBossRecitalStorage,
): PitchforksBossRecitalStorage {
  return practiceOnly ? createPitchforksEphemeralBossPracticeStorage() : durableStorage
}

export function pitchforksWaveReceiptDue({ logicalNowMs, receiptStartedAtMs }: PitchforksWaveReceiptClockInput): boolean {
  return pitchforksWaveReceiptAgeMs({ logicalNowMs, receiptStartedAtMs }) >= PITCHFORKS_VICTORY_NEXT_WAVE_MS
}

export type PitchforksWaveReceiptSealInput = Readonly<{
  spawned: number
  required: number
  villagers: ReadonlyArray<{ state: VillagerState }>
  bolts: readonly unknown[]
}>

/** A receipt cannot seal while even an ash villager or bolt remains present. */
export function canSealPitchforksWaveReceipt(input: PitchforksWaveReceiptSealInput): boolean {
  return Number.isSafeInteger(input.spawned) &&
    Number.isSafeInteger(input.required) &&
    input.spawned >= input.required &&
    input.villagers.length === 0 &&
    input.bolts.length === 0
}
const MASTERY_SESSION_COUNT = 3
const TRAIL_MS = 1000
const PITCH_BAR_Y = H - 52
const PITCH_BAR_H = 12
const PITCH_BAR_X = 34
const PITCH_BAR_W = W - PITCH_BAR_X * 2
const DUNGEON_FLOOR_Y = GROUND_Y - 42
const DUNGEON_TORCHES = [
  { x: 126, y: 126, phase: 0.2 },
  { x: 358, y: 104, phase: 1.9 },
  { x: 594, y: 132, phase: 3.4 },
] as const

type LayoutMode = 'portrait' | 'stage'
type PortraitDockPanel = 'staff' | 'settings' | null
type MicCheckStep = 'room' | 'voice' | 'ready'

function layoutModeForViewport(width: number, height: number): LayoutMode {
  return height > width && width <= 768 ? 'portrait' : 'stage'
}

// C3: fork pose lean. Villagers face/advance toward Frankenstein (FRANK_X, left side),
// so a negative angle here tips the tine end toward him — "gripped forward," not a
// vertical rod. Pivots around the villager's own fork_base anchor (rotation-invariant;
// strike/tineIndex targeting never reads rendered fork pixels, only villagerMeta.tines).
const FORK_LEAN_DEG = -18

function rotateAroundPivot(px: number, py: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

// C4: continuous charge-arc render cache. Pre-allocated once and mutated in place
// (CW consult-28, 0.86 conf: zero per-frame allocation is the single most important
// mobile-Safari perf rule for a per-frame polyline). Purely a rendering jitter cache,
// not gameplay state — renderView still emits everything logic-observable from
// (view, assets) only, same C0 render-seam guarantee.
const CHARGE_ARC_MAX_SEGMENTS = 16
const chargeArcPoints: { x: number; y: number }[] = Array.from(
  { length: CHARGE_ARC_MAX_SEGMENTS + 1 },
  () => ({ x: 0, y: 0 }),
)
const CHARGE_ARC_MAX_BRANCHES = 4
const CHARGE_ARC_MAX_BRANCH_SEGMENTS = 3
const chargeArcBranchPoints: { x: number; y: number }[][] = Array.from(
  { length: CHARGE_ARC_MAX_BRANCHES },
  () => Array.from({ length: CHARGE_ARC_MAX_BRANCH_SEGMENTS + 1 }, () => ({ x: 0, y: 0 })),
)
let chargeArcBranchCount = 0
let chargeArcBranchSegments = 0
let chargeArcJitterBucket = -1
let chargeArcSegmentCount = -1
// Structural degrade hook per CW's ask — no auto-detection wired yet (nothing to
// measure from; iPhone is the real gate at C13). Set to 'lite' manually if a device
// needs the cheaper path before C13 lands real detection.
let chargeArcQuality: 'full' | 'lite' = 'full'

// C5: Frankenstein neck-bolt/fist spark arcs while charging. Two short jittered
// polylines anchored near frankMeta.rod_tip (same anchor C4's lightning already
// terminates at) — pre-allocated, mutated in place, same zero-per-frame-allocation
// discipline as chargeArcPoints above.
const FRANK_SPARK_SEGMENTS = 5
const frankSparkPoints: { x: number; y: number }[][] = [0, 1].map(() =>
  Array.from({ length: FRANK_SPARK_SEGMENTS + 1 }, () => ({ x: 0, y: 0 })),
)
let frankSparkJitterBucket = -1

type Phase = 'menu' | 'tutorial' | 'calibrating' | 'range_manual' | 'range_assessment' | 'playing' | 'game_over' | 'songcraft'
type RangeAssessmentStep = 'anchor' | 'lower' | 'higher' | 'summary'
type RangeIntent = 'guided' | 'saved'
type ButtonFeedbackKind = 'listen' | 'question' | 'correct' | 'wrong'
type ButtonFeedback = Readonly<{ kind: ButtonFeedbackKind; text: string }>
type ActiveCueContext = Readonly<{ support: CueSupportLevel; noteCount: number }>
type FirstMinuteCoachState = Readonly<{ beat: FirstMinuteBeat; note: string | null }>
type SparkGuideEvent = Readonly<{
  atMs: number
  kind: 'target' | 'armed' | 'cancelled' | 'fired' | 'capped' | 'disabled' | 'activation-pulse'
  reason: string
  targetKey: string | null
  targetNote: string | null
  generation: number
  autoPulseCount: number
  suppressionStartMs: number | null
  suppressionEndMs: number | null
}>
type LightningPhase = 'idle' | 'charge-cloud' | 'charge-leader' | 'charge-discharge' | 'strike-leader' | 'strike-receipt' | 'strike-discharge' | 'strike-impact'
type VillagerState = 'waiting' | 'walking' | 'ash'
type ArtReviewBodyState = 'walk' | 'burn-1' | 'burn-2' | 'burn-3' | 'ash'
type ArtReviewStormState = 'dormant' | 'gather-1' | 'gather-2' | 'gather-3' | 'spent'

const ART_REVIEW_BODY_STATES: readonly ArtReviewBodyState[] = ['walk', 'burn-1', 'burn-2', 'burn-3', 'ash']
const ART_REVIEW_STORM_STATES: readonly ArtReviewStormState[] = ['dormant', 'gather-1', 'gather-2', 'gather-3', 'spent']
const ART_REVIEW_ACTOR_X: readonly number[] = [148, 288, 428, 568]
const ART_REVIEW_ACTOR_NOTES: readonly (readonly string[])[] = [
  ['C4'],
  ['D4', 'E4'],
  ['F4', 'G4', 'A4'],
  ['B4', 'C5', 'D5', 'E5'],
]

function parseArtReviewBodyState(value: string | null): ArtReviewBodyState {
  return value && (ART_REVIEW_BODY_STATES as readonly string[]).includes(value)
    ? value as ArtReviewBodyState
    : 'walk'
}

function parseArtReviewStormState(value: string | null): ArtReviewStormState {
  return value && (ART_REVIEW_STORM_STATES as readonly string[]).includes(value)
    ? value as ArtReviewStormState
    : 'dormant'
}

interface FrankMeta {
  frame_w: number
  frame_h: number
  frames: number
  rod_tip: { x: number; y: number }
}

interface VillagerMeta {
  frame_w: number
  frame_h: number
  source_frame_w?: number
  source_frame_h?: number
  walk_frames: number
  fork_base: { x: number; y: number }
  tines: Array<{ x: number; y: number }>
}

interface ForkMeta {
  frame_w: number
  frame_h: number
  handle_base: { x: number; y: number }
  tine_tips: Array<{ x: number; y: number }>
}

type PitchforksNormalWorld = WorldId
type VillageGateAssetStatus = 'loading' | 'ready' | 'missing'

export function pitchforksMicReadyActionLabel(
  rangeIntent: 'guided' | 'saved',
  selectedWorld: WorldId,
): string {
  if (rangeIntent === 'guided') return 'Begin comfortable range check'
  const chamber = WORLD_REGISTRY.find(world => world.id === selectedWorld)?.name.replace(/^The\s+/i, '')
  return `Enter the ${chamber ?? 'Dungeon'}`
}

interface Assets {
  frankIdle?: HTMLImageElement
  stormHeart?: HTMLImageElement
  bellSwing?: HTMLImageElement
  bellBackdrop?: HTMLImageElement
  gargoyleSpout?: HTMLImageElement
  rainCloud?: HTMLImageElement
  bellTowerPlate?: HTMLImageElement
  cathedralPlate?: HTMLImageElement
  villageGatePlate?: HTMLImageElement
  privatePlate?: HTMLImageElement
  torchmasterChamberPlate?: HTMLImageElement
  bellringerChamberPlate?: HTMLImageElement
  bellringerRest?: HTMLImageElement
  frankCharge?: HTMLImageElement
  frankCloseSmash?: HTMLImageElement
  frankVictoryNeutral?: HTMLImageElement
  frankVictoryEyeLift?: HTMLImageElement
  frankMeta: FrankMeta
  villagerMeta: Record<TineCount, VillagerMeta>
  forkMeta: Record<TineCount, ForkMeta>
  walkLeft: Record<TineCount, HTMLImageElement | undefined>
  burnedLeft: Record<string, HTMLImageElement | undefined>
  ashLeft: Record<TineCount, HTMLImageElement | undefined>
  fork: Record<string, HTMLImageElement | undefined>
  forkGlow: Record<string, HTMLImageElement | undefined>
}

interface Villager {
  id: number
  totalTines: TineCount
  x: number
  y: number
  speed: number
  notes: string[]
  burned: number
  state: VillagerState
  spawnIndex: number
  attackTimer: number
  attackTimerMax: number
  sequenceCued: boolean
  walkFrame: number
  walkClock: number
  ashTimer: number
  torch: TorchState
  torchBearer: boolean
  supportedLesson?: SupportedVillageLesson
}

type BoltPresentation = 'ordinary' | 'ordinary-fallback' | 'close-smash' | 'thunderhead' | 'galvanic'

interface Bolt {
  fromX: number
  fromY: number
  pivotX: number
  pivotY: number
  toX: number
  toY: number
  life: number
  maxLife: number
  seed: number
  hue: number
  note: string
  villagerId: number
  tineIndex: number
  presentation: BoltPresentation
}

interface LightningPhaseTransition {
  phase: LightningPhase
  logicalMs: number
  chargeProgress: number
}

type BurstKind = 'strike' | 'kill'
type FrankReactionKind = 'kill' | 'miss'

type CloseSmashRequest = Readonly<{
  targetKey: string
  requestedAtMs: number
}>

type BellChargeReceipt = Readonly<{
  receiptId: string
  targetKey: string
  note: string
  frequency: number
  chargedAtMs: number
}>

type BellKnockback = Readonly<{
  startX: number
  direction: -1 | 1
  startedAtMs: number
  expiresAtMs: number
}>

type ThunderheadPoint = Readonly<{ x: number; y: number }>

type ThunderheadView = Readonly<{
  projection: PitchforksThunderheadDebugProjection
  travelProgress: number
  cloudX: number
  cloudY: number
  targetX: number | null
  targetY: number | null
  runeStatus: typeof THUNDERHEAD_RUNE_STATUS
}>

type ThunderheadDebugProjection = Readonly<PitchforksThunderheadDebugProjection & {
  travelProgress: number
  cloudX: number
  cloudY: number
  targetX: number | null
  targetY: number | null
  runeStatus: typeof THUNDERHEAD_RUNE_STATUS
}>

type GalvanicDebugProjection = Readonly<{
  enabled: boolean
  battleId: string
  armed: boolean
  awaitingSilence: boolean
  bankCount: number
  capacity: typeof GALVANIC_BANK_CAPACITY
  banks: ReadonlyArray<Readonly<Pick<PitchforksGalvanicLock, 'lockId' | 'targetKey' | 'note' | 'octave'>>>
  consumedLockIds: readonly string[]
  processedAttackIds: readonly string[]
  lastOutcomes: readonly PitchforksGalvanicOutcome[]
  lastReason: PitchforksGalvanicPlanReason | string | null
}>

function buildGalvanicDebugProjection(
  enabled: boolean,
  state: PitchforksGalvanicState,
  banks: readonly PitchforksGalvanicLock[],
  armed: boolean,
  awaitingSilence: boolean,
  lastOutcomes: readonly PitchforksGalvanicOutcome[],
  lastReason: PitchforksGalvanicPlanReason | string | null,
): GalvanicDebugProjection {
  return Object.freeze({
    enabled,
    battleId: state.battleId,
    armed,
    awaitingSilence,
    bankCount: banks.length,
    capacity: GALVANIC_BANK_CAPACITY,
    banks: Object.freeze(banks.map(bank => Object.freeze({
      lockId: bank.lockId,
      targetKey: bank.targetKey,
      note: bank.note,
      octave: bank.octave,
    }))),
    consumedLockIds: Object.freeze([...state.consumedLockIds]),
    processedAttackIds: Object.freeze([...state.processedAttackIds]),
    lastOutcomes: Object.freeze(lastOutcomes.map(outcome => Object.freeze({ ...outcome }))),
    lastReason,
  })
}

interface Burst {
  x: number
  y: number
  hue: number
  kind: BurstKind
  seed: number
  life: number
  maxLife: number
}

interface TrailPoint {
  at: number
  deviation: number
  onTarget: boolean
  note: string
  generation: number
}

interface WavePlan {
  wave: number
  count: number
  spawnInterval: number
  speed: number
  tineCounts: TineCount[]
}

interface Runtime {
  villagers: Villager[]
  bolts: Bolt[]
  bursts: Burst[]
  wave: number
  health: number
  score: number
  streak: number
  spawned: number
  plan: WavePlan
  spawnClock: number
  bannerTimer: number
  nextWavePending: boolean
  nextWaveNumber: number | null
  nextWaveAtMs: number | null
  nextWaveRunGeneration: number | null
  animClock: number
  gameOver: boolean
  firstVillagerId: number | null
  lastPickedVillagerNote: string | null
  rain: RainState
}

interface ActiveTarget {
  villager: Villager
  tineIndex: number
  note: string
  key: string
}

type PitchforksMusicalPromptTarget = Readonly<{
  key: string
  note: string
  burned: number
  firstMinute: boolean
}>

type VillageLessonObjective = 'minor-third' | 'major-third' | 'perfect-fifth'

type SupportedVillageLesson = Readonly<{
  objective: VillageLessonObjective
  contextNote: string
  targetNote: string
  support?: 'SUPPORTED' | 'UNAIDED_RETURN'
}>

export function projectVillageReturnDisplay(
  villager: Pick<Villager, 'id' | 'burned' | 'totalTines' | 'notes' | 'supportedLesson'>,
  targetOutcomes: PitchforksLevelProgress['targetOutcomes'],
  hintedTargetKeys: ReadonlySet<string>,
): Readonly<{ targetKey: string; answerVisible: boolean }> {
  const targetKey = `${villager.id}:${villager.burned}`
  const lesson = villager.supportedLesson
  const isUnaidedReturn = villager.totalTines === 1 &&
    lesson?.support === 'UNAIDED_RETURN' &&
    lesson.contextNote !== lesson.targetNote &&
    lesson.targetNote === villager.notes[villager.burned]
  const answerVisible = !isUnaidedReturn ||
    Object.prototype.hasOwnProperty.call(targetOutcomes, targetKey) ||
    hintedTargetKeys.has(targetKey)
  return { targetKey, answerVisible }
}

const VILLAGE_RETURN_HIDDEN_NOTE_LABEL = 'THE TARGET'

export type VillageReturnTextProjection = Readonly<{
  targetKey: string
  answerVisible: boolean
  contextNote: string | null
  objective: string | null
  direction: 'above' | 'below' | null
}>

/**
 * Keep every return-facing text surface on the same exact-key decision as the
 * accepted canvas projection. A concealed projection deliberately has no
 * target-note field; callers must not be able to render the answer by accident.
 */
export function projectVillageReturnText(
  villager: Pick<Villager, 'id' | 'burned' | 'totalTines' | 'notes' | 'supportedLesson'>,
  targetOutcomes: PitchforksLevelProgress['targetOutcomes'],
  hintedTargetKeys: ReadonlySet<string>,
): VillageReturnTextProjection {
  const display = projectVillageReturnDisplay(villager, targetOutcomes, hintedTargetKeys)
  const lesson = villager.supportedLesson
  const targetNote = villager.notes[villager.burned]
  const validLesson = !!lesson &&
    lesson.contextNote !== lesson.targetNote &&
    lesson.targetNote === targetNote
  return {
    targetKey: display.targetKey,
    answerVisible: display.answerVisible,
    contextNote: validLesson ? lesson.contextNote : null,
    objective: validLesson ? lesson.objective.replace('-', ' ') : null,
    direction: validLesson
      ? noteToFreq(lesson.targetNote) > noteToFreq(lesson.contextNote) ? 'above' : 'below'
      : null,
  }
}

function replaceLastExact(value: string, target: string, replacement: string): string {
  if (!target) return value
  const index = value.lastIndexOf(target)
  if (index < 0) return value
  return `${value.slice(0, index)}${replacement}${value.slice(index + target.length)}`
}

function villageReturnIntervalInstruction(projection: VillageReturnTextProjection): string | null {
  if (projection.answerVisible || !projection.contextNote || !projection.objective || !projection.direction) return null
  return `starting note ${projection.contextNote} · ${projection.objective} ${projection.direction}`
}

export function projectVillageReturnPrompt(
  prompt: string,
  projection: VillageReturnTextProjection,
): string {
  const interval = villageReturnIntervalInstruction(projection)
  if (!interval) return prompt
  const verb = /^(Listen|Replay|Sing|Now|Strike):/.exec(prompt)?.[1] ?? 'Sing'
  return `${verb}: ${interval}`
}

export function projectVillageReturnTunerFeedback(
  feedback: PitchforksTunerFeedback,
  targetNote: string,
  projection: VillageReturnTextProjection,
): PitchforksTunerFeedback {
  if (projection.answerVisible) return feedback
  return {
    ...feedback,
    // Replace the final occurrence so an on-target reading can retain the
    // singer's own source pitch while hiding the target occurrence.
    headline: replaceLastExact(feedback.headline, targetNote, VILLAGE_RETURN_HIDDEN_NOTE_LABEL),
    detail: replaceLastExact(feedback.detail, targetNote, VILLAGE_RETURN_HIDDEN_NOTE_LABEL),
    compactLabel: replaceLastExact(feedback.compactLabel, targetNote, VILLAGE_RETURN_HIDDEN_NOTE_LABEL),
  }
}

export function projectVillageReturnNoteLabel(
  targetKey: string,
  note: string,
  projection: VillageReturnTextProjection | null,
): string {
  return projection && !projection.answerVisible && projection.targetKey === targetKey
    ? VILLAGE_RETURN_HIDDEN_NOTE_LABEL
    : note
}

export function projectVillageReturnEnvironmentText(
  text: string,
  targetNote: string | null,
  targetKey: string,
  projection: VillageReturnTextProjection | null,
): string {
  if (!projection || projection.answerVisible || projection.targetKey !== targetKey || !targetNote) return text
  return replaceLastExact(text, targetNote, VILLAGE_RETURN_HIDDEN_NOTE_LABEL)
}

export function projectVillageReturnCoachCopy(
  beat: FirstMinuteBeat,
  note: string | null,
  projection: VillageReturnTextProjection,
): string | null {
  const interval = villageReturnIntervalInstruction(projection)
  const ordinary = firstMinuteCoachCopy(beat, note)
  if (!interval) return ordinary
  if (beat === 'listen') return `LISTEN TO ${projection.contextNote} · THEN MATCH A ${projection.objective} ${projection.direction}`
  if (beat === 'charge') return `HOLD ${VILLAGE_RETURN_HIDDEN_NOTE_LABEL} · THE CLOUD IS CHARGING · ${interval}`
  if (beat === 'sing') return `SING A ${projection.objective} ${projection.direction} FROM ${projection.contextNote} · HUM TO ARM THE LIGHTNING`
  return ordinary
}

function pitchIdentity(note: string): Readonly<{ pitchClass: string; octave: number }> | null {
  const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(note)
  if (!match) return null
  const octave = Number(match[2])
  return Number.isSafeInteger(octave) ? { pitchClass: match[1], octave } : null
}

const BELL_NOTE_PITCH_CLASS_SEMITONES: Readonly<Record<string, number>> = Object.freeze({
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
})

/** Preserve literal octave identity while measuring an activation pair. */
export function pitchforksBellNoteMidi(note: string): number | null {
  const identity = pitchIdentity(note)
  const pitchClass = identity ? BELL_NOTE_PITCH_CLASS_SEMITONES[identity.pitchClass] : undefined
  return pitchClass === undefined || !identity ? null : identity.octave * 12 + pitchClass
}

/** Pick the closest distinct admitted pair without octave folding or reordering. */
export function selectPitchforksBellTaughtPair(admittedNotes: readonly string[]): readonly [string, string] | null {
  if (!Array.isArray(admittedNotes)) return null
  const candidates = distinctPitchforksAdmittedNotes([...admittedNotes])
    .filter(note => pitchforksBellNoteMidi(note) !== null)
  if (candidates.length < 2) return null

  let bestPair: readonly [string, string] | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let bestLowerMidi = Number.POSITIVE_INFINITY
  let bestUpperMidi = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < candidates.length - 1; leftIndex += 1) {
    const leftMidi = pitchforksBellNoteMidi(candidates[leftIndex])
    if (leftMidi === null) continue
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const rightMidi = pitchforksBellNoteMidi(candidates[rightIndex])
      if (rightMidi === null) continue
      const distance = Math.abs(leftMidi - rightMidi)
      const lowerMidi = Math.min(leftMidi, rightMidi)
      const upperMidi = Math.max(leftMidi, rightMidi)
      const orderedPair: readonly [string, string] = leftMidi < rightMidi
        ? [candidates[leftIndex], candidates[rightIndex]]
        : leftMidi > rightMidi
          ? [candidates[rightIndex], candidates[leftIndex]]
          : candidates[leftIndex] <= candidates[rightIndex]
            ? [candidates[leftIndex], candidates[rightIndex]]
            : [candidates[rightIndex], candidates[leftIndex]]
      const pairIsCanonicalTieBreaker = distance === bestDistance && (
        lowerMidi < bestLowerMidi ||
        (lowerMidi === bestLowerMidi && (
          upperMidi < bestUpperMidi ||
          (upperMidi === bestUpperMidi && bestPair !== null && (
            orderedPair[0] < bestPair[0] ||
            (orderedPair[0] === bestPair[0] && orderedPair[1] < bestPair[1])
          ))
        ))
      )
      if (distance < bestDistance || pairIsCanonicalTieBreaker) {
        bestDistance = distance
        bestLowerMidi = lowerMidi
        bestUpperMidi = upperMidi
        bestPair = orderedPair
      }
    }
  }
  // Canonical pair ordering keeps equal-distance ties stable across pool permutations.
  // The pure Bell controller requires a comfortable (< octave) teaching pair;
  // leave the power unavailable rather than asking for an invalid activation.
  return bestPair && bestDistance < 12
    ? Object.freeze([bestPair[0], bestPair[1]]) as readonly [string, string]
    : null
}

interface HudState {
  wave: number
  health: number
  score: number
  streak: number
}

type MicHudState = 'demo' | 'cue' | 'listening' | 'waiting' | 'blocked'

type Pf3ResetReason = 'confident-wrong' | 'silence' | null

type CeremonyToneAttempt = 'played' | 'suppressed' | 'pending' | 'disabled'

interface NewNoteCeremonyState {
  active: boolean
  note: string | null
  toneFired: boolean
  tonePulseKey: number
}

type WaveReceiptState = Readonly<{
  visible: boolean
  timer: number
  receiptStartedAtMs: number
  heard: readonly string[]
  sung: readonly string[]
  mastered: readonly string[]
  levelResult: PitchforksLevelResult | null
  claim: PitchforksVictoryReceiptClaim | null
}>

type MasteryProgress = Record<string, {
  sessionIds: string[]
  masteredAt: number | null
}>

type NoteChipPalette = Readonly<{
  hue: number
  saturation: number
  fillLight: number
  borderLight: number
  textLight: number
  glowPx: number
  glowAlpha: number
}>

const EMPTY_WAVE_RECEIPT: WaveReceiptState = {
  visible: false,
  timer: 0,
  receiptStartedAtMs: 0,
  heard: [],
  sung: [],
  mastered: [],
  levelResult: null,
  claim: null,
}

type VillagerView = Readonly<{
  id: number
  totalTines: TineCount
  x: number
  y: number
  lane: number
  speed: number
  notes: ReadonlyArray<string>
  burned: number
  state: VillagerState
  visualBurn: number
  visualState: VillagerState
  spawnIndex: number
  attackTimer: number
  attackTimerMax: number
  sequenceCued: boolean
  walkFrame: number
  ashTimer: number
  active: boolean
  answerVisible: boolean
  displayBurn: number
  timerPct: number
  soulR: number      // 0-1, currentR() for this villager's active note (notes[burned])
  soulCalm: number   // 0-1, retrievability(1, mem.S) for the same note, fixed 1-day-out reference
  soulHue: number     // hueForNote() for the same note
  torch: TorchState
  torchBearer: boolean
  /** Visual-only bystander recoil; never feeds target, tine, or score state. */
  recoilProgress: number
}>

type BoltView = Readonly<Bolt>
type BurstView = Readonly<Burst>
type TrailPointView = Readonly<TrailPoint>

type ShakeView = Readonly<{
  x: number
  y: number
}>

type ActiveView = Readonly<{
  villagerId: number
  tineIndex: number
  note: string
  key: string
}>

type TunerView = Readonly<{
  visible: boolean
  now: number
  targetNote: string | null
  sourceNote: string | null
  canUseSource: boolean
  dotDeviation: number | null
  renderDeviation: number | null
  onTarget: boolean
  trail: ReadonlyArray<TrailPointView>
  feedback: PitchforksTunerFeedback
}>

const EMPTY_TUNER_VIEW: TunerView = {
  visible: false,
  now: 0,
  targetNote: null,
  sourceNote: null,
  canUseSource: false,
  dotDeviation: null,
  renderDeviation: null,
  onTarget: false,
  trail: [],
  feedback: pitchforksTunerFeedback({
    targetNote: null,
    sourceNote: null,
    deviationSemis: null,
    matchingSuppressed: false,
    micUnreliable: false,
    voiceBreak: false,
    approaching: false,
    lockProgress: 0,
    toleranceSemis: MATCH_TOLERANCE_CENTS / 100,
  }),
}

type ViewState = Readonly<{
  phase: Phase
  normalWorld: PitchforksNormalWorld
  inputMode: PitchforksInputMode
  animClock: number
  gameOver: boolean
  villagers: ReadonlyArray<VillagerView>
  active: ActiveView | null
  charge: Readonly<{
    progress: number
    level: number
    tint: string | null
    charging: boolean
  }>
  bolts: ReadonlyArray<BoltView>
  bursts: ReadonlyArray<BurstView>
  frankReaction: Readonly<{
    kind: FrankReactionKind
    ageMs: number
  }> | null
  frankVictory: Readonly<{
    pose: Exclude<PitchforksVictoryPose, 'none'>
    ageMs: number
    receiptId: string
  }> | null
  closeSmash: Readonly<{
    phase: PitchforksCloseSmashState['phase']
    receipt: PitchforksCloseSmashReceipt | null
    consumer: PitchforksCloseSmashState['consumer']
    contactAtMs: number | null
    contactPresented: boolean
    fallbackRemainingMs: number | null
    showcase: boolean
  }>
  shake: ShakeView
  hud: Readonly<{
    wave: number
    health: number
    score: number
    streak: number
  }>
  waveBanner: Readonly<{
    visible: boolean
    timer: number
  }>
  prompt: Readonly<{
    visible: boolean
    text: string
  }>
  noteNamesVisible: boolean
  staffNotationVisible: boolean
  synesthesiaOn: boolean
  reducedMotion: boolean
  timersPaused: boolean
  tuner: TunerView
  ceremony: Readonly<NewNoteCeremonyState>
  noteMastered: string | null
  noteMasteredAgeMs: number
  rain: RainState
  thunderhead: ThunderheadView
  bellWave: PitchforksBellWaveProjection
  bellWaveElapsedMs: number
}>

interface NoteHealthDebug {
  hue: number
  r: number
  intensity: number
}

interface Pf3DebugState {
  bossId: PitchforksBossId | null
  bossRecital: PitchforksBossRecitalState | null
  bossReviewReceipts: readonly PitchforksBossRecitalReceipt[]
  demoStep: string
  closeSmashProof: boolean
  inputMode: PitchforksInputMode
  settings: PitchforksSettingsSnapshot
  chargeProgress: number
  chargeLevel: number
  silenceFreezeObserved: boolean
  resetCount: number
  lastResetReason: Pf3ResetReason
  strikeCount: number
  burnedTines: number
  ashCount: number
  wave: number
  levelProgress: PitchforksLevelProgress
  levelAccuracyPercent: number
  waveBannerVisible: boolean
  fullSequenceComplete: boolean
  barVisible: boolean
  barDotDeviation: number | null
  barOnTarget: boolean
  trailLength: number
  replayVisible: boolean
  cuePlaying: boolean
  matchingSuppressed: boolean
  timersPaused: boolean
  firstLockGrace: boolean
  timerBarVisible: boolean
  activeAttackTimerPct: number | null
  lockWhileSuppressed: boolean
  tutorialAvailable: boolean
  healthPips: number
  burstCount: number
  lastStrikeNote: string | null
  lastStrikeHue: number | null
  lastKillNote: string | null
  lastKillHue: number | null
  roarFiredCount: number
  unlockedCount: number
  unlockedNotes: string[]
  noteR: Record<string, number>
  noteHealth: Record<string, NoteHealthDebug>
  ceremonyActive: boolean
  ceremonyNote: string | null
  ceremonyToneFired: boolean
  noteMastered: string | null
  masteredNotes: string[]
  selectedNotes: string[]
  activeNote: string | null
  activeSequence: string[]
  activeCueSupport: CueSupportLevel
  cueSupportProfile: CueSupportProfile
  sparkGuideStatus: PitchforksSparkGuideStatus
  sparkGuideGeneration: number
  sparkGuideAutoPulseCount: number
  sparkGuideEvents: SparkGuideEvent[]
  firstMinuteBeat: FirstMinuteBeat
  fsrsDebug: boolean
  fsrsStoreKey: string
  earFsrsStoreKey: string
  buttonTrial: PitchforksButtonTrial | null
  newNoteUnlocked: string | null
  layoutMode: LayoutMode
  lightningPhase: LightningPhase
  boltCount: number
  lightningBendDeg: number | null
  lightningPhaseTrace: LightningPhaseTransition[]
  closeSmashPhase: PitchforksCloseSmashState['phase']
  closeSmashReceipt: PitchforksCloseSmashReceipt | null
  closeSmashConsumer: PitchforksCloseSmashState['consumer']
  closeSmashContactPresented: boolean
  closeSmashFallbackRemainingMs: number | null
  closeSmashRequestQueued: boolean
  logicalNowMs: number
  waveReceiptVictoryPose: PitchforksVictoryPose
  waveReceiptVictoryAgeMs: number | null
  waveReceiptVictoryNextWaveAtMs: number | null
  waveReceiptVictoryNextWaveRemainingMs: number | null
  villagers: Array<{
    id: number
    state: VillagerState
    burned: number
    totalTines: TineCount
    notes: string[]
    x: number
  }>
  rainPhase: RainState['phase']
  rainFill: number
  rainCycleID: number
  rainSlowFactor: number
  rainExtinguishes: boolean
  rainTransitions: RainState['recentTransitions']
  torchStates: Record<string, TorchState>
  thunderhead: ThunderheadDebugProjection
  thunderheadArmed: boolean
  thunderheadReleaseQueued: boolean
  thunderheadLastTransitionReason: PitchforksThunderheadTransitionReason | null
  thunderheadRuneStatus: typeof THUNDERHEAD_RUNE_STATUS
  thunderheadTravelProgress: number
  galvanic: GalvanicDebugProjection
  bellProof: boolean
  bellPhase: PitchforksBellWaveState['phase']
  bellRadius: number
  bellContactCount: number
  bellRingCount: number
  bellChargeReceiptId: string | null
  bellReleaseQueued: boolean
}

declare global {
  interface Window {
    __pf3?: {
      getState: () => Readonly<Pf3DebugState>
      readonly viewState: Readonly<ViewState> | null
    }
  }
}

const defaultFrankMeta: FrankMeta = {
  frame_w: 32,
  frame_h: 48,
  frames: 4,
  rod_tip: { x: 16, y: 0 },
}

const defaultVillagerMeta: VillagerMeta = {
  frame_w: 16,
  frame_h: 24,
  walk_frames: 4,
  fork_base: { x: 14, y: 11 },
  tines: [{ x: 14, y: 4 }, { x: 14, y: 6 }, { x: 14, y: 8 }, { x: 14, y: 10 }],
}

const defaultForkMeta: ForkMeta = {
  frame_w: 8,
  frame_h: 16,
  handle_base: { x: 3, y: 15 },
  tine_tips: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }],
}

function emptyAssets(): Assets {
  return {
    frankMeta: defaultFrankMeta,
    villagerMeta: { 1: defaultVillagerMeta, 2: defaultVillagerMeta, 3: defaultVillagerMeta, 4: defaultVillagerMeta },
    forkMeta: { 1: defaultForkMeta, 2: defaultForkMeta, 3: defaultForkMeta, 4: defaultForkMeta },
    walkLeft: { 1: undefined, 2: undefined, 3: undefined, 4: undefined },
    burnedLeft: {},
    ashLeft: { 1: undefined, 2: undefined, 3: undefined, 4: undefined },
    fork: {},
    forkGlow: {},
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function semiToName(semiFromC4: number): string {
  const rounded = Math.round(semiFromC4)
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12]
  const octave = 4 + Math.floor(rounded / 12)
  return `${name}${octave}`
}

function nameToSemi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d)$/)
  if (!match) return 0
  return (parseInt(match[2], 10) - 4) * 12 + NOTE_NAMES.indexOf(match[1])
}

function noteRSnapshot(notes: string[], memory: Record<string, NoteMemory>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const note of notes) {
    result[note] = Number(currentR(memory[note] ?? createNote(note)).toFixed(4))
  }
  return result
}

function noteHealthIntensity(r: number): number {
  // Low retrievability should look more urgent; high retrievability stays calm but legible.
  return Number(clamp(0.2 + (1 - clamp(r, 0, 1)) * 0.8, 0.2, 1).toFixed(4))
}

function noteHealthFor(note: string, memory: Readonly<Record<string, NoteMemory>>): NoteHealthDebug {
  const r = clamp(currentR(memory[note] ?? createNote(note)), 0, 1)
  return {
    hue: hueForNote(note),
    r: Number(r.toFixed(4)),
    intensity: noteHealthIntensity(r),
  }
}

function noteHealthSnapshot(notes: string[], memory: Readonly<Record<string, NoteMemory>>): Record<string, NoteHealthDebug> {
  const result: Record<string, NoteHealthDebug> = {}
  for (const note of notes) result[note] = noteHealthFor(note, memory)
  return result
}

function noteChipPalette(note: string, memory: Readonly<Record<string, NoteMemory>>): NoteChipPalette {
  const { hue, intensity } = noteHealthFor(note, memory)
  return {
    hue,
    saturation: Math.round(34 + intensity * 56),
    fillLight: Math.round(12 + intensity * 18),
    borderLight: Math.round(38 + intensity * 24),
    textLight: Math.round(72 + intensity * 12),
    glowPx: Math.round(4 + intensity * 12),
    glowAlpha: 0.12 + intensity * 0.22,
  }
}

function noteChipStyle(note: string, memory: Readonly<Record<string, NoteMemory>>): CSSProperties {
  const { hue, saturation, fillLight, borderLight, textLight, glowPx, glowAlpha } = noteChipPalette(note, memory)
  return {
    color: `hsl(${hue}, ${saturation}%, ${textLight}%)`,
    background: `linear-gradient(180deg, hsla(${hue}, ${saturation}%, ${fillLight + 7}%, 0.88), hsla(${hue}, ${saturation}%, ${fillLight}%, 0.72))`,
    borderColor: `hsla(${hue}, ${saturation}%, ${borderLight}%, 0.86)`,
    boxShadow: `0 0 ${glowPx}px hsla(${hue}, ${saturation}%, ${borderLight}%, ${glowAlpha})`,
  }
}

function WaveReceiptNoteRow(props: {
  label: string
  testId: string
  notes: readonly string[]
  noteNamesVisible: boolean
  memory: Readonly<Record<string, NoteMemory>>
  mastered?: boolean
}) {
  return (
    <div data-testid={props.testId} className="flex min-w-0 items-center gap-1">
      <span className={`shrink-0 text-[11px] font-black tracking-wider ${props.mastered ? 'text-cyan-100' : 'text-gray-400'}`}>
        {props.label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {props.notes.length === 0 ? (
          <span className="text-[11px] font-bold text-gray-500">NONE</span>
        ) : props.notes.map((note, index) => (
          <span
            key={`${props.label}:${note}:${index}`}
            data-note={note}
            role="img"
            aria-label={`${props.label} note ${note}`}
            className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded border px-1 text-[11px] font-black leading-none ${props.mastered ? 'ring-1 ring-cyan-100/70' : ''}`}
            style={noteChipStyle(note, props.memory)}
          >
            <span className={props.noteNamesVisible ? undefined : 'sr-only'}>{note}</span>
            {!props.noteNamesVisible && <span aria-hidden="true">•</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function ceremonyBannerStyle(note: string): CSSProperties {
  const hue = hueForNote(note)
  return {
    borderColor: `hsla(${hue}, 88%, 68%, 0.78)`,
    background: `linear-gradient(180deg, hsla(${hue}, 62%, 17%, 0.94), rgba(6, 8, 18, 0.9))`,
    boxShadow: `0 0 28px hsla(${hue}, 82%, 58%, 0.34)`,
  }
}

function ceremonyNoteStyle(note: string, memory: Readonly<Record<string, NoteMemory>>, toneFired: boolean): CSSProperties {
  const base = noteChipStyle(note, memory)
  const hue = hueForNote(note)
  return {
    ...base,
    boxShadow: toneFired
      ? `${base.boxShadow ?? ''}, 0 0 22px hsla(${hue}, 90%, 66%, 0.44)`
      : base.boxShadow,
  }
}

function fixedWaveDirector(wave: number, demo: boolean, closeSmashProof = false, galvanicProof = false): WavePlan {
  const speed = Math.min(56, 15 + (wave - 1) * 5)
  // Explicit private proof fixture only. It reuses the ordinary spawn and
  // attack machinery while exposing three independent two-tine actors for a
  // bounded Galvanic receipt; no bank or strike is created here.
  if (demo && galvanicProof && wave === 1) {
    return { wave, count: 3, spawnInterval: 0.01, speed, tineCounts: [2, 2, 2] }
  }
  // Explicit private proof fixture only. Normal demo and every normal wave
  // retain their existing director; this two-villager plan creates the
  // canonical two-tine target plus nearby three-tine bystander without a free
  // lock or a production movement change.
  if (demo && closeSmashProof && wave === 1) {
    return { wave, count: 2, spawnInterval: 0.01, speed, tineCounts: [2, 3] }
  }
  const early = patientTineCountsForWave(wave)
  if (early) {
    return { wave, count: early.length, spawnInterval: demo ? 0.01 : Math.max(1.4, 3.2 - (wave - 1) * 0.3), speed, tineCounts: [...early] }
  }
  // Wave 6+: probabilistic, slowly harder; 4-tine stays rare.
  const count = Math.min(4 + Math.floor((wave - 5) / 2), 6)
  const spawnInterval = demo ? 0.01 : Math.max(0.9, 2.2 - (wave - 6) * 0.15)
  const p4 = Math.min(0.34, 0.12 + (wave - 6) * 0.03)
  const tineCounts: TineCount[] = []
  for (let i = 0; i < count; i++) {
    const roll = Math.random()
    tineCounts.push(roll < 0.45 ? 2 : roll < 1 - p4 ? 3 : 4)
  }
  return { wave, count, spawnInterval, speed, tineCounts }
}

function attackTimeForWave(wave: number, index: number): number {
  return attackTimeForCurriculum(wave, index)
}

function makeInitialRuntime(demo: boolean, closeSmashProof = false, galvanicProof = false): Runtime {
  const plan = fixedWaveDirector(1, demo, closeSmashProof, galvanicProof)
  return {
    villagers: [],
    bolts: [],
    bursts: [],
    wave: 1,
    health: STARTING_HEALTH,
    score: 0,
    streak: 0,
    spawned: 0,
    plan,
    spawnClock: 0,
    bannerTimer: 1.1,
    nextWavePending: false,
    nextWaveNumber: null,
    nextWaveAtMs: null,
    nextWaveRunGeneration: null,
    animClock: 0,
    gameOver: false,
    firstVillagerId: null,
    lastPickedVillagerNote: null,
    rain: createRainState(),
  }
}

function createInactiveTorchState(): TorchState {
  return { ...createTorchState(), phase: 'spent' }
}

function artReviewBurnFor(totalTines: TineCount, body: ArtReviewBodyState): number {
  if (body === 'walk') return 0
  if (body === 'ash') return totalTines
  return Math.min(totalTines, Number(body.slice(-1)))
}

function artReviewChargeFor(storm: ArtReviewStormState): number {
  if (storm === 'gather-1') return 0.01
  if (storm === 'gather-2') return 0.33
  if (storm === 'gather-3') return 0.66
  return 0
}

function buildArtReviewRuntime(
  animClock: number,
  body: ArtReviewBodyState,
  storm: ArtReviewStormState,
  assets: Assets,
): Runtime {
  const runtime = makeInitialRuntime(false)
  const tineCounts: readonly TineCount[] = [1, 2, 3, 4]
  runtime.animClock = animClock
  runtime.bannerTimer = 0
  runtime.firstVillagerId = 1
  runtime.rain = {
    ...runtime.rain,
    phase: 'raining',
    elapsedMs: 0,
    fill: 1,
  }
  runtime.villagers = tineCounts.map((totalTines, index) => {
    const burned = artReviewBurnFor(totalTines, body)
    const state: VillagerState = burned >= totalTines ? 'ash' : 'walking'
    const meta = assets.villagerMeta[totalTines] ?? defaultVillagerMeta
    return {
      id: index + 1,
      totalTines,
      x: ART_REVIEW_ACTOR_X[index],
      y: GROUND_Y - meta.frame_h * SPRITE_SCALE,
      speed: 0,
      notes: [...ART_REVIEW_ACTOR_NOTES[index]],
      burned,
      state,
      spawnIndex: index,
      attackTimer: 30,
      attackTimerMax: 30,
      sequenceCued: false,
      walkFrame: Math.floor(animClock * 4) % 4,
      walkClock: animClock,
      ashTimer: state === 'ash' ? 1 : 0,
      torch: createInactiveTorchState(),
      torchBearer: false,
    }
  })

  const focus = runtime.villagers[runtime.villagers.length - 1]
  const focusNote = focus.notes[Math.min(focus.burned, focus.notes.length - 1)]
  const active: ActiveTarget = {
    villager: focus,
    tineIndex: Math.max(0, focus.totalTines - 1 - focus.burned),
    note: focusNote,
    key: `${focus.id}:${focus.burned}`,
  }
  if (storm === 'spent') {
    const pivotX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
    const pivotY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
    const target = thunderheadTargetPoint(active, assets)
    runtime.bolts = [{
      fromX: pivotX + FRANK_CLOUD_X_OFFSET,
      fromY: FRANK_CLOUD_Y,
      pivotX,
      pivotY,
      toX: target.x,
      toY: target.y,
      life: 1,
      maxLife: BOLT_LIFE_S,
      seed: 7,
      hue: hueForNote(focusNote),
      note: focusNote,
      villagerId: focus.id,
      tineIndex: active.tineIndex,
      presentation: 'ordinary',
    }]
  }
  return runtime
}

function buildArtReviewView(
  runtime: Runtime,
  storm: ArtReviewStormState,
  activeWorld: PitchforksNormalWorld,
): ViewState {
  const focus = runtime.villagers[runtime.villagers.length - 1]
  const focusNote = focus.notes[Math.min(focus.burned, focus.notes.length - 1)]
  const active: ActiveTarget = {
    villager: focus,
    tineIndex: Math.max(0, focus.totalTines - 1 - focus.burned),
    note: focusNote,
    key: `${focus.id}:${focus.burned}`,
  }
  return buildViewState({
    runtime,
    phase: 'playing',
    normalWorld: activeWorld,
    inputMode: 'buttons',
    active,
    activeVillagerId: focus.id,
    activeKey: active.key,
    targetOutcomes: createPitchforksLevelProgress(1).targetOutcomes,
    hintedTargetKeys: new Set(),
    chargeProgress: artReviewChargeFor(storm),
    tint: null,
    noteNamesVisible: false,
    staffNotationVisible: false,
    synesthesiaOn: false,
    reducedMotion: true,
    timersPaused: false,
    prompt: '',
    tuner: EMPTY_TUNER_VIEW,
    ceremony: { active: false, note: null, toneFired: false, tonePulseKey: 0 },
    noteMastered: null,
    noteMasteredAgeMs: 0,
    frankReaction: null,
    frankVictory: null,
    closeSmash: createPitchforksCloseSmashState(),
    closeSmashFallbackDueAtMs: 0,
    closeSmashRecoilUntil: new Map(),
    bellRecoilUntil: new Map(),
    bellWaveClockMs: 0,
    shake: { x: 0, y: 0 },
    fsrsMemory: {},
    thunderhead: createPitchforksThunderheadState(),
    thunderheadClockMs: 0,
    thunderheadTravelStartedAtMs: 0,
    thunderheadTravelStart: null,
    thunderheadTravelTarget: null,
    bellWave: projectPitchforksBellWave(createPitchforksBellWaveState(), 0),
    bellWaveElapsedMs: 0,
  })
}

function colorForCents(absCents: number): string | null {
  if (absCents > 300) return null
  if (absCents <= 25) return '#62ff9f'
  const t = Math.min(1, (absCents - 25) / 275)
  const r = Math.round(98 + (245 - 98) * t)
  const g = Math.round(255 + (205 - 255) * t)
  const b = Math.round(159 + (70 - 159) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function drawForkAccuracyRibbon(
  ctx: CanvasRenderingContext2D,
  anchor: Readonly<{ x: number; y: number }>,
  tint: string | null,
  progress: number,
) {
  if (!tint) return

  const width = 26 + progress * 8
  const height = 6 + progress * 3
  const x = anchor.x - width / 2
  const y = anchor.y - height / 2

  ctx.save()
  ctx.shadowColor = tint
  ctx.shadowBlur = 10 + progress * 8
  ctx.globalAlpha = 0.64
  ctx.fillStyle = tint
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, height / 2)
  ctx.fill()
  // bright near-white core (SimplySing "current" pattern) so the ribbon reads as a
  // distinct meter and doesn't camouflage against other same-hue green UI nearby
  // (note-name label outline, fork-glow sprite) -- Argus HIGH finding, C6 refinement.
  ctx.shadowBlur = 4
  ctx.globalAlpha = 0.92
  ctx.fillStyle = '#f4fff9'
  ctx.beginPath()
  ctx.roundRect(anchor.x - width * 0.22, y + height * 0.28, width * 0.44, height * 0.44, height * 0.22)
  ctx.fill()
  ctx.globalAlpha = 0.86
  ctx.shadowBlur = 10 + progress * 8
  ctx.lineWidth = 1
  ctx.strokeStyle = tint
  ctx.beginPath()
  ctx.moveTo(anchor.x - width * 0.5, anchor.y)
  ctx.lineTo(anchor.x - width * 0.28, anchor.y)
  ctx.moveTo(anchor.x + width * 0.28, anchor.y)
  ctx.lineTo(anchor.x + width * 0.5, anchor.y)
  ctx.stroke()
  ctx.restore()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hueForNote(note: string | undefined): number {
  return note ? (NOTE_COLORS[note]?.hue ?? 0) : 0
}

function pitchDeviationSemis(source: PitchInfo, targetNote: string): number {
  return exactCents(source.frequency, noteToFreq(targetNote)) / 100
}

type BuildViewStateArgs = Readonly<{
  runtime: Runtime
  phase: Phase
  normalWorld: PitchforksNormalWorld
  inputMode: PitchforksInputMode
  active: ActiveTarget | null
  activeVillagerId: number | null
  activeKey: string
  targetOutcomes: PitchforksLevelProgress['targetOutcomes']
  hintedTargetKeys: ReadonlySet<string>
  chargeProgress: number
  tint: string | null
  noteNamesVisible: boolean
  staffNotationVisible: boolean
  synesthesiaOn: boolean
  reducedMotion: boolean
  timersPaused: boolean
  prompt: string
  tuner: TunerView
  ceremony: NewNoteCeremonyState
  noteMastered: string | null
  noteMasteredAgeMs: number
  frankReaction: ViewState['frankReaction']
  closeSmash: PitchforksCloseSmashState
  closeSmashFallbackDueAtMs: number
  closeSmashRecoilUntil: ReadonlyMap<number, number>
  bellRecoilUntil: ReadonlyMap<number, number>
  bellWaveClockMs: number
  shake: ShakeView
  fsrsMemory: Readonly<Record<string, NoteMemory>>
  frankVictory: ViewState['frankVictory']
  thunderhead: PitchforksThunderheadState
  thunderheadClockMs: number
  thunderheadTravelStartedAtMs: number
  thunderheadTravelStart: ThunderheadPoint | null
  thunderheadTravelTarget: ThunderheadPoint | null
  bellWave: PitchforksBellWaveProjection
  bellWaveElapsedMs: number
}>

function activeTargetFromLiveVillager(villager: Villager): ActiveTarget | null {
  if (
    villager.state !== 'walking' ||
    !Number.isInteger(villager.burned) ||
    villager.burned < 0 ||
    villager.burned >= villager.totalTines
  ) return null
  const note = villager.notes[villager.burned]
  if (typeof note !== 'string' || note.length === 0) return null
  const tineIndex = villager.totalTines - 1 - villager.burned
  if (!Number.isSafeInteger(tineIndex) || tineIndex < 0) return null
  return {
    villager,
    tineIndex,
    note,
    key: `${villager.id}:${villager.burned}`,
  }
}

function activeTargetForThunderheadReceipt(
  villagers: readonly Villager[],
  receipt: PitchforksThunderheadLockReceipt,
): ActiveTarget | null {
  for (const villager of villagers) {
    const liveTarget = activeTargetFromLiveVillager(villager)
    if (!liveTarget || liveTarget.key !== receipt.targetKey || liveTarget.note !== receipt.note) continue
    const identity = pitchIdentity(liveTarget.note)
    if (!identity || identity.octave !== receipt.octave || identity.pitchClass !== receipt.pitchClass) return null
    return liveTarget
  }
  return null
}

function thunderheadTargetPoint(target: ActiveTarget, assets: Assets): ThunderheadPoint {
  const meta = assets.villagerMeta[target.villager.totalTines]
  const tine = meta.tines[Math.max(0, Math.min(target.tineIndex, meta.tines.length - 1))]
  const forkPivotX = target.villager.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
  const forkPivotY = target.villager.y + meta.fork_base.y * SPRITE_SCALE
  const rawX = target.villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
  const rawY = target.villager.y + tine.y * SPRITE_SCALE
  return rotateAroundPivot(rawX, rawY, forkPivotX, forkPivotY, FORK_LEAN_DEG)
}

function activeTargetForCloseReceipt(
  villager: Villager,
  receipt: PitchforksCloseSmashReceipt,
  phase: PitchforksCloseSmashState['phase'],
): ActiveTarget | null {
  const liveTarget = activeTargetFromLiveVillager(villager)
  // After contact, settle may show the surviving villager's real next tine;
  // locks remain disabled by processLock's lifecycle gate.
  if (phase === 'settle') return liveTarget
  if (
    !liveTarget ||
    String(liveTarget.villager.id) !== receipt.villagerId ||
    liveTarget.key !== receipt.targetKey ||
    liveTarget.note !== receipt.pitch ||
    liveTarget.tineIndex !== receipt.tineIndex
  ) return null
  return liveTarget
}

function liveGalvanicTargets(villagers: readonly Villager[]): ActiveTarget[] {
  return villagers
    .map(activeTargetFromLiveVillager)
    .filter((target): target is ActiveTarget => target !== null)
    .sort((left, right) => left.villager.x - right.villager.x || left.villager.spawnIndex - right.villager.spawnIndex)
}

function liveBellWaveRoster(villagers: readonly Villager[]): PitchforksBellWaveVillager[] {
  return villagers
    .filter(villager => villager.state === 'walking' && villager.burned < villager.totalTines)
    .map(villager => ({
      stableID: String(villager.id),
      x: villager.x,
      y: villager.y,
      walking: true,
      alive: true,
      spent: false,
    }))
}

function buildViewState(args: BuildViewStateArgs): ViewState {
  const {
    runtime,
    phase,
    normalWorld,
    inputMode,
    active,
    activeVillagerId,
    activeKey,
    targetOutcomes,
    hintedTargetKeys,
    chargeProgress,
    tint,
    noteNamesVisible,
    staffNotationVisible,
    synesthesiaOn,
    reducedMotion,
    timersPaused,
    prompt,
    tuner,
    ceremony,
    noteMastered,
    noteMasteredAgeMs,
    frankReaction,
    frankVictory,
    closeSmash,
    closeSmashFallbackDueAtMs,
    closeSmashRecoilUntil,
    bellRecoilUntil,
    bellWaveClockMs,
    shake,
    fsrsMemory,
    thunderhead,
    thunderheadClockMs,
    thunderheadTravelStartedAtMs,
    thunderheadTravelStart,
    thunderheadTravelTarget,
    bellWave,
    bellWaveElapsedMs,
  } = args
  const newestBolt = runtime.bolts[runtime.bolts.length - 1]
  const ownershipBolt = newestBolt && newestBolt.life / newestBolt.maxLife < STRIKE_IMPACT_START
    ? newestBolt
    : null
  const closeLifecycleActive = closeSmash.phase !== 'idle'
  const pinnedReceipt = closeLifecycleActive ? closeSmash.receipt : null
  const pinnedVillager = pinnedReceipt
    ? runtime.villagers.find(v => String(v.id) === pinnedReceipt.villagerId) ?? null
    : null
  const pinnedActive = pinnedReceipt && pinnedVillager
    ? activeTargetForCloseReceipt(pinnedVillager, pinnedReceipt, closeSmash.phase)
    : null
  const thunderheadLifecycleActive = thunderhead.phase !== 'idle' && thunderhead.phase !== 'consumed'
  const thunderheadReceipt = thunderheadLifecycleActive ? thunderhead.receipt ?? thunderhead.bank : null
  const thunderheadPinnedActive = thunderheadReceipt
    ? activeTargetForThunderheadReceipt(runtime.villagers, thunderheadReceipt)
    : null
  const thunderheadTravelProgress = thunderheadLifecycleActive && thunderheadTravelStartedAtMs > 0
    ? clamp((thunderheadClockMs - thunderheadTravelStartedAtMs) / THUNDERHEAD_TRAVEL_MS, 0, 1)
    : thunderhead.phase === 'target_match' || thunderhead.phase === 'strike' || thunderhead.phase === 'consumed'
      ? 1
      : 0
  const travelStart = thunderheadTravelStart ?? { x: FRANK_X + defaultFrankMeta.rod_tip.x * FRANK_SPRITE_SCALE + FRANK_CLOUD_X_OFFSET + THUNDERHEAD_BANK_X_OFFSET, y: FRANK_CLOUD_Y }
  const travelTarget = thunderheadTravelTarget ?? travelStart
  const thunderheadPosition = getPitchforksThunderheadPathPosition(travelStart, travelTarget.x, thunderheadTravelProgress) ?? travelStart
  const thunderheadCloudX = thunderheadPosition.x
  const thunderheadCloudY = thunderheadPosition.y
  const visualActive = thunderheadPinnedActive
    ? {
        villagerId: thunderheadPinnedActive.villager.id,
        tineIndex: thunderheadPinnedActive.tineIndex,
        note: thunderheadPinnedActive.note,
        key: thunderheadPinnedActive.key,
      }
    : thunderheadLifecycleActive
    ? null
    : pinnedActive
    ? {
        villagerId: pinnedActive.villager.id,
        tineIndex: pinnedActive.tineIndex,
        note: pinnedActive.note,
        key: pinnedActive.key,
      }
    : closeLifecycleActive
    ? null
    : ownershipBolt
    ? {
        villagerId: ownershipBolt.villagerId,
        tineIndex: ownershipBolt.tineIndex,
        note: ownershipBolt.note,
        key: `${ownershipBolt.villagerId}:${ownershipBolt.tineIndex}`,
      }
      : active
      ? {
          villagerId: active.villager.id,
          tineIndex: active.tineIndex,
          note: active.note,
          key: active.key,
          }
      : null
  const activeVillagerForView = visualActive
    ? runtime.villagers.find(v => v.id === visualActive.villagerId) ?? null
    : null
  const activeReturnDisplay = activeVillagerForView
    ? projectVillageReturnDisplay(activeVillagerForView, targetOutcomes, hintedTargetKeys)
    : null
  const activeReturnText = activeVillagerForView
    ? projectVillageReturnText(activeVillagerForView, targetOutcomes, hintedTargetKeys)
    : null
  const promptMatch = /^(Listen|Replay|Sing|Now|Strike):\s+(.+)$/.exec(prompt)
  const ownershipPrompt = ownershipBolt
    ? `Strike: ${ownershipBolt.note}`
    : visualActive && promptMatch
      ? `${promptMatch[1]}: ${visualActive.note}`
      : prompt
  // Apply the return policy after ownership rewriting so raw prompt text from
  // audio/torch helpers cannot bypass the exact-key concealment.
  const visualPrompt = activeReturnText
    ? projectVillageReturnPrompt(ownershipPrompt, activeReturnText)
    : ownershipPrompt
  const ownershipFeedback: PitchforksTunerFeedback = ownershipBolt
    ? {
        ...tuner.feedback,
        kind: 'locked',
        headline: `STRIKE · ${ownershipBolt.note}`,
        detail: 'Watch the lightning reach the fork',
        compactLabel: `strike: ${ownershipBolt.note}`,
      }
    : tuner.feedback
  const visualTunerFeedback = activeReturnText && visualActive
    ? projectVillageReturnTunerFeedback(ownershipFeedback, visualActive.note, activeReturnText)
    : ownershipFeedback
  const chargeLevel = active
    ? Math.max(
        active.villager.burned,
        Math.min(active.villager.totalTines, Math.round(chargeProgress * active.villager.totalTines)),
      )
    : 0
  return {
    phase,
    normalWorld,
    inputMode,
    animClock: runtime.animClock,
    gameOver: runtime.gameOver,
    villagers: runtime.villagers.map(v => {
    const isActive = thunderheadPinnedActive
        ? thunderheadPinnedActive.villager.id === v.id
        : thunderheadLifecycleActive
        ? false
        : pinnedActive
        ? pinnedActive.villager.id === v.id
        : closeLifecycleActive
        ? false
        : ownershipBolt
        ? ownershipBolt.villagerId === v.id
        : activeVillagerId === v.id || activeKey.startsWith(`${v.id}:`)
      const awaitingImpact = runtime.bolts.some(b => (
        b.villagerId === v.id && b.life / b.maxLife < STRIKE_IMPACT_START
      ))
      const visualBurn = awaitingImpact ? Math.max(0, v.burned - 1) : v.burned
      const visualState = awaitingImpact && v.state === 'ash' ? 'walking' : v.state
      const displayBurn = isActive
        ? Math.max(visualBurn, Math.min(v.totalTines, Math.round(chargeProgress * v.totalTines)))
        : visualBurn
      const activeNote = v.notes[Math.min(v.burned, v.notes.length - 1)]
      const mem = fsrsMemory[activeNote] ?? createNote(activeNote)
      const soulR = currentR(mem)
      const soulCalm = retrievability(1, mem.S)
      const soulHue = hueForNote(activeNote)
      return {
        id: v.id,
        totalTines: v.totalTines,
        x: v.x,
        y: v.y,
        lane: v.spawnIndex % 3,
        speed: v.speed,
        notes: [...v.notes],
        burned: v.burned,
        state: v.state,
        visualBurn,
        visualState,
        spawnIndex: v.spawnIndex,
        attackTimer: v.attackTimer,
        attackTimerMax: v.attackTimerMax,
        sequenceCued: v.sequenceCued,
        walkFrame: v.walkFrame,
        ashTimer: v.ashTimer,
        active: isActive,
        answerVisible: projectVillageReturnDisplay(v, targetOutcomes, hintedTargetKeys).answerVisible,
        displayBurn,
        timerPct: clamp(v.attackTimer / Math.max(0.001, v.attackTimerMax), 0, 1),
        soulR,
        soulCalm,
        soulHue,
        torch: {
          ...v.torch,
          recentTransitions: v.torch.recentTransitions.map(transition => ({ ...transition })),
        },
        torchBearer: v.torchBearer,
        recoilProgress: Math.max(
          closeSmashRecoilUntil.has(v.id)
            ? clamp(1 - (closeSmashRecoilUntil.get(v.id)! - runtime.animClock * 1000) / CLOSE_SMASH_RECOIL_MS, 0, 1)
            : 0,
          bellRecoilUntil.has(v.id)
            ? clamp(1 - (bellRecoilUntil.get(v.id)! - bellWaveClockMs) / BELL_KNOCKBACK_MS, 0, 1)
            : 0,
        ),
      }
    }),
    active: visualActive,
    charge: {
      progress: chargeProgress,
      level: chargeLevel,
      tint: activeReturnDisplay?.answerVisible === false ? null : tint,
      charging: chargeProgress > 0 || runtime.bolts.length > 0,
    },
    bolts: runtime.bolts.map(b => ({ ...b })),
    bursts: runtime.bursts.map(b => ({ ...b })),
    frankReaction,
    frankVictory,
    closeSmash: {
      phase: closeSmash.phase,
      receipt: closeSmash.receipt,
      consumer: closeSmash.consumer,
      contactAtMs: closeSmash.contactAtMs,
      contactPresented: closeSmash.contactPresented,
      fallbackRemainingMs: closeSmash.receipt
        ? Math.max(0, closeSmashFallbackDueAtMs - runtime.animClock * 1000)
        : null,
      showcase: false,
    },
    shake,
    hud: {
      wave: runtime.wave,
      health: runtime.health,
      score: runtime.score,
      streak: runtime.streak,
    },
    waveBanner: {
      visible: runtime.bannerTimer > 0,
      timer: runtime.bannerTimer,
    },
    prompt: {
      visible: !!visualPrompt && !!visualActive,
      text: visualPrompt,
    },
    noteNamesVisible,
    staffNotationVisible,
    synesthesiaOn,
    reducedMotion,
    timersPaused,
    tuner: {
      ...tuner,
      targetNote: ownershipBolt?.note ?? visualActive?.note ?? null,
      sourceNote: ownershipBolt ? null : tuner.sourceNote,
      canUseSource: ownershipBolt ? false : tuner.canUseSource,
      dotDeviation: ownershipBolt ? null : tuner.dotDeviation,
      renderDeviation: ownershipBolt ? null : tuner.renderDeviation,
      onTarget: ownershipBolt ? false : tuner.onTarget,
      trail: tuner.trail.map(point => ({ ...point })),
      feedback: visualTunerFeedback,
    },
    ceremony: {
      active: ceremony.active,
      note: ceremony.note,
      toneFired: ceremony.toneFired,
      tonePulseKey: ceremony.tonePulseKey,
    },
    noteMastered,
    noteMasteredAgeMs,
    rain: {
      ...runtime.rain,
      recentTransitions: runtime.rain.recentTransitions.map(transition => ({ ...transition })),
    },
    thunderhead: {
      projection: getPitchforksThunderheadDebugProjection(thunderhead),
      travelProgress: thunderheadTravelProgress,
      cloudX: thunderheadCloudX,
      cloudY: thunderheadCloudY,
      targetX: thunderheadTravelTarget?.x ?? null,
      targetY: thunderheadTravelTarget?.y ?? null,
      runeStatus: THUNDERHEAD_RUNE_STATUS,
    },
    bellWave,
    bellWaveElapsedMs,
  }
}

function freezeViewStateForDebug(view: ViewState, debug: boolean): ViewState {
  if (debug || process.env.NODE_ENV !== 'production') return Object.freeze(view)
  return view
}

function lightningPhaseFor(chargeProgress: number, bolt?: BoltView): LightningPhase {
  if (bolt) {
    const age = clamp(bolt.life / bolt.maxLife, 0, 1)
    if (age < STRIKE_LEADER_END) return 'strike-leader'
    if (age < STRIKE_RECEIPT_END) return 'strike-receipt'
    if (age < STRIKE_IMPACT_START) return 'strike-discharge'
    return 'strike-impact'
  }
  if (chargeProgress <= 0) return 'idle'
  if (chargeProgress < CHARGE_LEADER_START) return 'charge-cloud'
  if (chargeProgress < CHARGE_DISCHARGE_START) return 'charge-leader'
  return 'charge-discharge'
}

function circuitNoise(seed: number, index: number, bucket: number) {
  const wave = Math.sin(seed * 12.9898 + index * 78.233 + bucket * 37.719) * 43758.5453
  return wave - Math.floor(wave)
}

function lightningBendDeg(bolt?: BoltView): number | null {
  if (!bolt) return null
  const inX = bolt.pivotX - bolt.fromX
  const inY = bolt.pivotY - bolt.fromY
  const outX = CIRCUIT_RELAY_X
  const outY = CIRCUIT_RELAY_Y
  const lengths = Math.hypot(inX, inY) * Math.hypot(outX, outY)
  if (lengths <= 0) return null
  const cos = clamp((inX * outX + inY * outY) / lengths, -1, 1)
  return Math.acos(cos) * (180 / Math.PI)
}

function drawCircuitLeg(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  reveal: number,
  seed: number,
  bucket: number,
  alpha: number,
  hot: boolean,
  branched: boolean,
  reducedMotion: boolean,
) {
  const shown = clamp(reveal, 0, 1)
  if (shown <= 0 || alpha <= 0) return
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / distance
  const ny = dx / distance
  const segments = Math.max(5, Math.min(14, Math.round(distance / 24)))
  const visibleSegments = Math.max(1, Math.ceil(segments * shown))
  const jitter = reducedMotion
    ? 0
    : hot
      ? Math.min(38, Math.max(19, distance * 0.068))
      : Math.min(16, Math.max(7, distance * 0.08))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let pass = 0; pass < 3; pass++) {
    let wander = (circuitNoise(seed + 73, 0, bucket) - 0.5) * 0.8
    let priorT = 0
    let priorOffset = 0
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    for (let i = 1; i <= visibleSegments; i++) {
      const spacing = (circuitNoise(seed + 29, i, bucket) - 0.5) * 0.7
      const naturalT = clamp((i + spacing) / segments, 0, 1)
      const minT = priorT + 0.24 / segments
      const maxT = shown - ((visibleSegments - i) * 0.44) / segments
      const t = i === visibleSegments ? shown : clamp(naturalT, minT, Math.max(minT, maxT))
      const envelope = Math.sin(Math.PI * t)
      wander = clamp(wander * 0.22 + (circuitNoise(seed + 41, i, bucket) - 0.5) * 1.58, -1, 1)
      const drift = (circuitNoise(seed + 19, i, bucket) - 0.5) * 0.24
      const harmonic = Math.sin(i * 1.47 + seed * 0.07 + bucket * 0.31) * 0.3
      const candidateOffset = (wander * 0.95 + harmonic + drift) * jitter * envelope
      const maxOffsetDelta = Math.max(4, (t - priorT) * distance * (hot ? 1.1 : 0.9))
      const offset = t >= 0.999
        ? 0
        : clamp(candidateOffset, priorOffset - maxOffsetDelta, priorOffset + maxOffsetDelta)
      ctx.lineTo(fromX + dx * t + nx * offset, fromY + dy * t + ny * offset)
      priorT = t
      priorOffset = offset
    }
    if (pass === 0) {
      ctx.strokeStyle = hot ? `rgba(14,165,233,${alpha * 0.46})` : `rgba(59,130,246,${alpha * 0.28})`
      ctx.lineWidth = hot ? 11 : 7
    } else if (pass === 1) {
      ctx.strokeStyle = hot ? `rgba(125,211,252,${alpha * 0.88})` : `rgba(147,197,253,${alpha * 0.62})`
      ctx.lineWidth = hot ? 4.5 : 3
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * (hot ? 0.94 : 0.72)})`
      ctx.lineWidth = hot ? 1.6 : 1
    }
    ctx.stroke()
  }

  if (hot && branched && !reducedMotion && shown > 0.58) {
    for (let branch = 0; branch < 4; branch++) {
      const t = Math.min(shown, 0.48 + branch * 0.12)
      if (t >= shown) continue
      const envelope = Math.sin(Math.PI * t)
      const offset = (circuitNoise(seed, 30 + branch, bucket) - 0.5) * jitter * envelope
      const ax = fromX + dx * t + nx * offset
      const ay = fromY + dy * t + ny * offset
      const direction = circuitNoise(seed, 40 + branch, bucket) < 0.5 ? -1 : 1
      const length = 20 + circuitNoise(seed, 50 + branch, bucket) * 18
      const along = 4 + circuitNoise(seed, 60 + branch, bucket) * 8
      const midX = ax + nx * length * 0.58 * direction + (dx / distance) * along
      const midY = ay + ny * length * 0.58 * direction + (dy / distance) * along
      const bend = (circuitNoise(seed, 70 + branch, bucket) - 0.5) * 0.8
      const bx = midX + nx * length * 0.42 * (direction + bend) + (dx / distance) * along * 0.7
      const by = midY + ny * length * 0.42 * (direction + bend) + (dy / distance) * along * 0.7
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(midX, midY)
      ctx.lineTo(bx, by)
      ctx.strokeStyle = `rgba(125,211,252,${alpha * 0.62})`
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.76})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawStormCloudView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const bolt = view.bolts[view.bolts.length - 1]
  const galvanicPresentationActive = view.bolts.some(candidate => candidate.presentation === 'galvanic')
  const thunderheadLifecycleActive = view.thunderhead.projection.phase !== 'idle' &&
    view.thunderhead.projection.phase !== 'consumed'
  // Smash contact is hand-originated; suppress the ordinary cloud/relay
  // presentation while its explicit hand-to-tine route is drawn below.
  if (bolt?.presentation === 'close-smash' || galvanicPresentationActive) return
  if (bolt?.presentation === 'thunderhead' || thunderheadLifecycleActive) return
  const charge = view.charge.progress
  if (view.phase !== 'playing' || (!view.active && !bolt)) return
  const pivotX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
  const pivotY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
  const cloudX = bolt?.fromX ?? pivotX + FRANK_CLOUD_X_OFFSET
  const cloudY = bolt?.fromY ?? FRANK_CLOUD_Y
  const boltAge = bolt ? clamp(bolt.life / bolt.maxLife, 0, 1) : 0
  const bucket = bolt ? Math.floor(bolt.life / CIRCUIT_BUCKET_S) : Math.floor(charge * 20)
  const state = selectStormHeartState({
    listening: !bolt && (view.timersPaused || view.tuner.feedback.kind === 'listen'),
    chargeProgress: charge,
    hasBolt: !!bolt,
    spent: !!bolt && boltAge > STRIKE_RECEIPT_END,
  })
  drawStormHeart(ctx, state, cloudX, cloudY, assets.stormHeart)
  if (state === 'listen') return
  ctx.save()
  if (charge >= CHARGE_LEADER_START) {
    const reveal = clamp((charge - CHARGE_LEADER_START) / (CHARGE_DISCHARGE_START - CHARGE_LEADER_START), 0, 1)
    drawCircuitLeg(ctx, cloudX, cloudY, pivotX, pivotY, reveal, 71, bucket, 0.2 + charge * 0.48, false, false, view.reducedMotion)
  }
  ctx.restore()
}

function drawThunderheadCloudView(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  stormHeart?: HTMLImageElement,
) {
  const projection = view.thunderhead.projection
  const thunderheadBolt = view.bolts
    .slice()
    .reverse()
    .find(bolt => bolt.presentation === 'thunderhead') ?? null
  const boltLifecycle = projection.phase === 'strike' || projection.phase === 'consumed'
  if (
    !boltLifecycle &&
    projection.phase !== 'banked' &&
    projection.phase !== 'detached' &&
    projection.phase !== 'ceiling_travel' &&
    projection.phase !== 'target_match'
  ) return
  if (boltLifecycle && !thunderheadBolt) return
  const note = projection.bank?.note ?? projection.receipt?.note
  if (!note) return

  const boltAge = thunderheadBolt
    ? clamp(thunderheadBolt.life / thunderheadBolt.maxLife, 0, 1)
    : 0
  const cloudX = thunderheadBolt?.fromX ?? view.thunderhead.cloudX
  const cloudY = thunderheadBolt?.fromY ?? view.thunderhead.cloudY
  const stormHeartState = thunderheadBolt
    ? selectStormHeartState({
        listening: false,
        chargeProgress: boltAge < STRIKE_RECEIPT_END ? 1 : 0,
        hasBolt: true,
        spent: boltAge >= STRIKE_RECEIPT_END,
      })
    : selectStormHeartState({
        listening: false,
        chargeProgress: 1,
        hasBolt: false,
        spent: false,
      })
  drawStormHeart(ctx, stormHeartState, cloudX, cloudY, stormHeart)

  // The canonical rune dictionary has not been recovered. Keep the exact note
  // text large and pair it with the existing note-hue identity swatch; the
  // unresolved rune status remains in diagnostics; player-facing text is the exact note.
  ctx.save()
  const hue = hueForNote(note)
  const swatchSize = 14
  ctx.font = 'bold 24px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const noteWidth = ctx.measureText(note).width
  const contentWidth = swatchSize + 8 + noteWidth
  const labelWidth = Math.max(72, contentWidth + 20)
  const caption = getPitchforksThunderheadCaptionRect({ x: cloudX, y: cloudY }, labelWidth, W)
  if (!caption) { ctx.restore(); return }
  const labelHeight = caption.height
  const labelX = caption.left
  const labelY = caption.top
  const labelCenterX = labelX + labelWidth / 2
  ctx.fillStyle = 'rgba(3, 10, 20, 0.9)'
  ctx.fillRect(labelX, labelY, labelWidth, labelHeight)
  ctx.strokeStyle = 'rgba(159, 231, 255, 0.78)'
  ctx.lineWidth = 1
  ctx.strokeRect(labelX + 0.5, labelY + 0.5, labelWidth - 1, labelHeight - 1)
  ctx.fillStyle = `hsl(${hue}, 86%, 62%)`
  ctx.fillRect(labelCenterX - contentWidth / 2, labelY + 4, swatchSize, swatchSize)
  ctx.strokeStyle = `hsla(${hue}, 100%, 88%, 0.96)`
  ctx.strokeRect(labelCenterX - contentWidth / 2 + 0.5, labelY + 4.5, swatchSize - 1, swatchSize - 1)
  ctx.fillStyle = '#f4fbff'
  ctx.fillText(note, labelCenterX + (swatchSize + 8) / 2, labelY + 1)
  ctx.restore()
}

function drawBoltView(ctx: CanvasRenderingContext2D, b: BoltView, reducedMotion: boolean) {
  const age = clamp(b.life / b.maxLife, 0, 1)
  const bucket = Math.floor(b.life / CIRCUIT_BUCKET_S)
  if (b.presentation === 'galvanic') {
    // Galvanic is a direct joined-hand sweep. Each bolt is created only for a
    // backed tine, so this branch cannot visually claim an unbacked target.
    const reveal = reducedMotion ? 1 : clamp(age / STRIKE_RECEIPT_END, 0, 1)
    const alpha = age < STRIKE_RECEIPT_END ? 0.98 : 0.64 * Math.max(0.55, 1 - Math.pow(age, 2.2))
    ctx.save()
    drawCircuitLeg(ctx, b.fromX, b.fromY, b.toX, b.toY, reveal, b.seed, bucket, alpha, true, true, reducedMotion)
    const impactProgress = clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1)
    if (age >= STRIKE_IMPACT_START || reducedMotion) {
      const impactAlpha = reducedMotion ? 0.9 : Math.max(0, (1 - impactProgress) * 0.92)
      const impactRadius = reducedMotion ? 10 : 6 + impactProgress * 22
      const impact = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, impactRadius)
      impact.addColorStop(0, `hsla(${b.hue},100%,92%,${impactAlpha})`)
      impact.addColorStop(0.35, `hsla(${b.hue},100%,65%,${impactAlpha * 0.72})`)
      impact.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
      ctx.fillStyle = impact
      ctx.beginPath()
      ctx.arc(b.toX, b.toY, impactRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  if (b.presentation === 'thunderhead') {
    const reveal = reducedMotion ? 1 : clamp(age / STRIKE_RECEIPT_END, 0, 1)
    const alpha = age < STRIKE_RECEIPT_END ? 0.98 : 0.64 * Math.max(0.55, 1 - Math.pow(age, 2.2))
    ctx.save()
    drawCircuitLeg(ctx, b.fromX, b.fromY, b.toX, b.toY, reveal, b.seed, bucket, alpha, true, true, reducedMotion)
    const impactProgress = clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1)
    if (age >= STRIKE_IMPACT_START || reducedMotion) {
      const impactAlpha = reducedMotion ? 0.9 : Math.max(0, (1 - impactProgress) * 0.92)
      const impactRadius = reducedMotion ? 10 : 6 + impactProgress * 22
      const impact = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, impactRadius)
      impact.addColorStop(0, `hsla(${b.hue},100%,92%,${impactAlpha})`)
      impact.addColorStop(0.35, `hsla(${b.hue},100%,65%,${impactAlpha * 0.72})`)
      impact.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
      ctx.fillStyle = impact
      ctx.beginPath()
      ctx.arc(b.toX, b.toY, impactRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  if (b.presentation === 'close-smash') {
    // Smash contact has no cloud leg or relay detour: the accepted joined-hand
    // origin drives one bounded route to the exact tine endpoint. This is
    // presentation-only; strikeActiveTine still owns the musical mutation.
    const reveal = reducedMotion ? 1 : clamp(age / STRIKE_RECEIPT_END, 0, 1)
    const alpha = age < STRIKE_RECEIPT_END ? 0.98 : 0.62 * Math.max(0.55, 1 - Math.pow(age, 2.2))
    ctx.save()
    drawCircuitLeg(ctx, b.fromX, b.fromY, b.toX, b.toY, reveal, b.seed, bucket, alpha, true, false, reducedMotion)
    const impactAlpha = reducedMotion ? 0.9 : Math.max(0, (1 - clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1)) * 0.92)
    if (age >= STRIKE_IMPACT_START || reducedMotion) {
      const impactRadius = reducedMotion ? 10 : 6 + clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1) * 22
      const impact = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, impactRadius)
      impact.addColorStop(0, `hsla(${b.hue},100%,92%,${impactAlpha})`)
      impact.addColorStop(0.35, `hsla(${b.hue},100%,65%,${impactAlpha * 0.72})`)
      impact.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
      ctx.fillStyle = impact
      ctx.beginPath()
      ctx.arc(b.toX, b.toY, impactRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  const relayX = b.pivotX + CIRCUIT_RELAY_X
  const relayY = b.pivotY + CIRCUIT_RELAY_Y
  const phase = lightningPhaseFor(0, b)
  const fade = 1 - Math.pow(age, 2.2)
  const leaderReveal = reducedMotion ? 1 : clamp(age / STRIKE_LEADER_END, 0, 1)
  const receiptProgress = clamp((age - STRIKE_LEADER_END) / (STRIKE_RECEIPT_END - STRIKE_LEADER_END), 0, 1)
  const dischargeReveal = reducedMotion ? 1 : clamp((age - STRIKE_RECEIPT_END) / (STRIKE_IMPACT_START - STRIKE_RECEIPT_END), 0, 1)
  const impactProgress = clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1)
  const incomingAlpha = phase === 'strike-leader' ? 0.95 : phase === 'strike-receipt' ? 0.7 : 0.42 * Math.max(0.55, fade)
  const outgoingAlpha = phase === 'strike-impact' ? 0.72 * Math.max(0.55, fade) : 0.98

  ctx.save()
  drawCircuitLeg(ctx, b.fromX, b.fromY, b.pivotX, b.pivotY, leaderReveal, b.seed, bucket, incomingAlpha, false, false, reducedMotion)

  if (phase !== 'strike-leader' || reducedMotion) {
    const relayAlpha = reducedMotion ? 0.9 : phase === 'strike-receipt' ? Math.sin(receiptProgress * Math.PI) * 0.95 : 0.5 * fade
    if (relayAlpha > 0.02) {
      const relayGlow = ctx.createRadialGradient(b.pivotX, b.pivotY, 1, b.pivotX, b.pivotY, 24)
      relayGlow.addColorStop(0, `hsla(${b.hue},100%,88%,${relayAlpha * 0.72})`)
      relayGlow.addColorStop(0.35, `hsla(${b.hue},100%,62%,${relayAlpha * 0.38})`)
      relayGlow.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
      ctx.fillStyle = relayGlow
      ctx.beginPath()
      ctx.arc(b.pivotX, b.pivotY, 24, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = `rgba(255,255,255,${relayAlpha})`
    ctx.lineWidth = 3.4
    ctx.beginPath()
    ctx.moveTo(b.pivotX, b.pivotY)
    ctx.lineTo(relayX, relayY)
    ctx.stroke()
    ctx.strokeStyle = `hsla(${b.hue},100%,72%,${relayAlpha * 0.92})`
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.arc(b.pivotX, b.pivotY, 7 + receiptProgress * 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(b.pivotX - 8, b.pivotY)
    ctx.lineTo(b.pivotX + 8, b.pivotY)
    ctx.moveTo(b.pivotX, b.pivotY - 8)
    ctx.lineTo(b.pivotX, b.pivotY + 8)
    ctx.stroke()
  }

  if (phase === 'strike-discharge' || phase === 'strike-impact' || reducedMotion) {
    drawCircuitLeg(ctx, relayX, relayY, b.toX, b.toY, dischargeReveal, b.seed + 97, bucket, outgoingAlpha, true, true, reducedMotion)
  }

  if (phase === 'strike-impact' || reducedMotion) {
    const impactAlpha = reducedMotion ? 0.9 : Math.max(0, (1 - impactProgress) * 0.92)
    const impactRadius = reducedMotion ? 10 : 6 + impactProgress * 22
    const impact = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, impactRadius)
    impact.addColorStop(0, `hsla(${b.hue},100%,92%,${impactAlpha})`)
    impact.addColorStop(0.35, `hsla(${b.hue},100%,65%,${impactAlpha * 0.72})`)
    impact.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
    ctx.fillStyle = impact
    ctx.beginPath()
    ctx.arc(b.toX, b.toY, impactRadius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// C4: reactive lightning while the player HOLDS a note (the buildup), distinct from
// drawBoltView above (the one-shot strike flash). Gated strictly on charge.progress > 0
// — NOT charge.charging, which stays true for ~0.34s after a strike via
// `bolts.length > 0` (FLW consult-20 HIGH finding) and would relight this arc with no
// real hold in progress. Duplicates the tine-position math from the target-glow-ring
// block below rather than extracting a shared helper — CW consult-28: HARD BLOCKER 4 +
// the C0-frozen-core guarantee outweigh DRY on a function this small; a shared helper
// would touch code the ring-render path already ships verified.
function drawChargeArcView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const progress = view.charge.progress
  if (!view.active || progress < CHARGE_DISCHARGE_START) return
  const villager = view.villagers.find(v => v.id === view.active?.villagerId)
  if (!villager) return
  const meta = assets.villagerMeta[villager.totalTines]
  const tine = meta.tines[Math.max(0, Math.min(view.active.tineIndex, meta.tines.length - 1))]
  const forkPivotX = villager.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
  const forkPivotY = villager.y + meta.fork_base.y * SPRITE_SCALE
  const rawX = villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
  const rawY = villager.y + tine.y * SPRITE_SCALE
  const target = rotateAroundPivot(rawX, rawY, forkPivotX, forkPivotY, FORK_LEAN_DEG)

  const pivotX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
  const pivotY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
  const originX = pivotX + CIRCUIT_RELAY_X
  const originY = pivotY + CIRCUIT_RELAY_Y
  const dischargeProgress = clamp((progress - CHARGE_DISCHARGE_START) / (1 - CHARGE_DISCHARGE_START), 0, 1)
  const reveal = dischargeProgress * CHARGE_PRELOCK_REVEAL_MAX
  const shownTargetX = originX + (target.x - originX) * reveal
  const shownTargetY = originY + (target.y - originY) * reveal

  const lite = chargeArcQuality === 'lite'
  const maxSegments = lite ? 8 : CHARGE_ARC_MAX_SEGMENTS
  const minSegments = lite ? 3 : 4
  const segments = Math.max(minSegments, Math.min(maxSegments, Math.round(minSegments + dischargeProgress * (maxSegments - minSegments))))
  const jitterMag = 7 + dischargeProgress * 20
  const jitterBucket = Math.floor(progress * 20)
  const activeDx = shownTargetX - originX
  const activeDy = shownTargetY - originY
  const activeDistance = Math.max(1, Math.hypot(activeDx, activeDy))
  const activeNx = -activeDy / activeDistance
  const activeNy = activeDx / activeDistance

  // Jitter refresh is quantized to 20 logical charge buckets. The bucket derives
  // from real charge progress rather than rAF time, so identical
  // held states reproduce across devices. The pre-allocated buffer remains hot-path safe.
  const stale = chargeArcPoints[0].x === 0 && chargeArcPoints[0].y === 0
  if (stale || chargeArcJitterBucket !== jitterBucket || chargeArcSegmentCount !== segments) {
    chargeArcJitterBucket = jitterBucket
    chargeArcSegmentCount = segments
    chargeArcPoints[0].x = originX
    chargeArcPoints[0].y = originY
    let wander = (circuitNoise(433, 0, jitterBucket) - 0.5) * 0.8
    for (let i = 1; i < segments; i++) {
      const spacing = (circuitNoise(271, i, jitterBucket) - 0.5) * 0.7
      const t = clamp((i + spacing) / segments, 0, 1)
      wander = clamp(wander * 0.2 + (circuitNoise(419, i, jitterBucket) - 0.5) * 1.58, -1, 1)
      const harmonic = Math.sin(i * 1.53 + jitterBucket * 0.37) * 0.3
      const offset = (wander * 0.96 + harmonic) * jitterMag * Math.sin(Math.PI * t)
      chargeArcPoints[i].x = originX + activeDx * t + activeNx * offset
      chargeArcPoints[i].y = originY + activeDy * t + activeNy * offset
    }
    chargeArcPoints[segments].x = shownTargetX
    chargeArcPoints[segments].y = shownTargetY

    // Branch density, length, and detail all ride the existing segment scale so the
    // forks build with the real charge. Lite/reduced-motion paths pay no branch draw.
    if (lite || view.reducedMotion) {
      chargeArcBranchCount = 0
    } else {
      const segmentScale = (segments - minSegments) / (maxSegments - minSegments)
      chargeArcBranchCount = 2 + Math.round(segmentScale * (CHARGE_ARC_MAX_BRANCHES - 2))
      chargeArcBranchSegments = 2 + Math.round(segmentScale * (CHARGE_ARC_MAX_BRANCH_SEGMENTS - 2))
      const branchLengthScale = 0.55 + segmentScale * 0.4

      for (let branch = 0; branch < chargeArcBranchCount; branch++) {
        const anchorIndex = Math.max(
          1,
          Math.min(segments - 1, Math.round(((branch + 1) * segments) / (chargeArcBranchCount + 1))),
        )
        const before = chargeArcPoints[anchorIndex - 1]
        const after = chargeArcPoints[anchorIndex + 1]
        const anchor = chargeArcPoints[anchorIndex]
        const localDx = after.x - before.x
        const localDy = after.y - before.y
        const localSegmentLength = Math.hypot(localDx, localDy) / 2
        const forkDirection = circuitNoise(401, branch, jitterBucket) < 0.5 ? -1 : 1
        const forkAngle =
          Math.atan2(localDy, localDx) +
          forkDirection * (20 + circuitNoise(503, branch, jitterBucket) * 25) * (Math.PI / 180)
        const branchSegmentLength = localSegmentLength * branchLengthScale
        const points = chargeArcBranchPoints[branch]
        points[0].x = anchor.x
        points[0].y = anchor.y
        for (let point = 1; point <= chargeArcBranchSegments; point++) {
          const stepAngle = forkAngle + (circuitNoise(601 + branch, point, jitterBucket) - 0.5) * 0.32
          points[point].x = points[point - 1].x + Math.cos(stepAngle) * branchSegmentLength
          points[point].y = points[point - 1].y + Math.sin(stepAngle) * branchSegmentLength
        }
      }
    }
  }

  // Peak alpha kept below the strike-flash's (drawBoltView) so the release still
  // reads as the event, not lost in the buildup (CW: strike-swallow risk).
  const alpha = 0.18 + dischargeProgress * 0.52
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const relayAlpha = 0.34 + dischargeProgress * 0.5
  ctx.strokeStyle = `rgba(255,255,255,${relayAlpha})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pivotX, pivotY)
  ctx.lineTo(originX, originY)
  ctx.stroke()
  ctx.strokeStyle = `rgba(125,211,252,${relayAlpha * 0.8})`
  ctx.beginPath()
  ctx.arc(pivotX, pivotY, 5 + dischargeProgress * 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(chargeArcPoints[0].x, chargeArcPoints[0].y)
  for (let i = 1; i <= segments; i++) ctx.lineTo(chargeArcPoints[i].x, chargeArcPoints[i].y)

  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowColor = `rgba(80,190,255,${alpha * 0.72})`
  ctx.shadowBlur = lite ? 4 : 9
  ctx.strokeStyle = `rgba(80,190,255,${alpha * 0.5})`
  ctx.lineWidth = lite ? 5 : 11
  ctx.stroke()

  ctx.shadowBlur = lite ? 2 : 5
  ctx.strokeStyle = `rgba(159,231,255,${alpha * 0.82})`
  ctx.lineWidth = lite ? 2.5 : 4.5
  ctx.stroke()

  if (!lite) {
    // additive-blend white core, limited to this one layer only (CW: cost control)
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth = 1.6
    ctx.stroke()
  }

  if (!lite && !view.reducedMotion && chargeArcBranchCount > 0) {
    ctx.beginPath()
    for (let branch = 0; branch < chargeArcBranchCount; branch++) {
      const points = chargeArcBranchPoints[branch]
      ctx.moveTo(points[0].x, points[0].y)
      for (let point = 1; point <= chargeArcBranchSegments; point++) {
        ctx.lineTo(points[point].x, points[point].y)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = `rgba(80,190,255,${alpha * 0.42})`
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = `rgba(159,231,255,${alpha * 0.68})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`
    ctx.lineWidth = 0.85
    ctx.stroke()
  }
  ctx.restore()
}

// C5: Frankenstein charging overlay — torso glow + neck-bolt spark arcs, code-only,
// reusing the idle art. Strictly gated on progress>0 (never `charging`, which per
// row-25/FLW stays true post-strike via bolts.length>0 — that would relight this
// with no real hold, the exact fake-feedback failure mode HARD BLOCKER checklist
// item 1 bans). Same 20Hz-jitter-refresh / pre-allocated-buffer discipline as C4's
// drawChargeArcView above (CW: zero per-frame allocation).
function drawFrankChargeView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const progress = view.charge.progress
  if (progress <= 0) return

  const fm = assets.frankMeta
  const spriteW = fm.frame_w * FRANK_SPRITE_SCALE
  const spriteH = fm.frame_h * FRANK_SPRITE_SCALE
  const cx = FRANK_X + spriteW / 2
  const cy = FRANK_Y + spriteH * 0.42

  // Torso glow — screen-blend radial, same recipe as drawBurstView, scaled by progress.
  // Deliberately supplemental (FLW consult-22 MED): the fork-path feedback stays the
  // primary training surface, this is a secondary reactive read on Frank himself.
  // Argus video-review consult: alpha now ramps on a power curve (progress^1.6), not
  // linear — reads as faint-then-building rather than a near-binary on/off flip.
  const glowRadius = 18 + progress * 28
  const glowAlpha = 0.06 + Math.pow(progress, 1.6) * 0.32
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  gradient.addColorStop(0, `rgba(159,231,255,${glowAlpha})`)
  gradient.addColorStop(1, 'rgba(159,231,255,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Neck-bolt spark arcs — two short jittered pixel-block trails (Argus consult:
  // snapped to a SPRITE_SCALE-sized grid + filled squares instead of a stroked line,
  // so the effect reads as native pixel-art crackle rather than a smooth vector
  // clashing with the 6x-upscaled sprite; angle skews upward with per-refresh
  // random variance so it crackles rather than reading as a static outward pin).
  const boltY = FRANK_Y + spriteH * 0.31
  const anchors = [
    { x: FRANK_X + spriteW * 0.26, y: boltY, outDir: -1 },
    { x: FRANK_X + spriteW * 0.74, y: boltY, outDir: 1 },
  ]
  const sparkReach = 5 + progress * 11
  const sparkAlpha = 0.16 + Math.pow(progress, 1.4) * 0.68
  const pixelUnit = SPRITE_SCALE
  const snap = (v: number) => Math.round(v / pixelUnit) * pixelUnit

  // R3: logical charge buckets keep the relay crackle reproducible across devices.
  const sparkBucket = Math.floor(progress * 20)
  const refresh = frankSparkJitterBucket !== sparkBucket || frankSparkPoints[0][0].x === 0
  if (refresh) frankSparkJitterBucket = sparkBucket

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a]
    const points = frankSparkPoints[a]
    if (refresh) {
      // mostly-upward direction (-90deg) with per-refresh random lean, not a fixed
      // near-horizontal shape — reads as actively arcing, not a static wing/pin.
      const angle = -Math.PI / 2 + anchor.outDir * (0.35 + circuitNoise(701 + a, 0, sparkBucket) * 0.5)
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      points[0].x = anchor.x
      points[0].y = anchor.y
      for (let i = 1; i <= FRANK_SPARK_SEGMENTS; i++) {
        const t = i / FRANK_SPARK_SEGMENTS
        points[i].x = anchor.x + dx * t * sparkReach + (circuitNoise(809 + a, i, sparkBucket) - 0.5) * pixelUnit * 1.5
        points[i].y = anchor.y + dy * t * sparkReach + (circuitNoise(907 + a, i, sparkBucket) - 0.5) * pixelUnit * 1.5
      }
    }
    ctx.fillStyle = `rgba(159,231,255,${sparkAlpha})`
    for (let i = 0; i <= FRANK_SPARK_SEGMENTS; i++) {
      const px = snap(points[i].x)
      const py = snap(points[i].y)
      ctx.fillRect(px - pixelUnit / 2, py - pixelUnit / 2, pixelUnit, pixelUnit)
    }
  }
  ctx.restore()
}

function drawBurstView(ctx: CanvasRenderingContext2D, b: BurstView) {
  if (b.life < 0) return
  const progress = clamp(b.life / b.maxLife, 0, 1)
  const fade = Math.max(0, 1 - progress)
  const ease = 1 - Math.pow(1 - progress, 3)
  const kill = b.kind === 'kill'
  const radius = kill ? 18 + ease * 58 : 9 + ease * 24
  const flashAlpha = kill ? 0.46 * fade : 0.28 * fade

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius)
  gradient.addColorStop(0, `hsla(${b.hue}, 100%, 70%, ${flashAlpha})`)
  gradient.addColorStop(0.42, `hsla(${b.hue}, 95%, 52%, ${flashAlpha * 0.5})`)
  gradient.addColorStop(1, `hsla(${b.hue}, 90%, 45%, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(b.x, b.y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = fade
  ctx.strokeStyle = `hsla(${b.hue}, 100%, ${kill ? 68 : 62}%, ${kill ? 0.82 : 0.58})`
  ctx.lineWidth = kill ? 3 : 1.8
  ctx.beginPath()
  ctx.arc(b.x, b.y, radius * (kill ? 0.76 : 0.62), 0, Math.PI * 2)
  ctx.stroke()

  const sparkCount = kill ? 10 : 5
  for (let i = 0; i < sparkCount; i++) {
    const turn = (i / sparkCount) * Math.PI * 2 + b.seed * 0.019
    const spread = (kill ? 28 : 15) * ease * (0.82 + ((b.seed + i * 23) % 17) / 60)
    const sx = b.x + Math.cos(turn) * spread
    const sy = b.y + Math.sin(turn) * spread * 0.72
    const tail = kill ? 8 : 4
    ctx.strokeStyle = `hsla(${b.hue}, 100%, 72%, ${fade * (kill ? 0.9 : 0.62)})`
    ctx.lineWidth = kill ? 2 : 1.2
    ctx.beginPath()
    ctx.moveTo(sx - Math.cos(turn) * tail, sy - Math.sin(turn) * tail * 0.72)
    ctx.lineTo(sx, sy)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVillagerView(ctx: CanvasRenderingContext2D, v: VillagerView, view: ViewState, assets: Assets): PitchforksTargetContourDescriptor | undefined {
  const meta = assets.villagerMeta[v.totalTines]
  const sw = meta.frame_w * SPRITE_SCALE
  const sh = meta.frame_h * SPRITE_SCALE
  const sourceFrameW = meta.source_frame_w ?? meta.frame_w
  const sourceFrameH = meta.source_frame_h ?? meta.frame_h
  let img: HTMLImageElement | undefined
  let strip = false
  if (v.visualState === 'ash' || v.visualBurn >= v.totalTines) {
    img = assets.ashLeft[v.totalTines]
  } else if (v.visualBurn > 0) {
    img = assets.burnedLeft[`${v.totalTines}_${v.visualBurn}`]
  } else {
    img = assets.walkLeft[v.totalTines]
    strip = true
  }
  if (!img) return

  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(v.x + sw / 2, v.y + sh - 4, sw * 0.38, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.imageSmoothingEnabled = false
  const agitation = clamp(1 - v.soulR, 0, 1)
  const calm = clamp(v.soulCalm, 0, 1)
  let offsetPx = agitation * 1.0 * Math.sin(view.animClock * 1.35 + v.spawnIndex * 0.73)
  offsetPx *= 1 - calm * 0.7
  if (view.reducedMotion) offsetPx = 0
  // Smash recoil is a bystander-only presentation accent. It never changes
  // the villager's x, burned, tine, ash, or target-selection fields.
  const recoilPx = view.reducedMotion
    ? 0
    : Math.round(Math.sin(v.recoilProgress * Math.PI) * -6)
  const spriteX = v.x + offsetPx + recoilPx
  const spriteY = v.y + offsetPx * 0.35
  if (strip) {
    ctx.drawImage(img, v.walkFrame * sourceFrameW, 0, sourceFrameW, sourceFrameH, spriteX, spriteY, sw, sh)
  } else {
    ctx.drawImage(img, spriteX, spriteY, sw, sh)
  }

  if (v.recoilProgress > 0) {
    // Recoil is a bystander-only consequence. Reduced motion keeps a discrete
    // stun contour and three fixed pips, while normal motion additionally
    // permits the short positional nudge above; neither path changes gameplay.
    const stunAlpha = view.reducedMotion ? 0.82 : clamp(v.recoilProgress * 1.4, 0, 0.82)
    const stunX = spriteX + sw * 0.5
    const stunY = spriteY + sh * 0.16
    ctx.save()
    ctx.globalAlpha = stunAlpha
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(stunX, stunY, view.reducedMotion ? 9 : 9 + v.recoilProgress * 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fde68a'
    for (let pip = -1; pip <= 1; pip += 1) {
      ctx.fillRect(stunX + pip * 5 - 1, stunY - 15 - Math.abs(pip) * 2, 3, 3)
    }
    ctx.restore()
  }

  // Torch ecology attaches to the existing villager identity. It is a prop,
  // never a replacement sprite, and its state has no musical authority.
  if (v.visualState === 'walking' && v.torchBearer) {
    drawVillagerTorch(ctx, v.torch, spriteX + sw * 0.78, spriteY + sh - 3, view.reducedMotion)
  }

  if (v.visualState !== 'walking') return
  const progress = v.active ? view.charge.progress : 0
  const forkKey = `${v.totalTines}_${v.displayBurn}`
  const baseImg = assets.fork[forkKey] ?? assets.fork[`${v.totalTines}_${v.visualBurn}`]
  const glowImg = assets.forkGlow[forkKey] ?? assets.forkGlow[`${v.totalTines}_${v.visualBurn}`]
  const forkMeta = assets.forkMeta[v.totalTines]
  const forkW = forkMeta.frame_w * SPRITE_SCALE
  const forkH = forkMeta.frame_h * SPRITE_SCALE
  const fx = v.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE - (forkMeta.frame_w - forkMeta.handle_base.x) * SPRITE_SCALE
  const fy = v.y + meta.fork_base.y * SPRITE_SCALE - forkMeta.handle_base.y * SPRITE_SCALE
  const forkPivotX = v.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
  const forkPivotY = v.y + meta.fork_base.y * SPRITE_SCALE

  if (baseImg) {
    ctx.save()
    ctx.translate(forkPivotX, forkPivotY)
    ctx.rotate((FORK_LEAN_DEG * Math.PI) / 180)
    ctx.translate(-forkPivotX, -forkPivotY)
    ctx.translate(fx + forkW, fy)
    ctx.scale(-1, 1)
    ctx.drawImage(baseImg, 0, 0, forkW, forkH)
    if (v.active && glowImg) {
      ctx.globalAlpha = clamp(0.25 + progress * 0.75 + agitation * 0.15 * (1 - calm * 0.5), 0, 1)
      ctx.drawImage(glowImg, 0, 0, forkW, forkH)
    }
    ctx.restore()
  }

  const tineTipAnchor = rotateAroundPivot(fx + forkW / 2, fy + 7, forkPivotX, forkPivotY, FORK_LEAN_DEG)
  const noteLabelAnchor = rotateAroundPivot(fx + forkW / 2, fy - 7, forkPivotX, forkPivotY, FORK_LEAN_DEG)

  if (view.synesthesiaOn && v.answerVisible) {
    // Argus MED (C7 same-session): a flat same-alpha wash camouflages against
    // UI elements sharing this note's hue family (e.g. the cyan G4 note-name
    // badge). Fix mirrors C6's white-core-pip pattern: a bright saturated
    // core fading through the note hue to transparent reads as a distinct
    // aura instead of a flat color bleed.
    const auraRadius = 6 + progress * 3
    const auraGradient = ctx.createRadialGradient(
      tineTipAnchor.x, tineTipAnchor.y, 0,
      tineTipAnchor.x, tineTipAnchor.y, auraRadius,
    )
    auraGradient.addColorStop(0, `hsla(${v.soulHue}, 90%, 88%, 0.55)`)
    auraGradient.addColorStop(0.45, `hsla(${v.soulHue}, 80%, 65%, 0.32)`)
    auraGradient.addColorStop(1, `hsla(${v.soulHue}, 70%, 60%, 0)`)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = auraGradient
    ctx.beginPath()
    ctx.arc(tineTipAnchor.x, tineTipAnchor.y, auraRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (v.active && v.answerVisible && view.charge.tint) {
    drawForkAccuracyRibbon(ctx, tineTipAnchor, view.charge.tint, progress)
  }

  if (v.active && v.answerVisible && view.noteNamesVisible) {
    const note = v.notes[Math.min(v.visualBurn, v.notes.length - 1)]
    const canvasScale = ctx.canvas.clientWidth > 0 ? ctx.canvas.clientWidth / W : 1
    const noteFontPx = Math.round(clamp(11 / canvasScale, 14, 26))
    const badgePadX = Math.max(6, Math.round(noteFontPx * 0.38))
    ctx.font = `bold ${noteFontPx}px monospace`
    ctx.textAlign = 'center'
    const lx = noteLabelAnchor.x
    const ly = noteLabelAnchor.y
    const badgeTop = ly - noteFontPx - 3
    const tw = ctx.measureText(note).width + badgePadX * 2
    ctx.fillStyle = 'rgba(8, 10, 18, 0.86)'
    ctx.strokeStyle = view.charge.tint ?? 'rgba(130,210,255,0.62)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(lx - tw / 2, badgeTop, tw, noteFontPx + 7, 5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f4f7fb'
    ctx.fillText(note, lx, ly + 1)
  }

  if (v.active) {
    // ported from Pitchforks.tsx:576-584, using III's per-villager timer.
    const barW = 58
    const barH = 5
    const bx = v.x + sw / 2 - barW / 2
    const by = v.y - 25
    ctx.fillStyle = 'rgba(8, 10, 18, 0.88)'
    ctx.fillRect(bx, by, barW, barH)
    ctx.fillStyle = view.timersPaused ? '#7dd3fc' : v.timerPct > 0.3 ? '#fbbf24' : '#ef4444'
    ctx.fillRect(bx, by, barW * v.timerPct, barH)
    ctx.strokeStyle = view.timersPaused ? 'rgba(125,211,252,0.85)' : '#555'
    ctx.lineWidth = 1
    ctx.strokeRect(bx, by, barW, barH)
  }
  if (v.active) {
    return {
      image: img,
      sourceX: strip ? v.walkFrame * sourceFrameW : 0,
      sourceY: 0,
      sourceWidth: sourceFrameW,
      sourceHeight: sourceFrameH,
      destinationX: spriteX,
      destinationY: spriteY,
      scale: sw / sourceFrameW,
    }
  }
}

function drawPitchBarView(ctx: CanvasRenderingContext2D, tuner: TunerView) {
  if (!tuner.visible) return
  // ported from Pitchforks.tsx:602-658, with a 1s convergence trail.
  const centerX = PITCH_BAR_X + PITCH_BAR_W / 2
  const centerY = PITCH_BAR_Y + PITCH_BAR_H / 2
  const targetZoneW = PITCH_BAR_W * ((MATCH_TOLERANCE_CENTS / 100) / 6)

  ctx.fillStyle = 'rgba(20,20,30,0.78)'
  ctx.fillRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.strokeRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
  ctx.save()
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.62)'
  ctx.fillStyle = 'rgba(253, 186, 116, 0.48)'
  ctx.shadowColor = '#fdba74'
  ctx.shadowBlur = 4
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  const left = PITCH_BAR_X
  const right = PITCH_BAR_X + PITCH_BAR_W
  const top = PITCH_BAR_Y
  const bottom = PITCH_BAR_Y + PITCH_BAR_H
  const drawCornerRune = (x: number, y: number, sx: 1 | -1, sy: 1 | -1) => {
    ctx.beginPath()
    ctx.moveTo(x + sx * 4, y + sy * 1)
    ctx.lineTo(x + sx * 12, y + sy * 1)
    ctx.moveTo(x + sx * 1, y + sy * 4)
    ctx.lineTo(x + sx * 1, y + sy * 12)
    ctx.moveTo(x + sx * 7, y + sy * 4)
    ctx.lineTo(x + sx * 13, y + sy * 10)
    ctx.moveTo(x + sx * 4, y + sy * 7)
    ctx.lineTo(x + sx * 10, y + sy * 13)
    ctx.stroke()
  }
  const drawDiamond = (x: number, y: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y - 3)
    ctx.lineTo(x + 3, y)
    ctx.lineTo(x, y + 3)
    ctx.lineTo(x - 3, y)
    ctx.closePath()
    ctx.fill()
  }
  drawCornerRune(left, top, 1, 1)
  drawCornerRune(right, top, -1, 1)
  drawCornerRune(left, bottom, 1, -1)
  drawCornerRune(right, bottom, -1, -1)
  drawDiamond(centerX, top)
  drawDiamond(centerX, bottom)
  drawDiamond(left, centerY)
  drawDiamond(right, centerY)
  ctx.restore()
  ctx.fillStyle = 'rgba(74,222,128,0.16)'
  ctx.fillRect(centerX - targetZoneW / 2, PITCH_BAR_Y, targetZoneW, PITCH_BAR_H)

  const semisToCents = (semis: number) => Math.min(300, Math.abs(semis) * 100)
  const xForDeviation = (deviation: number) => {
    const clamped = clamp(deviation, -6, 6)
    return centerX + (clamped / 6) * (PITCH_BAR_W / 2)
  }

  const trail = tuner.trail
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1]
      const cur = trail[i]
      const alpha = clamp(1 - (tuner.now - cur.at) / TRAIL_MS, 0, 1)
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.08 + alpha * 0.22})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xForDeviation(prev.deviation), centerY)
      ctx.lineTo(xForDeviation(cur.deviation), centerY)
      ctx.stroke()
    }
  }
  for (const point of trail) {
    const alpha = clamp(1 - (tuner.now - point.at) / TRAIL_MS, 0, 1)
    ctx.save()
    ctx.globalAlpha = 0.08 + alpha * 0.36
    ctx.fillStyle = colorForCents(semisToCents(point.deviation)) ?? '#f87171'
    ctx.beginPath()
    ctx.arc(xForDeviation(point.deviation), centerY, 2 + alpha * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (tuner.canUseSource && tuner.renderDeviation !== null) {
    const dotX = xForDeviation(tuner.renderDeviation)
    const dotColor = colorForCents(semisToCents(tuner.renderDeviation)) ?? '#f87171'
    if (tuner.onTarget) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = dotColor
      ctx.beginPath()
      ctx.arc(dotX, centerY, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = dotColor
    ctx.beginPath()
    ctx.arc(dotX, centerY, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(tuner.sourceNote || '', dotX, PITCH_BAR_Y - 4)
  } else {
    ctx.fillStyle = '#555'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('sing...', centerX, centerY + 3)
  }

  if (tuner.targetNote) {
    // Argus video-review consult: low contrast against the dark dungeon floor in green;
    // switched to the brand-orange highlight (matches the C5 UI-reskin palette) for
    // readability under duress, per the explicit suggested fix.
    ctx.fillStyle = '#fdba74'
    const canvasScale = Math.max(0.45, ctx.canvas.clientWidth / W)
    ctx.font = `bold ${clamp(10 / canvasScale, 10, 18)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(tuner.feedback.compactLabel, centerX, PITCH_BAR_Y + PITCH_BAR_H + 13)
  }
}

const STAFF_PANEL_X = 18
const STAFF_PANEL_Y = 76
const STAFF_PANEL_W = 274
const STAFF_PANEL_H = 154
const STAFF_LEFT = STAFF_PANEL_X + 42
const STAFF_RIGHT = STAFF_PANEL_X + STAFF_PANEL_W - 12
const STAFF_BOTTOM_LINE_Y = STAFF_PANEL_Y + 88
const STAFF_LINE_GAP = 12
const STAFF_LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 } as const
const STAFF_PITCH_CLASS: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const STAFF_CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

type StaffNote = Readonly<{
  name: string
  letter: keyof typeof STAFF_LETTER_STEP
  accidental: '' | '#' | 'b'
  octave: number
  stepFromE4: number
}>

function staffNote(note: string | null): StaffNote | null {
  if (!note) return null
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!match) return null
  const letter = match[1] as StaffNote['letter']
  const accidental = match[2] as StaffNote['accidental']
  const octave = Number(match[3])
  return {
    name: note,
    letter,
    accidental,
    octave,
    stepFromE4: octave * 7 + STAFF_LETTER_STEP[letter] - (4 * 7 + STAFF_LETTER_STEP.E),
  }
}

function staffY(note: StaffNote): number {
  return STAFF_BOTTOM_LINE_Y - note.stepFromE4 * (STAFF_LINE_GAP / 2)
}

function staffMidi(note: StaffNote): number {
  return note.octave * 12 + (STAFF_PITCH_CLASS[`${note.letter}${note.accidental}`] ?? STAFF_PITCH_CLASS[note.letter])
}

function staffNoteFromMidi(midi: number): StaffNote {
  const rounded = Math.round(midi)
  const octave = Math.floor(rounded / 12)
  return staffNote(`${STAFF_CHROMATIC_NAMES[((rounded % 12) + 12) % 12]}${octave}`)!
}

function staffYForContinuousMidi(midi: number): number {
  const lowerMidi = Math.floor(midi)
  const fraction = midi - lowerMidi
  const lowerY = staffY(staffNoteFromMidi(lowerMidi))
  const upperY = staffY(staffNoteFromMidi(lowerMidi + 1))
  return lowerY + (upperY - lowerY) * fraction
}

function drawLedgerLines(ctx: CanvasRenderingContext2D, x: number, note: StaffNote) {
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
  ctx.lineWidth = 1
  if (note.stepFromE4 < 0) {
    for (let step = -2; step >= note.stepFromE4; step -= 2) {
      const y = STAFF_BOTTOM_LINE_Y - step * (STAFF_LINE_GAP / 2)
      ctx.beginPath()
      ctx.moveTo(x - 11, y)
      ctx.lineTo(x + 11, y)
      ctx.stroke()
    }
  } else if (note.stepFromE4 > 8) {
    for (let step = 10; step <= note.stepFromE4; step += 2) {
      const y = STAFF_BOTTOM_LINE_Y - step * (STAFF_LINE_GAP / 2)
      ctx.beginPath()
      ctx.moveTo(x - 11, y)
      ctx.lineTo(x + 11, y)
      ctx.stroke()
    }
  }
}

function drawStaffNoteHead(
  ctx: CanvasRenderingContext2D,
  note: StaffNote,
  x: number,
  spent: boolean,
  target: boolean,
) {
  const y = staffY(note)
  drawLedgerLines(ctx, x, note)

  ctx.save()
  ctx.globalAlpha = spent ? 0.42 : 1
  ctx.fillStyle = spent ? '#9ca3af' : '#86efac'
  ctx.strokeStyle = spent ? '#4b5563' : '#166534'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(x, y, 7, 4.5, -0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const stemDown = note.stepFromE4 >= 4
  ctx.beginPath()
  ctx.moveTo(x + (stemDown ? -6 : 6), y + (stemDown ? 1 : -1))
  ctx.lineTo(x + (stemDown ? -6 : 6), y + (stemDown ? 22 : -22))
  ctx.stroke()
  if (note.accidental) {
    ctx.fillStyle = spent ? '#9ca3af' : '#e5e7eb'
    ctx.font = '15px "Segoe UI Symbol", serif'
    ctx.textAlign = 'center'
    ctx.fillText(note.accidental === '#' ? '♯' : '♭', x - 12, y + 5)
  }
  ctx.restore()

  if (spent) {
    ctx.save()
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.82
    ctx.beginPath()
    ctx.moveTo(x - 10, y + 8)
    ctx.lineTo(x + 10, y - 8)
    ctx.stroke()
    ctx.restore()
  } else if (target) {
    ctx.save()
    ctx.strokeStyle = '#fdba74'
    ctx.shadowColor = '#fdba74'
    ctx.shadowBlur = 8
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawStaffNotationView(ctx: CanvasRenderingContext2D, view: ViewState) {
  if (!view.tuner.visible) return

  ctx.save()
  ctx.fillStyle = 'rgba(7, 9, 20, 0.9)'
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.48)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(STAFF_PANEL_X, STAFF_PANEL_Y, STAFF_PANEL_W, STAFF_PANEL_H, 8)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
  for (let line = 0; line < 5; line++) {
    const y = STAFF_BOTTOM_LINE_Y - line * STAFF_LINE_GAP
    ctx.beginPath()
    ctx.moveTo(STAFF_LEFT, y)
    ctx.lineTo(STAFF_RIGHT, y)
    ctx.stroke()
  }

  ctx.fillStyle = '#e5e7eb'
  ctx.font = '54px "Segoe UI Symbol", "Noto Music", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('𝄞', STAFF_PANEL_X + 25, STAFF_BOTTOM_LINE_Y + 17)

  const activeVillager = view.active
    ? view.villagers.find(villager => villager.id === view.active?.villagerId)
    : null
  const queue = activeVillager?.notes ?? []
  const queueLeft = STAFF_LEFT + 42
  const queueRight = STAFF_RIGHT - 24
  const stepX = queue.length > 1 ? (queueRight - queueLeft) / (queue.length - 1) : 0

  for (let index = 0; index < queue.length; index++) {
    const note = staffNote(queue[index])
    if (!note) continue
    const x = queue.length === 1 ? (queueLeft + queueRight) / 2 : queueLeft + stepX * index
    const spent = !!activeVillager && index < activeVillager.visualBurn
    const target = !!activeVillager && index === activeVillager.visualBurn
    const concealedTarget = target && activeVillager?.answerVisible === false
    if (!concealedTarget) drawStaffNoteHead(ctx, note, x, spent, target)

    if (view.noteNamesVisible && !concealedTarget) {
      ctx.save()
      ctx.globalAlpha = spent ? 0.45 : 1
      ctx.fillStyle = spent ? '#9ca3af' : '#bbf7d0'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, x, STAFF_PANEL_Y + STAFF_PANEL_H - 7)
      if (spent) {
        const width = ctx.measureText(note.name).width + 4
        ctx.strokeStyle = '#d1d5db'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x - width / 2, STAFF_PANEL_Y + STAFF_PANEL_H - 10)
        ctx.lineTo(x + width / 2, STAFF_PANEL_Y + STAFF_PANEL_H - 10)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  const source = staffNote(view.tuner.sourceNote)
  const targetNote = staffNote(activeVillager?.notes[activeVillager.visualBurn] ?? null)
  if (
    source &&
    activeVillager &&
    view.tuner.canUseSource &&
    view.tuner.renderDeviation !== null &&
    activeVillager.burned < queue.length
  ) {
    const targetX = queue.length === 1
      ? (queueLeft + queueRight) / 2
      : queueLeft + stepX * activeVillager.burned
    // Keep the exact staff mapping for the target note, then place the live
    // detected pitch continuously around it. `renderDeviation` is the same
    // smoothed, frequency-derived semitone distance used by the pitch bar.
    const rawSourceY = targetNote
      ? staffYForContinuousMidi(staffMidi(targetNote) + view.tuner.renderDeviation)
      : staffY(source)
    const sourceY = clamp(rawSourceY, STAFF_PANEL_Y + 8, STAFF_PANEL_Y + STAFF_PANEL_H - 12)
    const cents = Math.min(300, Math.abs(view.tuner.renderDeviation) * 100)
    const color = colorForCents(cents) ?? '#f87171'
    if (sourceY === rawSourceY) drawLedgerLines(ctx, targetX, source)
    ctx.save()
    ctx.fillStyle = color
    ctx.strokeStyle = '#071018'
    ctx.lineWidth = 1.5
    ctx.shadowColor = color
    ctx.shadowBlur = view.tuner.onTarget ? 10 : 4
    ctx.beginPath()
    ctx.moveTo(targetX, sourceY - 5)
    ctx.lineTo(targetX + 5, sourceY)
    ctx.lineTo(targetX, sourceY + 5)
    ctx.lineTo(targetX - 5, sourceY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    if (view.noteNamesVisible) {
      ctx.shadowBlur = 0
      ctx.fillStyle = '#f4f7fb'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(source.name, targetX + 8, sourceY + 3)
    }
    ctx.restore()
  }

  ctx.restore()
}

function drawDungeonArch(ctx: CanvasRenderingContext2D, cx: number, topY: number, width: number, bottomY: number) {
  const radius = width / 2

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - radius, bottomY)
  ctx.lineTo(cx - radius, topY + radius)
  ctx.arc(cx, topY + radius, radius, Math.PI, 0)
  ctx.lineTo(cx + radius, bottomY)
  ctx.closePath()
  const recess = ctx.createLinearGradient(cx, topY, cx, bottomY)
  recess.addColorStop(0, '#050608')
  recess.addColorStop(0.58, '#10110d')
  recess.addColorStop(1, '#18180f')
  ctx.fillStyle = recess
  ctx.fill()

  ctx.lineWidth = 9
  ctx.strokeStyle = 'rgba(52, 49, 39, 0.76)'
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(168, 139, 86, 0.16)'
  ctx.stroke()
  ctx.restore()
}

function drawDungeonFloor(ctx: CanvasRenderingContext2D) {
  const floor = ctx.createLinearGradient(0, DUNGEON_FLOOR_Y, 0, H)
  floor.addColorStop(0, '#202018')
  floor.addColorStop(0.55, '#29251a')
  floor.addColorStop(1, '#15140f')
  ctx.fillStyle = floor
  ctx.fillRect(0, DUNGEON_FLOOR_Y, W, H - DUNGEON_FLOOR_Y)

  const path = ctx.createLinearGradient(0, DUNGEON_FLOOR_Y, 0, H)
  path.addColorStop(0, 'rgba(79, 72, 52, 0.32)')
  path.addColorStop(1, 'rgba(35, 31, 23, 0.72)')
  ctx.beginPath()
  ctx.moveTo(82, DUNGEON_FLOOR_Y)
  ctx.lineTo(W - 82, DUNGEON_FLOOR_Y)
  ctx.lineTo(W + 64, H)
  ctx.lineTo(-64, H)
  ctx.closePath()
  ctx.fillStyle = path
  ctx.fill()

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(238, 221, 166, 0.08)'
  for (let i = 1; i <= 5; i++) {
    const t = i / 5
    const y = DUNGEON_FLOOR_Y + Math.pow(t, 1.45) * (H - DUNGEON_FLOOR_Y)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  for (let i = -4; i <= 4; i++) {
    const bottomX = W / 2 + i * 92
    ctx.beginPath()
    ctx.moveTo(W / 2, DUNGEON_FLOOR_Y - 22)
    ctx.lineTo(bottomX, H)
    ctx.stroke()
  }
  ctx.restore()
}

function drawDungeonTorchGlow(
  ctx: CanvasRenderingContext2D,
  torch: (typeof DUNGEON_TORCHES)[number],
  animClock: number,
) {
  const flicker =
    Math.sin(animClock * 5.7 + torch.phase) * 0.55 +
    Math.sin(animClock * 12.3 + torch.phase * 1.6) * 0.45
  const radius = 54 + flicker * 7
  const alpha = 0.15 + flicker * 0.025

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, radius)
  glow.addColorStop(0, `rgba(255, 179, 72, ${alpha})`)
  glow.addColorStop(0.38, `rgba(205, 91, 32, ${alpha * 0.42})`)
  glow.addColorStop(1, 'rgba(105, 45, 20, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(torch.x, torch.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDungeonTorchFixture(
  ctx: CanvasRenderingContext2D,
  torch: (typeof DUNGEON_TORCHES)[number],
  animClock: number,
) {
  const flameShift = Math.sin(animClock * 9.2 + torch.phase) * 2

  ctx.save()
  ctx.strokeStyle = 'rgba(61, 46, 32, 0.78)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(torch.x - 10, torch.y + 19)
  ctx.lineTo(torch.x + 7, torch.y + 6)
  ctx.stroke()

  ctx.fillStyle = '#3b2c20'
  ctx.fillRect(torch.x - 14, torch.y + 17, 18, 5)

  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255, 130, 38, 0.8)'
  ctx.beginPath()
  ctx.ellipse(torch.x, torch.y + 2, 7, 12 + flameShift, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 230, 128, 0.86)'
  ctx.beginPath()
  ctx.ellipse(torch.x + 1, torch.y + 1, 3.5, 7 + flameShift * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDungeonBackground(ctx: CanvasRenderingContext2D, animClock: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, H)
  wall.addColorStop(0, '#07080c')
  wall.addColorStop(0.32, '#171816')
  wall.addColorStop(0.72, '#222016')
  wall.addColorStop(1, '#11130d')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.lineWidth = 1
  for (let row = 0; row < 12; row++) {
    const y = 12 + row * 24
    ctx.strokeStyle = 'rgba(238, 226, 178, 0.06)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    const offset = row % 2 === 0 ? 0 : 45
    for (let x = offset; x < W + 92; x += 92) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 5 + (row % 3) * 3, Math.min(DUNGEON_FLOOR_Y, y + 23))
      ctx.stroke()
    }
  }

  ctx.fillStyle = 'rgba(122, 141, 74, 0.12)'
  ctx.fillRect(0, DUNGEON_FLOOR_Y - 18, W, 18)
  for (let i = 0; i < 42; i++) {
    const x = (i * 67 + 19) % W
    const y = 28 + ((i * 41 + 11) % 226)
    ctx.fillStyle = i % 3 === 0 ? 'rgba(205, 197, 155, 0.1)' : 'rgba(0, 0, 0, 0.16)'
    ctx.fillRect(x, y, 2 + (i % 2), 1)
  }
  ctx.restore()

  drawDungeonArch(ctx, 96, 72, 92, DUNGEON_FLOOR_Y + 8)
  drawDungeonArch(ctx, 274, 54, 122, DUNGEON_FLOOR_Y + 18)
  drawDungeonArch(ctx, 462, 58, 112, DUNGEON_FLOOR_Y + 14)
  drawDungeonArch(ctx, 642, 84, 82, DUNGEON_FLOOR_Y + 6)
  drawDungeonFloor(ctx)

  for (const torch of DUNGEON_TORCHES) drawDungeonTorchGlow(ctx, torch, animClock)
  for (const torch of DUNGEON_TORCHES) drawDungeonTorchFixture(ctx, torch, animClock)

  const vignette = ctx.createRadialGradient(W / 2, GROUND_Y - 78, 160, W / 2, GROUND_Y - 78, 430)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.44)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
}

function drawNoteMasteredCeremony(
  ctx: CanvasRenderingContext2D,
  note: string,
  ageMs: number,
  animClock: number,
  reducedMotion: boolean,
) {
  const progress = clamp(ageMs / NOTE_MASTERED_CEREMONY_MS, 0, 1)
  const alpha = Math.min(clamp(progress / 0.18, 0, 1), clamp((1 - progress) / 0.24, 0, 1))
  if (alpha <= 0) return

  const hue = hueForNote(note)
  const cx = W / 2
  const cy = 190
  const settle = 1 - Math.pow(1 - progress, 3)
  const pulse = reducedMotion ? 0 : Math.sin(animClock * 2.4) * 2.5

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(2, 7, 14, 0.64)'
  ctx.fillRect(0, 128, W, 124)

  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 164)
  glow.addColorStop(0, `hsla(${hue}, 96%, 70%, 0.34)`)
  glow.addColorStop(0.42, `hsla(${hue}, 82%, 42%, 0.16)`)
  glow.addColorStop(1, `hsla(${hue}, 70%, 18%, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 72, W, 236)

  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const ringProgress = clamp(settle - i * 0.12, 0, 1)
    const radius = 76 - ringProgress * 30 + i * 10 + pulse
    ctx.strokeStyle = `hsla(${hue}, ${92 - i * 10}%, ${68 - i * 6}%, ${0.38 - i * 0.08})`
    ctx.lineWidth = 2.4 - i * 0.35
    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI * 0.08, Math.PI * 1.92)
    ctx.stroke()
  }

  ctx.fillStyle = `hsla(${hue}, 92%, 78%, 0.92)`
  ctx.font = 'bold 15px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('NOTE MASTERED', cx, cy - 32)

  ctx.fillStyle = '#f7fbff'
  ctx.shadowColor = `hsla(${hue}, 96%, 70%, 0.72)`
  ctx.shadowBlur = 18
  ctx.font = 'bold 42px monospace'
  ctx.fillText(note, cx, cy + 16)

  ctx.shadowBlur = 0
  ctx.strokeStyle = `hsla(${hue}, 90%, 72%, 0.72)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 68, cy + 36)
  ctx.lineTo(cx - 18, cy + 36)
  ctx.moveTo(cx + 18, cy + 36)
  ctx.lineTo(cx + 68, cy + 36)
  ctx.stroke()
  ctx.restore()
}

function renderView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  ctx.save()
  ctx.translate(view.shake.x, view.shake.y)
  if (assets.privatePlate) {
    // Only the explicit demo art-proof route loads this candidate plate.
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(assets.privatePlate, 0, 0, W, H)
  } else if (view.normalWorld === 'bell-tower' && assets.bellTowerPlate) {
    ctx.drawImage(assets.bellTowerPlate, 0, 0, W, H)
  } else if (view.normalWorld === 'cathedral' && assets.cathedralPlate) {
    ctx.drawImage(assets.cathedralPlate, 0, 0, W, H)
  } else if (view.normalWorld === 'village-gate' && assets.villageGatePlate) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(assets.villageGatePlate, 0, 0, W, H)
  } else {
    drawDungeonBackground(ctx, view.animClock)
  }
  // Landscape staff lives in the left background so Frank remains the visual
  // anchor while the larger vertical spacing makes live pitch movement legible.
  if (view.staffNotationVisible) drawStaffNotationView(ctx, view)
  drawPitchforksBellSwing(ctx, {
    active: view.bellWave.phase === 'active' || view.bellWave.phase === 'finished',
    elapsedMs: view.bellWaveElapsedMs,
    reducedMotion: view.reducedMotion,
    bell: assets.bellSwing,
    backdrop: assets.bellBackdrop,
    renderResting: view.normalWorld === 'village-gate',
  })
  drawStormCloudView(ctx, view, assets)
  drawRainArchitecture(ctx, view.rain, view.reducedMotion, assets.gargoyleSpout, assets.rainCloud)
  // Stored-note identity and its lightning origin stay in front of the gutter.
  drawThunderheadCloudView(ctx, view, assets.stormHeart)

  // Close Smash deliberately uses the one accepted authored contact cell only.
  // Anticipation and settle are whole-pixel translations of shipped idle art;
  // no generated in-between frames enter the runtime.
  const closeSmashAction = (
    (view.closeSmash.phase === 'pending' || view.closeSmash.phase === 'settle') &&
    view.closeSmash.consumer === 'smash'
  )
  // Galvanic reuses the accepted original Close Smash cell only during the
  // short bolt/contact window; its accounting and lifecycle stay separate.
  // The authored joined-hand origin must remain visible for the whole lifetime
  // of a Galvanic bolt, including its reduced-motion static presentation.
  const galvanicContact = view.bolts.some(b => b.presentation === 'galvanic')
  const closeSmashPose = closeSmashAction || galvanicContact
  const closeSmashContact = (closeSmashAction && view.closeSmash.contactPresented) || galvanicContact
  // Accepted Conductor Coil: a held note changes Frank's pose, not a lingering bolt.
  const chargePose = selectPitchforksChargePose(
    closeSmashPose ? 0 : view.charge.progress,
    view.animClock,
    view.reducedMotion,
    !!assets.frankCharge,
  )
  const victoryFrank = view.frankVictory?.pose === 'eyeLift'
    ? assets.frankVictoryEyeLift
    : view.frankVictory?.pose === 'neutral'
      ? assets.frankVictoryNeutral
      : undefined
  const frank = victoryFrank
    ?? (closeSmashContact
      ? assets.frankCloseSmash ?? assets.frankIdle
      : chargePose.pose === 'charge' ? assets.frankCharge : assets.frankIdle)
  if (frank) {
    const fm = assets.frankMeta
    const isVictorySprite = !!victoryFrank
    const sourceFrameW = isVictorySprite ? VICTORY_SPRITE_W : fm.frame_w
    const sourceFrameH = isVictorySprite ? VICTORY_SPRITE_H : fm.frame_h
    const frame = isVictorySprite ? 0 : closeSmashContact ? 0 : chargePose.frame % fm.frames
    const spriteW = sourceFrameW * FRANK_SPRITE_SCALE
    const spriteH = sourceFrameH * FRANK_SPRITE_SCALE
    // Victory is a single authored sprite substitution. It deliberately does
    // not participate in the existing per-kill reaction scale/glow treatment.
    const reaction = isVictorySprite ? null : view.frankReaction
    const reactionPhase = reaction ? clamp(reaction.ageMs / FRANK_REACTION_MS, 0, 1) : 1
    const reactionBeat = reaction ? Math.sin(reactionPhase * Math.PI) : 0
    const reactionFade = reaction ? 1 - reactionPhase : 0
    const motionBeat = view.reducedMotion ? 0 : reactionBeat
    const scaleX = reaction?.kind === 'kill' ? 1 + motionBeat * 0.08 : reaction?.kind === 'miss' ? 1 - motionBeat * 0.05 : 1
    const scaleY = reaction?.kind === 'kill' ? 1 + motionBeat * 0.08 : reaction?.kind === 'miss' ? 1 + motionBeat * 0.035 : 1
    const drawW = spriteW * scaleX
    const drawH = spriteH * scaleY
    const drawX = FRANK_X - (drawW - spriteW) / 2 + (reaction?.kind === 'miss' ? -5 * motionBeat : 0)
    const closeSmashOffsetY = closeSmashPose
      ? closeSmashContact
        ? view.closeSmash.phase === 'settle' ? 1 : 0
        : 2
      : 0
    const drawY = FRANK_Y - (drawH - spriteH) + closeSmashOffsetY + (reaction?.kind === 'kill' ? -4 * motionBeat : 0)
    ctx.imageSmoothingEnabled = false
    if (reaction?.kind === 'kill') {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.36 * reactionFade
      const glowX = FRANK_X + spriteW / 2
      const glowY = FRANK_Y + spriteH * 0.42
      const glow = ctx.createRadialGradient(glowX, glowY, 5, glowX, glowY, 42 + 18 * reactionBeat)
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.9)')
      glow.addColorStop(0.54, 'rgba(74, 222, 128, 0.24)')
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(glowX, glowY, 46 + 18 * reactionBeat, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.globalAlpha = reaction?.kind === 'miss' ? 1 - reactionFade * 0.34 : 1
    ctx.drawImage(
      frank,
      frame * sourceFrameW,
      0,
      sourceFrameW,
      sourceFrameH,
      drawX,
      drawY,
      drawW,
      drawH,
    )
    if (reaction?.kind === 'kill') {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.28 * reactionFade
      ctx.drawImage(
        frank,
        frame * sourceFrameW,
        0,
        sourceFrameW,
        sourceFrameH,
        drawX,
        drawY,
        drawW,
        drawH,
      )
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.48)'
    ctx.beginPath()
    ctx.ellipse(FRANK_X + 48, FRANK_Y + fm.frame_h * FRANK_SPRITE_SCALE - 7, 35, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    drawFrankChargeView(ctx, view, assets)
    // ported from Pitchforks.tsx:518-523; health lives on the monster.
    for (let i = 0; i < STARTING_HEALTH; i++) {
      ctx.fillStyle = i < view.hud.health ? '#4ade80' : '#333'
      ctx.fillRect(FRANK_X + 7 + i * 13, FRANK_Y - 8, 10, 4)
    }
  }

  const ordered = [...view.villagers].sort((x, y) => x.y - y.y)
  let targetContour: PitchforksTargetContourDescriptor | undefined
  for (const v of ordered) {
    const descriptor = drawVillagerView(ctx, v, view, assets)
    if (descriptor) targetContour = descriptor
  }
  const bellOrigin = view.bellWave.bellOrigin
  if (bellOrigin) {
    // The renderer receives the lifecycle's leading radius directly; it owns
    // no clock or contact state and therefore cannot drift from knockback.
    drawPitchforksBellWave(ctx, {
      active: view.bellWave.visible,
      originX: bellOrigin.x,
      originY: bellOrigin.y,
      radius: view.bellWave.radius,
      progress: view.bellWave.progress,
      reducedMotion: view.reducedMotion,
    })
  }
  if (targetContour) drawPitchforksTargetContour(ctx, targetContour)
  drawChargeArcView(ctx, view, assets)
  for (const burst of view.bursts) drawBurstView(ctx, burst)
  for (const bolt of view.bolts) drawBoltView(ctx, bolt, view.reducedMotion)
  ctx.restore()

  if (view.noteMastered) {
    drawNoteMasteredCeremony(ctx, view.noteMastered, view.noteMasteredAgeMs, view.animClock, view.reducedMotion)
  }

  if (view.waveBanner.visible) {
    const alpha = Math.min(1, view.waveBanner.timer / 0.35)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(0,0,0,0.44)'
    ctx.fillRect(0, 150, W, 72)
    ctx.fillStyle = '#f6f8ff'
    ctx.font = 'bold 30px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${view.hud.wave}`, W / 2, 195)
    ctx.restore()
  }

  if (view.hud.streak >= 3) {
    ctx.fillStyle = view.hud.streak >= 10 ? '#ff6090' : '#ffc83c'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${view.hud.streak}x COMBO`, 16, 18)
  }

  if (view.prompt.visible) {
    ctx.fillStyle = '#f4f7fb'
    ctx.font = 'bold 15px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(view.prompt.text, W / 2, 20)
  }

  if (view.active) {
    const villager = view.villagers.find(v => v.id === view.active?.villagerId)
    if (villager) {
      const meta = assets.villagerMeta[villager.totalTines]
      const tine = meta.tines[Math.max(0, Math.min(view.active.tineIndex, meta.tines.length - 1))]
      const forkPivotX = villager.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
      const forkPivotY = villager.y + meta.fork_base.y * SPRITE_SCALE
      const rawX = villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
      const rawY = villager.y + tine.y * SPRITE_SCALE
      const { x, y } = rotateAroundPivot(rawX, rawY, forkPivotX, forkPivotY, FORK_LEAN_DEG)
      ctx.strokeStyle = view.charge.tint ?? 'rgba(160,210,255,0.62)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 12 + view.charge.progress * 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  drawPitchBarView(ctx, view.tuner)
}

function drawArtReviewOverlay(
  ctx: CanvasRenderingContext2D,
  body: ArtReviewBodyState,
  storm: ArtReviewStormState,
) {
  ctx.save()
  ctx.fillStyle = 'rgba(3, 7, 16, 0.92)'
  ctx.fillRect(8, 8, 354, 42)
  ctx.fillStyle = '#fef08a'
  ctx.font = 'bold 11px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('PRIVATE ART REVIEW · VISUAL ONLY · NO GAMEPLAY', 16, 23)
  ctx.fillStyle = '#bae6fd'
  ctx.font = 'bold 10px monospace'
  ctx.fillText(`BODY ${body.toUpperCase()} · STORM ${storm.toUpperCase()} · RAINING`, 16, 40)
  ctx.restore()
}

function localSfx(kind: 'strike' | 'ash' | 'hurt' | 'roar' | 'smash-contact' | 'recoil' | 'bell', volumePct: number, note?: string) {
  if (typeof window === 'undefined') return
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtor) return
  const ctx = new AudioCtor() as AudioContext
  const master = ctx.createGain()
  master.gain.value = Math.max(0, Math.min(2, volumePct / 100))
  master.connect(ctx.destination)
  const now = ctx.currentTime
  let closeAfterMs = 450

  if (kind === 'bell') {
    schedulePitchforksBellRing(ctx, master, note ? noteToFreq(note) : NaN)
    closeAfterMs = PITCHFORKS_BELL_RING_MS + 100
  } else if (kind === 'strike') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.07)
    gain.gain.setValueAtTime(0.13, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.19)
  } else if (kind === 'smash-contact') {
    // The contact sting is the earned pitch one octave down. The existing
    // strike call still supplies the normal tine snap through its authority.
    const contactFrequency = note ? noteToFreq(note) / 2 : 220
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(Math.max(40, contactFrequency), now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(32, contactFrequency * 0.72), now + 0.22)
    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.29)
    closeAfterMs = 520
  } else if (kind === 'recoil') {
    // A bystander gets one dull, unpitched thud; this branch owns no musical
    // state and intentionally has no note/frequency derived from the target.
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14)
    gain.gain.setValueAtTime(0.09, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.18)
  } else if (kind === 'ash') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.28)
    gain.gain.setValueAtTime(0.11, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.31)
  } else if (kind === 'roar') {
    closeAfterMs = 780
    const low = ctx.createOscillator()
    const detuned = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const growl = ctx.createGain()

    low.type = 'sawtooth'
    low.frequency.setValueAtTime(92, now)
    low.frequency.exponentialRampToValueAtTime(58, now + 0.56)
    detuned.type = 'sawtooth'
    detuned.frequency.setValueAtTime(77, now)
    detuned.frequency.exponentialRampToValueAtTime(51, now + 0.58)
    detuned.detune.setValueAtTime(-18, now)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(480, now)
    filter.frequency.exponentialRampToValueAtTime(145, now + 0.58)
    filter.Q.value = 2.5
    growl.gain.setValueAtTime(0.001, now)
    growl.gain.linearRampToValueAtTime(0.18, now + 0.045)
    growl.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    low.connect(filter)
    detuned.connect(filter)
    filter.connect(growl)
    growl.connect(master)
    low.start(now)
    detuned.start(now)
    low.stop(now + 0.62)
    detuned.stop(now + 0.62)

    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.16), ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const fade = 1 - i / data.length
      data[i] = (Math.random() * 2 - 1) * fade
    }
    const noise = ctx.createBufferSource()
    const noiseFilter = ctx.createBiquadFilter()
    const noiseGain = ctx.createGain()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(170, now)
    noiseFilter.Q.value = 0.8
    noiseGain.gain.setValueAtTime(0.07, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noise.start(now)
  } else {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(190, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.16)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.19)
  }

  window.setTimeout(() => ctx.close().catch(() => {}), closeAfterMs)
}

export default function PitchforksIII() {
  const bossWorldRef = useRef<WorldId | null>(null)
  const bossPracticeWorldRef = useRef<WorldId | null>(null)
  const bossPracticeOnlyRef = useRef(false)
  const bossPitchGenerationRef = useRef<PitchforksSongcraftGenerationState>({ lastGeneration: null, generationObserved: false, generationObservedAt: 0 })
  const bossControllerRef = useRef<PitchforksBossRecitalController | null>(null)
  const bossIdentityRef = useRef<PitchforksBossId | null>(null)
  const bossReceiptsRef = useRef<PitchforksBossRecitalReceipt[]>([])
  const bossSupportedPracticeRef = useRef(false)
  const bossHoldRef = useRef({ heldMs: 0, matched: false })
  const bossSimulatingRef = useRef(false)
  const bossClockRef = useRef(0)
  const bossHeadingRef = useRef<HTMLHeadingElement>(null)
  const bossHeardClaimRef = useRef<string | null>(null)
  const bossButtonTrialRef = useRef<PitchforksButtonTrial | null>(null)
  const [bossState, setBossState] = useState<PitchforksBossRecitalState | null>(null)
  const [bossIdentity, setBossIdentity] = useState<PitchforksBossId | null>(null)
  const [bossMessage, setBossMessage] = useState('')
  const [bossSimulating, setBossSimulating] = useState(false)
  const [bossAudioBusy, setBossAudioBusy] = useState(false)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const playRootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staffCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const pausedRef = useRef(false)
  const pauseGateRef = useRef<PitchforksPauseGate>(createPitchforksPauseGate())
  const loopRef = useRef<((ts: number, fence: number) => void) | null>(null)
  const runtimeRef = useRef<Runtime>(makeInitialRuntime(false))
  const rainActivationRequestedRef = useRef(false)
  const rainUiSignatureRef = useRef('')
  const torchSteppedTargetKeyRef = useRef('')
  const assetsRef = useRef<Assets>(emptyAssets())
  const nextIdRef = useRef(0)
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const earFsrsRef = useRef<Record<string, NoteMemory>>({})
  const masteryProgressRef = useRef<MasteryProgress>({})
  const levelProgressRef = useRef<PitchforksLevelProgress>(createPitchforksLevelProgress(1))
  const levelAdmissionOfferedRef = useRef(false)
  const cueSupportProfileRef = useRef<CueSupportProfile>(EMPTY_CUE_SUPPORT_PROFILE)
  const presentationJourneyRef = useRef<PitchforksPresentationJourney | null>(null)
  const selectedWorldRef = useRef<PitchforksNormalWorld>('dungeon')
  const [journeySaveStatus, setJourneySaveStatus] = useState<'idle' | 'not-confirmed'>('idle')
  const masterySavePendingLanesRef = useRef<Set<PitchforksInputMode>>(new Set())
  const [masterySaveStatus, setMasterySaveStatus] = useState<'idle' | 'not-confirmed'>('idle')
  const cueSupportByTargetRef = useRef<Map<string, CueSupportLevel>>(new Map())
  const presentationVisitCountByTargetRef = useRef<Map<string, number>>(new Map())
  const villageReturnQueueRef = useRef(createVillageReturnQueue('village-return:0'))
  const villageReturnOffersRef = useRef(new Map<string, VillageReturnOffer>())
  const villageReturnContextPlayedRef = useRef(new Set<string>())
  const completedVillageEncounterCountRef = useRef(0)
  const hintedTargetKeysRef = useRef<Set<string>>(new Set())
  const waveNotesHeardRef = useRef<Set<string>>(new Set())
  const waveNotesSungRef = useRef<Set<string>>(new Set())
  const waveStartedAtRef = useRef<number>(0)
  const masterySessionIdRef = useRef('')
  const unlockedNotesRef = useRef<string[]>([...STARTING_NOTES])
  const presentationOrderRef = useRef<string[]>([...INTRO_ORDER])
  const rangeProfileRef = useRef<PitchforksRangeProfile | null>(null)
  const rangeHeldMsRef = useRef(0)
  const rangeLastSampleAtRef = useRef(0)
  const runGenerationRef = useRef(0)
  const nextWaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debugReviewSequenceRef = useRef(0)
  const closeSmashProofRef = useRef(false)
  const fsrsDebugRef = useRef(false)
  const artReviewRef = useRef(false)
  const artReviewBodyRef = useRef<ArtReviewBodyState>('walk')
  const artReviewStormRef = useRef<ArtReviewStormState>('dormant')
  const promptStartedAtRef = useRef(0)
  const activePromptKeyRef = useRef('')
  const pendingMusicalPromptRef = useRef<PitchforksMusicalPromptTarget | null>(null)
  const failureGradedKeysRef = useRef<Set<string>>(new Set())
  const newNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteMasteredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteMasteredRef = useRef<string | null>(null)
  const noteMasteredStartedAtRef = useRef(0)
  const waveReceiptRef = useRef<WaveReceiptState>(EMPTY_WAVE_RECEIPT)
  const waveReceiptSequenceRef = useRef(0)
  const victoryCancelledReceiptIdRef = useRef<string | null>(null)
  const ceremonyToneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ceremonyRef = useRef<NewNoteCeremonyState>({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  const deferredAdmissionNotesRef = useRef<Set<string>>(new Set())
  const admissionHeldMsRef = useRef(0)
  const admissionLastSampleAtRef = useRef(0)
  const pianoSamplesReadyRef = useRef(false)
  const [pianoSamplesReady, setPianoSamplesReady] = useState(false)
  const lockHeldMsRef = useRef(0)
  const lockGenerationRef = useRef<PitchforksSongcraftGenerationState>({ lastGeneration: null, generationObserved: false, generationObservedAt: 0 })
  const lockProgressRef = useRef(0)
  const activeKeyRef = useRef('')
  const tintRef = useRef<string | null>(null)
  const closeSmashStateRef = useRef<PitchforksCloseSmashState>(createPitchforksCloseSmashState())
  const closeSmashRequestRef = useRef<CloseSmashRequest | null>(null)
  const closeSmashFallbackDueAtRef = useRef(0)
  const closeSmashSettleDueAtRef = useRef(0)
  const closeSmashRecoilUntilRef = useRef<Map<number, number>>(new Map())
  const closeSmashReonsetNoteRef = useRef<string | null>(null)
  const closeSmashReonsetStartedAtRef = useRef(0)
  const thunderheadStateRef = useRef<PitchforksThunderheadState>(createPitchforksThunderheadState())
  const thunderheadArmRequestedRef = useRef(false)
  const thunderheadReleaseRequestedRef = useRef(false)
  const thunderheadSequenceRef = useRef(0)
  const thunderheadLastTransitionReasonRef = useRef<PitchforksThunderheadTransitionReason | null>(null)
  const thunderheadClockMsRef = useRef(0)
  const thunderheadTravelStartedAtRef = useRef(0)
  const thunderheadTravelStartRef = useRef<ThunderheadPoint | null>(null)
  const thunderheadTravelTargetRef = useRef<ThunderheadPoint | null>(null)
  const thunderheadMatchDueAtRef = useRef(0)
  const thunderheadStrikeOriginRef = useRef<ThunderheadPoint | null>(null)
  const galvanicStateRef = useRef<PitchforksGalvanicState>(createPitchforksGalvanicState('galvanic:initial'))
  const galvanicBanksRef = useRef<PitchforksGalvanicLock[]>([])
  const galvanicArmRequestedRef = useRef(false)
  const galvanicReleaseRequestedRef = useRef(false)
  const galvanicAwaitingSilenceRef = useRef(false)
  const galvanicArmedTargetKeyRef = useRef('')
  const galvanicSequenceRef = useRef(0)
  const galvanicAttackSequenceRef = useRef(0)
  const galvanicLastOutcomesRef = useRef<PitchforksGalvanicOutcome[]>([])
  const galvanicLastReasonRef = useRef<PitchforksGalvanicPlanReason | string | null>(null)
  const galvanicRecoilVillagerIdsRef = useRef<Set<number>>(new Set())
  const galvanicProofRef = useRef(false)
  const bellWaveStateRef = useRef<PitchforksBellWaveState>(createPitchforksBellWaveState())
  const bellWaveClockMsRef = useRef(0)
  const bellWaveProjectionRef = useRef<PitchforksBellWaveProjection>(projectPitchforksBellWave(createPitchforksBellWaveState(), 0))
  const bellArmRequestedRef = useRef(false)
  const bellArmedTargetKeyRef = useRef('')
  const bellReleaseRequestedRef = useRef(false)
  const bellChargeSequenceRef = useRef(0)
  const bellChargeReceiptRef = useRef<BellChargeReceipt | null>(null)
  const bellReleaseStableIDsRef = useRef<Set<string>>(new Set())
  const bellKnockbackRef = useRef<Map<number, BellKnockback>>(new Map())
  const bellRecoilUntilRef = useRef<Map<number, number>>(new Map())
  // The shared matching-suppression window is intentionally broader than the
  // Bell's own ring. Keep a separate wall-clock marker so only that ring's
  // 1200 ms tone plus the existing echo tail can bypass matching suppression.
  const bellOwnRingSuppressionUntilRef = useRef(0)
  // Debug only: count accepted releases whose audible SFX branch was
  // scheduled. Muted physical waves stay mechanic-only and do not increment;
  // the prior receipt below guards duplicate side effects without replacing
  // the pure lifecycle's consumed-receipt ledger.
  const bellRingCountRef = useRef(0)
  // Last receipt whose audible ring side effects were scheduled. A muted
  // release intentionally leaves this value unchanged.
  const bellLastRingReceiptIdRef = useRef<string | null>(null)
  const bellLastReasonRef = useRef<string | null>(null)
  const bellUiSignatureRef = useRef('')
  const bellProofRef = useRef(false)
  const bellPowerStateRef = useRef<PitchforksBellPowerState | null>(null)
  // Normal Village activation is a separate run-local input lane. It shares
  // the existing detector generation/health gate, but never borrows a
  // villager target or the ordinary tine-resolution authority.
  const bellActivationNoteRef = useRef<string | null>(null)
  const bellActivationEventSequenceRef = useRef(0)
  const demoRef = useRef(false)
  const demoPitchRef = useRef<PitchInfo | null>(null)
  const demoTargetRef = useRef('')
  const demoTargetStartedRef = useRef(0)
  const demoLockCountRef = useRef(0)
  const demoStepRef = useRef('idle')
  const silenceFreezeObservedRef = useRef(false)
  const resetCountRef = useRef(0)
  const lastResetReasonRef = useRef<Pf3ResetReason>(null)
  const burnedTinesRef = useRef(0)
  const ashCountRef = useRef(0)
  const lastAshAtRef = useRef(0)
  const lastStrikeNoteRef = useRef<string | null>(null)
  const lastStrikeHueRef = useRef<number | null>(null)
  const lastKillNoteRef = useRef<string | null>(null)
  const lastKillHueRef = useRef<number | null>(null)
  const shakeStartedAtRef = useRef<number>(0)
  // Event-only mascot flash; future blind lanes should keep it on the resolved game event.
  const frankReactionKindRef = useRef<FrankReactionKind | null>(null)
  const frankReactionStartedAtRef = useRef(0)
  const roarFiredCountRef = useRef(0)
  const fullSequenceCompleteRef = useRef(false)
  const phaseRef = useRef<Phase>('menu')
  const cueVolumeRef = useRef(100)
  const microphoneGainRef = useRef(100)
  const sfxVolumeRef = useRef(100)
  const noteNamesRef = useRef(true)
  const audioCueRef = useRef(true)
  const staffNotationRef = useRef(false)
  const synesthesiaRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const currentPromptRef = useRef('')
  const promptMismatchWarnedRef = useRef('')
  const layoutModeRef = useRef<LayoutMode>('stage')
  const cueTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const firstMinuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cuePlayingUntilRef = useRef(0)
  const matchingSuppressedUntilRef = useRef(0)
  const timersPausedRef = useRef(false)
  const firstLockGraceRef = useRef(false)
  const inputModeRef = useRef<PitchforksInputMode>('voice')
  const buttonTrialRef = useRef<PitchforksButtonTrial | null>(null)
  const buttonAnswerPendingRef = useRef(false)
  const isListeningRef = useRef(false)
  const micErrorRef = useRef<string | null>(null)
  const heardYouRef = useRef(false)
  const roomNoiseSamplesRef = useRef<number[]>([])
  const roomCheckStartedAtRef = useRef(0)
  const voiceCheckStartedAtRef = useRef(0)
  const pitchTrailRef = useRef<TrailPoint[]>([])
  const barDotDeviationRef = useRef<number | null>(null)
  const smoothDevRef = useRef(0)
  const tunerTargetKeyRef = useRef('')
  const tunerNeedsRebaseRef = useRef(false)
  const tunerFeedbackKeyRef = useRef('')
  const tunerDropoutFramesRef = useRef(0)
  const tunerPitchGenerationRef = useRef(0)
  const tunerPitchGenerationAtRef = useRef(0)
  const tunerPitchGenerationObservedRef = useRef(false)
  const barOnTargetRef = useRef(false)
  const barVisibleRef = useRef(false)
  const activeVillagerIdRef = useRef<number | null>(null)
  const lockWhileSuppressedRef = useRef(false)
  const micHudStateRef = useRef<MicHudState>('waiting')
  const viewStateRef = useRef<ViewState | null>(null)
  const lightningPhaseTraceRef = useRef<LightningPhaseTransition[]>([])
  const activeCueContextRef = useRef<ActiveCueContext>({ support: 'guided', noteCount: 1 })
  const sparkGuideRef = useRef(createPitchforksSparkGuideState())
  const sparkGuideStatusRef = useRef<PitchforksSparkGuideStatus>('idle')
  const sparkGuideEventsRef = useRef<SparkGuideEvent[]>([])
  const firstMinuteCoachRef = useRef<FirstMinuteCoachState>({ beat: 'threat', note: null })
  const firstMinuteBeatStartedAtRef = useRef(0)
  const rangeHeadingRef = useRef<HTMLHeadingElement>(null)
  const admissionDialogRef = useRef<HTMLDialogElement>(null)
  const admissionDialogPanelRef = useRef<HTMLElement>(null)
  const admissionReturnFocusRef = useRef<HTMLElement | null>(null)
  const journeyResetDialogRef = useRef<HTMLDialogElement>(null)
  const journeyResetButtonRef = useRef<HTMLButtonElement>(null)
  const journeyResetCancelRef = useRef<HTMLButtonElement>(null)
  const journeyResetStatusRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>('menu')
  const [paused, setPaused] = useState(false)
  const [closeSmashGuideOpen, setCloseSmashGuideOpen] = useState(false)
  const closeSmashGuidePausedBeforeOpenRef = useRef(false)
  const [villageLessonOpen, setVillageLessonOpen] = useState(false)
  const [bellLessonOpen, setBellLessonOpen] = useState(false)
  const lessonPausedBeforeOpenRef = useRef(false)
  const [assetsReady, setAssetsReady] = useState(false)
  const [selectedWorld, setSelectedWorld] = useState<PitchforksNormalWorld>('dungeon')
  const [villageGateAssetStatus, setVillageGateAssetStatus] = useState<VillageGateAssetStatus>('loading')
  const [assetError, setAssetError] = useState<string | null>(null)
  const [hud, setHud] = useState<HudState>({ wave: 1, health: STARTING_HEALTH, score: 0, streak: 0 })
  const [rainState, setRainState] = useState<RainState>(() => createRainState())
  const [levelProgress, setLevelProgress] = useState<PitchforksLevelProgress>(() => createPitchforksLevelProgress(1))
  const [noteNamesOn, setNoteNamesOnState] = useState(true)
  const [audioCueOn, setAudioCueOnState] = useState(true)
  const [staffNotationOn, setStaffNotationOn] = useState(false)
  const [synesthesiaOn, setSynesthesiaOn] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [cueVolume, setCueVolume] = useState(100)
  const [microphoneGain, setMicrophoneGain] = useState(100)
  const [sfxVolume, setSfxVolume] = useState(100)
  const [demoMode, setDemoMode] = useState(false)
  const [fsrsDebugMode, setFsrsDebugMode] = useState(false)
  const [artReviewMode, setArtReviewMode] = useState(false)
  const [artReviewBody, setArtReviewBody] = useState<ArtReviewBodyState>('walk')
  const [artReviewStorm, setArtReviewStorm] = useState<ArtReviewStormState>('dormant')
  const [geometryDebug, setGeometryDebug] = useState(false)
  const [composerSeedProofEnabled, setComposerSeedProofEnabled] = useState(false)
  const [composerSeedProofStatus, setComposerSeedProofStatus] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle')
  const [composerSeedProof, setComposerSeedProof] = useState<HashedSongOption | null>(null)
  const [inputMode, setInputMode] = useState<PitchforksInputMode>('voice')
  const [buttonFeedback, setButtonFeedback] = useState<ButtonFeedback>({
    kind: 'listen',
    text: 'LISTEN, THEN CHOOSE THE NOTE',
  })
  const [closeSmashState, setCloseSmashState] = useState<PitchforksCloseSmashState>(() => createPitchforksCloseSmashState())
  const [thunderheadState, setThunderheadState] = useState<PitchforksThunderheadState>(() => createPitchforksThunderheadState())
  const [bellWaveState, setBellWaveState] = useState<PitchforksBellWaveState>(() => createPitchforksBellWaveState())
  const [bellWaveProjection, setBellWaveProjection] = useState<PitchforksBellWaveProjection>(() => projectPitchforksBellWave(createPitchforksBellWaveState(), 0))
  const [bellPowerState, setBellPowerState] = useState<PitchforksBellPowerState | null>(null)
  const [galvanicProjection, setGalvanicProjection] = useState<GalvanicDebugProjection>(() => buildGalvanicDebugProjection(
    false,
    createPitchforksGalvanicState('galvanic:initial'),
    [],
    false,
    false,
    [],
    null,
  ))
  const [unlockedNotes, setUnlockedNotes] = useState<string[]>([...STARTING_NOTES])
  const [presentationJourney, setPresentationJourney] = useState<PitchforksPresentationJourney | null>(null)
  const [rangeProfile, setRangeProfile] = useState<PitchforksRangeProfile | null>(null)
  const [tunerFeedback, setTunerFeedback] = useState<PitchforksTunerFeedback>(() => pitchforksTunerFeedback({
    targetNote: null,
    sourceNote: null,
    deviationSemis: null,
    matchingSuppressed: false,
    lockProgress: 0,
    toleranceSemis: MATCH_TOLERANCE_CENTS / 100,
  }))
  const [activeCueContext, setActiveCueContext] = useState<ActiveCueContext>({ support: 'guided', noteCount: 1 })
  const [sparkGuideStatus, setSparkGuideStatus] = useState<PitchforksSparkGuideStatus>('idle')
  const [firstMinuteCoach, setFirstMinuteCoach] = useState<FirstMinuteCoachState>({ beat: 'threat', note: null })
  const [rangeIntent, setRangeIntent] = useState<RangeIntent>('guided')
  const [rangeStep, setRangeStep] = useState<RangeAssessmentStep>('anchor')
  const [rangeCandidate, setRangeCandidate] = useState<string | null>(null)
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null)
  const [rangeLow, setRangeLow] = useState<string | null>(null)
  const [rangeHigh, setRangeHigh] = useState<string | null>(null)
  const [rangeMatched, setRangeMatched] = useState(false)
  const [rangeMatchProgress, setRangeMatchProgress] = useState(0)
  const [rangeCuePlayed, setRangeCuePlayed] = useState(false)
  const [rangeAssessmentError, setRangeAssessmentError] = useState<string | null>(null)
  const [pendingRangeProfile, setPendingRangeProfile] = useState<PitchforksRangeProfile | null>(null)
  const pendingPracticeWorldRef = useRef<PitchforksPracticeWorld | null>(null)
  const [manualLowNote, setManualLowNote] = useState('C4')
  const [manualHighNote, setManualHighNote] = useState('G4')
  const [journeyResetConfirm, setJourneyResetConfirm] = useState(false)
  const [journeyResetStatus, setJourneyResetStatus] = useState<string | null>(null)
  const [newNoteUnlocked, setNewNoteUnlocked] = useState<string | null>(null)
  const [noteMastered, setNoteMastered] = useState<string | null>(null)
  const [waveReceipt, setWaveReceipt] = useState<WaveReceiptState>(EMPTY_WAVE_RECEIPT)
  const [ceremony, setCeremony] = useState<NewNoteCeremonyState>({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  const [admissionCuePlayed, setAdmissionCuePlayed] = useState(false)
  const [admissionMatched, setAdmissionMatched] = useState(false)
  const [admissionMatchProgress, setAdmissionMatchProgress] = useState(0)
  const [micHudState, setMicHudState] = useState<MicHudState>('waiting')
  const [heardYou, setHeardYou] = useState(false)
  const [micCheckStep, setMicCheckStep] = useState<MicCheckStep>('room')
  const [roomReadiness, setRoomReadiness] = useState<PitchforksRoomReadiness>('checking-room')
  const [micReadiness, setMicReadiness] = useState<PitchforksMicReadiness>('checking-room')
  const [canvasDisplaySize, setCanvasDisplaySize] = useState(() => ({ width: W, height: H }))
  const [portraitStaffDisplaySize, setPortraitStaffDisplaySize] = useState(() => ({ width: STAFF_PANEL_W, height: STAFF_PANEL_H }))
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('stage')
  const [portraitDockPanel, setPortraitDockPanel] = useState<PortraitDockPanel>(null)
  const [viewportGeometry, setViewportGeometry] = useState(() => ({
    width: 0,
    height: 0,
    dpr: 1,
    visualScale: 1,
    containerWidth: 0,
    containerHeight: 0,
  }))

  const {
    isListening,
    pitch,
    pitchRef,
    signalDbRef,
    micSourceHealthRef,
    pitchGenerationRef,
    startListening: startMicrophoneRaw,
    stopListening: stopMicrophoneRaw,
    error: micError,
  } = usePitchDetection({
    profile: PITCHFORKS_PITCH_PROFILE,
    audioConstraints: PITCHFORKS_AUDIO_CONSTRAINTS,
    observationGainPct: microphoneGain,
  })

  const microphoneOwnerRef = useRef<PitchforksMicrophoneOwner | null>(null)
  if (!microphoneOwnerRef.current) {
    microphoneOwnerRef.current = createPitchforksMicrophoneOwner({
      start: startMicrophoneRaw,
      stop: stopMicrophoneRaw,
      isLive: () => micSourceHealthRef.current.trackReadyState === 'live',
    })
  }
  const startListening = useCallback(() => microphoneOwnerRef.current!.start(), [])
  const stopListening = useCallback(() => microphoneOwnerRef.current!.stop(), [])

  useEffect(() => {
    noteNamesRef.current = noteNamesOn
  }, [noteNamesOn])

  useEffect(() => {
    audioCueRef.current = audioCueOn
  }, [audioCueOn])

  const updatePitchforksSettings = useCallback((patch: Partial<PitchforksSettingsSnapshot>) => {
    const settings = normalizePitchforksSettings({
      noteNames: noteNamesRef.current,
      referenceAudio: audioCueRef.current,
      referenceGainPct: cueVolumeRef.current,
      microphoneGainPct: microphoneGainRef.current,
      ...patch,
    })
    noteNamesRef.current = settings.noteNames
    audioCueRef.current = settings.referenceAudio
    cueVolumeRef.current = settings.referenceGainPct
    microphoneGainRef.current = settings.microphoneGainPct
    setNoteNamesOnState(settings.noteNames)
    setAudioCueOnState(settings.referenceAudio)
    setCueVolume(settings.referenceGainPct)
    setMicrophoneGain(settings.microphoneGainPct)
    try { savePitchforksSettings(localStorage, settings) } catch {}
  }, [])

  const setNoteNamesPreference = useCallback((value: boolean) => {
    updatePitchforksSettings({ noteNames: value })
  }, [updatePitchforksSettings])

  const setReferenceAudioPreference = useCallback((value: boolean) => {
    updatePitchforksSettings({ referenceAudio: value })
  }, [updatePitchforksSettings])

  const setReferenceGainPreference = useCallback((value: number) => {
    updatePitchforksSettings({ referenceGainPct: value })
  }, [updatePitchforksSettings])

  const setMicrophoneGainPreference = useCallback((value: number) => {
    updatePitchforksSettings({ microphoneGainPct: value })
  }, [updatePitchforksSettings])

  useEffect(() => {
    staffNotationRef.current = staffNotationOn
  }, [staffNotationOn])

  useEffect(() => {
    synesthesiaRef.current = synesthesiaOn
  }, [synesthesiaOn])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  useEffect(() => {
    cueVolumeRef.current = cueVolume
    setPianoVolume(cueVolume)
  }, [cueVolume])

  useEffect(() => {
    microphoneGainRef.current = microphoneGain
  }, [microphoneGain])

  useEffect(() => {
    sfxVolumeRef.current = sfxVolume
  }, [sfxVolume])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    micErrorRef.current = micError
  }, [micError])

  useEffect(() => {
    if (phase !== 'calibrating' || !isListening) return
    const now = performance.now()

    if (micCheckStep === 'room') {
      const sample = signalDbRef.current
      if (Number.isFinite(sample)) roomNoiseSamplesRef.current.push(sample)
      if (now - roomCheckStartedAtRef.current < PITCHFORKS_ROOM_CHECK_MS) return

      const room = assessPitchforksRoom(
        roomNoiseSamplesRef.current,
        PITCHFORKS_PITCH_PROFILE.noiseGateDb,
      )
      if (room.status === 'checking-room') return
      setRoomReadiness(room.status)
      setMicReadiness(room.status)
      voiceCheckStartedAtRef.current = now
      setMicCheckStep('voice')
      return
    }

    if (micCheckStep !== 'voice') return
    const next = coachPitchforksVoice({
      room: roomReadiness,
      voiceHeard: !!pitch?.isActive,
      elapsedMs: now - voiceCheckStartedAtRef.current,
    })
    setMicReadiness(next)
    if (next !== 'ready' || heardYouRef.current) return
    heardYouRef.current = true
    setHeardYou(true)
    setMicCheckStep('ready')
  }, [isListening, micCheckStep, phase, pitch, roomReadiness, signalDbRef])

  useLayoutEffect(() => {
    const syncLayoutMode = () => {
      const nextLayoutMode = layoutModeForViewport(window.innerWidth, window.innerHeight)
      layoutModeRef.current = nextLayoutMode
      setLayoutMode(nextLayoutMode)
    }

    syncLayoutMode()
    window.addEventListener('resize', syncLayoutMode)
    return () => window.removeEventListener('resize', syncLayoutMode)
  }, [])

  useLayoutEffect(() => {
    if (phase !== 'playing') return
    const container = canvasContainerRef.current
    if (!container) return

    const gameAspect = W / H
    const updateCanvasDisplaySize = () => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect()
      if (containerWidth <= 0 || containerHeight <= 0) return

      const nextViewportGeometry = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        visualScale: window.visualViewport?.scale ?? 1,
        containerWidth,
        containerHeight,
      }
      setViewportGeometry((prev) => (
        Math.abs(prev.width - nextViewportGeometry.width) < 0.01 &&
        Math.abs(prev.height - nextViewportGeometry.height) < 0.01 &&
        Math.abs(prev.dpr - nextViewportGeometry.dpr) < 0.01 &&
        Math.abs(prev.visualScale - nextViewportGeometry.visualScale) < 0.01 &&
        Math.abs(prev.containerWidth - nextViewportGeometry.containerWidth) < 0.01 &&
        Math.abs(prev.containerHeight - nextViewportGeometry.containerHeight) < 0.01
      ) ? prev : nextViewportGeometry)

      const nextLayoutMode = layoutModeForViewport(window.innerWidth, window.innerHeight)

      const availableWidth = Math.min(containerWidth, MAX_CANVAS_DISPLAY_W)
      const availableHeight = Math.min(containerHeight, MAX_CANVAS_DISPLAY_H)
      const containerAspect = availableWidth / availableHeight
      const nextSize = containerAspect > gameAspect
        ? { height: availableHeight, width: availableHeight * gameAspect }
        : { width: availableWidth, height: availableWidth / gameAspect }

      setCanvasDisplaySize((prev) => {
        if (Math.abs(prev.width - nextSize.width) < 0.5 && Math.abs(prev.height - nextSize.height) < 0.5) return prev
        return nextSize
      })

      if (nextLayoutMode === 'portrait') {
        const nextStaffWidth = Math.max(0, Math.min(containerWidth - 32, 360))
        const nextStaffSize = { width: nextStaffWidth, height: nextStaffWidth * (STAFF_PANEL_H / STAFF_PANEL_W) }
        setPortraitStaffDisplaySize((prev) => {
          if (Math.abs(prev.width - nextStaffSize.width) < 0.5 && Math.abs(prev.height - nextStaffSize.height) < 0.5) return prev
          return nextStaffSize
        })
      }
    }

    updateCanvasDisplaySize()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateCanvasDisplaySize)
      observer.observe(container)
    }

    window.addEventListener('resize', updateCanvasDisplaySize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateCanvasDisplaySize)
    }
  }, [phase])

  const fsrsStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? FSRS_DEBUG_KEY : FSRS_VOICE_KEY
  }, [])

  const earFsrsStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? FSRS_EAR_DEBUG_KEY : FSRS_EAR_KEY
  }, [])

  const songcraftStorage = useMemo<PitchforksBossRecitalStorage>(() => {
    const keyFor = (lane: 'voice' | 'ear') => lane === 'voice' ? fsrsStorageKey() : earFsrsStorageKey()
    return {
      loadStore: lane => migrate(keyFor(lane), localStorage.getItem(keyFor(lane))),
      saveStore: (lane, store) => saveStore(keyFor(lane), store),
      readback: (lane, note) => {
        const durable = migrate(keyFor(lane), localStorage.getItem(keyFor(lane)))
        // Keep the returning battle on the same durable family history.
        if (lane === 'voice') fsrsRef.current = durable
        else earFsrsRef.current = durable
        return durable[note]
      },
    }
  }, [earFsrsStorageKey, fsrsStorageKey])

  const masteryStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? MASTERY_PROGRESS_DEBUG_KEY : MASTERY_PROGRESS_KEY
  }, [])

  const cueSupportStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? CUE_SUPPORT_DEBUG_KEY : CUE_SUPPORT_KEY
  }, [])

  const saveFsrs = useCallback((lane: PitchforksInputMode = 'voice') => {
    const key = lane === 'buttons' ? earFsrsStorageKey() : fsrsStorageKey()
    const store = lane === 'buttons' ? earFsrsRef.current : fsrsRef.current
    if (demoRef.current || fsrsDebugRef.current) {
      try { saveStore(key, store) } catch {}
      return
    }

    const result = persistPitchforksMasteryStore(
      () => localStorage,
      key,
      store,
      () => saveStore(key, store),
    )
    if (result.status === 'confirmed') masterySavePendingLanesRef.current.delete(lane)
    else masterySavePendingLanesRef.current.add(lane)
    setMasterySaveStatus(masterySavePendingLanesRef.current.size > 0 ? 'not-confirmed' : 'idle')
  }, [earFsrsStorageKey, fsrsStorageKey])

  const retryMasterySave = useCallback(() => {
    if (demoRef.current || fsrsDebugRef.current) return
    for (const lane of [...masterySavePendingLanesRef.current]) saveFsrs(lane)
  }, [saveFsrs])

  const chooseInputMode = useCallback((mode: PitchforksInputMode) => {
    inputModeRef.current = mode
    setInputMode(mode)
    try {
      localStorage.setItem(PITCHFORKS_INPUT_MODE_KEY, mode)
      const nextUrl = new URL(window.location.href)
      if (nextUrl.searchParams.has('input')) {
        nextUrl.searchParams.delete('input')
        window.history.replaceState(
          window.history.state,
          '',
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
        )
      }
    } catch {}
  }, [])

  const saveMasteryProgress = useCallback(() => {
    try {
      localStorage.setItem(masteryStorageKey(), JSON.stringify(masteryProgressRef.current))
    } catch {}
  }, [masteryStorageKey])

  const saveCueSupport = useCallback(() => {
    try {
      localStorage.setItem(cueSupportStorageKey(), JSON.stringify(cueSupportProfileRef.current))
    } catch {}
  }, [cueSupportStorageKey])

  const savePresentationJourney = useCallback((journey = presentationJourneyRef.current) => {
    if (!journey || demoRef.current || fsrsDebugRef.current) return
    try {
      // Resolve localStorage inside the guard: some privacy modes throw while
      // reading window.localStorage before setItem can even be attempted.
      const result = persistPitchforksPresentationJourney(() => localStorage, journey)
      if (result.status === 'confirmed') setJourneySaveStatus('idle')
      else if (result.status === 'not-confirmed') setJourneySaveStatus('not-confirmed')
    } catch {
      setJourneySaveStatus('not-confirmed')
    }
  }, [])

  const reconcileCampaignProgress = useCallback((journey = presentationJourneyRef.current) => {
    if (!journey || demoRef.current || fsrsDebugRef.current || bossSimulatingRef.current) return
    const rangeProfile = rangeProfileRef.current
    if (!rangeProfile) return

    const dungeonResult = advancePitchforksCampaignProgress({
      journey,
      rangeAssessedAt: rangeProfile.assessedAt,
      startedAt: journey.startedAt,
      demo: demoRef.current || fsrsDebugRef.current,
      simulated: bossSimulatingRef.current,
      voiceMemory: fsrsRef.current,
      masteryRecords: masteryProgressRef.current,
      nowMs: Date.now(),
    })
    const villageResult = advancePitchforksVillageProgress({
      journey: dungeonResult.journey, rangeAssessedAt: rangeProfile.assessedAt,
      startedAt: journey.startedAt, demo: false, simulated: false,
      normalVoice: inputModeRef.current === 'voice', comfortableRange: rangeProfile,
      voiceMemory: fsrsRef.current, masteryRecords: masteryProgressRef.current, nowMs: Date.now(),
    })
    const result = villageResult.changed ? villageResult : dungeonResult
    if (!result.changed) return

    // Keep the receipt live even when persistence is unavailable; the existing
    // retry action will write this same ref value later.
    presentationJourneyRef.current = result.journey
    setPresentationJourney(result.journey)
    savePresentationJourney(result.journey)
  }, [savePresentationJourney])

  const retryPresentationJourneySave = useCallback(() => {
    if (demoRef.current || fsrsDebugRef.current) return
    savePresentationJourney()
  }, [savePresentationJourney])

  const beginPresentationJourney = useCallback((
    profile: PitchforksRangeProfile,
    notes: readonly string[],
    guidedNotes: readonly string[] = notes,
  ) => {
    const journey = createPitchforksPresentationJourney({
      rangeAssessedAt: profile.assessedAt,
      unlockedNotes: notes,
      guidedNotes,
    })
    presentationJourneyRef.current = journey
    setPresentationJourney(journey)
    selectedWorldRef.current = 'dungeon'
    setSelectedWorld('dungeon')
    savePresentationJourney(journey)
  }, [savePresentationJourney])

  const savePresentationJourneyNotes = useCallback((notes: readonly string[]) => {
    const current = presentationJourneyRef.current
    if (!current) return
    const expanded = { ...current, unlockedNotes: [...notes] }
    const next = current.villageCurriculum && rangeProfileRef.current
      ? bindPitchforksVillageCurriculum(expanded, rangeProfileRef.current, Date.now()) : expanded
    presentationJourneyRef.current = next
    setPresentationJourney(next)
    savePresentationJourney(next)
  }, [savePresentationJourney])

  const completeJourneyGuidanceForNote = useCallback((note: string) => {
    const current = presentationJourneyRef.current
    if (!current?.guidedNotes.includes(note)) return
    const next = { ...current, guidedNotes: current.guidedNotes.filter(candidate => candidate !== note) }
    presentationJourneyRef.current = next
    setPresentationJourney(next)
    savePresentationJourney(next)
  }, [savePresentationJourney])

  const getMasterySessionId = useCallback(() => {
    if (!masterySessionIdRef.current) {
      masterySessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    return masterySessionIdRef.current
  }, [])

  const ensureNoteMemory = useCallback((note: string) => {
    if (!fsrsRef.current[note]) fsrsRef.current[note] = createNote(note)
    return fsrsRef.current[note]
  }, [])

  const ensureEarNoteMemory = useCallback((note: string) => {
    if (!earFsrsRef.current[note]) earFsrsRef.current[note] = createNote(note)
    return earFsrsRef.current[note]
  }, [])

  const activeFsrsStore = useCallback(() => (
    inputModeRef.current === 'buttons' ? earFsrsRef.current : fsrsRef.current
  ), [])

  const ensureActiveNoteMemory = useCallback((note: string) => (
    inputModeRef.current === 'buttons' ? ensureEarNoteMemory(note) : ensureNoteMemory(note)
  ), [ensureEarNoteMemory, ensureNoteMemory])

  const applyRangeProfile = useCallback((profile: PitchforksRangeProfile) => {
    const order = presentationOrderForRange(profile)
    const starterNotes = starterPairForRange(profile)
    rangeProfileRef.current = profile
    presentationOrderRef.current = order
    unlockedNotesRef.current = [...starterNotes]
    setRangeProfile(profile)
    setUnlockedNotes([...starterNotes])
    for (const note of starterNotes) {
      ensureNoteMemory(note)
      ensureEarNoteMemory(note)
    }
    try {
      localStorage.setItem(PITCHFORKS_RANGE_PROFILE_KEY, JSON.stringify(profile))
    } catch {}
    cueSupportProfileRef.current = { version: 1, notes: {} }
    saveCueSupport()
    beginPresentationJourney(profile, starterNotes)
  }, [beginPresentationJourney, ensureEarNoteMemory, ensureNoteMemory, saveCueSupport])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isArtReview = params.get('artReview') === '1'
    const isDemo = params.get('demo') === '1'
    artReviewRef.current = isArtReview
    if (isArtReview) {
      const initialBody = parseArtReviewBodyState(params.get('artReviewBody'))
      const initialStorm = parseArtReviewStormState(params.get('artReviewStorm'))
      artReviewBodyRef.current = initialBody
      artReviewStormRef.current = initialStorm
      setArtReviewMode(true)
      setArtReviewBody(initialBody)
      setArtReviewStorm(initialStorm)
      // This route is a private visual fixture. It deliberately exits before
      // any profile, mastery, journey, or input preference is read or written.
      demoRef.current = false
      fsrsDebugRef.current = false
      closeSmashProofRef.current = false
      galvanicProofRef.current = false
      bellProofRef.current = false
      inputModeRef.current = 'buttons'
      setDemoMode(false)
      setFsrsDebugMode(false)
      setInputMode('buttons')
      setGeometryDebug(false)
      return
    }
    closeSmashProofRef.current = isDemo && params.get('closeSmashProof') === '1'
    galvanicProofRef.current = isDemo && params.get('galvanicProof') === '1'
    bellProofRef.current = isDemo && params.get('worldProof') === 'bell-tower'
    const isFsrsDebug = params.get('fsrsDebug') === '1'
    const requestedInput = params.get('input')
    const storedInput = (() => {
      try { return localStorage.getItem(PITCHFORKS_INPUT_MODE_KEY) } catch { return null }
    })()
    const storedSettings = (() => {
      try { return loadPitchforksSettings(localStorage) }
      catch { return normalizePitchforksSettings(null) }
    })()
    // A saved choice always wins over the URL: otherwise re-opening the same
    // canonical link (bookmark, shared link, home-screen icon) with an old
    // ?input= value snaps a returning player back out of their chosen lane.
    const restoredInput = storedInput === 'buttons' || storedInput === 'voice'
      ? storedInput
      : requestedInput === 'buttons' || requestedInput === 'voice'
        ? requestedInput
        : parsePitchforksInputMode(storedInput)
    demoRef.current = isDemo
    fsrsDebugRef.current = isFsrsDebug
    inputModeRef.current = restoredInput
    noteNamesRef.current = storedSettings.noteNames
    audioCueRef.current = storedSettings.referenceAudio
    cueVolumeRef.current = storedSettings.referenceGainPct
    microphoneGainRef.current = storedSettings.microphoneGainPct
    setDemoMode(isDemo)
    setFsrsDebugMode(isFsrsDebug)
    setInputMode(restoredInput)
    setNoteNamesOnState(storedSettings.noteNames)
    setAudioCueOnState(storedSettings.referenceAudio)
    setCueVolume(storedSettings.referenceGainPct)
    setMicrophoneGain(storedSettings.microphoneGainPct)
    setGeometryDebug(params.get('geom') === '1')
    getMasterySessionId()

    try {
      fsrsRef.current = loadStore(isDemo || isFsrsDebug ? FSRS_DEBUG_KEY : FSRS_VOICE_KEY)
    } catch {
      fsrsRef.current = {}
    }
    try {
      earFsrsRef.current = loadStore(isDemo || isFsrsDebug ? FSRS_EAR_DEBUG_KEY : FSRS_EAR_KEY)
    } catch {
      earFsrsRef.current = {}
    }

    try {
      const rawMastery = localStorage.getItem(isDemo || isFsrsDebug ? MASTERY_PROGRESS_DEBUG_KEY : MASTERY_PROGRESS_KEY)
      if (rawMastery) {
        const parsed = JSON.parse(rawMastery)
        if (parsed && typeof parsed === 'object') masteryProgressRef.current = parsed as MasteryProgress
      }
    } catch { /* fresh mastery progress */ }

    try {
      cueSupportProfileRef.current = parseCueSupportProfile(
        localStorage.getItem(isDemo || isFsrsDebug ? CUE_SUPPORT_DEBUG_KEY : CUE_SUPPORT_KEY),
      )
    } catch {
      cueSupportProfileRef.current = { version: 1, notes: {} }
    }

    let storedRangeProfile: PitchforksRangeProfile | null = null
    if (!isDemo && !isFsrsDebug) {
      try {
        storedRangeProfile = parsePitchforksRangeProfile(localStorage.getItem(PITCHFORKS_RANGE_PROFILE_KEY))
      } catch { /* storage unavailable: require a fresh semantic setup */ }
    }
    if (storedRangeProfile) {
      rangeProfileRef.current = storedRangeProfile
      presentationOrderRef.current = presentationOrderForRange(storedRangeProfile)
      setRangeProfile(storedRangeProfile)
    }

    const order = storedRangeProfile ? presentationOrderRef.current : [...INTRO_ORDER]
    let restored: string[] = []
    if (storedRangeProfile) {
      let storedJourneyRaw: string | null = null
      try {
        storedJourneyRaw = localStorage.getItem(PITCHFORKS_PRESENTATION_JOURNEY_KEY)
      } catch { /* storage unavailable: migrate this session without persistence */ }
      const storedJourney = parsePitchforksPresentationJourney(
        storedJourneyRaw,
        storedRangeProfile.assessedAt,
        order,
      )
      if (storedJourney) {
        presentationJourneyRef.current = storedJourney
        setPresentationJourney(storedJourney)
        restored = [...storedJourney.unlockedNotes]
      } else {
        // One-time migration for players whose presentation unlocks were previously
        // reconstructed from FSRS. New resets persist independently from mastery.
        const reviewed = new Set(
          Object.entries(fsrsRef.current)
            .filter(([, memory]) => memory.lastReview > 0)
            .map(([note]) => note),
        )
        restored = order.slice(0, 2)
        for (const note of order.slice(2)) {
          if (reviewed.has(note)) restored.push(note)
          else break
        }
        const migratedJourney = createPitchforksPresentationJourney({
          rangeAssessedAt: storedRangeProfile.assessedAt,
          unlockedNotes: restored,
          guidedNotes: [],
        })
        presentationJourneyRef.current = migratedJourney
        setPresentationJourney(migratedJourney)
        savePresentationJourney(migratedJourney)
      }
    } else {
      const reviewed = new Set(
        Object.entries(fsrsRef.current)
          .filter(([, memory]) => memory.lastReview > 0)
          .map(([note]) => note),
      )
      for (const note of order) {
        if (reviewed.has(note)) restored.push(note)
        else break
      }
    }
    if (restored.length >= 2) {
      setUnlockedNotes(restored)
      unlockedNotesRef.current = restored
    }

    for (const note of unlockedNotesRef.current) {
      ensureNoteMemory(note)
      ensureEarNoteMemory(note)
    }
    reconcileCampaignProgress(presentationJourneyRef.current)
  }, [ensureEarNoteMemory, ensureNoteMemory, getMasterySessionId, reconcileCampaignProgress, savePresentationJourney])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('composerSeedProof') !== '1') return

    let cancelled = false
    setComposerSeedProofEnabled(true)
    setComposerSeedProofStatus('loading')
    void loadHashedComposedSongs().then(songs => {
      if (cancelled) return
      const firstSong = songs[0] ?? null
      setComposerSeedProof(firstSong)
      setComposerSeedProofStatus(firstSong ? 'ready' : 'empty')
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const a = assetsRef.current
        a.frankIdle = await loadImage(`${ASSET_BASE}/frankenstein_idle.png`)
        a.stormHeart = await loadImage(`${ASSET_BASE}/storm_heart_nano.png`).catch(() => undefined)
        // The same original Bell pixels serve the ordinary Village at rest and
        // the existing private proof. Keep this asset caller shared so the
        // normal route never renders an empty tower before activation.
        if (bellProofRef.current || (!demoRef.current && !fsrsDebugRef.current)) {
          a.bellSwing = await loadImage(`${ASSET_BASE}/bell_swing.png`).catch(() => undefined)
          a.bellBackdrop = await loadImage(`${ASSET_BASE}/bell_swing_backdrop.png`).catch(() => undefined)
        }
        a.gargoyleSpout = await loadImage(`${ASSET_BASE}/gargoyle_spout_idle.png`).catch(() => undefined)
        a.rainCloud = await loadImage(`${ASSET_BASE}/rain_cloud.png`).catch(() => undefined)
        if (!demoRef.current && !fsrsDebugRef.current) {
          a.villageGatePlate = await loadImage(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC).catch(() => undefined)
          if (!cancelled) setVillageGateAssetStatus(a.villageGatePlate ? 'ready' : 'missing')
        }
        a.bellTowerPlate = await loadImage(`${ASSET_BASE}/bell_tower_plate.png`).catch(() => undefined)
        a.cathedralPlate = await loadImage(`${ASSET_BASE}/cathedral_plate.png`).catch(() => undefined)
        a.bellringerChamberPlate = await loadImage(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC).catch(() => undefined)
        a.bellringerRest = await loadImage(PITCHFORKS_BELLRINGER_REST_SRC).catch(() => undefined)
        a.torchmasterChamberPlate = await loadImage(`${ASSET_BASE}/torchmaster_chamber_plate.png`).catch(() => undefined)
        const artProof = new URLSearchParams(window.location.search)
        if (artProof.get('demo') === '1') {
          a.torchmasterChamberPlate = await loadImage(`${ASSET_BASE}/torchmaster_chamber_plate.png`).catch(() => undefined)
          // Bellringer art stays inside the existing demo-only asset lane. The
          // fixed Village Gate plate is independent of worldProof so a wrong
          // proof query can never substitute another world's backdrop.
          a.bellringerChamberPlate = await loadImage(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC).catch(() => undefined)
          a.bellringerRest = await loadImage(PITCHFORKS_BELLRINGER_REST_SRC).catch(() => undefined)
        }
        const privatePlateAsset = selectPitchforksPrivatePlateAsset(artProof)
        if (privatePlateAsset) {
          a.privatePlate = await loadImage(`${ASSET_BASE}/${privatePlateAsset}`).catch(() => undefined)
        }
        // These are the two accepted, original staged-victory sprites. A
        // missing optional pose must never fabricate a new asset or block the
        // rest of the game; the claim snapshots exactly what was available.
        a.frankVictoryNeutral = await loadImage(`${ASSET_BASE}/frankenstein_victory_neutral.png`).catch(() => undefined)
        a.frankVictoryEyeLift = await loadImage(`${ASSET_BASE}/frankenstein_victory_eye_lift.png`).catch(() => undefined)
        // An optional pose must never prevent the game from loading.
        a.frankCharge = await loadImage(`${ASSET_BASE}/frankenstein_conductor_coil.png`).catch(() => undefined)
        // Contact art is optional during a private rollout; idle remains the
        // truthful non-blank fallback when the byte-copied strip is unavailable.
        a.frankCloseSmash = await loadImage(`${ASSET_BASE}/frankenstein_close_smash.png`).catch(() => undefined)
        try {
          const frank = await fetch(`${ASSET_BASE}/frankenstein.json`)
          if (frank.ok) a.frankMeta = await frank.json()
        } catch {}
        try {
          const forks = await fetch(`${ASSET_BASE}/forks.json`)
          if (forks.ok) {
            const parsed = await forks.json()
            a.forkMeta = {
              1: a.forkMeta[1],
              2: parsed['2tine'] ?? defaultForkMeta,
              3: parsed['3tine'] ?? defaultForkMeta,
              4: parsed['4tine'] ?? defaultForkMeta,
            }
          }
        } catch {}

        const oneTineForkMeta = await fetch(`${ASSET_BASE}/fork_1tine.json`)
        if (!oneTineForkMeta.ok) throw new Error('Single-tine fork metadata failed to load')
        a.forkMeta[1] = await oneTineForkMeta.json()

        for (const n of [1, 2, 3, 4] as const) {
          a.walkLeft[n] = await loadImage(`${ASSET_BASE}/villager_${n}tine_walk_left.png`)
          a.ashLeft[n] = await loadImage(`${ASSET_BASE}/villager_${n}tine_ash_left.png`)
          for (let k = 1; k < n; k++) {
            a.burnedLeft[`${n}_${k}`] = await loadImage(`${ASSET_BASE}/villager_${n}tine_burned_${k}_left.png`)
          }
          for (let b = 0; b <= n; b++) {
            a.fork[`${n}_${b}`] = await loadImage(`${ASSET_BASE}/fork_${n}tine_b${b}.png`)
            a.forkGlow[`${n}_${b}`] = await loadImage(`${ASSET_BASE}/fork_${n}tine_b${b}_glow.png`)
          }
          try {
            const meta = await fetch(`${ASSET_BASE}/villager_${n}tine.json`)
            if (meta.ok) a.villagerMeta[n] = await meta.json()
            else if (n === 1) throw new Error('Single-tine villager metadata failed to load')
          } catch (error) {
            if (n === 1) throw error
          }
        }
        if (!cancelled) setAssetsReady(true)
      } catch (err) {
        if (!cancelled) setAssetError(err instanceof Error ? err.message : 'Sprite load failed')
      }
    })()
    loadPianoSamples()
      .then(() => {
        pianoSamplesReadyRef.current = true
        if (!cancelled) setPianoSamplesReady(true)
      })
      .catch(() => {
        pianoSamplesReadyRef.current = false
        if (!cancelled) setPianoSamplesReady(false)
      })
    return () => { cancelled = true }
  }, [])

  const retryVillageGateAsset = useCallback(() => {
    if (demoRef.current || fsrsDebugRef.current) return
    setVillageGateAssetStatus('loading')
    void loadImage(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC)
      .then(image => {
        assetsRef.current.villageGatePlate = image
        setVillageGateAssetStatus('ready')
      })
      .catch(() => {
        assetsRef.current.villageGatePlate = undefined
        if (selectedWorldRef.current === 'village-gate') {
          selectedWorldRef.current = 'dungeon'
          setSelectedWorld('dungeon')
        }
        setVillageGateAssetStatus('missing')
      })
  }, [])

  const resetNormalBellPowerForRun = useCallback((eligible: boolean) => {
    const admittedNotes = distinctPitchforksAdmittedNotes([...unlockedNotesRef.current])
      .filter(note => pitchforksBellNoteMidi(note) !== null)
    const taughtPair = eligible ? selectPitchforksBellTaughtPair(admittedNotes) : null
    const next = taughtPair
      ? createPitchforksBellPowerState({
          runId: `bell-power:${runGenerationRef.current}`,
          requiredResponses: 3,
          admittedNotes,
          taughtPair,
        })
      : null
    bellPowerStateRef.current = next
    bellActivationNoteRef.current = null
    bellActivationEventSequenceRef.current = 0
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    setBellPowerState(next)
    return next
  }, [])

  const selectNormalWorld = useCallback((world: PitchforksNormalWorld) => {
    const journey = presentationJourneyRef.current
    if (world !== 'dungeon' && (demoRef.current || fsrsDebugRef.current || !journey
      || !isWorldUnlocked(world, projectPitchforksWorldGates(journey)))) return
    if (world === 'village-gate' && !assetsRef.current.villageGatePlate) return
    if (world === 'bell-tower' && !assetsRef.current.bellTowerPlate) return
    if (world === 'cathedral' && !assetsRef.current.cathedralPlate) return
    if (world === 'village-gate' && journey && rangeProfileRef.current) {
      const bound = bindPitchforksVillageCurriculum(journey, rangeProfileRef.current, Date.now())
      if (bound !== journey) {
        presentationJourneyRef.current = bound
        setPresentationJourney(bound)
        savePresentationJourney(bound)
      }
      reconcileCampaignProgress(bound)
    }
    if (world !== 'village-gate') resetNormalBellPowerForRun(false)
    selectedWorldRef.current = world
    setSelectedWorld(world)
  }, [resetNormalBellPowerForRun, savePresentationJourney, reconcileCampaignProgress])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') return
      // RAF can stop while hidden, so invalidate vocal proof at the event itself.
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
      const claim = waveReceiptRef.current.claim
      if (claim) victoryCancelledReceiptIdRef.current = claim.receiptId
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const commitCloseSmashState = useCallback((next: PitchforksCloseSmashState) => {
    // The helper is immutable, but the ref replacement is the runtime's
    // compare-and-swap boundary. Replace it before any strike/audio/VFX side
    // effect so a queued tap and fallback cannot both consume one receipt.
    closeSmashStateRef.current = next
    setCloseSmashState(next)
  }, [])

  const resetCloseSmash = useCallback(() => {
    const next = createPitchforksCloseSmashState()
    closeSmashStateRef.current = next
    closeSmashRequestRef.current = null
    closeSmashFallbackDueAtRef.current = 0
    closeSmashSettleDueAtRef.current = 0
    closeSmashRecoilUntilRef.current = new Map()
    closeSmashReonsetNoteRef.current = null
    closeSmashReonsetStartedAtRef.current = 0
    setCloseSmashState(next)
  }, [])

  const commitThunderheadState = useCallback((next: PitchforksThunderheadState) => {
    // The Thunderhead reducer is immutable, but the ref replacement is the
    // runtime CAS boundary. Publish the next snapshot before any strike,
    // audio, or presentation effect can observe the old consumer.
    thunderheadStateRef.current = next
    setThunderheadState(next)
  }, [])

  const transitionThunderhead = useCallback((event: PitchforksThunderheadEvent): PitchforksThunderheadTransition => {
    const decision = advancePitchforksThunderhead(thunderheadStateRef.current, event)
    thunderheadLastTransitionReasonRef.current = decision.reason
    if (decision.accepted) commitThunderheadState(decision.state)
    return decision
  }, [commitThunderheadState])

  const resetThunderhead = useCallback((publish = true) => {
    thunderheadArmRequestedRef.current = false
    thunderheadReleaseRequestedRef.current = false
    thunderheadClockMsRef.current = 0
    thunderheadTravelStartedAtRef.current = 0
    thunderheadTravelStartRef.current = null
    thunderheadTravelTargetRef.current = null
    thunderheadMatchDueAtRef.current = 0
    thunderheadStrikeOriginRef.current = null
    thunderheadLastTransitionReasonRef.current = null
    const next = createPitchforksThunderheadState()
    thunderheadStateRef.current = next
    if (publish) setThunderheadState(next)
  }, [])

  const commitBellWaveState = useCallback((next: PitchforksBellWaveState, logicalNowMs: number, force = false) => {
    bellWaveStateRef.current = next
    const projection = projectPitchforksBellWave(next, logicalNowMs)
    bellWaveProjectionRef.current = projection
    // Diagnostics are intentionally coarse: the canvas still projects the
    // current immutable state every frame, while React only publishes a
    // meaningful phase/contact/radius snapshot to the browser recorder.
    const signature = [
      projection.phase,
      projection.visible ? Math.round(projection.radius / 12) : 0,
      next.contactedStableIDs.length,
    ].join('|')
    if (!force && signature === bellUiSignatureRef.current) return
    bellUiSignatureRef.current = signature
    setBellWaveState(next)
    setBellWaveProjection(projection)
  }, [])

  const commitBellPowerState = useCallback((next: PitchforksBellPowerState) => {
    bellPowerStateRef.current = next
    setBellPowerState(next)
  }, [])

  const resetBellWave = useCallback((publish = true) => {
    const next = resetPitchforksBellWaveState(bellWaveStateRef.current)
    bellWaveStateRef.current = next
    bellWaveClockMsRef.current = 0
    bellWaveProjectionRef.current = projectPitchforksBellWave(next, 0)
    bellArmRequestedRef.current = false
    bellArmedTargetKeyRef.current = ''
    bellReleaseRequestedRef.current = false
    bellChargeSequenceRef.current = 0
    bellChargeReceiptRef.current = null
    bellReleaseStableIDsRef.current = new Set()
    bellKnockbackRef.current = new Map()
    bellRecoilUntilRef.current = new Map()
    bellOwnRingSuppressionUntilRef.current = 0
    bellRingCountRef.current = 0
    bellLastRingReceiptIdRef.current = null
    bellLastReasonRef.current = 'reset'
    bellUiSignatureRef.current = ''
    if (publish) {
      setBellWaveState(next)
      setBellWaveProjection(bellWaveProjectionRef.current)
    }
  }, [])

  const normalThunderheadRouteAvailable = useCallback(() => (
    !demoRef.current && !fsrsDebugRef.current && !bossSimulatingRef.current &&
    !!presentationJourneyRef.current &&
    isWorldUnlocked('bell-tower', projectPitchforksWorldGates(presentationJourneyRef.current))
  ), [])

  const normalGalvanicRouteAvailable = useCallback(() => (
    !demoRef.current && !fsrsDebugRef.current && !bossSimulatingRef.current &&
    !!presentationJourneyRef.current &&
    isWorldUnlocked('cathedral', projectPitchforksWorldGates(presentationJourneyRef.current))
  ), [])

  const thunderheadRouteAvailable = useCallback(() => (
    demoRef.current || normalThunderheadRouteAvailable()
  ), [normalThunderheadRouteAvailable])

  const galvanicRouteAvailable = useCallback(() => (
    galvanicProofRef.current || normalGalvanicRouteAvailable()
  ), [normalGalvanicRouteAvailable])

  // Entitlement alone does not own the input: other earned powers still work.
  const galvanicOwnsInput = useCallback(() => (
    galvanicProofRef.current || galvanicArmRequestedRef.current ||
    galvanicReleaseRequestedRef.current || galvanicBanksRef.current.length > 0 ||
    galvanicAwaitingSilenceRef.current
  ), [])

  const publishGalvanicProjection = useCallback(() => {
    setGalvanicProjection(buildGalvanicDebugProjection(
      galvanicProofRef.current,
      galvanicStateRef.current,
      galvanicBanksRef.current,
      galvanicArmRequestedRef.current,
      galvanicAwaitingSilenceRef.current,
      galvanicLastOutcomesRef.current,
      galvanicLastReasonRef.current,
    ))
  }, [])

  const resetGalvanic = useCallback((publish = true) => {
    const next = createPitchforksGalvanicState(`galvanic:${runGenerationRef.current}:${runtimeRef.current.wave}`)
    galvanicStateRef.current = next
    galvanicBanksRef.current = []
    galvanicArmRequestedRef.current = false
    galvanicReleaseRequestedRef.current = false
    galvanicAwaitingSilenceRef.current = false
    galvanicArmedTargetKeyRef.current = ''
    galvanicSequenceRef.current = 0
    galvanicAttackSequenceRef.current = 0
    galvanicLastOutcomesRef.current = []
    galvanicLastReasonRef.current = 'reset'
    for (const villagerId of galvanicRecoilVillagerIdsRef.current) {
      closeSmashRecoilUntilRef.current.delete(villagerId)
    }
    galvanicRecoilVillagerIdsRef.current.clear()
    runtimeRef.current.bolts = runtimeRef.current.bolts.filter(candidate => candidate.presentation !== 'galvanic')
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    if (publish) publishGalvanicProjection()
  }, [publishGalvanicProjection])

  const getActiveVillager = useCallback(() => {
    const walkers = runtimeRef.current.villagers.filter(v => v.state === 'walking' && v.burned < v.totalTines)
    if (walkers.length === 0) return null
    walkers.sort((a, b) => a.x - b.x)
    return walkers[0]
  }, [])

  const getActiveTarget = useCallback((): ActiveTarget | null => {
    // During the earned receipt lifecycle, pin selection to that villager but
    // construct the target from live gameplay fields. READY/PENDING require
    // an exact receipt match; a stale receipt returns null instead of falling
    // through to a bystander. SETTLE may expose the surviving villager's real
    // next tine, while processLock's lifecycle gate keeps it un-lockable.
    const bellState = bellWaveStateRef.current
    const normalBellPhase = bellPowerStateRef.current?.phase
    if (
      bellState.phase === 'active' ||
      bellChargeReceiptRef.current ||
      bellReleaseRequestedRef.current ||
      normalBellPhase === 'activating' ||
      normalBellPhase === 'pending'
    ) {
      return null
    }
    if (bellArmRequestedRef.current) {
      const armed = runtimeRef.current.villagers.find(v => {
        const target = activeTargetFromLiveVillager(v)
        return target?.key === bellArmedTargetKeyRef.current
      })
      return armed ? activeTargetFromLiveVillager(armed) : null
    }
    const closeState = closeSmashStateRef.current
    if (closeState.phase !== 'idle') {
      const closeReceipt = closeState.receipt
      if (!closeReceipt) return null
      const pinnedVillager = runtimeRef.current.villagers.find(v => String(v.id) === closeReceipt.villagerId)
      if (!pinnedVillager) return null
      return activeTargetForCloseReceipt(pinnedVillager, closeReceipt, closeState.phase)
    }
    const thunderheadState = thunderheadStateRef.current
    if (thunderheadState.phase !== 'idle' && thunderheadState.phase !== 'consumed') {
      const receipt = thunderheadState.receipt ?? thunderheadState.bank
      return receipt ? activeTargetForThunderheadReceipt(runtimeRef.current.villagers, receipt) : null
    }
    if (galvanicOwnsInput()) {
      if (galvanicReleaseRequestedRef.current) return null
      const candidates = liveGalvanicTargets(runtimeRef.current.villagers)
      if (galvanicArmRequestedRef.current) {
        return candidates.find(target => target.key === galvanicArmedTargetKeyRef.current) ?? null
      }
      // Keep the next live unbanked target visible at capacity so the existing
      // source path can observe a real re-onset. processLock owns the capacity
      // gate and prevents both a third bank and ordinary credit.
      const bankedKeys = new Set(galvanicBanksRef.current.map(bank => bank.targetKey))
      return candidates.find(target => !bankedKeys.has(target.key)) ?? null
    }
    const villager = getActiveVillager()
    if (!villager) return null
    return activeTargetFromLiveVillager(villager)
  }, [galvanicOwnsInput, getActiveVillager])

  const syncRainSnapshot = useCallback((next: RainState) => {
    const active = getActiveTarget()
    const heldBucket = active ? Math.round(active.villager.torch.heldMs / 100) : 0
    const signature = [
      next.phase,
      Math.round(next.fill * 20),
      next.cycleID,
      active?.key ?? 'none',
      active?.villager.torch.phase ?? 'none',
      heldBucket,
    ].join('|')
    if (signature === rainUiSignatureRef.current) return
    rainUiSignatureRef.current = signature
    setRainState(next)
  }, [getActiveTarget])

  const setPromptText = useCallback((text: string) => {
    currentPromptRef.current = text
    // Any explicit Listen/status copy supersedes a deferred Sing/Now request.
    // The gated presenter below only stores a pending target when it cannot
    // safely publish an action prompt yet.
    pendingMusicalPromptRef.current = null
  }, [])

  const armCloseSmash = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    logicalNowMs: number,
  ) => {
    // Close Smash is a voice-lane earned ability. The exact lock is still
    // owned by processLock; this callback only packages its immutable receipt.
    const existingCloseBoundaryEligible = target.villager.x <= FRANK_REACH_X + 0.5
    if (
      galvanicOwnsInput() ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      inputModeRef.current !== 'voice' ||
      closeSmashStateRef.current.phase !== 'idle' ||
      !existingCloseBoundaryEligible ||
      lockProgressRef.current < 1
    ) return false

    const receipt: PitchforksCloseSmashReceipt = Object.freeze({
      lockId: `close-smash:${runGenerationRef.current}:${target.key}`,
      targetKey: target.key,
      pitch: target.note,
      villagerId: String(target.villager.id),
      tineIndex: target.tineIndex,
    })
    const current = closeSmashStateRef.current
    const next = armPitchforksCloseSmash(current, {
      receipt,
      existingCloseBoundaryEligible,
    })
    if (next === current) return false
    commitCloseSmashState(next)
    closeSmashFallbackDueAtRef.current = logicalNowMs + CLOSE_SMASH_FALLBACK_MS
    if (demoRef.current) demoStepRef.current = 'close-smash-ready-showcase'
    setPromptText(`CLOSE SMASH READY · ${target.note}`)
    return true
  }, [commitCloseSmashState, galvanicOwnsInput, getActiveTarget, setPromptText])

  const setActiveCueContextSnapshot = useCallback((next: ActiveCueContext) => {
    const current = activeCueContextRef.current
    if (current.support === next.support && current.noteCount === next.noteCount) return
    activeCueContextRef.current = next
    setActiveCueContext(next)
  }, [])

  const setFirstMinuteCoachSnapshot = useCallback((beat: FirstMinuteBeat, note: string | null = null) => {
    const current = firstMinuteCoachRef.current
    if (current.beat === beat && current.note === note) return
    const next = { beat, note }
    firstMinuteCoachRef.current = next
    firstMinuteBeatStartedAtRef.current = performance.now()
    setFirstMinuteCoach(next)
  }, [])

  const clearFirstMinuteTimer = useCallback(() => {
    if (!firstMinuteTimerRef.current) return
    clearTimeout(firstMinuteTimerRef.current)
    firstMinuteTimerRef.current = null
  }, [])

  const cueContextForVillager = useCallback((villager: Villager): ActiveCueContext => {
    const firstEncounter = villager.id === runtimeRef.current.firstVillagerId
    const liveNotes = villager.notes.slice(villager.burned)
    if (inputModeRef.current === 'buttons') {
      const next = { support: 'guided' as const, noteCount: Math.max(1, liveNotes.length) }
      liveNotes.forEach((_, offset) => {
        cueSupportByTargetRef.current.set(`${villager.id}:${villager.burned + offset}`, 'guided')
      })
      setActiveCueContextSnapshot(next)
      return next
    }
    const perNote = liveNotes.map(note => cueSupportForNote(
      fsrsRef.current[note],
      cueSupportProfileRef.current.notes[note],
      firstEncounter || !!presentationJourneyRef.current?.guidedNotes.includes(note),
      demoRef.current,
    ))
    // A sequence is only Recall when every unresolved note has earned Recall.
    // If any note needs support, the whole audible chain is honestly Guided.
    const support: CueSupportLevel = perNote.every(level => level === 'recall') ? 'recall' : 'guided'
    const next = { support, noteCount: Math.max(1, liveNotes.length) }
    liveNotes.forEach((_, offset) => {
      cueSupportByTargetRef.current.set(`${villager.id}:${villager.burned + offset}`, support)
    })
    setActiveCueContextSnapshot(next)
    return next
  }, [setActiveCueContextSnapshot])

  const clearCueTimers = useCallback(() => {
    for (const id of cueTimeoutsRef.current) clearTimeout(id)
    cueTimeoutsRef.current = []
    cuePlayingUntilRef.current = 0
    matchingSuppressedUntilRef.current = 0
  }, [])

  const cuePlayingNow = useCallback(() => performance.now() < cuePlayingUntilRef.current, [])

  const strikePresentationPending = useCallback(() => {
    const newestBolt = runtimeRef.current.bolts[runtimeRef.current.bolts.length - 1]
    return !!newestBolt && newestBolt.life / newestBolt.maxLife < STRIKE_IMPACT_START
  }, [])

  const matchingSuppressedNow = useCallback(() => {
    return strikePresentationPending() || performance.now() < matchingSuppressedUntilRef.current || isWithinToneSuppressionWindow()
  }, [strikePresentationPending])

  const presentMusicalPrompt = useCallback((target: PitchforksMusicalPromptTarget) => {
    const text = selectPitchforksCuePrompt(target.note, target.burned, {
      cuePlaying: cuePlayingNow(),
      matchingSuppressed: matchingSuppressedNow(),
    })
    if (!text) {
      pendingMusicalPromptRef.current = target
      return false
    }
    pendingMusicalPromptRef.current = null
    activePromptKeyRef.current = target.key
    promptStartedAtRef.current = performance.now()
    setPromptText(text)
    if (
      target.firstMinute &&
      firstMinuteCoachRef.current.beat !== 'strike' &&
      firstMinuteCoachRef.current.beat !== 'victory' &&
      firstMinuteCoachRef.current.beat !== 'complete'
    ) {
      setFirstMinuteCoachSnapshot('sing', target.note)
    }
    return true
  }, [cuePlayingNow, matchingSuppressedNow, setFirstMinuteCoachSnapshot, setPromptText])

  const flushPendingMusicalPrompt = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    const pending = pendingMusicalPromptRef.current
    if (
      !pending ||
      pending.key !== target.key ||
      pending.note !== target.note ||
      pending.burned !== target.villager.burned
    ) return false
    return presentMusicalPrompt(pending)
  }, [getActiveTarget, presentMusicalPrompt])

  const syncSparkGuideStatus = useCallback((status: PitchforksSparkGuideStatus) => {
    if (sparkGuideStatusRef.current === status) return
    sparkGuideStatusRef.current = status
    setSparkGuideStatus(status)
  }, [])

  const recordSparkGuideEvent = useCallback((
    kind: SparkGuideEvent['kind'],
    reason: string,
    suppressionStartMs: number | null = null,
    suppressionEndMs: number | null = null,
    targetOverride: Readonly<{ key: string; note: string }> | null = null,
  ) => {
    const state = sparkGuideRef.current
    sparkGuideEventsRef.current = [...sparkGuideEventsRef.current, {
      atMs: performance.now(),
      kind,
      reason,
      targetKey: targetOverride?.key ?? state.targetKey,
      targetNote: targetOverride?.note ?? state.targetNote,
      generation: state.generation,
      autoPulseCount: state.autoPulseCount,
      suppressionStartMs,
      suppressionEndMs,
    }].slice(-80)
  }, [])

  const pauseSparkGuide = useCallback((reason: string) => {
    const current = sparkGuideRef.current
    const hadPendingWork = current.quietSinceMs !== null || current.wrongSinceMs !== null || current.status === 'pulse'
    const next = pausePitchforksSparkGuide(current)
    sparkGuideRef.current = next
    syncSparkGuideStatus(next.status)
    if (hadPendingWork) recordSparkGuideEvent('cancelled', reason)
  }, [recordSparkGuideEvent, syncSparkGuideStatus])

  const resetSparkGuide = useCallback((reason: string) => {
    const current = sparkGuideRef.current
    if (!current.targetKey && current.quietSinceMs === null && current.wrongSinceMs === null && current.status === 'idle') return
    if (current.targetKey || current.quietSinceMs !== null || current.wrongSinceMs !== null || current.status === 'pulse') {
      recordSparkGuideEvent('cancelled', reason)
    }
    const next = createPitchforksSparkGuideState(current.generation + 1)
    sparkGuideRef.current = next
    syncSparkGuideStatus(next.status)
  }, [recordSparkGuideEvent, syncSparkGuideStatus])

  const normalBellRouteAvailable = useCallback(() => (
    !demoRef.current &&
    !fsrsDebugRef.current &&
    !bossSimulatingRef.current &&
    (selectedWorldRef.current === 'village-gate' || selectedWorldRef.current === 'bell-tower' || selectedWorldRef.current === 'cathedral') &&
    presentationJourneyRef.current?.dungeonClear !== undefined &&
    isWorldUnlocked(selectedWorldRef.current, projectPitchforksWorldGates(presentationJourneyRef.current))
  ), [])

  const normalVillageLessonAvailable = useCallback(() => (
    selectedWorldRef.current === 'village-gate' && normalBellRouteAvailable()
  ), [normalBellRouteAvailable])

  const updateSparkGuide = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    source: PitchInfo | null,
    now: number,
  ) => {
    const cuePlaying = cuePlayingNow()
    const suppressed = cuePlaying || matchingSuppressedNow()
    const usable = !!source?.isActive && source.confidence >= CONFIDENCE_FLOOR && source.frequency > 0
    const inWindow = usable && Math.abs(exactCents(source.frequency, noteToFreq(target.note))) <= MATCH_TOLERANCE_CENTS
    const unhintedUnaidedReturn = normalVillageLessonAvailable() &&
      inputModeRef.current === 'voice' &&
      target.villager.totalTines === 1 &&
      target.villager.supportedLesson?.support === 'UNAIDED_RETURN' &&
      target.villager.supportedLesson.contextNote !== target.note &&
      target.villager.supportedLesson.targetNote === target.note &&
      !hintedTargetKeysRef.current.has(target.key)
    const eligible = phaseRef.current === 'playing' &&
      inputModeRef.current === 'voice' &&
      activeCueContextRef.current.support === 'guided' &&
      activeCueContextRef.current.noteCount === 1 &&
      audioCueRef.current &&
      cueVolumeRef.current > 0 &&
      pianoSamplesReadyRef.current &&
      !ceremonyRef.current.active &&
      !unhintedUnaidedReturn &&
      (typeof document === 'undefined' || document.visibilityState === 'visible')
    const sample = suppressed
      ? 'suppressed' as const
      : !usable
        ? 'silence' as const
        : inWindow
          ? 'progress' as const
          : 'confident-wrong' as const
    const before = sparkGuideRef.current
    const decision = advancePitchforksSparkGuide(before, {
      nowMs: now,
      targetKey: target.key,
      targetNote: target.note,
      eligible,
      sample,
      pulseWindowMs: TONE_SUPPRESS_MS,
    })

    if (!decision.fire) {
      sparkGuideRef.current = decision.state
      syncSparkGuideStatus(decision.state.status)
      if (before.status === 'pulse' && decision.state.status !== 'pulse') {
        presentMusicalPrompt({
          key: target.key,
          note: target.note,
          burned: target.villager.burned,
          firstMinute: target.villager.id === runtimeRef.current.firstVillagerId,
        })
      }
      for (const transition of decision.transitions) {
        recordSparkGuideEvent(transition.kind, transition.reason)
      }
      return
    }

    // Revalidate at the last possible moment. The scheduler never owns target truth.
    const liveTarget = getActiveTarget()
    const stillEligible = !!liveTarget &&
      liveTarget.key === decision.fire.targetKey &&
      liveTarget.note === decision.fire.targetNote &&
      before.generation === decision.fire.generation &&
      phaseRef.current === 'playing' &&
      inputModeRef.current === 'voice' &&
      activeCueContextRef.current.support === 'guided' &&
      activeCueContextRef.current.noteCount === 1 &&
      audioCueRef.current &&
      cueVolumeRef.current > 0 &&
      !(normalVillageLessonAvailable() &&
        liveTarget.villager.totalTines === 1 &&
        liveTarget.villager.supportedLesson?.support === 'UNAIDED_RETURN' &&
        liveTarget.villager.supportedLesson.contextNote !== liveTarget.note &&
        liveTarget.villager.supportedLesson.targetNote === liveTarget.note &&
        !hintedTargetKeysRef.current.has(liveTarget.key)) &&
      !cuePlayingNow() &&
      !matchingSuppressedNow()
    if (!stillEligible) {
      sparkGuideRef.current = pausePitchforksSparkGuide(before)
      syncSparkGuideStatus(sparkGuideRef.current.status)
      recordSparkGuideEvent('cancelled', 'fire-revalidation')
      return
    }

    sparkGuideRef.current = decision.state
    syncSparkGuideStatus(decision.state.status)
    const suppressionStartMs = performance.now()
    const suppressionEndMs = suppressionStartMs + TONE_SUPPRESS_MS
    waveNotesHeardRef.current.add(liveTarget.note)
    setPianoVolume(cueVolumeRef.current)
    playPianoNote(liveTarget.note, { exact: true })
    cuePlayingUntilRef.current = suppressionStartMs + TONE_MS
    matchingSuppressedUntilRef.current = suppressionEndMs
    timersPausedRef.current = true
    activePromptKeyRef.current = liveTarget.key
    promptStartedAtRef.current = suppressionStartMs
    setPromptText(`Listen: ${liveTarget.note}`)
    if (
      liveTarget.villager.id === runtimeRef.current.firstVillagerId &&
      firstMinuteCoachRef.current.beat !== 'complete'
    ) {
      setFirstMinuteCoachSnapshot('listen', liveTarget.note)
    }
    markToneEmitted(TONE_SUPPRESS_MS)
    recordSparkGuideEvent('fired', decision.fire.reason, suppressionStartMs, suppressionEndMs)
    if (decision.state.autoPulseCount >= PITCHFORKS_SPARK_MAX_AUTO_PULSES) {
      recordSparkGuideEvent('capped', 'automatic-limit-after-pulse')
    }
  }, [normalVillageLessonAvailable, cuePlayingNow, getActiveTarget, matchingSuppressedNow, normalBellRouteAvailable, presentMusicalPrompt, recordSparkGuideEvent, setFirstMinuteCoachSnapshot, setPromptText, syncSparkGuideStatus])

  const resetRangeMatch = useCallback((candidate: string | null = null) => {
    rangeHeldMsRef.current = 0
    rangeLastSampleAtRef.current = 0
    setRangeCandidate(candidate)
    setRangeMatched(false)
    setRangeMatchProgress(0)
    setRangeCuePlayed(false)
  }, [])

  useEffect(() => {
    if (phase !== 'range_assessment' || rangeStep === 'summary') return
    const source = pitch
    const now = performance.now()
    let candidate = rangeCandidate

    if (
      rangeStep === 'anchor' &&
      source?.isActive &&
      source.confidence >= CONFIDENCE_FLOOR &&
      source.frequency > 0
    ) {
      const heardNote = nearestPitchforksRangeNote(source.frequency)
      if (heardNote && heardNote !== candidate) {
        resetRangeMatch(heardNote)
        return
      }
      candidate = heardNote
    }

    const canEvaluate = !!candidate &&
      (rangeStep === 'anchor' || rangeCuePlayed) &&
      !matchingSuppressedNow()

    const sampleState = canEvaluate && candidate
      ? exactPitchSampleState(source, noteToFreq(candidate), CONFIDENCE_FLOOR, MATCH_TOLERANCE_CENTS)
      : 'unavailable'

    const delta = rangeLastSampleAtRef.current > 0
      ? Math.min(100, now - rangeLastSampleAtRef.current)
      : 0
    rangeLastSampleAtRef.current = now
    const next = advanceExactPitchHold(
      { heldMs: rangeHeldMsRef.current, matched: rangeMatched },
      sampleState,
      delta,
      HOLD_MS,
    )
    rangeHeldMsRef.current = next.heldMs
    setRangeMatchProgress(next.heldMs / HOLD_MS)
    setRangeMatched(next.matched)
  }, [matchingSuppressedNow, phase, pitch, rangeCandidate, rangeCuePlayed, rangeMatched, rangeStep, resetRangeMatch])

  useEffect(() => {
    if (phase !== 'range_assessment' && phase !== 'range_manual') return
    rangeHeadingRef.current?.focus()
  }, [phase, rangeStep])

  const syncMicHudState = useCallback(() => {
    const next: MicHudState = demoRef.current
      ? 'demo'
      : micErrorRef.current
        ? 'blocked'
        : matchingSuppressedNow()
          ? 'cue'
          : isListeningRef.current
            ? 'listening'
            : 'waiting'
    if (micHudStateRef.current !== next) {
      micHudStateRef.current = next
      setMicHudState(next)
    }
  }, [matchingSuppressedNow])

  useEffect(() => {
    syncMicHudState()
  }, [isListening, micError, syncMicHudState])

  const resumeCueAudioFromGesture = useCallback(() => {
    try {
      initAudio()
      setPianoVolume(cueVolumeRef.current)
    } catch {}
  }, [])

  const timersPausedNow = useCallback(() => {
    const active = getActiveTarget()
    const micUnavailable = inputModeRef.current === 'voice' && !demoRef.current && (!isListeningRef.current || !!micErrorRef.current)
    const buttonReplayPending = inputModeRef.current === 'buttons' &&
      !!active &&
      buttonTrialRef.current?.targetKey === active.key &&
      buttonTrialRef.current.requiresReplay
    const firstLockGrace = firstLockGraceRef.current &&
      !!active &&
      active.villager.id === runtimeRef.current.firstVillagerId
    const environmentalPause = ceremonyRef.current.active || matchingSuppressedNow()
    const paused = shouldPausePitchforksAttackTimer({
      ceremonyActive: ceremonyRef.current.active,
      matchingSuppressed: environmentalPause,
      micUnavailable,
      firstLockGrace,
      buttonReplayPending,
    })
    timersPausedRef.current = paused
    return paused
  }, [getActiveTarget, matchingSuppressedNow])

  // Attack timers keep the first target's grace period, but environmental
  // clocks must still let a demo torch receive its truthful extended hold.
  // Cue/suppression, ceremony, and an unavailable live mic remain hard pauses.
  const environmentalClockPausedNow = useCallback((ignoreMatchingSuppression = false) => {
    const micUnavailable = inputModeRef.current === 'voice' && !demoRef.current && (!isListeningRef.current || !!micErrorRef.current)
    return ceremonyRef.current.active || (!ignoreMatchingSuppression && matchingSuppressedNow()) || micUnavailable
  }, [matchingSuppressedNow])

  const setCeremonySnapshot = useCallback((next: NewNoteCeremonyState) => {
    ceremonyRef.current = next
    setCeremony(next)
  }, [])

  const clearCeremonyTimers = useCallback(() => {
    if (newNoteTimerRef.current) {
      clearTimeout(newNoteTimerRef.current)
      newNoteTimerRef.current = null
    }
    if (ceremonyToneTimerRef.current) {
      clearTimeout(ceremonyToneTimerRef.current)
      ceremonyToneTimerRef.current = null
    }
  }, [])

  const resetAdmissionMatch = useCallback(() => {
    admissionHeldMsRef.current = 0
    admissionLastSampleAtRef.current = 0
    setAdmissionCuePlayed(false)
    setAdmissionMatched(false)
    setAdmissionMatchProgress(0)
  }, [])

  const clearNewNoteCeremony = useCallback(() => {
    clearCeremonyTimers()
    resetAdmissionMatch()
    setNewNoteUnlocked(null)
    setCeremonySnapshot({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  }, [clearCeremonyTimers, resetAdmissionMatch, setCeremonySnapshot])

  const clearNoteMasteredTimer = useCallback(() => {
    if (noteMasteredTimerRef.current) {
      clearTimeout(noteMasteredTimerRef.current)
      noteMasteredTimerRef.current = null
    }
  }, [])

  const clearNoteMasteredCeremony = useCallback(() => {
    clearNoteMasteredTimer()
    noteMasteredRef.current = null
    noteMasteredStartedAtRef.current = 0
    setNoteMastered(null)
  }, [clearNoteMasteredTimer])

  const setWaveReceiptSnapshot = useCallback((next: WaveReceiptState) => {
    waveReceiptRef.current = next
    setWaveReceipt(next)
  }, [])

  const clearWaveReceipt = useCallback(() => {
    const rt = runtimeRef.current
    rt.nextWavePending = false
    rt.nextWaveNumber = null
    rt.nextWaveAtMs = null
    rt.nextWaveRunGeneration = null
    victoryCancelledReceiptIdRef.current = null
    setWaveReceiptSnapshot(EMPTY_WAVE_RECEIPT)
  }, [setWaveReceiptSnapshot])

  const clearNextWaveTimer = useCallback(() => {
    if (!nextWaveTimerRef.current) return
    clearTimeout(nextWaveTimerRef.current)
    nextWaveTimerRef.current = null
  }, [])

  const resetLevelProgress = useCallback((level: number) => {
    const next = createPitchforksLevelProgress(level)
    levelAdmissionOfferedRef.current = false
    levelProgressRef.current = next
    setLevelProgress(next)
  }, [])

  const showWaveReceipt = useCallback((snapshot: WaveReceiptState) => {
    setWaveReceiptSnapshot(snapshot)
  }, [setWaveReceiptSnapshot])

  const snapshotWaveReceipt = useCallback((
    levelResult: PitchforksLevelResult,
    receiptStartedAtMs: number,
    claim: PitchforksVictoryReceiptClaim | null,
  ): WaveReceiptState => {
    const mastered = Object.entries(masteryProgressRef.current)
      .filter(([, progress]) => progress.masteredAt !== null && progress.masteredAt >= waveStartedAtRef.current)
      .map(([note]) => note)

    return {
      visible: true,
      timer: 0,
      receiptStartedAtMs,
      heard: [...waveNotesHeardRef.current],
      sung: [...waveNotesSungRef.current],
      mastered,
      levelResult,
      claim,
    }
  }, [])

  const showNoteMastered = useCallback((note: string) => {
    clearNoteMasteredCeremony()
    noteMasteredRef.current = note
    noteMasteredStartedAtRef.current = performance.now()
    setNoteMastered(note)
    const callbackGeneration = runGenerationRef.current
    const callbackFence = pauseGateRef.current.fence
    noteMasteredTimerRef.current = setTimeout(() => {
      if (!acceptsPitchforksPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
      clearNoteMasteredCeremony()
    }, NOTE_MASTERED_CEREMONY_MS)
  }, [clearNoteMasteredCeremony])

  const recordMasteryProgressForReview = useCallback((note: string) => {
    const reviewed = fsrsRef.current[note]
    if (!reviewed || reviewed.S < MASTERY_STABILITY_DAYS) return

    const current = masteryProgressRef.current[note] ?? { sessionIds: [], masteredAt: null }
    const priorSessionIds = Array.isArray(current.sessionIds) ? current.sessionIds : []
    const masteredAt = current.masteredAt ?? null
    const sessionId = getMasterySessionId()
    const sessionIds = priorSessionIds.includes(sessionId)
      ? priorSessionIds
      : [...priorSessionIds, sessionId]
    const crossedNow = masteredAt === null && sessionIds.length >= MASTERY_SESSION_COUNT
    if (sessionIds === priorSessionIds && !crossedNow) return

    masteryProgressRef.current[note] = {
      sessionIds,
      masteredAt: crossedNow ? Date.now() : masteredAt,
    }
    saveMasteryProgress()
    if (crossedNow) showNoteMastered(note)
  }, [getMasterySessionId, saveMasteryProgress, showNoteMastered])

  const tryPlayCeremonyTone = useCallback((note: string, userRequested = false): CeremonyToneAttempt => {
    if ((!userRequested && !audioCueRef.current) || cueVolumeRef.current <= 0) return 'disabled'
    if (!pianoSamplesReadyRef.current) return 'pending'
    if (matchingSuppressedNow()) return 'suppressed'
    try {
      initAudio()
      setPianoVolume(cueVolumeRef.current)
      playPianoNote(note, { exact: true })
      markToneEmitted(TONE_SUPPRESS_MS)
      return 'played'
    } catch {
      return 'disabled'
    }
  }, [matchingSuppressedNow])

  const markCeremonyToneFired = useCallback((note: string) => {
    const current = ceremonyRef.current
    if (!current.active || current.note !== note) return
    setAdmissionCuePlayed(true)
    setCeremonySnapshot({ ...current, toneFired: true, tonePulseKey: current.tonePulseKey + 1 })
  }, [setCeremonySnapshot])

  const scheduleCeremonyTone = useCallback((note: string, replay = false) => {
    const scheduledFor = ceremonyRef.current
    if (!scheduledFor.active || scheduledFor.note !== note || (!replay && scheduledFor.toneFired)) return
    if (ceremonyToneTimerRef.current) {
      clearTimeout(ceremonyToneTimerRef.current)
      ceremonyToneTimerRef.current = null
    }

    const attempt = tryPlayCeremonyTone(note, replay)
    if (attempt === 'played') {
      markCeremonyToneFired(note)
      return
    }
    if (attempt !== 'suppressed' && attempt !== 'pending') return

    const localSuppressionRemaining = Math.max(0, matchingSuppressedUntilRef.current - performance.now())
    const waitMs = attempt === 'pending'
      ? 250
      : Math.max(180, localSuppressionRemaining + 80, TONE_SUPPRESS_MS + 80)

    const callbackGeneration = runGenerationRef.current
    const callbackFence = pauseGateRef.current.fence
    ceremonyToneTimerRef.current = setTimeout(() => {
      ceremonyToneTimerRef.current = null
      if (!acceptsPitchforksPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
      const current = ceremonyRef.current
      if (!current.active || current.note !== note || (!replay && current.toneFired)) return
      if (tryPlayCeremonyTone(note, replay) === 'played') markCeremonyToneFired(note)
    }, waitMs)
  }, [markCeremonyToneFired, tryPlayCeremonyTone])

  const requestNewNoteAdmission = useCallback((note: string) => {
    clearCeremonyTimers()
    resetAdmissionMatch()
    setNewNoteUnlocked(null)
    setCeremonySnapshot({ active: true, note, toneFired: false, tonePulseKey: 0 })
  }, [clearCeremonyTimers, resetAdmissionMatch, setCeremonySnapshot])

  const replayNewNoteCeremonyTone = useCallback((note: string) => {
    const current = ceremonyRef.current
    if (!current.active || current.note !== note) return
    scheduleCeremonyTone(note, true)
  }, [scheduleCeremonyTone])

  const acceptNewNoteAdmission = useCallback(() => {
    const note = ceremonyRef.current.note
    if (!admissionMatched || !note) return
    const currentPool = unlockedNotesRef.current
    const expectedNote = presentationOrderRef.current[currentPool.length]
    if (note !== expectedNote || currentPool.includes(note)) return

    const newPool = [...currentPool, note]
    unlockedNotesRef.current = newPool
    setUnlockedNotes(newPool)
    savePresentationJourneyNotes(newPool)
    ensureNoteMemory(note)
    saveFsrs()
    deferredAdmissionNotesRef.current.delete(note)
    clearNewNoteCeremony()
    setNewNoteUnlocked(note)
    // Dismissing this cosmetic banner is always safe, even across a level/wave change
    // (unlike gameplay callbacks) — do not gate it on run-generation staleness, or a
    // level advance inside the ceremony window strands the banner on screen forever.
    newNoteTimerRef.current = setTimeout(() => {
      setNewNoteUnlocked(null)
    }, NEW_NOTE_CEREMONY_MS)
  }, [admissionMatched, clearNewNoteCeremony, ensureNoteMemory, saveFsrs, savePresentationJourneyNotes])

  const deferNewNoteAdmission = useCallback(() => {
    const note = ceremonyRef.current.note
    if (!note) return
    deferredAdmissionNotesRef.current.add(note)
    clearNewNoteCeremony()
  }, [clearNewNoteCeremony])

  const maybeUnlockNextNote = useCallback(() => {
    const bypassEvidence = demoRef.current || fsrsDebugRef.current
    // Showcase autoplay has no human hand to complete the exact-note ceremony;
    // keep the isolated demo running instead of parking it behind a dialog.
    if (demoRef.current) return
    const currentPool = unlockedNotesRef.current
    if (
      inputModeRef.current === 'voice' &&
      !bypassEvidence &&
      !admissionRecallReady(currentPool, cueSupportProfileRef.current)
    ) return
    const currentPoolSize = currentPool.length
    const presentationOrder = presentationOrderRef.current
    if (
      pitchforksNewNoteAccuracyEligible(levelProgressRef.current, inputModeRef.current) &&
      currentPoolSize < presentationOrder.length
    ) {
      const nextNote = presentationOrder[currentPoolSize]
      if (ceremonyRef.current.active || deferredAdmissionNotesRef.current.has(nextNote)) return
      requestNewNoteAdmission(nextNote)
    }
  }, [requestNewNoteAdmission])

  useEffect(() => {
    const dialog = admissionDialogRef.current
    if (!dialog) return

    if (ceremony.active && ceremony.note) {
      if (!dialog.open) {
        admissionReturnFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
        try { dialog.showModal() } catch { return }
      }
      admissionDialogPanelRef.current?.focus()
      // Admission is itself an exact-note assessment, so its opening presentation
      // is mandatory even when ordinary gameplay cues are disabled. The shared
      // tone-suppression window still prevents speaker playback from earning credit.
      scheduleCeremonyTone(ceremony.note, true)
      return
    }

    if (dialog.open) dialog.close()
    const returnTarget = admissionReturnFocusRef.current
    admissionReturnFocusRef.current = null
    if (returnTarget?.isConnected) returnTarget.focus()
  }, [ceremony.active, ceremony.note, scheduleCeremonyTone])

  useEffect(() => {
    const note = ceremony.note
    const sourcePitch = pitch
    const now = performance.now()
    const canEvaluate = ceremony.active &&
      !!note &&
      admissionCuePlayed &&
      !matchingSuppressedNow()

    const sampleState = canEvaluate && note
      ? exactPitchSampleState(sourcePitch, noteToFreq(note), CONFIDENCE_FLOOR, MATCH_TOLERANCE_CENTS)
      : 'unavailable'

    const delta = admissionLastSampleAtRef.current > 0
      ? Math.min(100, now - admissionLastSampleAtRef.current)
      : 0
    admissionLastSampleAtRef.current = now
    const next = advanceExactPitchHold(
      { heldMs: admissionHeldMsRef.current, matched: admissionMatched },
      sampleState,
      delta,
      HOLD_MS,
    )
    admissionHeldMsRef.current = next.heldMs
    setAdmissionMatchProgress(next.heldMs / HOLD_MS)
    setAdmissionMatched(next.matched)
  }, [admissionCuePlayed, admissionMatched, ceremony.active, ceremony.note, matchingSuppressedNow, pitch])

  const latencyForTarget = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    if (activePromptKeyRef.current === target.key && promptStartedAtRef.current > 0) {
      return Math.max(0, performance.now() - promptStartedAtRef.current)
    }
    return 2000
  }, [])

  const acceptNormalBellCombatResponse = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    if (!normalBellRouteAvailable()) return
    const current = bellPowerStateRef.current
    const expectedRunId = `bell-power:${runGenerationRef.current}`
    if (!current || current.runId !== expectedRunId || !current.admittedNotes.includes(target.note)) return
    const liveTarget = getActiveTarget()
    if (!liveTarget || liveTarget.villager !== target.villager || liveTarget.key !== target.key || liveTarget.note !== target.note) return

    // This is the authoritative normal combat seam. Build one immutable event
    // and hand it to each independent ecology ledger; neither ledger borrows
    // the other's charge or optional provenance as a stale-run fence.
    const event = Object.freeze({
      runId: expectedRunId,
      eventId: `combat:${expectedRunId}:${target.key}`,
      note: target.note,
      lane: 'voice' as const,
      source: 'combat' as const,
      correct: true as const,
      demo: false,
      simulated: false,
      stale: false,
      inputMode: 'voice',
    })
    const bellDecision = acceptPitchforksBellPowerCombatResponse(current, event)
    if (bellDecision.state !== current) commitBellPowerState(bellDecision.state)

    const rain = runtimeRef.current.rain
    const rainDecision = acceptPitchforksRainCombatResponse(rain, event)
    const rainEarned = rainDecision.charged
    if (rainEarned || rainDecision.state !== rain) {
      runtimeRef.current.rain = rainDecision.state
      syncRainSnapshot(rainDecision.state)
    }
  }, [commitBellPowerState, getActiveTarget, normalBellRouteAvailable, syncRainSnapshot])

  const reviewTargetNote = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    correct: boolean,
    lane: PitchforksInputMode = inputModeRef.current,
  ) => {
    if (pausedRef.current) return false
    if (!target.note) return false
    if (matchingSuppressedNow()) return false
    if (lane === 'voice' && !demoRef.current && !isListeningRef.current) return false
    // Resolution is one-shot for both FSRS and level accuracy. This also
    // protects against an echo, duplicate callback, or a delayed button tap
    // trying to rewrite the same exact-octave encounter+tine.
    if (Object.prototype.hasOwnProperty.call(levelProgressRef.current.targetOutcomes, target.key)) return false
    if (target.villager.supportedLesson && (
      getActiveTarget()?.villager !== target.villager || getActiveTarget()?.key !== target.key
    )) return false

    if (!correct) {
      if (failureGradedKeysRef.current.has(target.key)) return false
      failureGradedKeysRef.current.add(target.key)
    }

    const latencyMs = latencyForTarget(target)
    const support = cueSupportByTargetRef.current.get(target.key) ?? 'guided'
    const hinted = hintedTargetKeysRef.current.has(target.key)
    const supportedVillageLesson = normalVillageLessonAvailable() &&
      lane === 'voice' &&
      target.villager.totalTines === 1 &&
      target.villager.supportedLesson?.targetNote === target.note
      ? target.villager.supportedLesson
      : undefined
    const returnOffer = villageReturnOffersRef.current.get(target.key)
    if (returnOffer && (
      returnOffer.runId !== `village-return:${runGenerationRef.current}` ||
      getActiveTarget()?.villager !== target.villager ||
      getActiveTarget()?.key !== target.key
    )) return false
    const levelCredit: PitchforksLevelCredit = lane === 'buttons'
      ? 'ear'
      : supportedVillageLesson || demoRef.current || support === 'guided'
        ? 'guided-practice'
        : hinted
          ? 'hinted'
          : 'recall'
    const nextLevelProgress = recordPitchforksLevelOutcome(levelProgressRef.current, {
      targetKey: target.key,
      correct,
      lane,
      credit: levelCredit,
      sampleState: 'valid',
    })
    if (nextLevelProgress === levelProgressRef.current) return false
    levelProgressRef.current = nextLevelProgress
    setLevelProgress(nextLevelProgress)
    completedVillageEncounterCountRef.current += 1

    if (supportedVillageLesson) {
      const journey = presentationJourneyRef.current
      const range = rangeProfileRef.current
      const candidateEligibility = journey && range ? {
        admittedNotes: unlockedNotesRef.current,
        introducedNotes: [...journey.guidedNotes, ...journey.unlockedNotes],
        comfortableRange: range,
      } : null
      const currentOffer = candidateEligibility && returnOffer
        ? selectVillageReturnOffer({
            ...villageReturnQueueRef.current,
            entries: villageReturnQueueRef.current.entries.filter(entry => entry.revision === returnOffer.revision),
          }, {
            runId: `village-return:${runGenerationRef.current}`,
            targetNote: target.note,
            completedEncounterCount: completedVillageEncounterCountRef.current,
            nowMs: performance.now(),
            candidateEligibility,
          })
        : undefined
      const unaided = !!returnOffer && currentOffer?.revision === returnOffer.revision &&
        returnOffer.support === 'UNAIDED_RETURN' &&
        returnOffer.targetNote === target.note &&
        returnOffer.contextNote === supportedVillageLesson.contextNote &&
        supportedVillageLesson.support === 'UNAIDED_RETURN' &&
        villageReturnContextPlayedRef.current.has(target.key) && !hinted
      const resolution = returnOffer ? resolveVillageReturnOffer(villageReturnQueueRef.current, {
        runId: `village-return:${runGenerationRef.current}`,
        offer: returnOffer,
        completedEncounterCount: completedVillageEncounterCountRef.current,
        nowMs: performance.now(),
        correct,
        hinted: !unaided,
      }) : undefined
      if (resolution?.accepted) villageReturnQueueRef.current = resolution.state
      villageReturnOffersRef.current.delete(target.key)
      villageReturnContextPlayedRef.current.delete(target.key)
      cueSupportByTargetRef.current.delete(target.key)
      hintedTargetKeysRef.current.delete(target.key)
      if (correct) {
        if (journey && range && candidateEligibility) {
          const currentVillagePractice = journey.villagePractice ?? []
          const practiceSessionId = `${getMasterySessionId()}:run:${runGenerationRef.current}`
          const earnedUnaided = unaided && resolution?.accepted === true && resolution.support === 'UNAIDED_RETURN'
          // Practice can already be saved from a prior run. The live return
          // still needs its own fresh introduction, count and delay.
          if (!returnOffer) villageReturnQueueRef.current = enqueueVillageReturn(villageReturnQueueRef.current, {
            runId: `village-return:${runGenerationRef.current}`,
            objective: supportedVillageLesson.objective,
            contextNote: supportedVillageLesson.contextNote,
            targetNote: target.note,
            completedEncounterCount: completedVillageEncounterCountRef.current,
            nowMs: performance.now(),
            support: 'SUPPORTED',
            candidateEligibility,
          })
          const nextVillagePractice = recordVillagePractice(currentVillagePractice, {
            eventId: `village-practice:${practiceSessionId}:${target.key}`,
            journeyId: journey.startedAt,
            sessionId: practiceSessionId,
            encounterIndex: completedVillageEncounterCountRef.current,
            introducedEncounterIndex: returnOffer?.enqueuedAtCompletedEncounterCount ?? completedVillageEncounterCountRef.current,
            timestampMs: Date.now(),
            objective: supportedVillageLesson.objective,
            contextNote: supportedVillageLesson.contextNote,
            targetNote: supportedVillageLesson.targetNote,
            support: earnedUnaided ? 'UNAIDED_RETURN' : 'SUPPORTED',
            correct,
            normalVoice: normalVillageLessonAvailable() && lane === 'voice',
            demo: demoRef.current,
            simulated: bossSimulatingRef.current,
            cueFree: earnedUnaided,
            candidateEligibility: {
              admittedNotes: unlockedNotesRef.current,
              introducedNotes: [...journey.guidedNotes, ...journey.unlockedNotes],
              comfortableRange: range,
            },
          })
          if (nextVillagePractice !== currentVillagePractice) {
            const nextJourney = { ...journey, villagePractice: nextVillagePractice }
            presentationJourneyRef.current = nextJourney
            setPresentationJourney(nextJourney)
            savePresentationJourney(nextJourney)
            reconcileCampaignProgress(nextJourney)
          }
        }
        waveNotesSungRef.current.add(target.note)
        acceptNormalBellCombatResponse(target)
      }
      return true
    }

    if (lane === 'buttons') {
      gradeEar(earFsrsRef.current, target.note, correct, latencyMs)
      saveFsrs('buttons')
      if (correct) waveNotesSungRef.current.add(target.note)
      return true
    }

    gradeVoice(fsrsRef.current, target.note, correct, latencyMs)
    saveFsrs('voice')
    const outcome = !correct
      ? 'miss'
      : support === 'guided'
        ? 'guided-success'
        : hintedTargetKeysRef.current.has(target.key)
          ? 'hinted-success'
          : 'recall-success'
    cueSupportProfileRef.current = {
      version: 1,
      notes: {
        ...cueSupportProfileRef.current.notes,
        [target.note]: recordCueSupportOutcome(cueSupportProfileRef.current.notes[target.note], outcome),
      },
    }
    saveCueSupport()
    cueSupportByTargetRef.current.delete(target.key)
    hintedTargetKeysRef.current.delete(target.key)
    if (correct) {
      completeJourneyGuidanceForNote(target.note)
      recordMasteryProgressForReview(target.note)
      if (lane === 'voice' && !demoRef.current && !fsrsDebugRef.current && !bossSimulatingRef.current) {
        reconcileCampaignProgress()
      }
    }

    if (correct) {
      waveNotesSungRef.current.add(target.note)
      // The same accepted normal voice response reaches Rain independently;
      // it never borrows Bell's charge or receipt.
      if (lane === 'voice') acceptNormalBellCombatResponse(target) // Rain connector
    }
    return true
  }, [normalVillageLessonAvailable, acceptNormalBellCombatResponse, completeJourneyGuidanceForNote, getActiveTarget, getMasterySessionId, latencyForTarget, matchingSuppressedNow, normalBellRouteAvailable, recordMasteryProgressForReview, reconcileCampaignProgress, saveCueSupport, saveFsrs, savePresentationJourney])

  const playVillagerSequence = useCallback((villager: Villager, mode: 'cue' | 'replay') => {
    if (!villager.notes.length) return
    if (strikePresentationPending()) return
    clearCueTimers()
    const liveNotes = villager.notes.slice(villager.burned)
    if (!liveNotes.length) return
    const supportedLesson = normalVillageLessonAvailable() &&
      inputModeRef.current === 'voice' &&
      villager.totalTines === 1 &&
      liveNotes.length === 1 &&
      !!villager.supportedLesson?.contextNote &&
      villager.supportedLesson.contextNote !== liveNotes[0] &&
      villager.supportedLesson.targetNote === liveNotes[0]
      ? villager.supportedLesson
      : undefined
    const targetKey = `${villager.id}:${villager.burned}`
    const cueRunGeneration = runGenerationRef.current
    const cueFence = pauseGateRef.current.fence
    if (mode === 'replay' && supportedLesson?.support === 'UNAIDED_RETURN') {
      // Replay is the explicit hint path. Mark the exact target before any
      // answer tone is scheduled, even when the current cue profile is Guided.
      hintedTargetKeysRef.current.add(targetKey)
    }
    const unhintedUnaidedReturnCue = supportedLesson?.support === 'UNAIDED_RETURN' &&
      mode === 'cue' &&
      !hintedTargetKeysRef.current.has(targetKey)
    const playbackNotes = supportedLesson
      ? [supportedLesson.contextNote, supportedLesson.targetNote]
      : liveNotes
    if (unhintedUnaidedReturnCue) playbackNotes.pop()
    const supportedInterval = supportedLesson?.objective.replace('-', ' ')
    const supportedDirection = supportedLesson
      ? noteToFreq(supportedLesson.targetNote) > noteToFreq(supportedLesson.contextNote)
        ? 'above'
        : 'below'
      : undefined
    const supportedCueText = supportedLesson
      ? `Listen ${supportedLesson.contextNote}, then sing ${supportedLesson.targetNote} comfortably — ${supportedInterval} ${supportedDirection}.`
      : undefined
    const buttonLane = inputModeRef.current === 'buttons'
    const activeTarget = getActiveTarget()
    const buttonTrial = buttonTrialRef.current
    if (buttonLane && mode === 'replay' && buttonTrial && buttonTrial.targetKey === activeTarget?.key) {
      buttonTrialRef.current = replayPitchforksButtonTrial(buttonTrial)
      setButtonFeedback({ kind: 'listen', text: 'LISTEN AGAIN...' })
    }
    const emitsTone = (buttonLane || mode === 'replay' || audioCueRef.current) && cueVolumeRef.current > 0
    if (!emitsTone) {
      if (
        villager.id === runtimeRef.current.firstVillagerId &&
        firstMinuteCoachRef.current.beat !== 'strike' &&
        firstMinuteCoachRef.current.beat !== 'victory' &&
        firstMinuteCoachRef.current.beat !== 'complete'
      ) {
        setFirstMinuteCoachSnapshot('sing', liveNotes[0])
      }
      return
    }
    if (emitsTone) {
      if (unhintedUnaidedReturnCue) {
        // The automatic return only played its context. Do not claim the
        // target was heard; the later queue consumer needs this provenance.
        for (const note of playbackNotes) waveNotesHeardRef.current.add(note)
      } else {
        // Preserve the existing supported/ordinary hearing semantics.
        for (const note of liveNotes) waveNotesHeardRef.current.add(note)
      }
    }
    if (mode === 'replay' && activeCueContextRef.current.support === 'recall') {
      liveNotes.forEach((_, offset) => {
        hintedTargetKeysRef.current.add(`${villager.id}:${villager.burned + offset}`)
      })
    }
    if (
      villager.id === runtimeRef.current.firstVillagerId &&
      firstMinuteCoachRef.current.beat !== 'strike' &&
      firstMinuteCoachRef.current.beat !== 'victory' &&
      firstMinuteCoachRef.current.beat !== 'complete'
    ) {
      setFirstMinuteCoachSnapshot('listen', liveNotes[0])
    }

    const now = performance.now()
    const toneWindowMs = (playbackNotes.length - 1) * TONE_SPACING_MS + TONE_MS
    const suppressMs = toneWindowMs + ECHO_TAIL_MS
    cuePlayingUntilRef.current = now + toneWindowMs
    matchingSuppressedUntilRef.current = now + suppressMs
    timersPausedRef.current = true
    if (!buttonLane && mode === 'cue' && activeCueContextRef.current.support === 'guided' && liveNotes.length === 1 && activeTarget) {
      recordSparkGuideEvent('activation-pulse', 'existing-guided-cue', now, now + suppressMs, {
        key: activeTarget.key,
        note: liveNotes[0],
      })
    }
    if (demoRef.current) demoStepRef.current = mode === 'replay' ? 'replay-cue' : 'auto-cue'

    const firstIndex = villager.burned
    if (buttonLane) setPromptText('Listen...')
    else setPromptText(supportedCueText
      ? `${mode === 'replay' ? 'Replay: ' : ''}${supportedCueText}`
      : `${mode === 'replay' ? 'Replay' : 'Listen'}: ${liveNotes[0]}`)
    if (buttonLane) setButtonFeedback({ kind: 'listen', text: 'LISTEN, THEN CHOOSE THE NOTE' })
    activePromptKeyRef.current = `${villager.id}:${firstIndex}`
    promptStartedAtRef.current = now

    playbackNotes.forEach((note, toneIndex) => {
      // A supported context tone teaches the relationship but is not a new
      // villager tine. Both tones therefore point at the actual target tine.
      const tineIndex = supportedLesson ? villager.burned : villager.burned + toneIndex
      const id = setTimeout(() => {
        const promptOwnerKey = `${villager.id}:${tineIndex}`
        if (!acceptsPitchforksPauseCallback(pauseGateRef.current, cueRunGeneration, cueFence) ||
          cueRunGeneration !== runGenerationRef.current || phaseRef.current !== 'playing' ||
          getActiveTarget()?.villager !== villager || getActiveTarget()?.key !== promptOwnerKey) return
        if (phaseRef.current === 'playing' && getActiveTarget()?.key === promptOwnerKey) {
          setPromptText(buttonLane
            ? 'Listen…'
            : supportedLesson && toneIndex === 0
              ? `${mode === 'replay' ? 'Replay' : 'Listen'}: starting note ${note}`
              : supportedCueText
                ? `${mode === 'replay' ? 'Replay: ' : ''}${supportedCueText}`
                : `${mode === 'replay' ? 'Replay' : 'Listen'}: ${note}`)
          activePromptKeyRef.current = promptOwnerKey
          promptStartedAtRef.current = performance.now()
        }
        setPianoVolume(cueVolumeRef.current)
        try {
          const emitted = playPianoNote(note, { exact: true })
          if (emitted && unhintedUnaidedReturnCue && toneIndex === 0 &&
            pianoSamplesReadyRef.current && audioCueRef.current && cueVolumeRef.current > 0 &&
            villageReturnOffersRef.current.get(promptOwnerKey)?.runId === `village-return:${cueRunGeneration}`) {
            villageReturnContextPlayedRef.current.add(promptOwnerKey)
          }
        } finally {
          matchingSuppressedUntilRef.current = performance.now() + TONE_SUPPRESS_MS
          markToneEmitted(TONE_SUPPRESS_MS)
        }
      }, toneIndex * TONE_SPACING_MS)
      cueTimeoutsRef.current.push(id)
    })

    const finishCue = () => {
      if (!acceptsPitchforksPauseCallback(pauseGateRef.current, cueRunGeneration, cueFence)) return
      if (matchingSuppressedNow()) {
        const retryId = setTimeout(finishCue, 25)
        cueTimeoutsRef.current.push(retryId)
        return
      }
      if (cuePlayingNow()) {
        const retryId = setTimeout(finishCue, 25)
        cueTimeoutsRef.current.push(retryId)
        return
      }
      if (
        phaseRef.current === 'playing' &&
        activeVillagerIdRef.current === villager.id &&
        villager.state === 'walking'
      ) {
        const note = villager.notes[villager.burned]
        if (note) {
          if (buttonLane) {
            activePromptKeyRef.current = `${villager.id}:${villager.burned}`
            promptStartedAtRef.current = performance.now()
            setPromptText('Which note did you hear?')
            setButtonFeedback({ kind: 'question', text: 'WHICH NOTE DID YOU HEAR?' })
          } else {
            presentMusicalPrompt({
              key: `${villager.id}:${villager.burned}`,
              note,
              burned: villager.burned,
              firstMinute: villager.id === runtimeRef.current.firstVillagerId,
            })
          }
        }
      }
    }
    const doneId = setTimeout(finishCue, suppressMs)
    cueTimeoutsRef.current.push(doneId)
  }, [clearCueTimers, cuePlayingNow, getActiveTarget, matchingSuppressedNow, normalVillageLessonAvailable, presentMusicalPrompt, recordSparkGuideEvent, setPromptText, strikePresentationPending])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!demoMode && !fsrsDebugMode) {
      delete window.__pf3
      return
    }

    const getState = (): Readonly<Pf3DebugState> => {
      const rt = runtimeRef.current
      const active = getActiveTarget()
      const chargeLevel = active
        ? Math.max(
            active.villager.burned,
            Math.min(active.villager.totalTines, Math.round(lockProgressRef.current * active.villager.totalTines)),
          )
        : 0
      const newestBolt = rt.bolts[rt.bolts.length - 1]
      const rainEffects = deriveRainEffects(rt.rain)
      const receipt = waveReceiptRef.current
      const logicalNowMs = rt.animClock * 1000
      const thunderheadClockMs = thunderheadClockMsRef.current
      const bellProjection = projectPitchforksBellWave(
        bellWaveStateRef.current,
        bellWaveClockMsRef.current,
      )
      const thunderheadProjection = getPitchforksThunderheadDebugProjection(thunderheadStateRef.current)
      const thunderheadPhase = thunderheadProjection.phase
      const thunderheadTravelProgress = thunderheadPhase === 'ceiling_travel' && thunderheadTravelStartedAtRef.current > 0
        ? clamp((thunderheadClockMs - thunderheadTravelStartedAtRef.current) / THUNDERHEAD_TRAVEL_MS, 0, 1)
        : thunderheadPhase === 'target_match' || thunderheadPhase === 'strike' || thunderheadPhase === 'consumed'
          ? 1
          : 0
      const thunderheadTravelStart = thunderheadTravelStartRef.current ?? { x: FRANK_X + assetsRef.current.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE + FRANK_CLOUD_X_OFFSET + THUNDERHEAD_BANK_X_OFFSET, y: FRANK_CLOUD_Y }
      const thunderheadTravelTarget = thunderheadTravelTargetRef.current ?? thunderheadTravelStart
      const thunderheadPosition = getPitchforksThunderheadPathPosition(thunderheadTravelStart, thunderheadTravelTarget.x, thunderheadTravelProgress) ?? thunderheadTravelStart
      const thunderheadCloudX = thunderheadPosition.x
      const thunderheadCloudY = thunderheadPosition.y
      const thunderheadDebugProjection: ThunderheadDebugProjection = Object.freeze({
        ...thunderheadProjection,
        travelProgress: thunderheadTravelProgress,
        cloudX: thunderheadCloudX,
        cloudY: thunderheadCloudY,
        targetX: thunderheadTravelTargetRef.current?.x ?? null,
        targetY: thunderheadTravelTargetRef.current?.y ?? null,
        runeStatus: THUNDERHEAD_RUNE_STATUS,
      })
      const receiptAgeMs = receipt.visible
        ? pitchforksWaveReceiptAgeMs({
            logicalNowMs,
            receiptStartedAtMs: receipt.receiptStartedAtMs,
          })
        : 0
      const victoryClaim = receipt.visible && rt.nextWavePending ? receipt.claim : null
      const victoryPose = selectPitchforksVictoryPoseForClaim(
        victoryClaim,
        victoryClaim ? pitchforksWaveReceiptAgeMs({ logicalNowMs, receiptStartedAtMs: victoryClaim.claimedAtMs }) : 0,
        victoryClaim ? victoryCancelledReceiptIdRef.current === victoryClaim.receiptId : false,
      )

      return Object.freeze({
        bossId: bossIdentityRef.current,
        bossRecital: bossControllerRef.current?.state() ?? null,
        bossReviewReceipts: bossReceiptsRef.current.map(receipt => ({
          ...receipt,
          before: receipt.before ? { ...receipt.before } : null,
          after: { ...receipt.after },
          readback: receipt.readback ? { ...receipt.readback } : null,
        })),
        demoStep: demoStepRef.current,
        closeSmashProof: closeSmashProofRef.current,
        inputMode: inputModeRef.current,
        settings: normalizePitchforksSettings({
          noteNames: noteNamesRef.current,
          referenceAudio: audioCueRef.current,
          referenceGainPct: cueVolumeRef.current,
          microphoneGainPct: microphoneGainRef.current,
        }),
        chargeProgress: lockProgressRef.current,
        chargeLevel,
        silenceFreezeObserved: silenceFreezeObservedRef.current,
        resetCount: resetCountRef.current,
        lastResetReason: lastResetReasonRef.current,
        strikeCount: demoLockCountRef.current,
        burnedTines: burnedTinesRef.current,
        ashCount: ashCountRef.current,
        wave: rt.wave,
        levelProgress: {
          ...levelProgressRef.current,
          targetOutcomes: Object.fromEntries(
            Object.entries(levelProgressRef.current.targetOutcomes).map(([key, outcome]) => [key, { ...outcome }]),
          ),
        },
        levelAccuracyPercent: pitchforksLevelAccuracyPercent(levelProgressRef.current, inputModeRef.current),
        waveBannerVisible: rt.bannerTimer > 0,
        fullSequenceComplete: fullSequenceCompleteRef.current,
        barVisible: barVisibleRef.current,
        barDotDeviation: barDotDeviationRef.current,
        barOnTarget: barOnTargetRef.current,
        trailLength: pitchTrailRef.current.length,
        replayVisible: phaseRef.current === 'playing',
        cuePlaying: cuePlayingNow(),
        matchingSuppressed: matchingSuppressedNow(),
        timersPaused: timersPausedRef.current,
        firstLockGrace: firstLockGraceRef.current,
        timerBarVisible: phaseRef.current === 'playing' && !!active,
        activeAttackTimerPct: active
          ? clamp(active.villager.attackTimer / Math.max(0.001, active.villager.attackTimerMax), 0, 1)
          : null,
        lockWhileSuppressed: lockWhileSuppressedRef.current,
        tutorialAvailable: true,
        healthPips: rt.health,
        burstCount: rt.bursts.length,
        lastStrikeNote: lastStrikeNoteRef.current,
        lastStrikeHue: lastStrikeHueRef.current,
        lastKillNote: lastKillNoteRef.current,
        lastKillHue: lastKillHueRef.current,
        roarFiredCount: roarFiredCountRef.current,
        unlockedCount: unlockedNotesRef.current.length,
        unlockedNotes: [...unlockedNotesRef.current],
        noteR: noteRSnapshot(unlockedNotesRef.current, activeFsrsStore()),
        noteHealth: noteHealthSnapshot(unlockedNotesRef.current, activeFsrsStore()),
        ceremonyActive: ceremonyRef.current.active,
        ceremonyNote: ceremonyRef.current.note,
        ceremonyToneFired: ceremonyRef.current.toneFired,
        noteMastered,
        masteredNotes: Object.entries(masteryProgressRef.current)
          .filter(([, progress]) => progress.masteredAt !== null)
          .map(([masteredNote]) => masteredNote),
        selectedNotes: rt.villagers.flatMap(v => v.notes),
        activeNote: active?.note ?? null,
        activeSequence: active ? [...active.villager.notes] : [],
        activeCueSupport: activeCueContextRef.current.support,
        cueSupportProfile: {
          version: 1 as const,
          notes: Object.fromEntries(
            Object.entries(cueSupportProfileRef.current.notes).map(([note, evidence]) => [note, { ...evidence }]),
          ),
        },
        sparkGuideStatus: sparkGuideRef.current.status,
        sparkGuideGeneration: sparkGuideRef.current.generation,
        sparkGuideAutoPulseCount: sparkGuideRef.current.autoPulseCount,
        sparkGuideEvents: sparkGuideEventsRef.current.map(event => ({ ...event })),
        firstMinuteBeat: firstMinuteCoachRef.current.beat,
        fsrsDebug: demoRef.current || fsrsDebugRef.current,
        fsrsStoreKey: fsrsStorageKey(),
        earFsrsStoreKey: earFsrsStorageKey(),
        buttonTrial: buttonTrialRef.current ? { ...buttonTrialRef.current } : null,
        newNoteUnlocked,
        layoutMode: layoutModeRef.current,
        lightningPhase: lightningPhaseFor(lockProgressRef.current, newestBolt),
        boltCount: rt.bolts.length,
        lightningBendDeg: lightningBendDeg(newestBolt),
        lightningPhaseTrace: lightningPhaseTraceRef.current.map(entry => ({ ...entry })),
        closeSmashPhase: closeSmashStateRef.current.phase,
        closeSmashReceipt: closeSmashStateRef.current.receipt
          ? { ...closeSmashStateRef.current.receipt }
          : null,
        closeSmashConsumer: closeSmashStateRef.current.consumer,
        closeSmashContactPresented: closeSmashStateRef.current.contactPresented,
        closeSmashFallbackRemainingMs: closeSmashStateRef.current.receipt
          ? Math.max(0, closeSmashFallbackDueAtRef.current - rt.animClock * 1000)
          : null,
        closeSmashRequestQueued: closeSmashRequestRef.current !== null,
        logicalNowMs,
        waveReceiptVictoryPose: victoryPose,
        waveReceiptVictoryAgeMs: victoryClaim ? receiptAgeMs : null,
        waveReceiptVictoryNextWaveAtMs: rt.nextWavePending ? rt.nextWaveAtMs : null,
        waveReceiptVictoryNextWaveRemainingMs: rt.nextWavePending && rt.nextWaveAtMs !== null
          ? Math.max(0, rt.nextWaveAtMs - logicalNowMs)
          : null,
        villagers: rt.villagers.map(v => ({
          id: v.id,
          state: v.state,
          burned: v.burned,
          totalTines: v.totalTines,
          notes: [...v.notes],
          x: v.x,
        })),
        rainPhase: rt.rain.phase,
        rainFill: rt.rain.fill,
        rainCycleID: rt.rain.cycleID,
        rainSlowFactor: rainEffects.slowFactor,
        rainExtinguishes: rainEffects.extinguish,
        rainTransitions: rt.rain.recentTransitions.map(transition => ({ ...transition })),
        torchStates: Object.fromEntries(
          rt.villagers.map(v => [v.id, {
            ...v.torch,
            recentTransitions: v.torch.recentTransitions.map(transition => ({ ...transition })),
          }]),
        ),
        galvanic: buildGalvanicDebugProjection(
          galvanicProofRef.current,
          galvanicStateRef.current,
          galvanicBanksRef.current,
          galvanicArmRequestedRef.current,
          galvanicAwaitingSilenceRef.current,
          galvanicLastOutcomesRef.current,
          galvanicLastReasonRef.current,
        ),
        thunderhead: thunderheadDebugProjection,
        thunderheadArmed: thunderheadArmRequestedRef.current,
        thunderheadReleaseQueued: thunderheadReleaseRequestedRef.current,
        thunderheadLastTransitionReason: thunderheadLastTransitionReasonRef.current,
        thunderheadRuneStatus: THUNDERHEAD_RUNE_STATUS,
        thunderheadTravelProgress,
        bellProof: bellProofRef.current,
        bellPhase: bellWaveStateRef.current.phase,
        bellRadius: bellProjection.radius,
        bellContactCount: bellWaveStateRef.current.contactedStableIDs.length,
        bellRingCount: bellRingCountRef.current,
        bellChargeReceiptId: bellChargeReceiptRef.current?.receiptId ?? null,
        bellReleaseQueued: bellReleaseRequestedRef.current,
      })
    }
    // fsrsDebug-gated test hook: drives the same level-progress/admission path as
    // live voice resolutions while keeping FSRS in the isolated debug store.
    // Inert in normal play — this whole effect only runs when demo/fsrsDebug is on.
    const review = (note: string, correct: boolean) => {
      const mem = ensureNoteMemory(note)
      const grade = autoGrade(correct, correct ? 800 : 2000)
      fsrsRef.current[note] = reviewNote(mem, grade)
      saveFsrs()
      if (correct) recordMasteryProgressForReview(note)
      const prior = levelProgressRef.current
      const next = recordPitchforksLevelOutcome(prior, {
        targetKey: `debug:${runtimeRef.current.wave}:${debugReviewSequenceRef.current++}:${note}`,
        correct,
        lane: 'voice',
        credit: 'recall',
        sampleState: 'valid',
      })
      if (next !== prior) {
        levelProgressRef.current = next
        setLevelProgress(next)
        maybeUnlockNextNote()
      }
      return {
        note,
        grade,
        level: next.level,
        levelAccuracyPercent: pitchforksLevelAccuracyPercent(next, 'voice'),
        unlockedCount: unlockedNotesRef.current.length,
        unlockedNotes: [...unlockedNotesRef.current],
        phase: fsrsRef.current[note].phase,
        lapses: fsrsRef.current[note].lapses,
      }
    }
    const resetDebug = () => {
      clearNewNoteCeremony()
      clearNoteMasteredCeremony()
      fsrsRef.current = {}
      earFsrsRef.current = {}
      masteryProgressRef.current = {}
    cueSupportProfileRef.current = { version: 1, notes: {} }
    unlockedNotesRef.current = [...STARTING_NOTES]
    runtimeRef.current.lastPickedVillagerNote = null
    setUnlockedNotes([...STARTING_NOTES])
    resetThunderhead()
    resetBellWave()
    debugReviewSequenceRef.current = 0
      rainActivationRequestedRef.current = false
      rainUiSignatureRef.current = ''
      setRainState(createRainState())
      clearNextWaveTimer()
      runGenerationRef.current += 1
      pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
      villageReturnQueueRef.current = createVillageReturnQueue(`village-return:${runGenerationRef.current}`)
      villageReturnOffersRef.current.clear()
      villageReturnContextPlayedRef.current.clear()
      completedVillageEncounterCountRef.current = 0
      resetLevelProgress(1)
      for (const n of unlockedNotesRef.current) {
        ensureNoteMemory(n)
        ensureEarNoteMemory(n)
      }
      saveFsrs('voice')
      saveFsrs('buttons')
      saveMasteryProgress()
      saveCueSupport()
      return { unlockedCount: unlockedNotesRef.current.length, notes: [...unlockedNotesRef.current] }
    }
    const showMasteryCeremony = (note: string) => {
      showNoteMastered(note)
      return { note, noteMastered: noteMasteredRef.current }
    }
    const forceMasteryForTest = (note: string) => {
      ensureNoteMemory(note)
      const prior = masteryProgressRef.current[note] ?? { sessionIds: [], masteredAt: null }
      masteryProgressRef.current[note] = {
        sessionIds: prior.sessionIds.length > 0 ? prior.sessionIds : ['debug-forced-session'],
        masteredAt: Date.now(),
      }
      saveMasteryProgress()
      return { note, masteredAt: masteryProgressRef.current[note].masteredAt }
    }
    const simulateHeardYouForTest = () => {
      heardYouRef.current = true
      setHeardYou(true)
      setMicCheckStep('ready')
      setMicReadiness('ready')
      return { heardYou: true }
    }
    const forceMissForTest = () => {
      getActiveTarget()
      frankReactionKindRef.current = 'miss'
      frankReactionStartedAtRef.current = performance.now()
      return { triggered: true }
    }
    const hook = Object.freeze({
      getState,
      get viewState() {
        return viewStateRef.current
      },
      review,
      resetDebug,
      showMasteryCeremony,
      forceMasteryForTest,
      simulateHeardYouForTest,
      forceMissForTest,
    })

    Object.defineProperty(window, '__pf3', {
      configurable: true,
      value: hook,
    })

    return () => {
      if (window.__pf3 === hook) delete window.__pf3
    }
  }, [activeFsrsStore, clearNextWaveTimer, clearNewNoteCeremony, clearNoteMasteredCeremony, cuePlayingNow, demoMode, earFsrsStorageKey, ensureEarNoteMemory, ensureNoteMemory, fsrsDebugMode, fsrsStorageKey, getActiveTarget, matchingSuppressedNow, maybeUnlockNextNote, newNoteUnlocked, noteMastered, recordMasteryProgressForReview, resetBellWave, resetLevelProgress, resetThunderhead, saveCueSupport, saveFsrs, saveMasteryProgress, showNoteMastered])

  const pickVillagerNotes = useCallback((totalTines: TineCount, wave: number, encounterIndex: number) => {
    const pool = unlockedNotesRef.current.length > 0 ? unlockedNotesRef.current : [...STARTING_NOTES]
    const fsrsStore = activeFsrsStore()
    for (const note of pool) ensureActiveNoteMemory(note)

    const patientNotes = deterministicPairNotes(pool, wave, encounterIndex, totalTines, demoRef.current)
    if (patientNotes) {
      runtimeRef.current.lastPickedVillagerNote = patientNotes[patientNotes.length - 1] ?? null
      return patientNotes
    }

    const stage = curriculumStageForWave(wave, demoRef.current)
    let exclude: string | null = stage === 'step-chain' ? runtimeRef.current.lastPickedVillagerNote : null
    const pickFromPool = (candidatePool: string[]) => {
      const narrowedPool = stage === 'step-chain'
        ? stepChainCandidatePool(candidatePool, exclude)
        : candidatePool
      const nextNote = pickNextNote(narrowedPool, fsrsStore, exclude)
      ensureActiveNoteMemory(nextNote)
      exclude = nextNote
      runtimeRef.current.lastPickedVillagerNote = nextNote
      return nextNote
    }

    if (totalTines > 1) {
      const isMasteredNote = (note: string) => {
        if (inputModeRef.current === 'buttons') return fsrsStore[note]?.phase === 'review'
        const masteredAt = masteryProgressRef.current[note]?.masteredAt
        return masteredAt !== null && masteredAt !== undefined
      }
      const masteredPool = pool.filter(isMasteredNote)

      if (masteredPool.length > 0) {
        const weakPool = pool.filter(note => !isMasteredNote(note))
        const notes: string[] = []

        if (weakPool.length > 0) {
          const weakNote = pickFromPool(weakPool)
          notes.push(weakNote)
        }

        while (notes.length < totalTines) {
          const masteredNote = pickFromPool(masteredPool)
          notes.push(masteredNote)
        }

        return notes
      }
    }

    const notes: string[] = []
    for (let i = 0; i < totalTines; i++) {
      const nextNote = pickFromPool(pool)
      notes.push(nextNote)
    }
    return notes
  }, [activeFsrsStore, ensureActiveNoteMemory])

  const spawnVillager = useCallback(() => {
    const rt = runtimeRef.current
    if (rt.spawned >= rt.plan.count) return
    const spawnIndex = rt.spawned
    const totalTines = rt.plan.tineCounts[rt.spawned] ?? 2
    const lane = spawnIndex % 3
    const notes = pickVillagerNotes(totalTines, rt.wave, spawnIndex)
    if (galvanicProofRef.current && rt.wave === 1 && spawnIndex < GALVANIC_PROOF_FIRST_NOTES.length) {
      const firstNote = GALVANIC_PROOF_FIRST_NOTES[spawnIndex]
      notes[0] = firstNote
      ensureActiveNoteMemory(firstNote)
    }
    const targetNote = notes[0]
    const encounterIndex = presentationVisitCountByTargetRef.current.get(targetNote) ?? 0
    const range = rangeProfileRef.current
    const journey = presentationJourneyRef.current
    const supportedLesson = normalVillageLessonAvailable() &&
      inputModeRef.current === 'voice' &&
      totalTines === 1 &&
      !!range &&
      !!journey &&
      notes.length === 1
      ? selectVillageLessonCandidate({
          admittedNotes: unlockedNotesRef.current,
          introducedNotes: [...journey.guidedNotes, ...journey.unlockedNotes],
          comfortableRange: range,
          targetNote,
          encounterIndex,
        })
      : undefined
    // Reserve before the actor reaches the renderer, so no answer badge can
    // precede the unaided-return concealment and no batch can reuse an offer.
    const reservedRevisions = new Set([...villageReturnOffersRef.current.values()].map(offer => offer.revision))
    const returnOffer = supportedLesson && range && journey
      ? selectVillageReturnOffer({
          ...villageReturnQueueRef.current,
          entries: villageReturnQueueRef.current.entries.filter(entry => !reservedRevisions.has(entry.revision)),
        }, {
          runId: `village-return:${runGenerationRef.current}`,
          targetNote,
          completedEncounterCount: completedVillageEncounterCountRef.current,
          nowMs: performance.now(),
          candidateEligibility: {
            admittedNotes: unlockedNotesRef.current,
            introducedNotes: [...journey.guidedNotes, ...journey.unlockedNotes],
            comfortableRange: range,
          },
        })
      : undefined
    const attackTimer = attackTimeForWave(rt.wave, spawnIndex)
    const spriteWidth = (assetsRef.current.villagerMeta[totalTines] ?? defaultVillagerMeta).frame_w * SPRITE_SCALE
    const v: Villager = {
      id: ++nextIdRef.current,
      totalTines,
      x: galvanicProofRef.current && rt.wave === 1
        ? GALVANIC_PROOF_X[spawnIndex] ?? W - 150
        : demoRef.current ? W - 150 : villagerEntryX(W, spriteWidth),
      y: GROUND_Y - defaultVillagerMeta.frame_h * SPRITE_SCALE - lane * 6,
      speed: rt.plan.speed + lane * 1.8,
      notes,
      burned: 0,
      state: 'walking',
      spawnIndex,
      attackTimer,
      attackTimerMax: attackTimer,
      sequenceCued: false,
      walkFrame: 0,
      walkClock: 0,
      ashTimer: 0,
      torch: (demoRef.current || normalBellRouteAvailable()) && !bellProofRef.current && spawnIndex % 2 === 0 ? createTorchState() : createInactiveTorchState(),
      torchBearer: (demoRef.current || normalBellRouteAvailable()) && !bellProofRef.current && spawnIndex % 2 === 0,
      ...(supportedLesson ? {
        supportedLesson: {
          objective: returnOffer?.objective ?? supportedLesson.objective,
          contextNote: returnOffer?.contextNote ?? supportedLesson.contextNote,
          targetNote: returnOffer?.targetNote ?? supportedLesson.targetNote,
          support: returnOffer?.support ?? 'SUPPORTED',
        },
      } : {}),
    }
    // The regular demo path keeps its measured far-entry movement for rain
    // and torch showcase coverage. Add one clearly labeled close-threat seed
    // so the private Smash control can be exercised without waiting ~30 s.
    if (bellProofRef.current && rt.wave === 1) {
      // Bell proof actors stay ordinary walking villagers, but the
      // environmental torch lane is intentionally absent so an exact Bell
      // charge cannot be consumed by the unrelated douse action.
      v.torch = createInactiveTorchState()
      v.torchBearer = false
    } else if (galvanicProofRef.current && rt.wave === 1) {
      // The proof keeps every actor live and spaced so the release snapshot
      // has three deterministic one-tine candidates.
      v.torch = createInactiveTorchState()
      v.torchBearer = false
    } else if (demoRef.current && rt.wave === 1 && spawnIndex === 0) {
      v.x = FRANK_REACH_X
      v.torch = createInactiveTorchState()
      v.torchBearer = false
      demoStepRef.current = 'close-smash-threat-showcase'
    } else if (demoRef.current && closeSmashProofRef.current && rt.wave === 1 && spawnIndex === 1) {
      // Keep the three-tine negative-control bystander close enough to recoil
      // visibly while remaining a separate active-target candidate.
      v.x = FRANK_REACH_X + 96
      v.torch = createInactiveTorchState()
      v.torchBearer = false
    }
    if (returnOffer) villageReturnOffersRef.current.set(`${v.id}:0`, returnOffer)
    rt.villagers.push(v)
    if (supportedLesson) {
      presentationVisitCountByTargetRef.current.set(
        targetNote,
        encounterIndex >= Number.MAX_SAFE_INTEGER ? 0 : encounterIndex + 1,
      )
    }
    if (rt.firstVillagerId === null) rt.firstVillagerId = v.id
    rt.spawned += 1
  }, [normalVillageLessonAvailable, ensureActiveNoteMemory, normalBellRouteAvailable, pickVillagerNotes])

  const startWave = useCallback((wave: number) => {
    const rt = runtimeRef.current
    villageReturnOffersRef.current.clear()
    villageReturnContextPlayedRef.current.clear()
    clearNextWaveTimer()
    resetCloseSmash()
    resetThunderhead()
    resetBellWave()
    resetNormalBellPowerForRun(normalBellRouteAvailable())
    const rawPlan = fixedWaveDirector(wave, demoRef.current, closeSmashProofRef.current, galvanicProofRef.current)
    const masteredAdmittedNotes = unlockedNotesRef.current.filter(note => (
      inputModeRef.current === 'buttons'
        ? earFsrsRef.current[note]?.phase === 'review'
        : masteryProgressRef.current[note]?.masteredAt !== null && masteryProgressRef.current[note]?.masteredAt !== undefined
    )).length
    const maxTines: TineCount = masteredAdmittedNotes >= 3 ? 4 : masteredAdmittedNotes >= 2 ? 3 : 2
    const plan = !demoRef.current && wave >= 6
      ? { ...rawPlan, tineCounts: rawPlan.tineCounts.map(count => count > maxTines ? maxTines : count) }
      : rawPlan
    waveNotesHeardRef.current = new Set()
    waveNotesSungRef.current = new Set()
    waveStartedAtRef.current = Date.now()
    clearWaveReceipt()
    rt.wave = wave
    resetGalvanic()
    rt.plan = plan
    rt.spawned = 0
    rt.spawnClock = 0
    rt.bannerTimer = 1.15
    rt.nextWavePending = false
    rt.nextWaveNumber = null
    rt.nextWaveAtMs = null
    rt.nextWaveRunGeneration = null
    rt.rain = createRainState()
    rainActivationRequestedRef.current = false
    rainUiSignatureRef.current = ''
    setRainState(rt.rain)
    resetLevelProgress(wave)
    cueSupportByTargetRef.current = new Map()
    hintedTargetKeysRef.current = new Set()
    failureGradedKeysRef.current = new Set()
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    activePromptKeyRef.current = ''
    promptStartedAtRef.current = 0
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    setPromptText('')
    if (demoRef.current) demoStepRef.current = 'wave-banner'
    setHud({ wave, health: rt.health, score: rt.score, streak: rt.streak })
  }, [clearNextWaveTimer, clearWaveReceipt, normalBellRouteAvailable, resetBellWave, resetCloseSmash, resetGalvanic, resetLevelProgress, resetNormalBellPowerForRun, resetThunderhead, setPromptText])

  const addBolt = useCallback((
    villager: Villager,
    tineIndex: number,
    hue: number,
    note: string,
    presentation: BoltPresentation = 'ordinary',
  ) => {
    const a = assetsRef.current
    const frankMeta = a.frankMeta
    const vMeta = a.villagerMeta[villager.totalTines]
    const tine = vMeta.tines[Math.max(0, Math.min(tineIndex, vMeta.tines.length - 1))]
    const pivotX = FRANK_X + frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
    const pivotY = FRANK_Y + frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
    const forkPivotX = villager.x + (vMeta.frame_w - vMeta.fork_base.x) * SPRITE_SCALE
    const forkPivotY = villager.y + vMeta.fork_base.y * SPRITE_SCALE
    const rawToX = villager.x + (vMeta.frame_w - tine.x) * SPRITE_SCALE
    const rawToY = villager.y + tine.y * SPRITE_SCALE
    const { x: toX, y: toY } = rotateAroundPivot(rawToX, rawToY, forkPivotX, forkPivotY, FORK_LEAN_DEG)
    runtimeRef.current.bolts.push({
      // Ordinary strikes originate at the shipped cloud relay. Smash contact
      // deliberately overrides only this presentation origin: the accepted
      // joined-hand cell drives the same authoritative tine endpoint.
      fromX: presentation === 'close-smash' || presentation === 'galvanic'
        ? FRANK_X + CLOSE_SMASH_HANDS_X * FRANK_SPRITE_SCALE
        : presentation === 'thunderhead'
          ? thunderheadStrikeOriginRef.current?.x ?? pivotX + FRANK_CLOUD_X_OFFSET
          : pivotX + FRANK_CLOUD_X_OFFSET,
      fromY: presentation === 'close-smash' || presentation === 'galvanic'
        ? FRANK_Y + CLOSE_SMASH_HANDS_Y * FRANK_SPRITE_SCALE
        : presentation === 'thunderhead'
          ? thunderheadStrikeOriginRef.current?.y ?? FRANK_CLOUD_Y
        : FRANK_CLOUD_Y,
      pivotX,
      pivotY,
      toX,
      toY,
      life: 0,
      maxLife: BOLT_LIFE_S,
      seed: villager.id * 131 + tineIndex * 37 + Math.round(hue),
      hue,
      note,
      villagerId: villager.id,
      tineIndex,
      presentation,
    })
  }, [])

  const addBurst = useCallback((villager: Villager, hue: number, kind: BurstKind) => {
    const meta = assetsRef.current.villagerMeta[villager.totalTines]
    const sw = meta.frame_w * SPRITE_SCALE
    const sh = meta.frame_h * SPRITE_SCALE
    runtimeRef.current.bursts.push({
      x: villager.x + sw / 2,
      y: villager.y + sh / 2,
      hue,
      kind,
      seed: (villager.id * 37 + villager.burned * 19 + hue * 3 + (kind === 'kill' ? 137 : 0)) % 997,
      life: -(BOLT_LIFE_S * STRIKE_IMPACT_START),
      maxLife: kind === 'kill' ? 0.58 : 0.26,
    })
  }, [])

  const strikeActiveTine = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    gradeReview = true,
    presentation: BoltPresentation = 'ordinary',
  ) => {
    const rt = runtimeRef.current
    const { villager, tineIndex } = target
    const strikeNote = target.note ?? villager.notes[villager.burned]
    const strikeHue = hueForNote(strikeNote)
    if (gradeReview) reviewTargetNote(target, true)
    lastStrikeNoteRef.current = strikeNote ?? null
    lastStrikeHueRef.current = strikeHue
    const wasMatchingSuppressed = matchingSuppressedNow()
    addBolt(villager, tineIndex, strikeHue, strikeNote, presentation)
    addBurst(villager, strikeHue, 'strike')
    if (villager.id === rt.firstVillagerId && villager.burned === 0) {
      clearFirstMinuteTimer()
      setFirstMinuteCoachSnapshot('strike', strikeNote)
      const callbackGeneration = runGenerationRef.current
      const callbackFence = pauseGateRef.current.fence
      firstMinuteTimerRef.current = setTimeout(() => {
        if (!acceptsPitchforksPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence) ||
          pausedRef.current || phaseRef.current !== 'playing') {
          firstMinuteTimerRef.current = null
          return
        }
        setFirstMinuteCoachSnapshot('victory', strikeNote)
        firstMinuteTimerRef.current = setTimeout(() => {
          if (acceptsPitchforksPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence) &&
            !pausedRef.current && phaseRef.current === 'playing') setFirstMinuteCoachSnapshot('complete', null)
          firstMinuteTimerRef.current = null
        }, 1700)
      }, 700)
    }
    villager.burned += 1
    burnedTinesRef.current += 1
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    demoLockCountRef.current += 1
    if (wasMatchingSuppressed) lockWhileSuppressedRef.current = true
    if (demoRef.current) demoStepRef.current = 'strike'
    localSfx('strike', sfxVolumeRef.current)

    if (villager.burned >= villager.totalTines) {
      villager.state = 'ash'
      villager.ashTimer = 1.1
      ashCountRef.current += 1
      lastAshAtRef.current = performance.now()
      fullSequenceCompleteRef.current = true
      if (demoRef.current) demoStepRef.current = 'ash'
      rt.streak += 1
      const comboMult = rt.streak >= 10 ? 3 : rt.streak >= 5 ? 2 : 1
      rt.score += (100 + villager.totalTines * 20) * comboMult
      lastKillNoteRef.current = strikeNote ?? null
      lastKillHueRef.current = strikeHue
      addBurst(villager, strikeHue, 'kill')
      shakeStartedAtRef.current = performance.now()
      frankReactionKindRef.current = 'kill'
      frankReactionStartedAtRef.current = performance.now()
      localSfx('ash', sfxVolumeRef.current)
      localSfx('roar', sfxVolumeRef.current)
      roarFiredCountRef.current += 1
      setHud({ wave: rt.wave, health: rt.health, score: rt.score, streak: rt.streak })
    } else {
      if (presentation === 'close-smash' || presentation === 'ordinary-fallback') {
        // A close receipt resolves one tine without freezing the world. Give
        // the surviving encounter its existing threat window again so an
        // attack apex cannot immediately grade every remaining tine as miss.
        villager.attackTimer = villager.attackTimerMax
      }
      const nextNote = villager.notes[villager.burned]
      if (nextNote) {
        presentMusicalPrompt({
          key: `${villager.id}:${villager.burned}`,
          note: nextNote,
          burned: villager.burned,
          firstMinute: villager.id === runtimeRef.current.firstVillagerId,
        })
      }
    }
    if (firstLockGraceRef.current) firstLockGraceRef.current = false
  }, [addBolt, addBurst, clearFirstMinuteTimer, matchingSuppressedNow, presentMusicalPrompt, reviewTargetNote, setFirstMinuteCoachSnapshot, setPromptText])

  const confirmThunderheadLock = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    logicalNowMs: number,
  ) => {
    if (
      !thunderheadRouteAvailable() ||
      inputModeRef.current !== 'voice' ||
      !thunderheadArmRequestedRef.current ||
      (thunderheadStateRef.current.phase !== 'idle' && thunderheadStateRef.current.phase !== 'consumed')
    ) return false

    const identity = pitchIdentity(target.note)
    if (!identity) {
      thunderheadArmRequestedRef.current = false
      thunderheadLastTransitionReasonRef.current = 'invalid-receipt'
      return false
    }
    const sequence = ++thunderheadSequenceRef.current
    const receipt: PitchforksThunderheadLockReceipt = Object.freeze({
      bankId: `thunderhead-bank:${runGenerationRef.current}:${sequence}`,
      lockId: `thunderhead-lock:${runGenerationRef.current}:${sequence}:${target.key}`,
      targetKey: target.key,
      pitchClass: identity.pitchClass,
      // Canonical rune mapping is unresolved. Exact note text is the truthful
      // temporary readable label; the debug/UI status keeps that gate open.
      rune: target.note,
      colorToken: NOTE_COLORS[target.note]?.name ?? 'unresolved-color-token',
      note: target.note,
      octave: identity.octave,
    })
    const confirmation = transitionThunderhead({
      type: 'lock_confirmed',
      logicalTimeMs: logicalNowMs,
      receipt,
    })
    if (!confirmation.accepted) {
      thunderheadArmRequestedRef.current = false
      return false
    }
    const banked = transitionThunderhead({ type: 'banked', logicalTimeMs: logicalNowMs })
    if (!banked.accepted) {
      resetThunderhead()
      thunderheadLastTransitionReasonRef.current = banked.reason
      return false
    }

    thunderheadArmRequestedRef.current = false
    thunderheadReleaseRequestedRef.current = false
    thunderheadTravelStartedAtRef.current = 0
    const frankMeta = assetsRef.current.frankMeta
    const start = Object.freeze({
      x: FRANK_X + frankMeta.rod_tip.x * FRANK_SPRITE_SCALE + FRANK_CLOUD_X_OFFSET + THUNDERHEAD_BANK_X_OFFSET,
      y: FRANK_CLOUD_Y,
    })
    const targetPoint = thunderheadTargetPoint(target, assetsRef.current)
    thunderheadTravelStartRef.current = start
    thunderheadTravelTargetRef.current = Object.freeze({ x: targetPoint.x, y: THUNDERHEAD_CEILING_Y })
    thunderheadMatchDueAtRef.current = 0
    thunderheadStrikeOriginRef.current = null
    firstLockGraceRef.current = false
    if (demoRef.current) demoStepRef.current = 'thunderhead-banked'
    setPromptText(`THUNDERHEAD BANKED · ${target.note}`)
    return true
  }, [thunderheadRouteAvailable, resetThunderhead, setPromptText, transitionThunderhead])

  const confirmGalvanicLock = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
  ) => {
    if (
      !galvanicRouteAvailable() ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      !galvanicArmRequestedRef.current ||
      galvanicAwaitingSilenceRef.current ||
      galvanicBanksRef.current.length >= GALVANIC_BANK_CAPACITY ||
      galvanicArmedTargetKeyRef.current !== target.key ||
      matchingSuppressedNow()
    ) return false

    const identity = pitchIdentity(target.note)
    const state = galvanicStateRef.current
    const expectedBattleId = `galvanic:${runGenerationRef.current}:${runtimeRef.current.wave}`
    if (!identity || state.battleId !== expectedBattleId || galvanicBanksRef.current.some(bank => bank.targetKey === target.key)) {
      galvanicArmRequestedRef.current = false
      galvanicArmedTargetKeyRef.current = ''
      galvanicLastReasonRef.current = !identity ? 'invalid-target' : state.battleId !== expectedBattleId ? 'battle-mismatch' : 'duplicate-target'
      publishGalvanicProjection()
      return false
    }

    const sequence = ++galvanicSequenceRef.current
    const receipt: PitchforksGalvanicLock = Object.freeze({
      battleId: state.battleId,
      lockId: `galvanic-lock:${runGenerationRef.current}:${runtimeRef.current.wave}:${sequence}:${target.key}:${target.note}:${identity.octave}`,
      targetKey: target.key,
      note: target.note,
      octave: identity.octave,
    })
    galvanicBanksRef.current = [...galvanicBanksRef.current, receipt]
    galvanicArmRequestedRef.current = false
    galvanicArmedTargetKeyRef.current = ''
    // A bank is not a strike. Clear the ordinary hold and require an observed
    // inactive sample before the next target can be acquired or credited.
    galvanicAwaitingSilenceRef.current = true
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    galvanicLastReasonRef.current = 'banked'
    if (demoRef.current) demoStepRef.current = 'galvanic-banked'
    publishGalvanicProjection()
    setPromptText(`GALVANIC BANKED · ${receipt.note} · ${galvanicBanksRef.current.length}/${GALVANIC_BANK_CAPACITY}`)
    return true
  }, [galvanicRouteAvailable, matchingSuppressedNow, publishGalvanicProjection, setPromptText])

  const confirmBellCharge = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    logicalNowMs: number,
  ) => {
    if (
      !bellProofRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      !bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmedTargetKeyRef.current !== target.key
    ) return false

    const frequency = noteToFreq(target.note)
    if (!Number.isFinite(frequency) || frequency <= 0) {
      bellArmRequestedRef.current = false
      bellArmedTargetKeyRef.current = ''
      bellLastReasonRef.current = 'invalid-note'
      return false
    }

    const sequence = ++bellChargeSequenceRef.current
    const receipt: BellChargeReceipt = Object.freeze({
      receiptId: `bell-charge:${runGenerationRef.current}:${sequence}:${target.key}`,
      targetKey: target.key,
      note: target.note,
      frequency,
      chargedAtMs: logicalNowMs,
    })
    // Publish the exclusive receipt before any prompt/UI side effect. A
    // second rAF or click can therefore observe READY and cannot re-fund it.
    bellArmRequestedRef.current = false
    bellArmedTargetKeyRef.current = ''
    bellChargeReceiptRef.current = receipt
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    bellLastReasonRef.current = 'charged'
    if (demoRef.current) demoStepRef.current = 'bell-charged'
    commitBellWaveState(bellWaveStateRef.current, logicalNowMs, true)
    setPromptText(`BELL READY · ${receipt.note} · RING BELLS`)
    return true
  }, [commitBellWaveState, getActiveTarget, setPromptText])

  const requestBellArm = useCallback(() => {
    const state = bellWaveStateRef.current
    const normalRoute = normalBellRouteAvailable()
    if (normalRoute) {
      const current = bellPowerStateRef.current
      if (
        !current ||
        current.runId !== `bell-power:${runGenerationRef.current}` ||
        current.phase !== 'ready' ||
        phaseRef.current !== 'playing' ||
        inputModeRef.current !== 'voice' ||
        state.phase !== 'idle' && state.phase !== 'finished' ||
        bellReleaseRequestedRef.current ||
        closeSmashStateRef.current.phase !== 'idle' ||
        thunderheadStateRef.current.phase !== 'idle' && thunderheadStateRef.current.phase !== 'consumed' ||
        thunderheadArmRequestedRef.current ||
        galvanicArmRequestedRef.current ||
        galvanicReleaseRequestedRef.current ||
        galvanicBanksRef.current.length > 0
      ) return

      const decision = startPitchforksBellPowerActivation(current)
      if (!decision.accepted) return
      commitBellPowerState(decision.state)
      bellActivationNoteRef.current = null
      bellActivationEventSequenceRef.current = 0
      lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      activeKeyRef.current = `bell-activation:${current.runId}:0`
      bellLastReasonRef.current = 'activation-started'
      setBellWaveProjection(projectPitchforksBellWave(bellWaveStateRef.current, bellWaveClockMsRef.current))
      setPromptText(`BELL ACTIVATION · SING ${current.taughtPair[0]} · STEP 1/2`)
      return
    }

    const target = getActiveTarget()
    const thunderheadBusy = thunderheadStateRef.current.phase !== 'idle' && thunderheadStateRef.current.phase !== 'consumed'
    const galvanicBusy = galvanicArmRequestedRef.current || galvanicReleaseRequestedRef.current || galvanicBanksRef.current.length > 0
    if (
      !bellProofRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      !target ||
      state.phase !== 'idle' && state.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      closeSmashStateRef.current.phase !== 'idle' ||
      thunderheadBusy ||
      thunderheadArmRequestedRef.current ||
      galvanicBusy
    ) return

    bellArmRequestedRef.current = true
    bellArmedTargetKeyRef.current = target.key
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = target.key
    bellLastReasonRef.current = 'arming'
    if (demoRef.current) demoStepRef.current = 'bell-arming'
    setBellWaveProjection(projectPitchforksBellWave(bellWaveStateRef.current, bellWaveClockMsRef.current))
    // Arming is only intent. Preserve the current cue/impact prompt, while
    // processLock keeps its existing playback-suppression gate on earning.
    if (!cuePlayingNow() && !matchingSuppressedNow() && !strikePresentationPending()) {
      setPromptText(`BELL CHARGE · HOLD ${target.note}`)
    }
  }, [commitBellPowerState, cuePlayingNow, getActiveTarget, matchingSuppressedNow, normalBellRouteAvailable, setBellWaveProjection, setPromptText, strikePresentationPending])

  const cancelBellActivation = useCallback(() => {
    if (!normalBellRouteAvailable() || phaseRef.current !== 'playing' || inputModeRef.current !== 'voice') return
    const current = bellPowerStateRef.current
    if (!current || current.phase !== 'activating') return
    const decision = cancelPitchforksBellPowerActivation(current)
    if (!decision.accepted) return
    commitBellPowerState(decision.state)
    bellActivationNoteRef.current = null
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    bellLastReasonRef.current = 'activation-cancelled'
    setPromptText(`BELL READY · ${current.taughtPair.join(' → ')} · RETRY WHEN READY`)
  }, [commitBellPowerState, normalBellRouteAvailable, setPromptText])

  const requestBellRelease = useCallback(() => {
    const normalRoute = normalBellRouteAvailable()
    if (normalRoute) {
      const current = bellPowerStateRef.current
      const receipt = current?.pendingReceipt ?? null
      if (
        !current ||
        current.runId !== `bell-power:${runGenerationRef.current}` ||
        current.phase !== 'pending' ||
        !receipt ||
        phaseRef.current !== 'playing' ||
        inputModeRef.current !== 'voice' ||
        bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
        bellReleaseRequestedRef.current
      ) return
      bellReleaseRequestedRef.current = true
      bellLastReasonRef.current = 'release-queued'
      setBellWaveProjection(projectPitchforksBellWave(bellWaveStateRef.current, bellWaveClockMsRef.current))
      setPromptText(`BELL RELEASE QUEUED · ${receipt.taughtPair.join(' → ')}`)
      return
    }

    const receipt = bellChargeReceiptRef.current
    if (
      !bellProofRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      !receipt ||
      bellReleaseRequestedRef.current
    ) return
    bellReleaseRequestedRef.current = true
    bellLastReasonRef.current = 'release-queued'
    if (demoRef.current) demoStepRef.current = 'bell-release-queued'
    setBellWaveProjection(projectPitchforksBellWave(bellWaveStateRef.current, bellWaveClockMsRef.current))
    setPromptText(`BELL RELEASE QUEUED · ${receipt.note}`)
  }, [normalBellRouteAvailable, setBellWaveProjection, setPromptText])

  const processNormalBellActivation = useCallback(() => {
    const current = bellPowerStateRef.current
    if (!normalBellRouteAvailable() || !current || current.phase !== 'activating') return false

    const stepIndex = current.activationNotes.length
    const expected = current.taughtPair[stepIndex]
    if (!expected) return true
    const stepKey = `${current.runId}:${stepIndex}`
    if (activeKeyRef.current !== `bell-activation:${stepKey}`) {
      activeKeyRef.current = `bell-activation:${stepKey}`
      bellActivationNoteRef.current = null
      lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
    }

    const now = performance.now()
    const observation = observePitchforksSongcraftGeneration(lockGenerationRef.current, pitchGenerationRef.current, now, TRAIL_MS)
    lockGenerationRef.current = observation.state
    const health = micSourceHealthRef.current
    const suppressed = matchingSuppressedNow()
    const pageVisible = typeof document === 'undefined' || document.visibilityState === 'visible'
    const unreliable = pitchforksMicUnreliable({
      // Activation is an active voice lane even when the moving combat roster
      // has no current target. Keep the existing microphone health authority.
      hasTarget: true,
      isListening: isListeningRef.current,
      micError: micErrorRef.current,
      audioContextState: health.audioContextState,
      trackReadyState: health.trackReadyState,
      trackMuted: health.trackMuted,
      matchingSuppressed: suppressed,
      pageVisible,
      generationObserved: observation.state.generationObserved,
      generationAgeMs: observation.state.generationObserved
        ? now - observation.state.generationObservedAt
        : Number.POSITIVE_INFINITY,
      staleAfterMs: TRAIL_MS,
    })
    if (unreliable || suppressed || observation.staleRecovery) {
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
    }
    if (unreliable || suppressed) {
      lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
      return true
    }
    // A render frame is not a microphone sample and cannot confirm either
    // activation note. The shared generation observer is the freshness fence.
    if (!observation.generationAdvanced) return true

    const source = pitchRef.current
    if (!source?.isActive || source.confidence < CONFIDENCE_FLOOR || source.frequency <= 0) {
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      bellActivationNoteRef.current = null
      return true
    }

    const actual = source.note
    const actualFrequency = noteToFreq(actual)
    if (!Number.isFinite(actualFrequency) || actualFrequency <= 0) {
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      bellActivationNoteRef.current = null
      return true
    }
    const actualCents = Math.abs(exactCents(source.frequency, actualFrequency))
    if (actualCents > MATCH_TOLERANCE_CENTS) {
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      bellActivationNoteRef.current = null
      return true
    }
    if (bellActivationNoteRef.current !== actual) {
      // A stable note identity starts a fresh exact hold. This prevents one
      // detector sample from confirming both steps while still allowing the
      // player to move directly from the first taught note to the second.
      bellActivationNoteRef.current = actual
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
    }

    const expectedFrequency = noteToFreq(expected)
    const expectedExact = actual === expected && Number.isFinite(expectedFrequency)
      && Math.abs(exactCents(source.frequency, expectedFrequency)) <= MATCH_TOLERANCE_CENTS
    tintRef.current = colorForCents(expectedExact ? Math.abs(exactCents(source.frequency, expectedFrequency)) : actualCents)
    // Only detector freshness advances the exact hold. A zero elapsed sample
    // (including stale recovery) must not borrow RAF time into activation.
    lockHeldMsRef.current = Math.min(HOLD_MS, lockHeldMsRef.current + Math.max(0, observation.freshElapsedMs))
    lockProgressRef.current = Math.min(1, lockHeldMsRef.current / HOLD_MS)
    if (lockProgressRef.current < 1) return true

    const eventId = `activation:${current.runId}:${++bellActivationEventSequenceRef.current}:${stepIndex}:${actual}`
    const decision = acceptPitchforksBellPowerActivationNote(current, {
      runId: current.runId,
      eventId,
      note: actual,
      confirmed: true,
    })
    bellLastReasonRef.current = decision.reason
    if (decision.state !== current) commitBellPowerState(decision.state)
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    bellActivationNoteRef.current = null
    activeKeyRef.current = ''

    if (decision.accepted && decision.completed) {
      setPromptText(`BELL PAIR READY · ${current.taughtPair.join(' → ')} · RING BELLS`)
    } else if (decision.accepted) {
      const next = current.taughtPair[stepIndex + 1] ?? current.taughtPair[1]
      setPromptText(`BELL ACTIVATION · SING ${next} · STEP ${stepIndex + 2}/2`)
    } else {
      // Wrong, duplicate, stale, or unadmitted input never spends the earned
      // charge; the pure controller has already returned the attempt to ready.
      setPromptText(`BELL READY · ${current.taughtPair.join(' → ')} · RETRY WHEN READY`)
    }
    return true
  }, [commitBellPowerState, matchingSuppressedNow, normalBellRouteAvailable, setPromptText])

  const advanceBellWaveLifecycle = useCallback((logicalNowMs: number, paused: boolean) => {
    const current = bellWaveStateRef.current
    const normalRoute = normalBellRouteAvailable()
    if ((!bellProofRef.current && !normalRoute) || phaseRef.current !== 'playing' || inputModeRef.current !== 'voice') {
      if (
        current.phase !== 'idle' ||
        bellArmRequestedRef.current ||
        bellChargeReceiptRef.current !== null ||
        bellReleaseRequestedRef.current
      ) resetBellWave(false)
      return
    }
    // Hidden/environmental/ceremony pauses hold both the release request and
    // the pure lifecycle clock. A Bell's own later ring audio is not included
    // in this caller-supplied pause bit, so it cannot freeze its wave.
    if (paused) return

    if (bellReleaseRequestedRef.current && (current.phase === 'idle' || current.phase === 'finished')) {
      const privateReceipt = bellChargeReceiptRef.current
      const normalState = normalRoute ? bellPowerStateRef.current : null
      const normalReceipt = normalState?.pendingReceipt ?? null
      const receipt = privateReceipt ?? normalReceipt
      const releaseRoster = liveBellWaveRoster(runtimeRef.current.villagers)
      bellReleaseRequestedRef.current = false
      if (!receipt || releaseRoster.length === 0) {
        bellLastReasonRef.current = !receipt ? 'missing-charge' : 'no-live-roster'
        return
      }
      const decision = releasePitchforksBellWave(current, {
        receipt: { receiptId: receipt.receiptId },
        releaseEligible: true,
        logicalTimeMs: logicalNowMs,
        bellOrigin: BELL_WAVE_ORIGIN,
        waveSpeed: BELL_WAVE_SPEED,
        waveDurationMs: BELL_WAVE_DURATION_MS,
        walkingVillagers: releaseRoster,
      })
      if (!decision.accepted || !decision.intent) {
        bellLastReasonRef.current = decision.reason
        return
      }
      // The helper consumes the charge identity before any release effects.
      // Keep the release roster as a caller-side revalidation fence so late
      // spawns cannot appear behind an already-passed wave front.
      if (privateReceipt) bellChargeReceiptRef.current = null
      if (normalReceipt && normalState) {
        // Only an accepted existing-wave release acknowledgement spends the
        // normal Bell readiness. A rejected/empty release leaves the same
        // pure-controller receipt available for the next button attempt.
        const acknowledgement = acknowledgePitchforksBellPowerWaveRelease(normalState, {
          runId: normalState.runId,
          receiptId: normalReceipt.receiptId,
          released: true,
        })
        if (acknowledgement.spent) {
          commitBellPowerState(acknowledgement.state)
        } else {
          bellLastReasonRef.current = `ack-${acknowledgement.reason}`
        }
      }
      bellReleaseStableIDsRef.current = new Set(releaseRoster.map(villager => villager.stableID))
      bellLastReasonRef.current = decision.reason
      commitBellWaveState(decision.state, logicalNowMs, true)
      if (sfxVolumeRef.current > 0 && bellLastRingReceiptIdRef.current !== decision.intent.receiptId) {
        bellLastRingReceiptIdRef.current = decision.intent.receiptId
        bellRingCountRef.current += 1
        const ringSuppressMs = PITCHFORKS_BELL_RING_MS + ECHO_TAIL_MS
        const ringStartedAtMs = performance.now()
        bellOwnRingSuppressionUntilRef.current = ringStartedAtMs + ringSuppressMs
        matchingSuppressedUntilRef.current = Math.max(
          matchingSuppressedUntilRef.current,
          bellOwnRingSuppressionUntilRef.current,
        )
        markToneEmitted(ringSuppressMs)
        localSfx('bell', sfxVolumeRef.current, 'note' in receipt ? receipt.note : receipt.taughtPair[0])
      }
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      activeKeyRef.current = ''
      if (demoRef.current) demoStepRef.current = 'bell-wave-active'
      setPromptText(`BELLS RING · ${privateReceipt?.note ?? normalReceipt?.taughtPair.join(' → ') ?? 'BELL'}`)
      return
    }

    if (current.phase !== 'active') return
    const releaseIDs = bellReleaseStableIDsRef.current
    const walkingRoster = liveBellWaveRoster(runtimeRef.current.villagers)
      .filter(villager => releaseIDs.has(villager.stableID))
    const decision: PitchforksBellWaveAdvanceDecision = advancePitchforksBellWave(current, {
      logicalTimeMs: logicalNowMs,
      walkingVillagers: walkingRoster,
    })
    if (!decision.accepted) {
      bellLastReasonRef.current = decision.reason
      return
    }
    commitBellWaveState(decision.state, logicalNowMs)
    if (decision.state.phase === 'finished') {
      bellLastReasonRef.current = 'finished'
      if (demoRef.current) demoStepRef.current = 'bell-wave-finished'
    }
    for (const intent of decision.intents) {
      const villager = runtimeRef.current.villagers.find(candidate => String(candidate.id) === intent.stableID)
      // A contact is an intent, not authority: revalidate the live gameplay
      // record before applying the bounded physical displacement.
      if (!villager || villager.state !== 'walking' || villager.burned >= villager.totalTines) continue
      // Bell Tower villagers approach Frank from the right; the wave pushes
      // them back along the safe +X direction, never toward the player.
      const direction = 1 as const
      bellKnockbackRef.current.set(villager.id, Object.freeze({
        startX: villager.x,
        direction,
        startedAtMs: intent.contactAtMs,
        expiresAtMs: intent.contactAtMs + BELL_KNOCKBACK_MS,
      }))
      bellRecoilUntilRef.current.set(villager.id, intent.contactAtMs + BELL_KNOCKBACK_MS)
    }
  }, [acknowledgePitchforksBellPowerWaveRelease, commitBellPowerState, commitBellWaveState, normalBellRouteAvailable, resetBellWave, setPromptText])

  const applyBellKnockback = useCallback((logicalNowMs: number) => {
    const rt = runtimeRef.current
    for (const [villagerId, knockback] of bellKnockbackRef.current) {
      const villager = rt.villagers.find(candidate => candidate.id === villagerId)
      if (!villager || villager.state !== 'walking' || villager.burned >= villager.totalTines) {
        bellKnockbackRef.current.delete(villagerId)
        bellRecoilUntilRef.current.delete(villagerId)
        continue
      }
      const progress = clamp((logicalNowMs - knockback.startedAtMs) / BELL_KNOCKBACK_MS, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const spriteWidth = (assetsRef.current.villagerMeta[villager.totalTines] ?? defaultVillagerMeta).frame_w * SPRITE_SCALE
      const nextX = knockback.startX + knockback.direction * BELL_KNOCKBACK_DISTANCE * eased
      villager.x = clamp(nextX, FRANK_REACH_X, W - spriteWidth)
      if (progress >= 1) bellKnockbackRef.current.delete(villagerId)
    }
    for (const [villagerId, untilMs] of bellRecoilUntilRef.current) {
      if (untilMs <= logicalNowMs) bellRecoilUntilRef.current.delete(villagerId)
    }
  }, [])

  const cancelGalvanic = useCallback((reason: string = 'cancelled') => {
    if (!galvanicRouteAvailable()) return
    resetGalvanic(false)
    galvanicLastReasonRef.current = reason
    publishGalvanicProjection()
    if (demoRef.current) demoStepRef.current = 'galvanic-cancelled'
    setPromptText(`GALVANIC CANCELLED · ${reason}`)
  }, [galvanicRouteAvailable, publishGalvanicProjection, resetGalvanic, setPromptText])

  const cancelThunderhead = useCallback((reason: PitchforksThunderheadTransitionReason) => {
    resetThunderhead()
    thunderheadLastTransitionReasonRef.current = reason
    if (demoRef.current) demoStepRef.current = 'thunderhead-cancelled'
    setPromptText(`THUNDERHEAD CANCELLED · ${reason}`)
  }, [resetThunderhead, setPromptText])

  const advanceThunderheadLifecycle = useCallback((logicalNowMs: number, paused: boolean) => {
    const current = thunderheadStateRef.current
    if (!thunderheadRouteAvailable() || inputModeRef.current !== 'voice') {
      if (current.phase !== 'idle' && current.phase !== 'consumed') resetThunderhead()
      return
    }

    if (current.phase === 'banked') {
      if (!thunderheadReleaseRequestedRef.current || paused) return
      thunderheadReleaseRequestedRef.current = false
      const detached = transitionThunderhead({ type: 'detached', logicalTimeMs: logicalNowMs })
      if (!detached.accepted) {
        cancelThunderhead(detached.reason)
        return
      }
      const travel = transitionThunderhead({ type: 'ceiling_travel', logicalTimeMs: logicalNowMs })
      if (!travel.accepted) {
        cancelThunderhead(travel.reason)
        return
      }
      thunderheadTravelStartedAtRef.current = logicalNowMs
      if (demoRef.current) demoStepRef.current = 'thunderhead-ceiling-travel'
      const note = travel.state.bank?.note ?? travel.state.receipt?.note ?? ''
      setPromptText(`THUNDERHEAD TRAVEL · ${note}`)
      return
    }

    if (current.phase === 'ceiling_travel') {
      if (paused || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return
      if (
        thunderheadTravelStartedAtRef.current <= 0 ||
        logicalNowMs - thunderheadTravelStartedAtRef.current < THUNDERHEAD_TRAVEL_MS
      ) return
      const receipt = current.bank ?? current.receipt
      const liveTarget = getActiveTarget()
      if (!receipt || !liveTarget) {
        cancelThunderhead('stale-target')
        return
      }
      const identity = pitchIdentity(liveTarget.note)
      if (
        identity &&
        identity.pitchClass === receipt.pitchClass &&
        identity.octave !== receipt.octave
      ) {
        cancelThunderhead('octave-mismatch')
        return
      }
      const target: PitchforksThunderheadTarget = {
        targetKey: liveTarget.key,
        note: liveTarget.note,
        octave: identity?.octave ?? Number.NaN,
      }
      const matched = transitionThunderhead({ type: 'target_match', logicalTimeMs: logicalNowMs, target })
      if (!matched.accepted) {
        cancelThunderhead(matched.reason)
        return
      }
      const start = thunderheadTravelStartRef.current ?? { x: FRANK_X + assetsRef.current.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE + FRANK_CLOUD_X_OFFSET + THUNDERHEAD_BANK_X_OFFSET, y: FRANK_CLOUD_Y }
      const targetPoint = thunderheadTravelTargetRef.current ?? { x: start.x, y: THUNDERHEAD_CEILING_Y }
      thunderheadStrikeOriginRef.current = Object.freeze({ x: targetPoint.x, y: targetPoint.y })
      thunderheadMatchDueAtRef.current = logicalNowMs + THUNDERHEAD_MATCH_SETTLE_MS
      if (demoRef.current) demoStepRef.current = 'thunderhead-target-match'
      setPromptText(`THUNDERHEAD TARGET MATCH · ${matched.state.matchedTarget?.note ?? liveTarget.note}`)
      return
    }

    if (current.phase !== 'target_match' || paused) return
    if (thunderheadMatchDueAtRef.current <= 0 || logicalNowMs < thunderheadMatchDueAtRef.current) return
    const receipt = current.bank ?? current.receipt
    const liveTarget = getActiveTarget()
    const matchedTarget = current.matchedTarget
    if (
      !receipt ||
      !matchedTarget ||
      !liveTarget ||
      liveTarget.key !== receipt.targetKey ||
      liveTarget.key !== matchedTarget.targetKey ||
      liveTarget.note !== receipt.note ||
      liveTarget.note !== matchedTarget.note ||
      (pitchIdentity(liveTarget.note)?.octave ?? Number.NaN) !== receipt.octave
    ) {
      cancelThunderhead('stale-target')
      return
    }
    const strike = transitionThunderhead({ type: 'strike', logicalTimeMs: logicalNowMs })
    if (!strike.accepted || !strike.intent) {
      cancelThunderhead(strike.reason)
      return
    }
    // `transitionThunderhead` publishes phase=strike before invoking the
    // existing strike authority. The receipt therefore cannot race a second
    // release or ordinary lock around this effect.
    strikeActiveTine(liveTarget, true, 'thunderhead')
    const consumed = transitionThunderhead({ type: 'consumed', logicalTimeMs: logicalNowMs })
    thunderheadMatchDueAtRef.current = 0
    if (!consumed.accepted) {
      thunderheadLastTransitionReasonRef.current = consumed.reason
      return
    }
    if (demoRef.current) demoStepRef.current = 'thunderhead-consumed'
    setPromptText(`THUNDERHEAD CONSUMED · ${strike.intent.note}`)
  }, [thunderheadRouteAvailable, cancelThunderhead, getActiveTarget, resetThunderhead, setPromptText, strikeActiveTine, transitionThunderhead])

  const arbitrateCloseSmash = useCallback((logicalNowMs: number) => {
    const current = closeSmashStateRef.current
    const receipt = current.receipt

    if (current.phase === 'ready' && receipt) {
      const request = closeSmashRequestRef.current
      const requestedForReceipt = request?.targetKey === receipt.targetKey
      const fallbackDue = closeSmashFallbackDueAtRef.current > 0 && logicalNowMs >= closeSmashFallbackDueAtRef.current
      if (!requestedForReceipt && !fallbackDue) return

      const liveTarget = getActiveTarget()
      const currentTargetKey = liveTarget?.key ?? null
      const consumer = requestedForReceipt ? 'smash' : 'ordinary-fallback'
      const decision = consumePitchforksCloseSmash(current, {
        consumer,
        currentTargetKey,
        logicalTimeMs: logicalNowMs,
        deadlineMs: closeSmashFallbackDueAtRef.current,
        contactAtMs: logicalNowMs + CLOSE_SMASH_CONTACT_DELAY_MS,
      })
      // Consume the request and replace the immutable state before any
      // presentation or strike side effect. This is the runtime CAS boundary.
      closeSmashRequestRef.current = null
      commitCloseSmashState(decision.state)
      if (!decision.intent) {
        if (decision.state.phase === 'idle') closeSmashFallbackDueAtRef.current = 0
        return
      }

      if (decision.intent.consumer === 'smash') {
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
        setPromptText(`CLOSE SMASH WIND-UP · ${decision.intent.receipt.pitch}`)
        if (demoRef.current) demoStepRef.current = 'close-smash-wind-up-showcase'
        return
      }

      // Ordinary fallback retains the existing presentation and strike seam.
      // The receipt has already been consumed above, so this path cannot race
      // a late deliberate tap into a second strike.
      const fallbackTarget = getActiveTarget()
      if (
        !fallbackTarget ||
        fallbackTarget.key !== decision.intent.receipt.targetKey ||
        String(fallbackTarget.villager.id) !== decision.intent.receipt.villagerId ||
        fallbackTarget.tineIndex !== decision.intent.receipt.tineIndex
      ) return
      // Fallback is still an earned resolution, so it shares the same
      // re-onset discipline as Smash before the next tine can lock.
      closeSmashReonsetNoteRef.current = decision.intent.receipt.pitch
      closeSmashReonsetStartedAtRef.current = performance.now()
      strikeActiveTine(fallbackTarget, true, 'ordinary-fallback')
      commitCloseSmashState(settlePitchforksCloseSmash(decision.state))
      closeSmashSettleDueAtRef.current = logicalNowMs + CLOSE_SMASH_SETTLE_MS
      closeSmashFallbackDueAtRef.current = 0
      if (demoRef.current) demoStepRef.current = 'close-smash-fallback-showcase'
    }

    const pending = closeSmashStateRef.current
    if (pending.phase === 'pending' && pending.consumer === 'smash' && pending.receipt) {
      const liveTarget = getActiveTarget()
      const currentTargetKey = liveTarget?.key ?? null
      const decision = presentPitchforksCloseSmashContact(pending, {
        currentTargetKey,
        logicalTimeMs: logicalNowMs,
      })
      // As with consumption, publish the helper's immutable state first. A
      // stale target therefore voids the receipt without invoking strike.
      commitCloseSmashState(decision.state)
      if (!decision.intent) {
        if (decision.state.phase === 'idle') closeSmashFallbackDueAtRef.current = 0
        return
      }

      const contactTarget = getActiveTarget()
      if (
        !contactTarget ||
        contactTarget.key !== decision.intent.receipt.targetKey ||
        String(contactTarget.villager.id) !== decision.intent.receipt.villagerId ||
        contactTarget.tineIndex !== decision.intent.receipt.tineIndex
      ) return

      const targetId = contactTarget.villager.id
      for (const bystander of runtimeRef.current.villagers) {
        const nearby = Math.abs(bystander.x - contactTarget.villager.x) <= CLOSE_SMASH_RECOIL_RADIUS_X &&
          Math.abs(bystander.y - contactTarget.villager.y) <= CLOSE_SMASH_RECOIL_RADIUS_Y
        if (bystander.state === 'walking' && bystander.id !== targetId && nearby) {
          closeSmashRecoilUntilRef.current.set(bystander.id, logicalNowMs + CLOSE_SMASH_RECOIL_MS)
        }
      }
      // Set the re-onset gate before striking so a continuous same-note voice
      // cannot immediately resolve the next tine after the receipt settles.
      closeSmashReonsetNoteRef.current = decision.intent.receipt.pitch
      closeSmashReonsetStartedAtRef.current = performance.now()
      strikeActiveTine(contactTarget, true, 'close-smash')
      localSfx('smash-contact', sfxVolumeRef.current, decision.intent.receipt.pitch)
      if (closeSmashRecoilUntilRef.current.size > 0) localSfx('recoil', sfxVolumeRef.current)
      commitCloseSmashState(settlePitchforksCloseSmash(decision.state))
      closeSmashSettleDueAtRef.current = logicalNowMs + CLOSE_SMASH_SETTLE_MS
      closeSmashFallbackDueAtRef.current = 0
      if (demoRef.current) demoStepRef.current = 'close-smash-contact-showcase'
    }

    const settled = closeSmashStateRef.current
    if (settled.phase === 'settle' && settled.receipt) {
      const hasStrikePresentation = runtimeRef.current.bolts.some(b => (
        b.villagerId === Number(settled.receipt?.villagerId) &&
        b.tineIndex === settled.receipt?.tineIndex
      ))
      const settleDue = closeSmashSettleDueAtRef.current
      if ((settleDue > 0 && logicalNowMs >= settleDue) || !hasStrikePresentation) {
        commitCloseSmashState(completePitchforksCloseSmashSettle(settled))
        closeSmashSettleDueAtRef.current = 0
        closeSmashFallbackDueAtRef.current = 0
        if (demoRef.current) demoStepRef.current = 'close-smash-settle-showcase'
      }
    }
  }, [commitCloseSmashState, getActiveTarget, setPromptText, strikeActiveTine])

  const requestCloseSmash = useCallback(() => {
    const state = closeSmashStateRef.current
    const target = getActiveTarget()
    if (
      galvanicOwnsInput() ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      state.phase !== 'ready' ||
      !state.receipt ||
      !target ||
      target.key !== state.receipt.targetKey
    ) return
    // The click only queues a consumer request. updateGame is the sole place
    // that calls the helper, preventing stale READY snapshots from double
    // consuming a receipt during a rerender or same-tick fallback.
    closeSmashRequestRef.current = Object.freeze({
      targetKey: state.receipt.targetKey,
      requestedAtMs: performance.now(),
    })
  }, [galvanicOwnsInput, getActiveTarget])

  const requestThunderheadArm = useCallback(() => {
    const state = thunderheadStateRef.current
    if (
      !thunderheadRouteAvailable() ||
      galvanicOwnsInput() ||
      bellPowerStateRef.current?.phase === 'activating' ||
      bellPowerStateRef.current?.phase === 'pending' ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      (state.phase !== 'idle' && state.phase !== 'consumed')
    ) return
    thunderheadArmRequestedRef.current = true
    if (demoRef.current) demoStepRef.current = 'thunderhead-armed'
    setPromptText('THUNDERHEAD ARMED · HOLD THE EXACT NOTE')
  }, [galvanicOwnsInput, thunderheadRouteAvailable, setPromptText])

  const requestThunderheadRelease = useCallback(() => {
    const state = thunderheadStateRef.current
    if (
      !thunderheadRouteAvailable() ||
      galvanicOwnsInput() ||
      bellPowerStateRef.current?.phase === 'activating' ||
      bellPowerStateRef.current?.phase === 'pending' ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      state.phase !== 'banked' ||
      !state.bank
    ) return
    thunderheadReleaseRequestedRef.current = true
    if (demoRef.current) demoStepRef.current = 'thunderhead-release-queued'
    setPromptText(`THUNDERHEAD RELEASE QUEUED · ${state.bank.note}`)
  }, [galvanicOwnsInput, thunderheadRouteAvailable, setPromptText])

  const requestGalvanicArm = useCallback(() => {
    const target = getActiveTarget()
    const thunderheadBusy = thunderheadStateRef.current.phase !== 'idle' && thunderheadStateRef.current.phase !== 'consumed'
    const thunderheadArmPending = thunderheadArmRequestedRef.current
    if (
      !galvanicRouteAvailable() ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      !target ||
      target.villager.torch.phase !== 'spent' ||
      galvanicArmRequestedRef.current ||
      galvanicAwaitingSilenceRef.current ||
      galvanicReleaseRequestedRef.current ||
      galvanicBanksRef.current.length >= GALVANIC_BANK_CAPACITY ||
      closeSmashStateRef.current.phase !== 'idle' ||
      thunderheadBusy ||
      thunderheadArmPending ||
      strikePresentationPending() ||
      cuePlayingNow() ||
      matchingSuppressedNow()
    ) return

    galvanicArmRequestedRef.current = true
    galvanicArmedTargetKeyRef.current = target.key
    galvanicAwaitingSilenceRef.current = true
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    galvanicLastReasonRef.current = 'armed'
    if (demoRef.current) demoStepRef.current = 'galvanic-armed'
    publishGalvanicProjection()
    setPromptText(`GALVANIC ARMED · HOLD ${target.note} FOR ${HOLD_MS} MS`)
  }, [galvanicRouteAvailable, cuePlayingNow, getActiveTarget, matchingSuppressedNow, publishGalvanicProjection, setPromptText, strikePresentationPending])

  const requestGalvanicRelease = useCallback(() => {
    if (
      !galvanicRouteAvailable() ||
      bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished' ||
      bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      bellReleaseRequestedRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      galvanicBanksRef.current.length < 1 ||
      galvanicBanksRef.current.length > GALVANIC_BANK_CAPACITY ||
      galvanicReleaseRequestedRef.current ||
      closeSmashStateRef.current.phase !== 'idle' ||
      thunderheadArmRequestedRef.current ||
      (thunderheadStateRef.current.phase !== 'idle' && thunderheadStateRef.current.phase !== 'consumed') ||
      strikePresentationPending()
    ) return
    galvanicReleaseRequestedRef.current = true
    galvanicLastReasonRef.current = 'release-queued'
    if (demoRef.current) demoStepRef.current = 'galvanic-release-queued'
    publishGalvanicProjection()
    setPromptText(`GALVANIC RELEASE QUEUED · ${galvanicBanksRef.current.length} BANK${galvanicBanksRef.current.length === 1 ? '' : 'S'}`)
  }, [galvanicRouteAvailable, publishGalvanicProjection, setPromptText, strikePresentationPending])

  const advanceGalvanicRelease = useCallback((logicalNowMs: number) => {
    if (!galvanicRouteAvailable() || inputModeRef.current !== 'voice') {
      galvanicReleaseRequestedRef.current = false
      return
    }
    if (!galvanicReleaseRequestedRef.current) return

    const generation = runGenerationRef.current
    const state = galvanicStateRef.current
    const banks = [...galvanicBanksRef.current]
    galvanicReleaseRequestedRef.current = false
    if (banks.length < 1 || banks.length > GALVANIC_BANK_CAPACITY) {
      galvanicLastReasonRef.current = 'no-bank'
      publishGalvanicProjection()
      return
    }

    const snapshot = liveGalvanicTargets(runtimeRef.current.villagers)
    if (snapshot.length === 0) {
      resetGalvanic(false)
      galvanicLastReasonRef.current = 'stale-target'
      publishGalvanicProjection()
      return
    }
    const request = {
      battleId: state.battleId,
      attackId: `galvanic-attack:${state.battleId}:${++galvanicAttackSequenceRef.current}`,
      expectedVersion: state.version,
      tines: snapshot.map(target => ({
        targetKey: target.key,
        note: target.note,
        octave: pitchIdentity(target.note)?.octave ?? Number.NaN,
      })),
      locks: banks,
    }
    // The run and helper snapshot are the caller's compare-and-swap fence.
    if (generation !== runGenerationRef.current || galvanicStateRef.current !== state) return
    const plan = planPitchforksGalvanicSweep(state, request)
    if (!plan.accepted) {
      galvanicLastReasonRef.current = plan.reason
      publishGalvanicProjection()
      return
    }
    if (generation !== runGenerationRef.current || galvanicStateRef.current !== state) return

    // Publish the consumed helper state and discard every pending bank before
    // the first strike/recoil effect can run.
    galvanicStateRef.current = plan.nextState
    galvanicBanksRef.current = []
    galvanicArmRequestedRef.current = false
    galvanicArmedTargetKeyRef.current = ''
    galvanicAwaitingSilenceRef.current = true
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    galvanicLastOutcomesRef.current = [...plan.outcomes]
    galvanicLastReasonRef.current = plan.reason
    publishGalvanicProjection()
    if (demoRef.current) demoStepRef.current = 'galvanic-release'
    setPromptText(`GALVANIC SWEEP · ${plan.outcomes.filter(outcome => outcome.kind === 'strike').length} STRIKE${plan.outcomes.filter(outcome => outcome.kind === 'strike').length === 1 ? '' : 'S'}`)

    let recoilPresented = false
    for (const outcome of plan.outcomes) {
      if (generation !== runGenerationRef.current || galvanicStateRef.current !== plan.nextState) return
      const live = liveGalvanicTargets(runtimeRef.current.villagers).find(candidate => {
        const identity = pitchIdentity(candidate.note)
        return candidate.key === outcome.targetKey && candidate.note === outcome.note && identity?.octave === outcome.octave
      })
      if (!live) continue
      if (outcome.kind === 'strike') {
        if (generation !== runGenerationRef.current || galvanicStateRef.current !== plan.nextState) return
        strikeActiveTine(live, true, 'galvanic')
      } else {
        // Recoil is deliberately presentation-only: the live target is
        // revalidated, but no tine, score, FSRS, miss, or health field changes.
        closeSmashRecoilUntilRef.current.set(live.villager.id, logicalNowMs + CLOSE_SMASH_RECOIL_MS)
        galvanicRecoilVillagerIdsRef.current.add(live.villager.id)
        recoilPresented = true
      }
    }
    if (recoilPresented) localSfx('recoil', sfxVolumeRef.current)
  }, [galvanicRouteAvailable, publishGalvanicProjection, resetGalvanic, setPromptText, strikeActiveTine])

  const answerWithButton = useCallback((answeredNote: string) => {
    if (phaseRef.current !== 'playing' || inputModeRef.current !== 'buttons') return
    if (buttonAnswerPendingRef.current || cuePlayingNow() || matchingSuppressedNow()) return
    if (typeof document !== 'undefined' && (document.visibilityState !== 'visible' || !document.hasFocus())) return

    const target = getActiveTarget()
    if (!target) return
    const current = buttonTrialRef.current?.targetKey === target.key
      ? buttonTrialRef.current
      : createPitchforksButtonTrial(target.key)
    const decision = decidePitchforksButtonAnswer(current, answeredNote, target.note)
    if (!decision.accepted) return

    buttonAnswerPendingRef.current = true
    buttonTrialRef.current = decision.next
    if (decision.shouldGrade) reviewTargetNote(target, decision.correct, 'buttons')

    if (decision.shouldStrike) {
      setButtonFeedback({ kind: 'correct', text: `${target.note} · LIGHTNING RELEASED` })
      strikeActiveTine(target, false)
    } else {
      setButtonFeedback({ kind: 'wrong', text: 'NOT THAT NOTE · REPLAY AND TRY AGAIN' })
      setPromptText('Replay the note, then try again.')
    }

    requestAnimationFrame(() => { buttonAnswerPendingRef.current = false })
  }, [cuePlayingNow, getActiveTarget, matchingSuppressedNow, reviewTargetNote, setPromptText, strikeActiveTine])

  const demoPitchForTarget = useCallback((target: Pick<NonNullable<ReturnType<typeof getActiveTarget>>, 'key' | 'note'>, now: number): PitchInfo | null => {
    if (demoTargetRef.current !== target.key) {
      demoTargetRef.current = target.key
      demoTargetStartedRef.current = now
    }
    const elapsed = now - demoTargetStartedRef.current
    const targetFreq = noteToFreq(target.note)
    const firstTargetScript = demoLockCountRef.current === 0

    if (now - lastAshAtRef.current < 220) {
      demoStepRef.current = 'attack-countdown'
      return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
    }

    if (firstTargetScript) {
      if (elapsed < 160) {
        demoStepRef.current = 'charge-start'
        return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.96, isActive: true }
      }
      if (elapsed < 900) {
        demoStepRef.current = lockProgressRef.current > 0 ? 'silence-freeze' : 'silence-prime'
        return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
      }
      if (elapsed < 1700) {
        const wrong = semiToName(nameToSemi(target.note) + 2)
        demoStepRef.current = 'confident-wrong'
        return { note: wrong, frequency: noteToFreq(wrong), cents: 0, confidence: 0.98, isActive: true }
      }
      demoStepRef.current = 'charge-recover'
      return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
    }

    if (elapsed < 90) {
      demoStepRef.current = 'target-silence-prime'
      return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
    }
    demoStepRef.current = 'charge-hold'
    return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
  }, [])

  const processLock = useCallback((dt: number) => {
    if (ceremonyRef.current.active) {
      pauseSparkGuide('ceremony')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }
    const bellPhase = bellWaveStateRef.current.phase
    if (bellPhase === 'active' || bellChargeReceiptRef.current !== null || bellReleaseRequestedRef.current) {
      pauseSparkGuide('bell-lifecycle')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }
    const normalBellPhase = normalBellRouteAvailable() ? bellPowerStateRef.current?.phase : null
    if (normalBellPhase === 'pending') {
      pauseSparkGuide('bell-lifecycle')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }
    if (normalBellPhase === 'activating') {
      pauseSparkGuide('bell-lifecycle')
      processNormalBellActivation()
      return
    }
    // The receipt owns the close action until its presentation settles. The
    // world keeps stepping in updateGame, but this earned target cannot start
    // a second lock or arm a second receipt during ready/pending/settle.
    if (closeSmashStateRef.current.phase !== 'idle') {
      pauseSparkGuide('close-smash-lifecycle')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = closeSmashStateRef.current.phase === 'ready' ? 1 : 0
      tintRef.current = null
      return
    }
    const thunderheadPhase = thunderheadStateRef.current.phase
    if (thunderheadPhase !== 'idle' && thunderheadPhase !== 'consumed') {
      pauseSparkGuide('thunderhead-lifecycle')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = thunderheadPhase === 'lock_confirmed' ? 1 : 0
      tintRef.current = null
      return
    }
    if (strikePresentationPending()) {
      pauseSparkGuide('strike-presentation')
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }
    const target = getActiveTarget()
    if (!target) {
      if (bellArmRequestedRef.current) {
        bellArmRequestedRef.current = false
        bellArmedTargetKeyRef.current = ''
        bellLastReasonRef.current = 'stale-target'
      }
      if (galvanicArmRequestedRef.current) {
        galvanicArmRequestedRef.current = false
        galvanicArmedTargetKeyRef.current = ''
        galvanicLastReasonRef.current = 'stale-target'
        publishGalvanicProjection()
      }
      resetSparkGuide('no-target')
      activeKeyRef.current = ''
      activeVillagerIdRef.current = null
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      setPromptText('')
      setActiveCueContextSnapshot({ support: 'guided', noteCount: 1 })
      if (buttonTrialRef.current) {
        buttonTrialRef.current = null
      }
      if (demoRef.current) demoStepRef.current = 'idle'
      return
    }

    flushPendingMusicalPrompt(target)

    // Environmental torch work reuses this same target's authoritative pitch
    // sample below. It never calls review/strike and never changes musical
    // progress. The caller marks the target so updateGame does not advance its
    // torch twice in one frame.
    const advanceActiveTorch = (confirmedExactHold: boolean) => {
      if (!target.villager.torchBearer) return target.villager.torch
      const before = target.villager.torch
      const next = stepTorch(before, dt * 1000, {
        confirmedExactHold,
        rainWet: deriveRainEffects(runtimeRef.current.rain).extinguish,
        paused: environmentalClockPausedNow(),
      })
      target.villager.torch = next
      torchSteppedTargetKeyRef.current = target.key
      if (next.phase !== before.phase) {
        if (next.phase === 'holding') setPromptText(`Hold ${target.note} to douse the torch`)
        else if (next.phase === 'steaming') setPromptText(`Torch steaming · keep ${target.note}`)
        else if (next.phase === 'wet') setPromptText(`Torch doused · keep ${target.note}`)
        else if (next.phase === 'spent') {
          presentMusicalPrompt({
            key: target.key,
            note: target.note,
            burned: target.villager.burned,
            firstMinute: target.villager.id === runtimeRef.current.firstVillagerId,
          })
        } else {
          presentMusicalPrompt({
            key: target.key,
            note: target.note,
            burned: target.villager.burned,
            firstMinute: target.villager.id === runtimeRef.current.firstVillagerId,
          })
        }
      }
      return next
    }

    if (activeVillagerIdRef.current !== target.villager.id) {
      activeVillagerIdRef.current = target.villager.id
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      if (inputModeRef.current === 'buttons') {
        setPromptText('Listen…')
      } else {
        presentMusicalPrompt({
          key: target.key,
          note: target.note,
          burned: target.villager.burned,
          firstMinute: target.villager.id === runtimeRef.current.firstVillagerId,
        })
      }
      const cueContext = cueContextForVillager(target.villager)
      if (!target.villager.sequenceCued) {
        target.villager.sequenceCued = true
        if (inputModeRef.current === 'buttons' ||
          ((cueContext.support === 'guided' || target.villager.supportedLesson) && audioCueRef.current)) {
          playVillagerSequence(target.villager, 'cue')
        } else if (
          target.villager.id === runtimeRef.current.firstVillagerId &&
          firstMinuteCoachRef.current.beat !== 'complete'
        ) {
          setFirstMinuteCoachSnapshot('sing', target.note)
        }
      }
    }

    if (activeKeyRef.current !== target.key) {
      activeKeyRef.current = target.key
      lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      if (inputModeRef.current === 'buttons') {
        buttonTrialRef.current = createPitchforksButtonTrial(target.key)
        setButtonFeedback({ kind: cuePlayingNow() ? 'listen' : 'question', text: cuePlayingNow() ? 'LISTEN, THEN CHOOSE THE NOTE' : 'WHICH NOTE DID YOU HEAR?' })
      }
      cueContextForVillager(target.villager)
      if (inputModeRef.current === 'buttons') {
        if (!cuePlayingNow() && !matchingSuppressedNow()) {
          setPromptText('Which note did you hear?')
        }
      } else {
        presentMusicalPrompt({
          key: target.key,
          note: target.note,
          burned: target.villager.burned,
          firstMinute: target.villager.id === runtimeRef.current.firstVillagerId,
        })
      }
    }

    if (inputModeRef.current === 'buttons') {
      advanceActiveTorch(false)
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }

    const now = performance.now()
    if (demoRef.current && !matchingSuppressedNow()) {
      demoPitchRef.current = demoPitchForTarget(target, now)
    }

    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    updateSparkGuide(target, source, now)
    let holdElapsedMs = dt * 1000
    if (!demoRef.current) {
      // ponytail: reuse the detector-generation fence; extract a shared module if another consumer needs it.
      const observation = observePitchforksSongcraftGeneration(lockGenerationRef.current, pitchGenerationRef.current, now, TRAIL_MS)
      lockGenerationRef.current = observation.state
      const health = micSourceHealthRef.current
      const suppressed = matchingSuppressedNow()
      const pageVisible = typeof document === 'undefined' || document.visibilityState === 'visible'
      const unreliable = !pageVisible || pitchforksMicUnreliable({
        hasTarget: true,
        isListening: isListeningRef.current,
        micError: micErrorRef.current,
        audioContextState: health.audioContextState,
        trackReadyState: health.trackReadyState,
        trackMuted: health.trackMuted,
        matchingSuppressed: suppressed,
        pageVisible,
        generationObserved: observation.state.generationObserved,
        generationAgeMs: observation.state.generationObserved ? now - observation.state.generationObservedAt : Number.POSITIVE_INFINITY,
        staleAfterMs: TRAIL_MS,
      })
      if (unreliable || suppressed || observation.staleRecovery) {
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
      }
      if (unreliable || suppressed) {
        lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
        return
      }
      // Render frames are not microphone samples and cannot earn a note or power charge.
      if (!observation.generationAdvanced) return
      holdElapsedMs = observation.freshElapsedMs
    }
    if (matchingSuppressedNow()) return

    // A bank or release must observe a real inactive detector sample before
    // the next exact hold can begin. The source has already been sampled above
    // so this gate cannot freeze the demo on the previous active sample.
    if (galvanicAwaitingSilenceRef.current) {
      if (source?.isActive) {
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
        if (demoRef.current) demoStepRef.current = 'galvanic-reonset'
        return
      }
      galvanicAwaitingSilenceRef.current = false
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      galvanicLastReasonRef.current = 'awaiting-silence-cleared'
      publishGalvanicProjection()
      return
    }

    // Any close receipt resolution (Smash or ordinary fallback) must end a
    // continuous phonation before the next tine can earn another lock. The
    // gate is intentionally note-agnostic: a distinct next tine still needs
    // an actual silent sample, so a held voice cannot roll through the hit.
    if (closeSmashReonsetNoteRef.current) {
      if (source?.isActive) {
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
        if (demoRef.current) demoStepRef.current = 'close-smash-reonset'
        return
      } else {
        closeSmashReonsetNoteRef.current = null
        closeSmashReonsetStartedAtRef.current = 0
      }
    }

    if (!source?.isActive || source.confidence < CONFIDENCE_FLOOR || source.frequency <= 0) {
      advanceActiveTorch(false)
      if (demoRef.current && lockProgressRef.current > 0) {
        silenceFreezeObservedRef.current = true
        demoStepRef.current = 'silence-freeze'
      }
      tintRef.current = null
      return
    }

    const cents = exactCents(source.frequency, noteToFreq(target.note))
    const absCents = Math.abs(cents)
    tintRef.current = colorForCents(absCents)

    const torch = advanceActiveTorch(absCents <= MATCH_TOLERANCE_CENTS)
    if (torch.phase !== 'spent') {
      // An exact hold is first an environmental action. Do not leak its
      // extended hold into the ordinary 300 ms musical lock.
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }

    // Bell charge is the first exact-hold consumer on its private proof
    // route. It mints a non-musical receipt and returns before Galvanic,
    // Thunderhead, Close Smash, or ordinary strike authority can run.
    if (bellArmRequestedRef.current) {
      if (
        bellArmedTargetKeyRef.current !== target.key
        || bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished'
      ) {
        bellArmRequestedRef.current = false
        bellArmedTargetKeyRef.current = ''
        bellLastReasonRef.current = 'stale-target'
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
        return
      }
      if (absCents <= MATCH_TOLERANCE_CENTS) {
        lockHeldMsRef.current = Math.min(HOLD_MS, lockHeldMsRef.current + holdElapsedMs)
        lockProgressRef.current = Math.min(1, lockHeldMsRef.current / HOLD_MS)
        tintRef.current = colorForCents(absCents)
        if (lockProgressRef.current >= 1) {
          confirmBellCharge(target, runtimeRef.current.animClock * 1000)
        }
      } else {
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
      }
      return
    }

    if (galvanicRouteAvailable() && galvanicBanksRef.current.length >= GALVANIC_BANK_CAPACITY) {
      // Capacity is a hard bank boundary. The upstream target remains
      // available for source observation, but this frame cannot mint a third
      // Galvanic bank or fall through to ordinary/Close Smash credit.
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      if (demoRef.current) demoStepRef.current = 'galvanic-awaiting-release'
      return
    }

    // Once a bank exists, ordinary exact input is presentation-only
    // until the player deliberately releases the sweep or arms the next
    // target. Source observation still runs, but no ordinary credit can leak
    // through while a receipt waits.
    if (galvanicRouteAvailable() && galvanicBanksRef.current.length > 0 && !galvanicArmRequestedRef.current) {
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      if (demoRef.current) demoStepRef.current = 'galvanic-awaiting-release'
      return
    }

    if (absCents <= MATCH_TOLERANCE_CENTS) {
      if (
        target.villager.id === runtimeRef.current.firstVillagerId &&
        firstMinuteCoachRef.current.beat === 'sing' &&
        performance.now() - firstMinuteBeatStartedAtRef.current >= 120
      ) {
        setFirstMinuteCoachSnapshot('charge', target.note)
      }
      lockHeldMsRef.current = Math.min(HOLD_MS, lockHeldMsRef.current + holdElapsedMs)
      lockProgressRef.current = Math.min(1, lockHeldMsRef.current / HOLD_MS)
      if (lockProgressRef.current >= 1) {
        // Galvanic is an exclusive exact-hold consumer. It is deliberately
        // first at this seam and returns so ordinary, Close Smash, and
        // Thunderhead credit cannot also consume the same held sample.
        if (galvanicArmRequestedRef.current) {
          confirmGalvanicLock(target)
          return
        }
        if (galvanicRouteAvailable() && galvanicBanksRef.current.length > 0) {
          lockHeldMsRef.current = 0
          lockProgressRef.current = 0
          tintRef.current = null
          return
        }
        // A Thunderhead arming request gets first refusal at the exact
        // 300 ms lock. It banks the existing receipt rather than invoking
        // ordinary strike or Close Smash; buttons/EAR never enter this path.
        if (thunderheadArmRequestedRef.current) {
          // An armed Thunderhead lock is exclusive: invalid/rejected receipts must
          // not fall through to ordinary strike authority.
          confirmThunderheadLock(target, thunderheadClockMsRef.current)
          return
        }
        // Close Smash gets first refusal at the shipped reach boundary. The
        // ordinary strike remains the fallback when this target is elsewhere.
        // `now` is the pitch-detector wall clock. Close Smash's fallback and
        // contact deadlines share the runtime animation clock with updateGame.
        if (!armCloseSmash(target, runtimeRef.current.animClock * 1000)) strikeActiveTine(target)
      }
    } else {
      // v1 confident-wrong = charge RESET only, NO FSRS review (FLW GREEN-LIGHT option A,
      // flw-out-9b). FSRS grades exactly once per villager-tine encounter at resolution:
      // strike = correct (latency-graded), timeout = failure. A beginner's approach wobble
      // is not a recall failure — the real failure is not resolving the tine in time.
      const hadCharge = lockHeldMsRef.current > 0 || lockProgressRef.current > 0
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      if (demoRef.current && hadCharge) {
        resetCountRef.current += 1
        lastResetReasonRef.current = 'confident-wrong'
        demoStepRef.current = 'confident-wrong-reset'
      }
    }
  }, [
    galvanicRouteAvailable,
    cueContextForVillager,
    cuePlayingNow,
    flushPendingMusicalPrompt,
    confirmGalvanicLock,
    confirmBellCharge,
    confirmThunderheadLock,
    demoPitchForTarget,
    environmentalClockPausedNow,
    getActiveTarget,
    armCloseSmash,
    matchingSuppressedNow,
    normalBellRouteAvailable,
    processNormalBellActivation,
    presentMusicalPrompt,
    pitchRef,
    playVillagerSequence,
    pauseSparkGuide,
    publishGalvanicProjection,
    resetSparkGuide,
    setActiveCueContextSnapshot,
    setFirstMinuteCoachSnapshot,
    setPromptText,
    strikeActiveTine,
    strikePresentationPending,
    updateSparkGuide,
  ])

  const updateGame = useCallback((dt: number) => {
    const rt = runtimeRef.current
    const environmentalPaused = environmentalClockPausedNow()
    const receiptAtFrameStart = waveReceiptRef.current
    const receiptWindowActive = receiptAtFrameStart.visible && rt.nextWavePending
    const pageVisible = typeof document === 'undefined' || document.visibilityState === 'visible'
    if (receiptWindowActive) {
      // Visibility cancels the decorative presentation at most once. The
      // receipt remains authoritative and its shared clock can still reach the
      // existing next-wave boundary after the page is visible again.
      if (!pageVisible && receiptAtFrameStart.claim) {
        victoryCancelledReceiptIdRef.current = receiptAtFrameStart.claim.receiptId
      }
      // Recompute the pause source at the boundary; a prior cue/ceremony must
      // not leave a stale `timersPausedRef` value blocking the 1900 ms handoff.
      const receiptPaused = !pageVisible || environmentalPaused || timersPausedNow()
      rt.animClock = advancePitchforksLogicalClock(rt.animClock * 1000, dt * 1000, receiptPaused) / 1000
      const logicalNowMs = rt.animClock * 1000
      if (
        rt.nextWaveRunGeneration !== runGenerationRef.current ||
        phaseRef.current !== 'playing'
      ) {
        clearWaveReceipt()
        return
      }
      if (!receiptPaused && rt.nextWaveAtMs !== null && logicalNowMs >= rt.nextWaveAtMs) {
        startWave(rt.nextWaveNumber ?? rt.wave)
      }
      // Receipt presentation owns this frame. Do not step rain, villagers,
      // bolts, locks, targets, detector state, or any other gameplay state.
      return
    }
    const activationRequested = rainActivationRequestedRef.current
    const nextRain = stepRain(rt.rain, dt * 1000, {
      paused: environmentalPaused,
      activated: activationRequested,
      mode: demoRef.current ? 'demo' : 'normal',
    })
    const rainEffects = deriveRainEffects(nextRain)
    rt.rain = nextRain
    if (nextRain.phase !== 'ready') rainActivationRequestedRef.current = false
    syncRainSnapshot(nextRain)
    torchSteppedTargetKeyRef.current = ''
    rt.animClock = advancePitchforksLogicalClock(rt.animClock * 1000, dt * 1000, false) / 1000
    const logicalNowMs = rt.animClock * 1000
    // Ordinary combat keeps its shared clock moving. Thunderhead gets a
    // pause-aware view of the same frame delta so cue/visibility pauses do not
    // spend detached-cloud travel or match-settle time behind the player's back.
    const thunderheadPhaseAtFrameStart = thunderheadStateRef.current.phase
    const thunderheadLifecycleActiveAtFrameStart = thunderheadPhaseAtFrameStart !== 'idle' && thunderheadPhaseAtFrameStart !== 'consumed'
    const thunderheadPausedAtFrameStart = thunderheadLifecycleActiveAtFrameStart && (
      !pageVisible || environmentalPaused || timersPausedNow()
    )
    const thunderheadLogicalNowMs = advancePitchforksLogicalClock(
      thunderheadClockMsRef.current,
      dt * 1000,
      thunderheadPausedAtFrameStart,
    )
    thunderheadClockMsRef.current = thunderheadLogicalNowMs
    // During the Bell's own audible ring, the physical wave and swing outlive
    // that ring's echo guard. Later unrelated cues may pause them normally;
    // hidden pages, ceremonies and unavailable microphones always still pause.
    const bellOwnRingSuppressionActive = (bellWaveStateRef.current.phase === 'active' || bellWaveStateRef.current.phase === 'finished') && bellOwnRingSuppressionUntilRef.current > performance.now()
    const bellPausedAtFrameStart = !pageVisible || environmentalClockPausedNow(bellOwnRingSuppressionActive)
    const bellLogicalNowMs = advancePitchforksLogicalClock(
      bellWaveClockMsRef.current,
      dt * 1000,
      bellPausedAtFrameStart,
    )
    bellWaveClockMsRef.current = bellLogicalNowMs
    for (const [villagerId, untilMs] of closeSmashRecoilUntilRef.current) {
      if (untilMs <= logicalNowMs) closeSmashRecoilUntilRef.current.delete(villagerId)
    }
    if (ceremonyRef.current.active) {
      timersPausedRef.current = true
      processLock(0)
      return
    }

    if (rt.bannerTimer > 0) {
      rt.bannerTimer = Math.max(0, rt.bannerTimer - dt)
      if (rt.bannerTimer === 0 && rt.spawned === 0) {
        spawnVillager()
      }
    } else {
      const waitForClear = waitForClearBeforeSpawn(rt.wave, demoRef.current) &&
        !closeSmashProofRef.current && !(galvanicProofRef.current && rt.wave === 1)
      const encounterClear = !rt.villagers.some(v => v.state === 'walking')
      if (!waitForClear || encounterClear) {
        rt.spawnClock += dt
        if (rt.spawned < rt.plan.count && rt.spawnClock >= rt.plan.spawnInterval) {
          rt.spawnClock = 0
          spawnVillager()
        }
      } else {
        rt.spawnClock = 0
      }
    }

    for (const v of rt.villagers) {
      if (v.state === 'walking') {
        v.x = Math.max(FRANK_REACH_X, v.x - v.speed * rainEffects.slowFactor * dt)
        v.walkClock += dt
        if (v.walkClock >= 0.16) {
          v.walkClock = 0
          v.walkFrame = (v.walkFrame + 1) % 4
        }
      } else if (v.state === 'ash') {
        v.ashTimer -= dt
      }
    }

    for (let i = rt.bolts.length - 1; i >= 0; i--) {
      rt.bolts[i].life += dt
      if (rt.bolts[i].life >= rt.bolts[i].maxLife) rt.bolts.splice(i, 1)
    }
    for (let i = rt.bursts.length - 1; i >= 0; i--) {
      rt.bursts[i].life += dt
      if (rt.bursts[i].life >= rt.bursts[i].maxLife) rt.bursts.splice(i, 1)
    }

    processLock(dt)
    advanceBellWaveLifecycle(bellLogicalNowMs, bellPausedAtFrameStart)
    applyBellKnockback(bellLogicalNowMs)
    advanceGalvanicRelease(logicalNowMs)
    arbitrateCloseSmash(logicalNowMs)
    const timersPaused = timersPausedNow()
    const environmentalPausedAfterLock = environmentalClockPausedNow()
    advanceThunderheadLifecycle(
      thunderheadLogicalNowMs,
      thunderheadPausedAtFrameStart || timersPaused || environmentalPausedAfterLock || !pageVisible,
    )
    const steppedTargetKey = torchSteppedTargetKeyRef.current
    for (const v of rt.villagers) {
      const currentTargetKey = `${v.id}:${v.burned}`
      if (currentTargetKey === steppedTargetKey) continue
      v.torch = stepTorch(v.torch, dt * 1000, {
        confirmedExactHold: false,
        rainWet: rainEffects.extinguish,
        paused: environmentalPausedAfterLock,
      })
    }
    syncRainSnapshot(rt.rain)
    const newestBolt = rt.bolts[rt.bolts.length - 1]
    const lightningPhase = lightningPhaseFor(lockProgressRef.current, newestBolt)
    const priorLightningPhase = lightningPhaseTraceRef.current[lightningPhaseTraceRef.current.length - 1]?.phase
    if (priorLightningPhase !== lightningPhase) {
      lightningPhaseTraceRef.current.push({
        phase: lightningPhase,
        logicalMs: Math.round(newestBolt ? newestBolt.life * 1000 : lockProgressRef.current * HOLD_MS),
        chargeProgress: lockProgressRef.current,
      })
      if (lightningPhaseTraceRef.current.length > 80) lightningPhaseTraceRef.current.shift()
    }
    const active = getActiveTarget()
    const closeState = closeSmashStateRef.current
    const thunderheadState = thunderheadStateRef.current
    const closeLifecycleTarget = closeState.phase !== 'idle' &&
      !!closeState.receipt &&
      String(active?.villager.id) === closeState.receipt.villagerId
    const thunderheadLifecycleTarget = thunderheadState.phase !== 'idle' &&
      thunderheadState.phase !== 'consumed' &&
      !!(thunderheadState.receipt ?? thunderheadState.bank) &&
      active?.key === (thunderheadState.receipt ?? thunderheadState.bank)?.targetKey
    if (active?.villager.state === 'walking' && !timersPaused) {
      const v = active.villager
      v.attackTimer = Math.max(0, v.attackTimer - dt)
      if (v.attackTimer <= 0) {
        if (closeLifecycleTarget) {
          // The existing attack timer is allowed to reach its threat apex; it
          // is not frozen. While the earned receipt is still resolving, defer
          // the consequence and let the same serialized fallback/Smash path
          // finish first. READY reaches the ordinary fallback immediately at
          // this apex, preserving musical credit without free damage.
          if (closeState.phase === 'ready') {
            closeSmashFallbackDueAtRef.current = closeSmashFallbackDueAtRef.current > 0
              ? Math.min(closeSmashFallbackDueAtRef.current, logicalNowMs)
              : logicalNowMs
          }
        } else if (thunderheadLifecycleTarget) {
          // A released bank owns the exact target until its ceiling travel and
          // target-match window finish. Keep the existing attack clock from
          // converting a still-valid receipt into an unrelated miss; no new
          // timer is created and the live target is revalidated before strike.
          v.attackTimer = v.attackTimerMax
        } else {
          // A timeout resolves the whole encounter, not just the tine currently
          // in front. Record every remaining tine as a miss so an abandoned
          // multi-note fork cannot pass a level by skipping its tail.
          for (let offset = v.burned; offset < v.notes.length; offset += 1) {
            const unresolvedTarget: NonNullable<ReturnType<typeof getActiveTarget>> = {
              villager: v,
              tineIndex: v.totalTines - 1 - offset,
              note: v.notes[offset],
              key: `${v.id}:${offset}`,
            }
            reviewTargetNote(unresolvedTarget, false)
          }
          const timeout = resolvePitchforksAttackTimeout(rt.health)
          if (inputModeRef.current === 'buttons') {
            setButtonFeedback({ kind: 'wrong', text: `TIME EXPIRED · THE NOTE WAS ${active.note}` })
          }
          frankReactionKindRef.current = 'miss'
          frankReactionStartedAtRef.current = performance.now()
          v.state = 'ash'
          v.ashTimer = 0.9
          rt.health = timeout.health
          rt.streak = 0
          activeKeyRef.current = ''
          activeVillagerIdRef.current = null
          lockHeldMsRef.current = 0
          lockProgressRef.current = 0
          tintRef.current = null
          setPromptText('')
          localSfx('hurt', sfxVolumeRef.current)
          setHud({ wave: rt.wave, health: rt.health, score: rt.score, streak: rt.streak })
          if (timeout.gameOver) {
            rt.gameOver = true
            resetSparkGuide('game-over')
            phaseRef.current = 'game_over'
            setPhase('game_over')
            return
          }
        }
      }
    }

    rt.villagers = rt.villagers.filter(v => v.state !== 'ash' || v.ashTimer > 0)

    const waveClear = canSealPitchforksWaveReceipt({
      spawned: rt.spawned,
      required: rt.plan.count,
      villagers: rt.villagers,
      bolts: rt.bolts,
    })
    if (waveClear && !rt.nextWavePending && !ceremonyRef.current.active) {
      // Offer at most one comfortable new note after the earned strike has finished.
      if (!levelAdmissionOfferedRef.current) {
        levelAdmissionOfferedRef.current = true
        maybeUnlockNextNote()
        if (ceremonyRef.current.active) return
      }
      const measuredResult = pitchforksLevelResult(levelProgressRef.current, inputModeRef.current)
      // Scripted input showcases the game; it never certifies independent recall.
      const result: PitchforksLevelResult = demoRef.current
        ? { ...measuredResult, showcase: true, cleared: true, nextLevel: rt.wave + 1, nextStep: `DEMO showcase · Next: Level ${rt.wave + 1}. No vocal mastery awarded.` }
        : measuredResult
      if (!demoRef.current && !fsrsDebugRef.current && inputModeRef.current === 'voice' && presentationJourneyRef.current) {
        const nextJourney = advancePitchforksJourneyLevel(presentationJourneyRef.current, rt.wave, result.cleared)
        if (nextJourney !== presentationJourneyRef.current) {
          presentationJourneyRef.current = nextJourney
          setPresentationJourney(nextJourney)
          savePresentationJourney(nextJourney)
        }
      }
      const receiptStartedAtMs = logicalNowMs
      const receiptOrdinal = rt.wave
      const assetAvailability = Object.freeze({
        neutral: !!assetsRef.current.frankVictoryNeutral,
        eyeLift: !!assetsRef.current.frankVictoryEyeLift,
      })
      const receiptId = `wave-receipt:${runGenerationRef.current}:${++waveReceiptSequenceRef.current}`
      const claim = result.cleared && assetAvailability.neutral
        ? Object.freeze({
            receiptId,
            receiptOrdinal,
            variant: receiptOrdinal % 2 === 1 ? 'eyeLift' as const : 'neutral' as const,
            reducedMotion: reducedMotionRef.current,
            assetAvailability,
            claimedAtMs: receiptStartedAtMs,
          })
        : null
      showWaveReceipt(snapshotWaveReceipt(result, receiptStartedAtMs, claim))
      rt.nextWavePending = true
      const nextWave = result.cleared ? rt.wave + 1 : rt.wave
      rt.nextWaveNumber = nextWave
      rt.nextWaveAtMs = receiptStartedAtMs + PITCHFORKS_VICTORY_NEXT_WAVE_MS
      rt.nextWaveRunGeneration = runGenerationRef.current
      clearNextWaveTimer()
    }
  }, [advanceBellWaveLifecycle, advanceGalvanicRelease, advanceThunderheadLifecycle, applyBellKnockback, arbitrateCloseSmash, clearNextWaveTimer, clearWaveReceipt, environmentalClockPausedNow, getActiveTarget, maybeUnlockNextNote, processLock, resetSparkGuide, reviewTargetNote, savePresentationJourney, setPromptText, showWaveReceipt, snapshotWaveReceipt, spawnVillager, startWave, syncRainSnapshot, timersPausedNow])

  const updatePitchBarState = useCallback((active: ActiveTarget | null): TunerView => {
    const visible = phaseRef.current === 'playing' && inputModeRef.current === 'voice'
    barVisibleRef.current = visible
    const now = performance.now()
    const nextTargetKey = active?.key ?? ''
    const targetChanged = tunerTargetKeyRef.current !== nextTargetKey
    if (targetChanged) {
      tunerTargetKeyRef.current = nextTargetKey
      tunerNeedsRebaseRef.current = !!nextTargetKey
      tunerDropoutFramesRef.current = 0
      pitchTrailRef.current = []
      barDotDeviationRef.current = null
      barOnTargetRef.current = false
    } else {
      pitchTrailRef.current = pitchTrailRef.current.filter(p => now - p.at <= TRAIL_MS)
    }
    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    const matchingSuppressed = !!active && (cuePlayingNow() || matchingSuppressedNow())
    const pitchGeneration = pitchGenerationRef.current
    const hasNewPitchGeneration = pitchGeneration !== tunerPitchGenerationRef.current
    if (hasNewPitchGeneration) {
      tunerPitchGenerationRef.current = pitchGeneration
      tunerPitchGenerationAtRef.current = now
      tunerPitchGenerationObservedRef.current = true
    }
    const micHealth = micSourceHealthRef.current
    const micUnreliable = !demoRef.current && pitchforksMicUnreliable({
      hasTarget: !!active,
      isListening,
      micError,
      audioContextState: micHealth.audioContextState,
      trackReadyState: micHealth.trackReadyState,
      trackMuted: micHealth.trackMuted,
      matchingSuppressed,
      pageVisible: typeof document === 'undefined' || document.visibilityState === 'visible',
      generationObserved: tunerPitchGenerationObservedRef.current,
      generationAgeMs: tunerPitchGenerationObservedRef.current ? now - tunerPitchGenerationAtRef.current : Number.POSITIVE_INFINITY,
      staleAfterMs: TRAIL_MS,
    })
    const canUseSource = !!active &&
      !matchingSuppressed &&
      !micUnreliable &&
      !!source?.isActive &&
      source.confidence >= CONFIDENCE_FLOOR &&
      source.frequency > 0

    if (hasNewPitchGeneration) {
      tunerDropoutFramesRef.current = !active || matchingSuppressed || micUnreliable || canUseSource
        ? 0
        : tunerDropoutFramesRef.current + 1
    }

    let sourceNote: string | null = null
    let renderDeviation: number | null = null
    let deviationSemis: number | null = null

    if (canUseSource && active && source) {
      const deviation = pitchDeviationSemis(source, active.note)
      deviationSemis = deviation
      const clampedDeviation = clamp(deviation, -6, 6)
      const onTarget = Math.abs(deviation) <= MATCH_TOLERANCE_CENTS / 100
      barDotDeviationRef.current = clampedDeviation
      barOnTargetRef.current = onTarget
      // Ease the readout toward the detected pitch so it glides instead of jittering frame-to-frame.
      smoothDevRef.current = tunerNeedsRebaseRef.current
        ? clampedDeviation
        : smoothDevRef.current + (clampedDeviation - smoothDevRef.current) * 0.28
      tunerNeedsRebaseRef.current = false
      pitchTrailRef.current.push({
        at: now,
        deviation: smoothDevRef.current,
        onTarget,
        note: source.note,
        generation: pitchGeneration,
      })
      sourceNote = source.note || ''
      renderDeviation = smoothDevRef.current
    } else {
      barDotDeviationRef.current = null
      barOnTargetRef.current = false
    }

    const lastUsablePoint = pitchTrailRef.current[pitchTrailRef.current.length - 1]
    const voiceBreak = pitchforksVoiceBreak({
      hasTarget: !!active,
      matchingSuppressed,
      micUnreliable,
      dropoutFrames: tunerDropoutFramesRef.current,
      dropoutResetFrames: PITCHFORKS_PITCH_PROFILE.dropoutResetFrames,
      lastUsableAgeMs: lastUsablePoint ? now - lastUsablePoint.at : null,
      trailMs: TRAIL_MS,
    })
    const approaching = canUseSource && pitchforksApproaching(
      pitchTrailRef.current,
      MATCH_TOLERANCE_CENTS / 100,
    )
    const feedback = pitchforksTunerFeedback({
      targetNote: active?.note ?? null,
      sourceNote,
      deviationSemis,
      matchingSuppressed,
      micUnreliable,
      voiceBreak,
      approaching,
      lockProgress: lockProgressRef.current,
      toleranceSemis: MATCH_TOLERANCE_CENTS / 100,
    })
    const bankedGalvanicNotes = galvanicBanksRef.current.map(bank => bank.note).join(' · ')
    const galvanicBanked = galvanicRouteAvailable() &&
      inputModeRef.current === 'voice' &&
      galvanicBanksRef.current.length > 0
    const storedThunderhead = thunderheadStateRef.current.bank
    const thunderheadStoredPhase = thunderheadStateRef.current.phase
    // A full bank owns this lock: continued singing cannot advance it further.
    // Keep microphone/cue safety feedback authoritative while it is suppressed.
    const thunderheadReadyFeedback = storedThunderhead &&
      storedThunderhead.consumedAt === null && inputModeRef.current === 'voice' &&
      !micUnreliable && !matchingSuppressed
      ? {
          ...feedback,
          kind: 'locked' as const,
          headline: `${storedThunderhead.note} ${thunderheadStoredPhase === 'banked' ? 'BANKED' : 'CLOUD IN FLIGHT'}`,
          detail: thunderheadStoredPhase === 'banked'
            ? 'SEND CLOUD WHEN READY'
            : 'WATCH THE CLOUD REACH THE FORK',
          compactLabel: `${thunderheadStoredPhase === 'banked' ? 'send' : 'cloud'}: ${storedThunderhead.note}`,
        }
      : null
    const presentationFeedback = galvanicBanked
      ? {
          ...feedback,
          kind: 'locked' as const,
          headline: galvanicArmRequestedRef.current ? 'GALVANIC ARMED' : 'GALVANIC READY',
          detail: galvanicArmRequestedRef.current
            ? `HOLD ${active?.note ?? 'THE EXACT NOTE'} FOR ${HOLD_MS} MS`
            : galvanicBanksRef.current.length >= GALVANIC_BANK_CAPACITY
              ? `2 BANKS · ${bankedGalvanicNotes} · RELEASE SWEEP`
              : `BANKED · ${bankedGalvanicNotes} · RELEASE OR BANK AGAIN`,
          compactLabel: galvanicArmRequestedRef.current
            ? `galvanic: ${active?.note ?? 'exact note'}`
            : `release: ${bankedGalvanicNotes}`,
        }
      : feedback
    return {
      visible,
      now,
      targetNote: active?.note ?? null,
      sourceNote,
      canUseSource,
      dotDeviation: barDotDeviationRef.current,
      renderDeviation,
      onTarget: barOnTargetRef.current,
      trail: pitchTrailRef.current,
      feedback: thunderheadReadyFeedback ?? presentationFeedback,
    }
  }, [galvanicRouteAvailable, cuePlayingNow, isListening, matchingSuppressedNow, micError, micSourceHealthRef, pitchGenerationRef, pitchRef])

  const acceptBossResult = useCallback((result: PitchforksBossRecitalResult) => {
    if (pausedRef.current) return
    if (bossControllerRef.current?.state().attempt !== result.state.attempt) return
    const simulatedResponse = bossSimulatingRef.current
    if (simulatedResponse) bossSupportedPracticeRef.current = true
    bossSimulatingRef.current = false
    setBossSimulating(false)
    bossHoldRef.current = { heldMs: 0, matched: false }
    bossHeardClaimRef.current = null
    bossButtonTrialRef.current = null
    if ('receipt' in result) {
      const index = bossReceiptsRef.current.findIndex(receipt => receipt.claimId === result.receipt.claimId)
      if (index < 0) bossReceiptsRef.current.push(result.receipt)
      else bossReceiptsRef.current[index] = result.receipt
    }
    setBossState(result.state)
    if (result.kind === 'supported-practice') {
      bossSupportedPracticeRef.current = true
      setBossMessage(result.completed
        ? 'Practice finished with help. Try again without hints when you feel ready.'
        : 'Good practice with a hint. The next note is ready. This did not count as unaided recall.')
    } else if (result.kind === 'persisted') {
      setBossMessage(result.outcome === 'failed'
        ? 'Saved for gentle review. Take your time, then try this same note again.'
        : result.completed
          ? bossSupportedPracticeRef.current
            ? 'Practice complete. Unaided notes were saved; helped notes did not count as unaided recall.'
            : 'You finished the recital. Your practice is saved.'
          : 'That note is saved. The next note is ready when you are.')
      const world = bossWorldRef.current
      const journey = presentationJourneyRef.current
      const range = rangeProfileRef.current
      if ((world === 'bell-tower' || world === 'cathedral') && !bossPracticeOnlyRef.current && journey && range && result.completed && result.outcome === 'success') {
        fsrsRef.current = loadStore(FSRS_VOICE_KEY)
        const successful = new Set(bossReceiptsRef.current.filter(receipt =>
          receipt.persisted && receipt.correct && !receipt.supported
          && receipt.attempt === result.state.attempt && receipt.lane === 'voice').map(receipt => receipt.cursor))
        const passed = !bossSupportedPracticeRef.current && successful.size === result.state.sequence.length
        const clear = advancePitchforksExaminationProgress({
          journey, rangeAssessedAt: range.assessedAt, startedAt: journey.startedAt,
          world, normalVoice: inputModeRef.current === 'voice', passed,
          demo: demoRef.current || fsrsDebugRef.current, simulated: simulatedResponse,
          admittedNotes: [...new Set(result.state.sequence)], voiceMemory: fsrsRef.current,
          masteryRecords: masteryProgressRef.current, nowMs: Date.now(),
        })
        if (clear.changed) {
          presentationJourneyRef.current = clear.journey
          setPresentationJourney(clear.journey)
          savePresentationJourney(clear.journey)
          setBossMessage(world === 'cathedral'
            ? 'The storm breaks. The bells ring in your voice — every note earned. Campaign complete. Return anytime to keep making music.'
            : 'The Bellringer steps aside. The Cathedral is open, and your earned passage is saved in this journey.')
        }
      }
    } else if (result.kind === 'retry-note') setBossMessage('A fresh try, on the same note. There is no timer.')
    else if (result.kind === 'storage-error') setBossMessage('Your saved history could not be read. Nothing was replaced. Try again or return safely.')
    else if (result.kind === 'conflict') setBossMessage('Newer practice was found. It has not been overwritten. Return safely and reopen the room.')
    else if (result.kind === 'save-failed' || result.kind === 'readback-mismatch') setBossMessage('Your answer is held, but saving is not confirmed. Retry saving; do not sing it again.')
  }, [savePresentationJourney])

  const resolveBossNote = useCallback((correct: boolean) => {
    if (pausedRef.current) return
    const controller = bossControllerRef.current
    const state = controller?.state()
    if (!controller || !state?.claimId || !state.currentNote || matchingSuppressedNow()) return
    acceptBossResult(controller.resolve({
      attempt: state.attempt, lane: state.lane, cursor: state.cursor,
      note: state.currentNote, claimId: state.claimId, correct,
    }))
  }, [acceptBossResult, matchingSuppressedNow])

  const stepBossChamber = useCallback((dt: number, ctx: CanvasRenderingContext2D) => {
    const controller = bossControllerRef.current
    if (!controller) return
    bossClockRef.current += dt
    let state = controller.state()
    if (state.claimId && state.currentNote && state.lane === 'voice' && !matchingSuppressedNow()) {
      const source = bossSimulatingRef.current
        ? demoPitchForTarget({ key: state.claimId, note: state.currentNote }, performance.now())
        : pitchRef.current
      // DEMO silence is genuinely unavailable input unless the visible sample
      // control is running; no hidden automatic success is synthesized.
      const observation = observePitchforksSongcraftGeneration(bossPitchGenerationRef.current, pitchGenerationRef.current, performance.now())
      bossPitchGenerationRef.current = observation.state
      const health = micSourceHealthRef.current
      const bossSceneWorld = bossWorldRef.current ?? bossPracticeWorldRef.current
      const ready = !bossSceneWorld || (!document.hidden && isListeningRef.current && !micErrorRef.current
        && health.audioContextState === 'running' && health.trackReadyState === 'live' && !health.trackMuted)
      const sample = (demoRef.current && !bossSimulatingRef.current) || !ready ? null : source
      if (bossSceneWorld && (observation.staleRecovery || !ready)) bossHoldRef.current = { heldMs: 0, matched: false }
      if (!bossSceneWorld || observation.generationAdvanced) bossHoldRef.current = advanceExactPitchHold(bossHoldRef.current,
        exactPitchSampleState(sample, noteToFreq(state.currentNote), CONFIDENCE_FLOOR, MATCH_TOLERANCE_CENTS),
        bossSceneWorld ? observation.freshElapsedMs : dt * 1000, HOLD_MS)
      if (bossHoldRef.current.matched) {
        resolveBossNote(true)
        state = controller.state()
      }
    }
    const bossId = bossIdentityRef.current
    if (!bossId) return
    const bossSceneWorld = bossWorldRef.current ?? bossPracticeWorldRef.current
    const chamberAssets = bossSceneWorld ? { ...assetsRef.current,
      bellringerChamberPlate: bossSceneWorld === 'cathedral' ? assetsRef.current.cathedralPlate : assetsRef.current.bellTowerPlate,
      bellringerRest: bossSceneWorld === 'cathedral' ? undefined : assetsRef.current.bellringerRest,
    } : assetsRef.current
    renderBossChamber(ctx, chamberAssets, state, bossHoldRef.current.heldMs / HOLD_MS, bossClockRef.current, reducedMotionRef.current, bossId, bossSceneWorld)
  }, [demoPitchForTarget, matchingSuppressedNow, resolveBossNote, isListening, micError, pitchGenerationRef])

  const togglePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const action = pausedRef.current ? 'resume' : 'pause'
    pauseGateRef.current = transitionPitchforksPauseGate(pauseGateRef.current, action)
    pausedRef.current = action === 'pause'
    setPaused(pausedRef.current)
    timersPausedRef.current = pausedRef.current
    if (pausedRef.current) {
      lastTimeRef.current = 0
      return
    }

    // A resumed run starts a fresh detector/callback generation. Durable FSRS,
    // mastery, banks, and a visible wave receipt stay in memory; stale async
    // callbacks cannot re-enter the resumed run.
    runGenerationRef.current += 1
    if (runtimeRef.current.nextWavePending) {
      runtimeRef.current.nextWaveRunGeneration = runGenerationRef.current
    }
    const now = performance.now()
    lockGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: now }
    bossPitchGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: now }
    lastTimeRef.current = 0
    if (loopRef.current) {
      rafRef.current = requestAnimationFrame(nextTs => loopRef.current?.(nextTs, pauseGateRef.current.fence))
    }
  }, [pitchGenerationRef])

  const setCloseSmashGuideDisclosure = useCallback((open: boolean) => {
    if (open) {
      closeSmashGuidePausedBeforeOpenRef.current = pausedRef.current
      setCloseSmashGuideOpen(true)
      if (!pausedRef.current) togglePause()
      return
    }
    setCloseSmashGuideOpen(false)
    if (!closeSmashGuidePausedBeforeOpenRef.current && pausedRef.current) togglePause()
  }, [togglePause])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || phaseRef.current !== 'playing') return
      event.preventDefault()
      togglePause()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePause])

  const loop = useCallback((ts: number, fence = pauseGateRef.current.fence) => {
    if (phaseRef.current !== 'playing' || fence !== pauseGateRef.current.fence) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dt = lastTimeRef.current ? Math.min(0.05, (ts - lastTimeRef.current) / 1000) : 0
    lastTimeRef.current = ts
    if (pausedRef.current) {
      rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, fence))
      return
    }
    if (artReviewRef.current) {
      const reviewRuntime = buildArtReviewRuntime(
        ts / 1000,
        artReviewBodyRef.current,
        artReviewStormRef.current,
        assetsRef.current,
      )
      const reviewView = buildArtReviewView(reviewRuntime, artReviewStormRef.current, selectedWorldRef.current)
      runtimeRef.current = reviewRuntime
      viewStateRef.current = reviewView
      renderView(ctx, reviewView, assetsRef.current)
      drawArtReviewOverlay(ctx, artReviewBodyRef.current, artReviewStormRef.current)
      rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, fence))
      return
    }
    // The separate recital room owns this frame. No battlefield movement,
    // attack deadlines, environmental clock, spawn or next-wave path runs.
    if (bossControllerRef.current) {
      stepBossChamber(dt, ctx)
      rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, fence))
      return
    }
    updateGame(dt)
    const receiptWindowActive = waveReceiptRef.current.visible && runtimeRef.current.nextWavePending
    if (!receiptWindowActive) syncMicHudState()
    const active = receiptWindowActive ? null : getActiveTarget()
    const tuner = receiptWindowActive
      ? viewStateRef.current?.tuner ?? EMPTY_TUNER_VIEW
      : updatePitchBarState(active)
    const frameNow = performance.now()
    const shakeElapsedMs = frameNow - shakeStartedAtRef.current
    const shakeProgress = !reducedMotionRef.current && shakeStartedAtRef.current > 0 && shakeElapsedMs < SHAKE_MS
      ? 1 - Math.max(0, shakeElapsedMs) / SHAKE_MS
      : 0
    const shake: ShakeView = shakeProgress > 0
      ? {
          x: Math.sin(runtimeRef.current.animClock * 47) * SHAKE_PEAK_PX * shakeProgress,
          y: Math.sin(runtimeRef.current.animClock * 61) * SHAKE_PEAK_PX * shakeProgress * 0.6,
        }
      : { x: 0, y: 0 }
    let frankReaction: ViewState['frankReaction'] = null
    const frankReactionKind = frankReactionKindRef.current
    if (!receiptWindowActive && frankReactionKind && frankReactionStartedAtRef.current > 0) {
      const ageMs = frameNow - frankReactionStartedAtRef.current
      if (ageMs < FRANK_REACTION_MS) {
        frankReaction = { kind: frankReactionKind, ageMs }
      } else {
        frankReactionKindRef.current = null
        frankReactionStartedAtRef.current = 0
      }
    }
    const logicalNowMs = runtimeRef.current.animClock * 1000
    const bellWaveProjection = projectPitchforksBellWave(
      bellWaveStateRef.current,
      bellWaveClockMsRef.current,
    )
    const bellWaveElapsedMs = bellWaveStateRef.current.wave
      ? Math.max(0, bellWaveClockMsRef.current - bellWaveStateRef.current.wave.releasedAtMs)
      : 0
    const receipt = waveReceiptRef.current
    const receiptAgeMs = receipt.visible
      ? pitchforksWaveReceiptAgeMs({
          logicalNowMs,
          receiptStartedAtMs: receipt.receiptStartedAtMs,
        })
      : 0
    const victoryClaim = receiptWindowActive ? receipt.claim : null
    const victoryPose = selectPitchforksVictoryPoseForClaim(
      victoryClaim,
      victoryClaim ? pitchforksWaveReceiptAgeMs({ logicalNowMs, receiptStartedAtMs: victoryClaim.claimedAtMs }) : 0,
      victoryClaim ? victoryCancelledReceiptIdRef.current === victoryClaim.receiptId : false,
    )
    const frankVictory: ViewState['frankVictory'] = victoryPose === 'none' || !victoryClaim
      ? null
      : {
          pose: victoryPose,
          ageMs: receiptAgeMs,
          receiptId: victoryClaim.receiptId,
        }
    const view = freezeViewStateForDebug(buildViewState({
      runtime: runtimeRef.current,
      phase: phaseRef.current,
      normalWorld: selectedWorldRef.current,
      inputMode,
      active,
      activeVillagerId: activeVillagerIdRef.current,
      activeKey: activeKeyRef.current,
      targetOutcomes: levelProgressRef.current.targetOutcomes,
      hintedTargetKeys: hintedTargetKeysRef.current,
      chargeProgress: lockProgressRef.current,
      tint: tintRef.current,
      noteNamesVisible: inputMode === 'buttons' ? false : noteNamesRef.current,
      staffNotationVisible: inputMode === 'buttons' ? false : staffNotationRef.current && layoutModeRef.current !== 'portrait',
      synesthesiaOn: synesthesiaRef.current,
      reducedMotion: reducedMotionRef.current,
      timersPaused: timersPausedRef.current,
      prompt: currentPromptRef.current,
      tuner,
      ceremony: ceremonyRef.current,
      noteMastered: noteMasteredRef.current,
      noteMasteredAgeMs: noteMasteredStartedAtRef.current > 0
        ? performance.now() - noteMasteredStartedAtRef.current
        : 0,
      frankReaction,
      frankVictory,
      closeSmash: closeSmashStateRef.current,
      closeSmashFallbackDueAtMs: closeSmashFallbackDueAtRef.current,
      closeSmashRecoilUntil: closeSmashRecoilUntilRef.current,
      bellRecoilUntil: bellRecoilUntilRef.current,
      bellWaveClockMs: bellWaveClockMsRef.current,
      shake,
      fsrsMemory: inputMode === 'buttons' ? earFsrsRef.current : fsrsRef.current,
      thunderhead: thunderheadStateRef.current,
      thunderheadClockMs: thunderheadClockMsRef.current,
      thunderheadTravelStartedAtMs: thunderheadTravelStartedAtRef.current,
      thunderheadTravelStart: thunderheadTravelStartRef.current,
      thunderheadTravelTarget: thunderheadTravelTargetRef.current,
      bellWave: bellWaveProjection,
      bellWaveElapsedMs,
    }), demoRef.current || fsrsDebugRef.current)
    viewStateRef.current = view
    renderView(ctx, view, assetsRef.current)

    const staffCanvas = staffCanvasRef.current
    if (staffCanvas) {
      const staffCtx = staffCanvas.getContext('2d')
      if (staffCtx) {
        staffCtx.setTransform(1, 0, 0, 1, 0, 0)
        staffCtx.clearRect(0, 0, staffCanvas.width, staffCanvas.height)
        if (
          layoutModeRef.current === 'portrait' &&
          inputModeRef.current !== 'buttons' &&
          staffNotationRef.current &&
          view.tuner.visible
        ) {
          staffCtx.setTransform(
            STAFF_BAND_RENDER_SCALE,
            0,
            0,
            STAFF_BAND_RENDER_SCALE,
            -STAFF_PANEL_X * STAFF_BAND_RENDER_SCALE,
            -STAFF_PANEL_Y * STAFF_BAND_RENDER_SCALE,
          )
          drawStaffNotationView(staffCtx, view)
        }
      }
    }

    const feedbackKey = `${view.tuner.feedback.kind}|${view.tuner.feedback.headline}|${view.tuner.feedback.detail}`
    if (feedbackKey !== tunerFeedbackKeyRef.current) {
      tunerFeedbackKeyRef.current = feedbackKey
      // Paint both canvases first, then publish the DOM ribbon and any queued coach/status
      // updates in this same task. Publishing React first can expose a one-frame split state.
      flushSync(() => setTunerFeedback(view.tuner.feedback))
    }

    const actionPrompt = /^(?:Sing|Now):\s+(.+)$/.exec(currentPromptRef.current)
    if ((demoRef.current || fsrsDebugRef.current) && actionPrompt && active && actionPrompt[1] !== active.note) {
      const warningKey = `${actionPrompt[1]}:${active.note}:${active.key}`
      if (promptMismatchWarnedRef.current !== warningKey) {
        promptMismatchWarnedRef.current = warningKey
        console.warn(`[PitchforksIII] action prompt ${actionPrompt[1]} does not match active target ${active.note}`)
      }
    } else {
      promptMismatchWarnedRef.current = ''
    }
    if (!runtimeRef.current.gameOver) rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, fence))
  }, [getActiveTarget, inputMode, stepBossChamber, syncMicHudState, updateGame, updatePitchBarState])
  loopRef.current = loop

  const beginPlaying = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
    setCloseSmashGuideOpen(false)
    closeSmashGuidePausedBeforeOpenRef.current = false
    setVillageLessonOpen(false)
    setBellLessonOpen(false)
    lessonPausedBeforeOpenRef.current = false
    pendingPracticeWorldRef.current = null
    presentationVisitCountByTargetRef.current.clear()
    runtimeRef.current.lastPickedVillagerNote = null
    bossControllerRef.current?.cancel()
    bossControllerRef.current = null
    bossWorldRef.current = null
    bossPracticeWorldRef.current = null
    bossIdentityRef.current = null
    setBossIdentity(null)
    bossSimulatingRef.current = false
    setBossState(null)
    if (!demoRef.current && !rangeProfileRef.current) {
      phaseRef.current = 'tutorial'
      setPhase('tutorial')
      return
    }
    resumeCueAudioFromGesture()
    clearCueTimers()
    clearNextWaveTimer()
    runGenerationRef.current += 1
    pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
    villageReturnQueueRef.current = createVillageReturnQueue(`village-return:${runGenerationRef.current}`)
    villageReturnOffersRef.current.clear()
    villageReturnContextPlayedRef.current.clear()
    completedVillageEncounterCountRef.current = 0
    sparkGuideEventsRef.current = []
    sparkGuideRef.current = createPitchforksSparkGuideState(sparkGuideRef.current.generation + 1)
    syncSparkGuideStatus('idle')
    clearFirstMinuteTimer()
    clearNewNoteCeremony()
    clearNoteMasteredCeremony()
    clearWaveReceipt()
    resetCloseSmash()
    resetThunderhead()
    resetNormalBellPowerForRun(normalBellRouteAvailable())
    resetBellWave()
    resetRangeMatch(null)
    setPendingRangeProfile(null)
    setRangeAssessmentError(null)
    setPortraitDockPanel(staffNotationRef.current ? 'staff' : null)
    runtimeRef.current = makeInitialRuntime(demoRef.current, closeSmashProofRef.current, galvanicProofRef.current)
    resetGalvanic()
    rainActivationRequestedRef.current = false
    rainUiSignatureRef.current = ''
    setRainState(runtimeRef.current.rain)
    viewStateRef.current = null
    lightningPhaseTraceRef.current = []
    deferredAdmissionNotesRef.current = new Set()
    cueSupportByTargetRef.current = new Map()
    hintedTargetKeysRef.current = new Set()
    activeCueContextRef.current = { support: 'guided', noteCount: 1 }
    setActiveCueContext({ support: 'guided', noteCount: 1 })
    firstMinuteCoachRef.current = { beat: 'threat', note: null }
    firstMinuteBeatStartedAtRef.current = performance.now()
    setFirstMinuteCoach({ beat: 'threat', note: null })
    nextIdRef.current = 0
    waveNotesHeardRef.current = new Set()
    waveNotesSungRef.current = new Set()
    waveStartedAtRef.current = Date.now()
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    activePromptKeyRef.current = ''
    promptStartedAtRef.current = 0
    failureGradedKeysRef.current = new Set()
    buttonTrialRef.current = null
    buttonAnswerPendingRef.current = false
    setButtonFeedback({ kind: 'listen', text: 'LISTEN, THEN CHOOSE THE NOTE' })
    resetLevelProgress(1)
    for (const note of unlockedNotesRef.current) ensureActiveNoteMemory(note)
    demoTargetRef.current = ''
    demoLockCountRef.current = 0
    demoStepRef.current = 'idle'
    silenceFreezeObservedRef.current = false
    resetCountRef.current = 0
    lastResetReasonRef.current = null
    burnedTinesRef.current = 0
    ashCountRef.current = 0
    lastAshAtRef.current = 0
    lastStrikeNoteRef.current = null
    lastStrikeHueRef.current = null
    lastKillNoteRef.current = null
    lastKillHueRef.current = null
    shakeStartedAtRef.current = 0
    frankReactionKindRef.current = null
    frankReactionStartedAtRef.current = 0
    roarFiredCountRef.current = 0
    fullSequenceCompleteRef.current = false
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    currentPromptRef.current = ''
    timersPausedRef.current = false
    firstLockGraceRef.current = true
    pitchTrailRef.current = []
    barDotDeviationRef.current = null
    barOnTargetRef.current = false
    barVisibleRef.current = false
    lockWhileSuppressedRef.current = false
    micHudStateRef.current = demoRef.current ? 'demo' : 'waiting'
    setMicHudState(micHudStateRef.current)
    // Reuse the same director and mastery caps as every later level. Demo and
    // the separate EAR lane never borrow a singer's saved journey checkpoint.
    const resumeLevel = !demoRef.current && !fsrsDebugRef.current && inputModeRef.current === 'voice'
      ? presentationJourneyRef.current?.currentLevel ?? 1
      : 1
    startWave(resumeLevel)
    if (inputModeRef.current === 'buttons') stopListening()
    setPhase('playing')
    phaseRef.current = 'playing'
    lastTimeRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, pauseGateRef.current.fence))
  }, [clearCueTimers, clearFirstMinuteTimer, clearNewNoteCeremony, clearNextWaveTimer, clearNoteMasteredCeremony, clearWaveReceipt, ensureActiveNoteMemory, loop, normalBellRouteAvailable, resetBellWave, resetGalvanic, resetLevelProgress, resetNormalBellPowerForRun, resetRangeMatch, resetThunderhead, resumeCueAudioFromGesture, startWave, stopListening, syncSparkGuideStatus])

  const beginArtReview = useCallback(() => {
    if (!artReviewRef.current) return
    pausedRef.current = false
    setPaused(false)
    pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
    phaseRef.current = 'playing'
    setPhase('playing')
    lastTimeRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, pauseGateRef.current.fence))
  }, [loop])

  useEffect(() => {
    if (!artReviewMode || !assetsReady || phase !== 'menu') return
    beginArtReview()
  }, [artReviewMode, assetsReady, beginArtReview, phase])

  const startGame = useCallback(() => {
    beginPlaying()
  }, [beginPlaying])

  const setVillageLessonDisclosure = useCallback((open: boolean) => {
    if (open) {
      lessonPausedBeforeOpenRef.current = pausedRef.current
      setVillageLessonOpen(true)
      setBellLessonOpen(false)
      if (!pausedRef.current) togglePause()
      return
    }
    setVillageLessonOpen(false)
    if (!lessonPausedBeforeOpenRef.current && pausedRef.current) togglePause()
  }, [togglePause])

  const setBellLessonDisclosure = useCallback((open: boolean) => {
    if (open) {
      lessonPausedBeforeOpenRef.current = pausedRef.current
      setBellLessonOpen(true)
      setVillageLessonOpen(false)
      if (!pausedRef.current) togglePause()
      return
    }
    setBellLessonOpen(false)
    if (!lessonPausedBeforeOpenRef.current && pausedRef.current) togglePause()
  }, [togglePause])

  const beginBossPreview = useCallback((lane: 'voice' | 'ear', bossId: PitchforksBossId = 'torchmaster', earnedWorld: WorldId | null = null, practiceOnly = false, practiceWorld: WorldId | null = null) => {
    if (!isPitchforksBossId(bossId)) return
    pausedRef.current = false
    setPaused(false)
    const admitted = [...unlockedNotesRef.current]
    const journey = presentationJourneyRef.current
    if (earnedWorld && (!journey || lane !== 'voice' || demoRef.current || fsrsDebugRef.current
      || inputModeRef.current !== 'voice' || !(practiceOnly ? isWorldUnlocked(earnedWorld, projectPitchforksWorldGates(journey)) : isBossAvailable(earnedWorld, projectPitchforksMastery({
        admittedNotes: admitted, voiceMemory: fsrsRef.current, masteryRecords: masteryProgressRef.current,
        nowMs: Date.now(),
      }), projectPitchforksWorldGates(journey))))) return
    const entry = assessPitchforksBossEntry(bossId, earnedWorld || practiceWorld ? true : demoRef.current, {
      torchmasterChamberPlate: !!assetsRef.current.torchmasterChamberPlate,
      bellringerChamberPlate: !!assetsRef.current.bellringerChamberPlate,
      bellringerRest: !!assetsRef.current.bellringerRest,
    }, admitted)
    // Entry validation stays before any lifecycle reset, controller creation,
    // attempt minting, or storage port access. Missing Bellringer art and a
    // short admitted arsenal therefore remain visibly unavailable and inert.
    if (!entry.available || !entry.sequence.length) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    bossControllerRef.current?.cancel()
    clearCueTimers()
    clearNextWaveTimer()
    clearFirstMinuteTimer()
    clearNewNoteCeremony()
    clearNoteMasteredCeremony()
    clearWaveReceipt()
    resetCloseSmash()
    resetThunderhead()
    resetBellWave()
    stopListening()
    resumeCueAudioFromGesture()
    runGenerationRef.current += 1
    pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
    villageReturnQueueRef.current = createVillageReturnQueue(`village-return:${runGenerationRef.current}`)
    villageReturnOffersRef.current.clear()
    villageReturnContextPlayedRef.current.clear()
    completedVillageEncounterCountRef.current = 0
    runtimeRef.current = makeInitialRuntime(!earnedWorld && !practiceWorld)
    resetGalvanic()
    bossWorldRef.current = earnedWorld
    bossPracticeWorldRef.current = practiceWorld
    bossPracticeOnlyRef.current = practiceOnly
    bossPitchGenerationRef.current = { lastGeneration: pitchGenerationRef.current, generationObserved: false, generationObservedAt: 0 }
    const key = earnedWorld ? FSRS_VOICE_KEY : lane === 'voice' ? FSRS_DEBUG_KEY : FSRS_EAR_DEBUG_KEY
    const durableStorage: PitchforksBossRecitalStorage = {
      loadStore: () => migrate(key, localStorage.getItem(key)),
      saveStore: (_, store) => saveStore(key, store),
      readback: (_, note) => migrate(key, localStorage.getItem(key))[note],
    }
    const controller = createPitchforksBossRecital({
      attempt: `${bossId}:${runGenerationRef.current}:${Date.now()}`,
      lane, sequence: practiceOnly && bossId !== 'bellringer' ? entry.sequence : earnedWorld === 'bell-tower'
        ? journey!.villageClear!.bindings.flatMap(binding => [binding.contextNote, binding.targetNote])
        : earnedWorld === 'cathedral' ? [...admitted, ...admitted.slice(0, -1).reverse()] : entry.sequence,
      admittedNotes: admitted,
      storage: selectPitchforksBossRecitalStorage(practiceOnly, durableStorage),
    })
    bossIdentityRef.current = bossId
    setBossIdentity(bossId)
    bossControllerRef.current = controller
    bossReceiptsRef.current = []
    bossSupportedPracticeRef.current = false
    bossHoldRef.current = { heldMs: 0, matched: false }
    bossClockRef.current = 0
    bossSimulatingRef.current = false
    bossHeardClaimRef.current = null
    bossButtonTrialRef.current = null
    demoTargetRef.current = ''
    demoLockCountRef.current = 0
    lastAshAtRef.current = 0
    setBossSimulating(false)
    setBossAudioBusy(false)
    setBossState(controller.state())
    setBossMessage(practiceOnly ? bossId === 'torchmaster' ? 'The Torchmaster raises his flame. Answer one comfortable note at a time. Listen whenever you need; this chamber is practice.' : bossId === 'choirmaster' ? 'The Choirmaster gives the chorus its notes. Sing this short phrase at your own pace, with hints whenever you need.' : practiceWorld === 'cathedral' ? 'The Maestro gives you the phrase. Sing each note at your own pace; this chamber does not alter your journey.' : 'The Bellringer gives you the phrase. Sing each note at your own pace; this chamber does not alter your journey.' : earnedWorld ? earnedWorld === 'bell-tower' ? 'The Bellringer listens. Sing back every bell you have bound, in the order you learned them. There is no clock here — only your voice.' : 'One last storm. Every note you know — out, then back. Take your time. The lightning is yours now.' : bossId === 'bellringer'
      ? lane === 'ear'
        ? 'Bellringer two-note interval practice: hear the challenge, then choose the note. There is no timer.'
        : 'Bellringer two-note interval practice: one exact note at a time. Start the simulated voice when you are ready.'
      : lane === 'ear'
        ? 'Hear the challenge, then choose the note. There is no timer.'
        : 'One exact note at a time. Start the simulated voice when you are ready.')
    phaseRef.current = 'playing'
    setPhase('playing')
    if (shouldStartPitchforksBossMicrophone({ lane, earnedWorld, practiceWorld })) void startListening()
    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(nextTs => loop(nextTs, pauseGateRef.current.fence))
  }, [startListening, clearCueTimers, clearFirstMinuteTimer, clearNewNoteCeremony, clearNextWaveTimer, clearNoteMasteredCeremony, clearWaveReceipt, loop, resetBellWave, resetCloseSmash, resetGalvanic, resetThunderhead, resumeCueAudioFromGesture, stopListening])

  const rehearseCampaignRecital = useCallback((world: 'bell-tower' | 'cathedral') => {
    const journey = presentationJourneyRef.current
    if (!journey || !isWorldUnlocked(world, projectPitchforksWorldGates(journey))
      || !pianoSamplesReadyRef.current || phaseRef.current !== 'menu') return
    clearCueTimers()
    resumeCueAudioFromGesture()
    const notes = world === 'bell-tower'
      ? journey.villageClear?.bindings.flatMap(binding => [binding.contextNote, binding.targetNote]) ?? []
      : [...journey.unlockedNotes, ...journey.unlockedNotes.slice(0, -1).reverse()]
    const run = runGenerationRef.current
    notes.forEach((note, index) => cueTimeoutsRef.current.push(setTimeout(() => {
      if (runGenerationRef.current !== run || phaseRef.current !== 'menu') return
      playPianoNote(note, { exact: true })
      matchingSuppressedUntilRef.current = performance.now() + 1800
    }, index * 1800)))
  }, [clearCueTimers, resumeCueAudioFromGesture])

  const playBossCue = useCallback((hint: boolean) => {
    const controller = bossControllerRef.current
    const state = controller?.state()
    if (!controller || !state?.claimId || !state.currentNote || matchingSuppressedNow()) return
    if (!pianoSamplesReadyRef.current) {
      setBossMessage('Reference audio is still loading. Please wait before listening.')
      return
    }
    if (hint) {
      bossSupportedPracticeRef.current = true
      controller.hint({ attempt: state.attempt, lane: state.lane, cursor: state.cursor, note: state.currentNote, claimId: state.claimId })
    }
    bossSimulatingRef.current = false
    setBossSimulating(false)
    bossHoldRef.current = { heldMs: 0, matched: false }
    resumeCueAudioFromGesture()
    playPianoNote(state.currentNote, { exact: true })
    const until = performance.now() + 1800
    cuePlayingUntilRef.current = until
    matchingSuppressedUntilRef.current = until
    setBossAudioBusy(true)
    setBossState(controller.state())
    const claim = state.claimId
    schedulePitchforksBossCueCompletion(
      (callback, delayMs) => {
        const timer = setTimeout(callback, delayMs)
        cueTimeoutsRef.current.push(timer)
        return timer
      },
      () => bossControllerRef.current === controller && controller.state().claimId === claim && phaseRef.current === 'playing',
      () => pausedRef.current,
      () => {
        bossHeardClaimRef.current = claim
        bossButtonTrialRef.current = createPitchforksButtonTrial(claim)
        setBossAudioBusy(false)
        setBossMessage(hint ? 'Hint heard. This is supported practice—take your time.' : 'Now choose the note you heard.')
      },
    )
  }, [matchingSuppressedNow, resumeCueAudioFromGesture])

  const answerBossByButton = useCallback((note: string) => {
    const state = bossControllerRef.current?.state()
    const trial = bossButtonTrialRef.current
    if (!state?.claimId || state.lane !== 'ear' || !state.currentNote || bossHeardClaimRef.current !== state.claimId || !trial || matchingSuppressedNow()) return
    const decision = decidePitchforksButtonAnswer(trial, note, state.currentNote)
    bossButtonTrialRef.current = decision.next
    if (decision.accepted && decision.shouldGrade) resolveBossNote(decision.correct)
  }, [matchingSuppressedNow, resolveBossNote])

  useEffect(() => {
    if (bossState) bossHeadingRef.current?.focus()
  }, [bossState?.attempt])

  const activateRaincall = useCallback(() => {
    if ((!demoRef.current && !normalBellRouteAvailable()) || phaseRef.current !== 'playing') return
    if (runtimeRef.current.rain.phase !== 'ready' || environmentalClockPausedNow()) return
    rainActivationRequestedRef.current = true
  }, [environmentalClockPausedNow, normalBellRouteAvailable])

  const beginCalibration = useCallback(async () => {
    if (demoRef.current) {
      beginPlaying()
      return
    }
    heardYouRef.current = false
    setHeardYou(false)
    roomNoiseSamplesRef.current = []
    roomCheckStartedAtRef.current = 0
    voiceCheckStartedAtRef.current = 0
    setMicCheckStep('room')
    setRoomReadiness('checking-room')
    setMicReadiness('checking-room')
    phaseRef.current = 'calibrating'
    setPhase('calibrating')
    await startListening()
    if (phaseRef.current !== 'calibrating') return
    roomCheckStartedAtRef.current = performance.now()
  }, [beginPlaying, startListening])

  const restartGameAfterGameOver = useCallback(() => {
    setRangeIntent('saved')
    if (inputModeRef.current === 'buttons') {
      beginPlaying()
      return
    }
    void beginCalibration()
  }, [beginCalibration, beginPlaying])

  const startGuidedRangeSetup = useCallback(() => {
    setRangeIntent('guided')
    void beginCalibration()
  }, [beginCalibration])

  const enterPracticeArcade = useCallback((world: PitchforksPracticeWorld) => {
    const lane = inputMode === 'buttons' ? 'ear' : 'voice'
    if (lane === 'voice' && !rangeProfileRef.current) {
      pendingPracticeWorldRef.current = world
      setRangeIntent('guided')
      void beginCalibration()
      return
    }
    beginBossPreview(lane, pitchforksPracticeBossForWorld(world), null, true, world)
  }, [beginBossPreview, beginCalibration, inputMode])

  const startSavedRangeSetup = useCallback(() => {
    if (!rangeProfileRef.current) return
    setRangeIntent('saved')
    void beginCalibration()
  }, [beginCalibration])

  const openManualRangeSetup = useCallback(() => {
    const current = rangeProfileRef.current
    setManualLowNote(current?.lowNote ?? 'C4')
    setManualHighNote(current?.highNote ?? 'G4')
    setRangeAssessmentError(null)
    phaseRef.current = 'range_manual'
    setPhase('range_manual')
  }, [])

  const saveManualRangeAndCheckMic = useCallback(() => {
    const profile = createPitchforksRangeProfile({
      lowNote: manualLowNote,
      highNote: manualHighNote,
      source: 'manual',
    })
    if (!profile) {
      setRangeAssessmentError('Choose at least two neighboring notes, with the low note below the high note.')
      return
    }
    applyRangeProfile(profile)
    setRangeIntent('saved')
    setRangeAssessmentError(null)
    if (inputModeRef.current === 'buttons') beginPlaying()
    else void beginCalibration()
  }, [applyRangeProfile, beginCalibration, beginPlaying, manualHighNote, manualLowNote])

  const startRangeAssessment = useCallback(() => {
    setRangeStep('anchor')
    setRangeAnchor(null)
    setRangeLow(null)
    setRangeHigh(null)
    setPendingRangeProfile(null)
    setRangeAssessmentError(null)
    resetRangeMatch(null)
    phaseRef.current = 'range_assessment'
    setPhase('range_assessment')
  }, [resetRangeMatch])

  const playRangeCandidateTone = useCallback(() => {
    const candidate = rangeCandidate
    if (!candidate || cueVolumeRef.current <= 0 || matchingSuppressedNow()) return
    resetRangeMatch(candidate)
    setRangeCuePlayed(true)
    try {
      initAudio()
      setPianoVolume(cueVolumeRef.current)
      playPianoNote(candidate, { exact: true })
    } finally {
      matchingSuppressedUntilRef.current = performance.now() + TONE_SUPPRESS_MS
      markToneEmitted(TONE_SUPPRESS_MS)
    }
  }, [matchingSuppressedNow, rangeCandidate, resetRangeMatch])

  const finishGuidedRange = useCallback((lowNote: string, highNote: string, anchorNote: string) => {
    const profile = createPitchforksRangeProfile({
      lowNote,
      highNote,
      anchorNote,
      source: 'guided',
    })
    if (!profile) {
      setRangeAssessmentError('We need two comfortable neighboring notes. Try a new easy note, or choose your range manually.')
      setRangeStep('anchor')
      setRangeAnchor(null)
      setRangeLow(null)
      setRangeHigh(null)
      resetRangeMatch(null)
      return
    }
    setPendingRangeProfile(profile)
    setRangeAssessmentError(null)
    setRangeStep('summary')
    resetRangeMatch(null)
  }, [resetRangeMatch])

  const beginHigherRange = useCallback((anchorNote: string) => {
    setRangeStep('higher')
    const next = adjacentRangeNote(anchorNote, 'higher')
    if (next) {
      resetRangeMatch(next)
    } else {
      finishGuidedRange(rangeLow ?? anchorNote, rangeHigh ?? anchorNote, anchorNote)
    }
  }, [finishGuidedRange, rangeHigh, rangeLow, resetRangeMatch])

  const confirmRangeComfortable = useCallback(() => {
    if (!rangeMatched || !rangeCandidate) return
    if (rangeStep === 'anchor') {
      const anchorNote = rangeCandidate
      setRangeAnchor(anchorNote)
      setRangeLow(anchorNote)
      setRangeHigh(anchorNote)
      const next = adjacentRangeNote(anchorNote, 'lower')
      if (next) {
        setRangeStep('lower')
        resetRangeMatch(next)
      } else {
        beginHigherRange(anchorNote)
      }
      return
    }

    if (!rangeAnchor) return
    if (rangeStep === 'lower') {
      const confirmedLow = rangeCandidate
      setRangeLow(confirmedLow)
      const next = adjacentRangeNote(confirmedLow, 'lower')
      if (next) resetRangeMatch(next)
      else beginHigherRange(rangeAnchor)
      return
    }

    if (rangeStep === 'higher') {
      const confirmedHigh = rangeCandidate
      setRangeHigh(confirmedHigh)
      const next = adjacentRangeNote(confirmedHigh, 'higher')
      if (next) resetRangeMatch(next)
      else finishGuidedRange(rangeLow ?? rangeAnchor, confirmedHigh, rangeAnchor)
    }
  }, [beginHigherRange, finishGuidedRange, rangeAnchor, rangeCandidate, rangeLow, rangeMatched, rangeStep, resetRangeMatch])

  const stopAtRangeLimit = useCallback(() => {
    if (!rangeAnchor) return
    if (rangeStep === 'lower') {
      beginHigherRange(rangeAnchor)
    } else if (rangeStep === 'higher') {
      finishGuidedRange(rangeLow ?? rangeAnchor, rangeHigh ?? rangeAnchor, rangeAnchor)
    }
  }, [beginHigherRange, finishGuidedRange, rangeAnchor, rangeHigh, rangeLow, rangeStep])

  const acceptPendingRange = useCallback(() => {
    if (!pendingRangeProfile) return
    applyRangeProfile(pendingRangeProfile)
    setPendingRangeProfile(null)
    const practiceWorld = pendingPracticeWorldRef.current
    pendingPracticeWorldRef.current = null
    if (practiceWorld) {
      beginBossPreview('voice', pitchforksPracticeBossForWorld(practiceWorld), null, true, practiceWorld)
    } else {
      beginPlaying()
    }
  }, [applyRangeProfile, beginBossPreview, beginPlaying, pendingRangeProfile])

  const quitToMenu = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
    setCloseSmashGuideOpen(false)
    closeSmashGuidePausedBeforeOpenRef.current = false
    presentationVisitCountByTargetRef.current.clear()
    runtimeRef.current.lastPickedVillagerNote = null
    bossControllerRef.current?.cancel()
    bossControllerRef.current = null
    bossWorldRef.current = null
    bossPracticeWorldRef.current = null
    bossIdentityRef.current = null
    setBossIdentity(null)
    bossSimulatingRef.current = false
    setBossState(null)
    setBossAudioBusy(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    clearCueTimers()
    clearNextWaveTimer()
    runGenerationRef.current += 1
    pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
    villageReturnQueueRef.current = createVillageReturnQueue(`village-return:${runGenerationRef.current}`)
    villageReturnOffersRef.current.clear()
    villageReturnContextPlayedRef.current.clear()
    completedVillageEncounterCountRef.current = 0
    resetSparkGuide('quit')
    clearFirstMinuteTimer()
    clearNewNoteCeremony()
    clearNoteMasteredCeremony()
    clearWaveReceipt()
    resetCloseSmash()
    resetThunderhead()
    resetBellWave()
    resetNormalBellPowerForRun(false)
    resetGalvanic()
    resetRangeMatch(null)
    setPendingRangeProfile(null)
    setRangeAssessmentError(null)
    phaseRef.current = 'menu'
    viewStateRef.current = null
    rainActivationRequestedRef.current = false
    rainUiSignatureRef.current = ''
    runtimeRef.current.rain = createRainState()
    setRainState(runtimeRef.current.rain)
    resetLevelProgress(1)
    stopListening()
    micHudStateRef.current = 'waiting'
    setMicHudState('waiting')
    setPhase('menu')
  }, [clearCueTimers, clearFirstMinuteTimer, clearNewNoteCeremony, clearNextWaveTimer, clearNoteMasteredCeremony, clearWaveReceipt, resetBellWave, resetCloseSmash, resetGalvanic, resetLevelProgress, resetNormalBellPowerForRun, resetRangeMatch, resetSparkGuide, resetThunderhead, stopListening])

  const beginSongcraft = useCallback(() => {
    if (!demoRef.current && !rangeProfileRef.current) return
    quitToMenu()
    phaseRef.current = 'songcraft'
    setPhase('songcraft')
  }, [quitToMenu])

  const playSongcraftReference = useCallback((note: string) => {
    if (phaseRef.current !== 'songcraft' || !pianoSamplesReadyRef.current) return
    if (!unlockedNotesRef.current.includes(note) || !PITCHFORKS_RANGE_NOTES.includes(note)) return
    resumeCueAudioFromGesture()
    playPianoNote(note, { exact: true })
    const until = performance.now() + 1800
    cuePlayingUntilRef.current = until
    matchingSuppressedUntilRef.current = until
  }, [resumeCueAudioFromGesture])

  const restartNoteJourney = useCallback(() => {
    const profile = rangeProfileRef.current
    if (!profile) return
    const starterNotes = starterPairForRange(profile)
    unlockedNotesRef.current = [...starterNotes]
    setUnlockedNotes([...starterNotes])
    deferredAdmissionNotesRef.current = new Set()
    clearNextWaveTimer()
    runGenerationRef.current += 1
    pauseGateRef.current = createPitchforksPauseGate(runGenerationRef.current)
    villageReturnQueueRef.current = createVillageReturnQueue(`village-return:${runGenerationRef.current}`)
    villageReturnOffersRef.current.clear()
    villageReturnContextPlayedRef.current.clear()
    completedVillageEncounterCountRef.current = 0
    resetNormalBellPowerForRun(false)
    resetLevelProgress(1)
    clearNewNoteCeremony()
    setNewNoteUnlocked(null)
    for (const note of starterNotes) {
      ensureNoteMemory(note)
      ensureEarNoteMemory(note)
    }
    cueSupportProfileRef.current = { version: 1, notes: {} }
    saveCueSupport()
    beginPresentationJourney(profile, starterNotes)
    setJourneyResetConfirm(false)
    setJourneyResetStatus(`Journey restarted with ${starterNotes.join(' and ')}. Your range and mastery are safe.`)
  }, [beginPresentationJourney, clearNextWaveTimer, clearNewNoteCeremony, ensureEarNoteMemory, ensureNoteMemory, resetLevelProgress, resetNormalBellPowerForRun, saveCueSupport])

  useEffect(() => {
    const dialog = journeyResetDialogRef.current
    if (!dialog) return
    if (journeyResetConfirm && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => journeyResetCancelRef.current?.focus())
    } else if (!journeyResetConfirm && dialog.open) {
      dialog.close()
    }
  }, [journeyResetConfirm])

  useEffect(() => () => {
    bossControllerRef.current?.cancel()
    bossControllerRef.current = null
    bossWorldRef.current = null
    bossPracticeWorldRef.current = null
    bossIdentityRef.current = null
    bossSimulatingRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (admissionDialogRef.current?.open) admissionDialogRef.current.close()
    const admissionReturnTarget = admissionReturnFocusRef.current
    admissionReturnFocusRef.current = null
    if (admissionReturnTarget?.isConnected) admissionReturnTarget.focus()
    clearCueTimers()
    const spark = sparkGuideRef.current
    if (spark.quietSinceMs !== null || spark.wrongSinceMs !== null || spark.status === 'pulse') {
      recordSparkGuideEvent('cancelled', 'unmount')
    }
    sparkGuideRef.current = createPitchforksSparkGuideState(spark.generation + 1)
    clearFirstMinuteTimer()
    clearNextWaveTimer()
    clearCeremonyTimers()
    clearNoteMasteredTimer()
    resetThunderhead(false)
    resetBellWave(false)
    resetGalvanic(false)
    stopListening()
  }, [clearCeremonyTimers, clearCueTimers, clearFirstMinuteTimer, clearNextWaveTimer, clearNoteMasteredTimer, recordSparkGuideEvent, resetBellWave, resetGalvanic, resetThunderhead, stopListening])

  const micHudView: Record<MicHudState, { label: string; className: string; dotClassName: string }> = {
    demo: {
      label: 'Demo mode',
      className: 'border-orange-500/50 text-orange-100 bg-orange-950/45',
      dotClassName: 'bg-orange-300',
    },
    cue: {
      label: 'Cue...',
      className: 'border-amber-500/60 text-amber-100 bg-amber-950/45',
      dotClassName: 'bg-amber-300 animate-pulse',
    },
    listening: {
      label: 'Mic listening',
      className: 'border-green-500/60 text-green-100 bg-green-950/45',
      dotClassName: pitch?.isActive ? 'bg-green-300 animate-ping' : 'bg-green-500',
    },
    waiting: {
      label: 'Mic waiting',
      className: 'border-gray-700 text-gray-300 bg-black/35',
      dotClassName: 'bg-gray-500',
    },
    blocked: {
      label: 'Mic blocked',
      className: 'border-red-500/60 text-red-100 bg-red-950/45',
      dotClassName: 'bg-red-400',
    },
  }
  const activeMicHud = micHudView[micHudState]
  const activeInputHud = inputMode === 'buttons'
    ? {
        label: cuePlayingNow() ? 'Playing note' : 'Listen & tap',
        className: 'border-cyan-500/60 text-cyan-100 bg-cyan-950/45',
        dotClassName: cuePlayingNow() ? 'bg-cyan-300 animate-pulse' : 'bg-cyan-400',
      }
    : activeMicHud
  const cuePlaybackActive = cuePlayingNow()
  const replayLabel = inputMode === 'buttons'
    ? activeCueContext.noteCount > 1 ? '🔊 REPLAY NOTE CHAIN' : '🔊 REPLAY NOTE'
    : replayLabelForCueSupport(activeCueContext.support, activeCueContext.noteCount, cuePlaybackActive)
  const activeButtonTarget = inputMode === 'buttons' ? getActiveTarget() : null
  const activeTargetForEnvironment = getActiveTarget()
  const activeEnvironmentReturnText = activeTargetForEnvironment
    ? projectVillageReturnText(activeTargetForEnvironment.villager, levelProgress.targetOutcomes, hintedTargetKeysRef.current)
    : null
  const activeEnvironmentTargetKey = activeTargetForEnvironment?.key ?? null
  const activeEnvironmentHidden = !!activeTargetForEnvironment &&
    !!activeEnvironmentReturnText &&
    activeEnvironmentReturnText.targetKey === activeEnvironmentTargetKey &&
    !activeEnvironmentReturnText.answerVisible
  const activeEnvironmentNoteLabel = activeTargetForEnvironment
    ? projectVillageReturnNoteLabel(
        activeTargetForEnvironment.key,
        activeTargetForEnvironment.note,
        activeEnvironmentHidden ? activeEnvironmentReturnText : null,
      )
    : null
  const projectEnvironmentNote = (targetKey: string, note: string): string =>
    projectVillageReturnNoteLabel(targetKey, note, activeEnvironmentHidden ? activeEnvironmentReturnText : null)
  const projectEnvironmentText = (text: string): string =>
    projectVillageReturnEnvironmentText(
      text,
      activeTargetForEnvironment?.note ?? null,
      activeEnvironmentTargetKey ?? '',
      activeEnvironmentHidden ? activeEnvironmentReturnText : null,
    )
  const activeVillageLesson = normalVillageLessonAvailable() && inputMode === 'voice' && activeTargetForEnvironment?.villager.totalTines === 1
    ? activeTargetForEnvironment.villager.supportedLesson ?? null
    : null
  const galvanicAvailable = galvanicRouteAvailable()
  const thunderheadAvailable = thunderheadRouteAvailable()
  const galvanicBusy = galvanicOwnsInput()
  const bellProof = demoMode && bellProofRef.current
  const normalBell = normalBellRouteAvailable()
  const bellringerEntry = assessPitchforksBossEntry('bellringer', demoMode, {
    torchmasterChamberPlate: !!assetsRef.current.torchmasterChamberPlate,
    bellringerChamberPlate: !!assetsRef.current.bellringerChamberPlate,
    bellringerRest: !!assetsRef.current.bellringerRest,
  }, unlockedNotes)
  const bellringerEntryCopy = pitchforksBossEntryCopy(bellringerEntry)
  const bellChargeReceipt = bellChargeReceiptRef.current
  const normalBellState = normalBell ? bellPowerState : null
  const normalBellPair = normalBellState?.taughtPair.join(' → ') ?? ''
  const normalBellExpected = normalBellState?.phase === 'activating'
    ? normalBellState.taughtPair[normalBellState.activationNotes.length] ?? null
    : null
  const thunderheadBank = thunderheadState.bank ?? thunderheadState.receipt
  const projectedNormalBellPair = projectEnvironmentText(normalBellPair)
  const projectedNormalBellExpected = normalBellExpected
    ? projectEnvironmentText(normalBellExpected)
    : null
  const bellChargeReceiptNote = bellChargeReceipt
    ? projectEnvironmentNote(bellChargeReceipt.targetKey, bellChargeReceipt.note)
    : null
  const thunderheadBankNote = thunderheadBank
    ? projectEnvironmentNote(thunderheadBank.targetKey, thunderheadBank.note)
    : null
  const closeSmashReceiptPitch = closeSmashState.receipt
    ? projectEnvironmentNote(closeSmashState.receipt.targetKey, closeSmashState.receipt.pitch)
    : null
  const bellLifecycleBusy = closeSmashState.phase !== 'idle' ||
    (thunderheadState.phase !== 'idle' && thunderheadState.phase !== 'consumed') ||
    galvanicProjection.bankCount > 0 ||
    galvanicProjection.armed
  const privateBellArmDisabled = !bellProof ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    bellWaveState.phase !== 'idle' && bellWaveState.phase !== 'finished' ||
    !!bellChargeReceipt ||
    bellArmRequestedRef.current ||
    bellReleaseRequestedRef.current ||
    !activeTargetForEnvironment ||
    bellLifecycleBusy
  const normalBellArmDisabled = !normalBell ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    bellWaveState.phase !== 'idle' && bellWaveState.phase !== 'finished' ||
    !normalBellState ||
    normalBellState.phase !== 'ready' ||
    bellReleaseRequestedRef.current ||
    bellChargeReceipt !== null ||
    bellLifecycleBusy
  const bellArmDisabled = bellProof ? privateBellArmDisabled : normalBellArmDisabled
  const privateBellReleaseDisabled = !bellProof ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    bellWaveState.phase !== 'idle' && bellWaveState.phase !== 'finished' ||
    !bellChargeReceipt ||
    bellReleaseRequestedRef.current
  const normalBellReleaseDisabled = !normalBell ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    bellWaveState.phase !== 'idle' && bellWaveState.phase !== 'finished' ||
    normalBellState?.phase !== 'pending' ||
    bellReleaseRequestedRef.current
  const bellReleaseDisabled = bellProof ? privateBellReleaseDisabled : normalBellReleaseDisabled
  const bellStatusCopy = bellProof
    ? inputMode !== 'voice'
      ? 'BELL · VOICE ONLY'
      : bellWaveState.phase === 'active'
        ? `WAVE ACTIVE · ${Math.round(bellWaveProjection.radius)} PX · ${bellWaveState.contactedStableIDs.length} CONTACT${bellWaveState.contactedStableIDs.length === 1 ? '' : 'S'}`
        : bellReleaseRequestedRef.current
          ? `RING QUEUED · ${bellChargeReceiptNote ?? ''}`
          : bellChargeReceipt
            ? `READY · ${bellChargeReceiptNote ?? 'THE EXACT NOTE'} · RING BELLS`
            : bellWaveState.phase === 'finished'
              ? `WAVE FINISHED · ${bellWaveState.contactedStableIDs.length} CONTACT${bellWaveState.contactedStableIDs.length === 1 ? '' : 'S'}`
              : bellArmRequestedRef.current
                ? `CHARGING · HOLD ${activeEnvironmentNoteLabel ?? 'THE EXACT NOTE'}`
                : 'CHARGE THE EXACT NOTE'
    : normalBell
      ? inputMode !== 'voice'
        ? 'BELL · VOICE ONLY'
        : bellWaveState.phase === 'active'
        ? `WAVE ACTIVE · ${Math.round(bellWaveProjection.radius)} PX · ${bellWaveState.contactedStableIDs.length} CONTACT${bellWaveState.contactedStableIDs.length === 1 ? '' : 'S'}`
        : bellReleaseRequestedRef.current
          ? `RING QUEUED · ${projectedNormalBellPair}`
          : normalBellState?.phase === 'pending'
            ? `READY · ${projectedNormalBellPair} · RING BELLS`
            : bellWaveState.phase === 'finished'
              ? `WAVE FINISHED · ${bellWaveState.contactedStableIDs.length} CONTACT${bellWaveState.contactedStableIDs.length === 1 ? '' : 'S'}`
              : normalBellState?.phase === 'activating'
                ? `SING ${projectedNormalBellExpected ?? 'THE NEXT NOTE'} · STEP ${(normalBellState.activationNotes.length + 1)}/2`
                : normalBellState?.phase === 'ready'
                  ? `READY · ${projectedNormalBellPair} · TEACH PAIR`
                  : `CHARGE ${normalBellState?.charge ?? 0}/3 · ${projectedNormalBellPair}`
      : 'BELL UNAVAILABLE'
  const bellControlVisible = bellProof || normalBell
  const activeTorch = activeTargetForEnvironment?.villager.torch ?? null
  const closeSmashReady = inputMode === 'voice' &&
    closeSmashState.phase === 'ready' &&
    !!closeSmashState.receipt &&
    activeTargetForEnvironment?.key === closeSmashState.receipt?.targetKey
  const closeSmashActionDisabled = phase !== 'playing' || !closeSmashReady || galvanicBusy
  const closeSmashStatusCopy = inputMode !== 'voice'
    ? 'CLOSE SMASH · VOICE LOCK REQUIRED'
    : closeSmashState.phase === 'ready' && closeSmashState.receipt
      ? `CLOSE SMASH READY · ${closeSmashReceiptPitch ?? 'THE EXACT NOTE'}`
      : closeSmashState.phase === 'pending'
        ? closeSmashState.consumer === 'smash' ? 'CLOSE SMASH · WIND-UP' : 'CLOSE SMASH · RESOLVING'
        : closeSmashState.phase === 'settle'
          ? 'CLOSE SMASH · SETTLING'
          : 'CLOSE SMASH · EARN AN EXACT CLOSE LOCK'
  const closeSmashStatusLabel = inputMode !== 'voice'
    ? 'VOICE ONLY'
    : closeSmashState.phase === 'ready' && closeSmashState.receipt
      ? 'READY'
      : closeSmashState.phase === 'pending'
        ? closeSmashState.consumer === 'smash' ? 'WIND-UP' : 'RESOLVING'
        : closeSmashState.phase === 'settle'
          ? 'SETTLING'
          : 'EARN LOCK'
  const thunderheadArmReady = thunderheadState.phase === 'idle' || thunderheadState.phase === 'consumed'
  const bellActivationBusy = normalBellState?.phase === 'activating' || normalBellState?.phase === 'pending'
  const thunderheadArmDisabled = !thunderheadAvailable || phase !== 'playing' || inputMode !== 'voice' || !thunderheadArmReady || galvanicBusy || bellActivationBusy
  const thunderheadReleaseDisabled = !thunderheadAvailable || phase !== 'playing' || inputMode !== 'voice' || thunderheadState.phase !== 'banked' || !thunderheadState.bank || galvanicBusy || bellActivationBusy
  const thunderheadStatusCopy = inputMode !== 'voice'
    ? 'THUNDERHEAD · VOICE ONLY'
    : galvanicBusy
      ? 'DISABLED · GALVANIC OWNS SWEEP'
      : thunderheadState.phase === 'banked' && thunderheadBank
        ? `BANKED · ${thunderheadBankNote ?? 'THE EXACT NOTE'} · RELEASE WHEN READY`
        : thunderheadState.phase === 'detached' || thunderheadState.phase === 'ceiling_travel'
          ? `CEILING TRAVEL · ${thunderheadBankNote ?? ''}`
          : thunderheadState.phase === 'target_match'
            ? `TARGET MATCH · ${thunderheadBankNote ?? ''}`
            : thunderheadState.phase === 'strike'
              ? `STRIKE · ${thunderheadBankNote ?? ''}`
              : thunderheadState.phase === 'consumed'
                ? `CONSUMED · ${thunderheadBankNote ?? ''}`
                : thunderheadArmRequestedRef.current
                  ? 'ARMED · HOLD THE EXACT NOTE'
                  : 'ARM NEXT EXACT VOICE LOCK'
  const galvanicBankLabels = galvanicProjection.banks
    .map(bank => projectEnvironmentNote(bank.targetKey, bank.note))
    .join(' · ')
  const galvanicStatusCopy = inputMode !== 'voice'
    ? 'GALVANIC · VOICE ONLY'
    : galvanicProjection.bankCount >= GALVANIC_BANK_CAPACITY
      ? `2 BANKS · ${galvanicBankLabels} · RELEASE SWEEP`
    : galvanicProjection.armed
      ? `ARMED · HOLD ${activeEnvironmentNoteLabel ?? 'THE EXACT NOTE'} FOR ${HOLD_MS} MS · ${galvanicProjection.bankCount}/${GALVANIC_BANK_CAPACITY}`
      : galvanicProjection.awaitingSilence
        ? `WAITING FOR SILENCE · ${galvanicProjection.bankCount}/${GALVANIC_BANK_CAPACITY} BANK${galvanicProjection.bankCount === 1 ? '' : 'S'}`
        : galvanicProjection.bankCount === 0
          ? 'READY · 0 BANKS · BANK THE NEXT EXACT NOTE'
          : galvanicProjection.bankCount === 1
            ? `1 BANK · ${galvanicBankLabels} · BANK AGAIN OR RELEASE SWEEP`
            : `2 BANKS · ${galvanicBankLabels} · RELEASE SWEEP`
  const galvanicLifecycleBusy = closeSmashState.phase !== 'idle' ||
    (thunderheadState.phase !== 'idle' && thunderheadState.phase !== 'consumed') ||
    strikePresentationPending() ||
    cuePlayingNow() ||
    matchingSuppressedNow()
  const galvanicBankDisabled = !galvanicAvailable ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    !activeTargetForEnvironment ||
    activeTargetForEnvironment.villager.torch.phase !== 'spent' ||
    galvanicProjection.bankCount >= GALVANIC_BANK_CAPACITY ||
    galvanicProjection.armed ||
    galvanicProjection.awaitingSilence ||
    galvanicReleaseRequestedRef.current ||
    galvanicLifecycleBusy
  const galvanicReleaseDisabled = !galvanicAvailable ||
    phase !== 'playing' ||
    inputMode !== 'voice' ||
    galvanicProjection.bankCount < 1 ||
    galvanicProjection.bankCount > GALVANIC_BANK_CAPACITY ||
    galvanicProjection.armed ||
    galvanicReleaseRequestedRef.current ||
    galvanicLifecycleBusy
  const galvanicCancelDisabled = !galvanicAvailable || phase !== 'playing'
  const galvanicCoachCopy = galvanicAvailable && inputMode === 'voice' && galvanicProjection.bankCount > 0
    ? galvanicProjection.armed
      ? `GALVANIC ARMED · HOLD ${activeEnvironmentNoteLabel ?? 'THE EXACT NOTE'}`
      : galvanicStatusCopy
    : null
  const firstMinuteCoachDisplayCopy = activeEnvironmentReturnText
    ? projectVillageReturnCoachCopy(firstMinuteCoach.beat, firstMinuteCoach.note, activeEnvironmentReturnText)
    : firstMinuteCoachCopy(firstMinuteCoach.beat, firstMinuteCoach.note)
  // Stored-cloud instructions replace the ordinary first-lock tutorial until
  // this charge is consumed; the tutorial resumes on ordinary play afterward.
  const firstMinuteCopy = thunderheadState.bank?.consumedAt === null
    ? null
    : galvanicCoachCopy
    ?? (inputMode === 'buttons'
      ? firstMinuteCoach.beat === 'threat'
        ? 'THE MOB IS COMING · LISTEN FOR THE FORK NOTE'
        : null
      : firstMinuteCoachDisplayCopy)
  const rainEffects = deriveRainEffects(rainState)
  const rainChargeCopy = `${rainState.charge}/${RAINCALL_REQUIRED_RESPONSES}`
  const rainCycleCopy = `cycle ${rainState.cycleID}`
  const rainPhaseCopy = rainState.phase === 'charging'
    ? `Charging ${rainChargeCopy} · ${Math.round(clamp(rainState.elapsedMs / RAINCALL_TIMINGS.chargingMs, 0, 1) * 100)}% · ${rainCycleCopy}`
    : rainState.phase === 'ready'
      ? `Ready ${rainChargeCopy} · ${rainCycleCopy} — call the rain`
      : rainState.phase === 'gutter_fill'
        ? `Gutters filling ${Math.round(rainState.fill * 100)}% · ${rainChargeCopy} · ${rainCycleCopy}`
        : rainState.phase === 'gargoyle_release'
          ? `Gargoyles releasing water · ${rainChargeCopy} · ${rainCycleCopy}`
          : rainState.phase === 'raining'
            ? `Rain active — villagers slowed · ${rainChargeCopy} · ${rainCycleCopy}`
            : `Rain cooldown · ${rainChargeCopy} · ${rainCycleCopy}`
  const torchPhaseCopy = !activeTorch
    ? 'No active torch bearer.'
    : activeTorch.phase === 'lit'
      ? `Torch lit — hold the exact ${activeEnvironmentNoteLabel ?? 'target'} to douse it before the fork can strike.`
      : activeTorch.phase === 'holding'
        ? `Torch hold ${Math.round(clamp(activeTorch.heldMs / TORCH_EXACT_HOLD_MS, 0, 1) * 100)}% — keep the exact note.`
        : activeTorch.phase === 'steaming'
          ? 'Torch steaming — keep the target steady.'
          : activeTorch.phase === 'wet'
            ? 'Torch wet — no tine credit was granted by water.'
            : 'Torch spent — the ordinary note lock is available.'
  const rainPhaseLabel = rainState.phase === 'charging'
    ? 'CHARGING'
    : rainState.phase === 'ready'
      ? 'READY'
      : rainState.phase === 'gutter_fill'
        ? 'FILLING'
        : rainState.phase === 'gargoyle_release'
          ? 'RELEASING'
          : rainState.phase === 'raining'
            ? 'RAINING'
            : 'COOLDOWN'
  const torchPhaseLabel = !activeTorch
    ? null
    : activeTorch.phase === 'lit'
      ? 'DOUSE'
      : activeTorch.phase === 'holding'
        ? 'HOLD'
        : activeTorch.phase === 'steaming'
          ? 'STEAMING'
          : activeTorch.phase === 'wet'
            ? 'WET'
            : 'SPENT'
  const raincallActionDisabled = (!demoMode && !normalBell) || rainState.phase !== 'ready' || timersPausedRef.current || ceremony.active
  const buttonAnswerOpen = !!activeButtonTarget &&
    !cuePlaybackActive &&
    !matchingSuppressedNow() &&
    buttonTrialRef.current?.targetKey === activeButtonTarget.key &&
    !buttonTrialRef.current.requiresReplay &&
    !buttonTrialRef.current.resolved
  const waveReceiptResult = waveReceipt.visible ? waveReceipt.levelResult : null
  const waveReceiptNoteNamesVisible = inputMode === 'buttons' || noteNamesOn
  const waveReceiptMemory = inputMode === 'buttons' ? earFsrsRef.current : fsrsRef.current
  const calibrationReady = heardYou && !micError
  const micReadinessView = pitchforksMicReadinessCopy(micReadiness)
  const levelAccuracyPercent = pitchforksLevelAccuracyPercent(levelProgress, inputMode)
  const levelProgressMode = inputMode === 'buttons'
    ? 'EAR'
    : levelProgress.level === 1
      ? 'Practice'
      : 'Recall'
  const levelProgressCopy = demoMode ? 'DEMO showcase' : `${levelAccuracyPercent}% / ${PITCHFORKS_LEVEL_ACCURACY_GOAL_PERCENT}% ${levelProgressMode}`
  const supportedPracticeCount = levelProgress.supportedPracticeCorrectTargets + levelProgress.hintedCorrectTargets
  const supportedPracticeCopy = !demoMode && inputMode === 'voice' && supportedPracticeCount > 0
    ? ` · supported +${supportedPracticeCount}`
    : ''
  const calibrationHudLabel = micError
    ? activeMicHud.label
    : heardYou
      ? 'We hear you!'
      : micHudState === 'waiting'
        ? 'Connecting mic...'
        : activeMicHud.label
  const journeySaveNotice = !demoMode && !fsrsDebugMode && journeySaveStatus === 'not-confirmed' ? (
    <div
      data-testid="pf3-journey-save-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-amber-500/70 bg-amber-950/30 px-3 py-2 text-xs font-bold leading-relaxed text-amber-100"
    >
      <span id="pf3-journey-save-message">Saving not confirmed. Progress remains in memory; retry saving.</span>
      <button
        type="button"
        data-testid="pf3-journey-save-retry"
        aria-describedby="pf3-journey-save-message"
        onClick={retryPresentationJourneySave}
        className="min-h-11 shrink-0 border border-amber-200 px-3 py-1 text-xs font-black tracking-widest text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
      >
        RETRY SAVING JOURNEY
      </button>
    </div>
  ) : null
  const masterySaveNotice = !demoMode && !fsrsDebugMode && masterySaveStatus === 'not-confirmed' ? (
    <div
      data-testid="pf3-mastery-save-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-amber-500/70 bg-amber-950/30 px-3 py-2 text-xs font-bold leading-relaxed text-amber-100"
    >
      <span id="pf3-mastery-save-message">Mastery saving not confirmed. Latest practice remains in memory; retry saving.</span>
      <button
        type="button"
        data-testid="pf3-mastery-save-retry"
        aria-describedby="pf3-mastery-save-message"
        onClick={retryMasterySave}
        className="min-h-11 shrink-0 border border-amber-200 px-3 py-1 text-xs font-black tracking-widest text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
      >
        RETRY SAVING MASTERY
      </button>
    </div>
  ) : null
  const newNoteCeremonyBanner = (
    <>
      <dialog
        ref={admissionDialogRef}
        className="fixed inset-0 z-30 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-gray-100 backdrop:bg-black/85"
        style={{ fontFamily: 'monospace' }}
        data-testid="pf3-new-note-ceremony"
        aria-labelledby="pf3-new-note-title"
        onCancel={event => {
          event.preventDefault()
          deferNewNoteAdmission()
        }}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const dialog = event.currentTarget
          const enabledButtons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
          const first = enabledButtons[0]
          const last = enabledButtons[enabledButtons.length - 1]
          if (!first || !last) {
            event.preventDefault()
            admissionDialogPanelRef.current?.focus()
            return
          }
          const active = document.activeElement
          if (event.shiftKey && (active === first || active === admissionDialogPanelRef.current || !dialog.contains(active))) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && (active === last || active === admissionDialogPanelRef.current || !dialog.contains(active))) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        {ceremony.active && ceremony.note && (
          <div
            className="flex min-h-full items-start justify-center overflow-y-auto px-4"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 1.5rem)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)',
            }}
          >
          <section
            ref={admissionDialogPanelRef}
            tabIndex={-1}
            className="my-auto w-full max-w-sm border border-cyan-300/70 bg-[#080d18] p-5 text-center outline-none shadow-[0_0_35px_rgba(34,211,238,0.18)]"
          >
            <div className="mb-2 text-xs font-black tracking-[0.25em] text-cyan-200">NEW NOTE DISCOVERED</div>
            <h2 id="pf3-new-note-title" className="mb-3 text-xl font-black tracking-widest text-white">
              Is {ceremony.note} comfortable today?
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-gray-300">
              Hear the exact octave, then sing and hold it gently. It joins your arsenal only after a true match and your comfort check.
            </p>
            <span
              key={ceremony.tonePulseKey}
              className={`mx-auto mb-4 inline-flex min-h-16 min-w-24 items-center justify-center border px-4 text-4xl font-black tracking-widest${ceremony.toneFired && !reducedMotion ? ' animate-pulse' : ''}`}
              style={ceremonyNoteStyle(ceremony.note, fsrsRef.current, ceremony.toneFired)}
            >
              {ceremony.note}
            </span>
            <div className="mx-auto mb-3 h-2 w-full overflow-hidden rounded bg-gray-800" aria-hidden="true">
              <div
                className="h-full bg-green-300"
                style={{ width: `${Math.round(admissionMatchProgress * 100)}%`, transition: reducedMotion ? 'none' : 'width 80ms linear' }}
              />
            </div>
            <div role="status" aria-live="polite" className="mb-4 min-h-10 text-xs font-bold leading-relaxed text-gray-200">
              {admissionMatched
                ? `Exact ${ceremony.note} held. Confirm only if it feels comfortable.`
                : admissionCuePlayed
                  ? matchingSuppressedNow()
                    ? 'Listen… then sing after the cue.'
                    : `Sing ${ceremony.note} and hold it gently.`
                  : 'Preparing the exact note…'}
            </div>
            <button
              type="button"
              onClick={() => replayNewNoteCeremonyTone(ceremony.note!)}
              data-testid="pf3-admission-hear"
              className="min-h-12 w-full border border-cyan-300 bg-cyan-950/45 px-4 py-3 text-sm font-black tracking-widest text-cyan-100 disabled:opacity-50"
              disabled={matchingSuppressedNow()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RotateCcw size={16} strokeWidth={3} aria-hidden="true" /> HEAR {ceremony.note}
              </span>
            </button>
            <button
              type="button"
              onClick={acceptNewNoteAdmission}
              data-testid="pf3-admission-comfortable"
              disabled={!admissionMatched}
              className="mt-3 min-h-12 w-full border-2 border-green-200 bg-green-300 px-4 py-3 text-sm font-black tracking-widest text-[#071018] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-70"
            >
              YES, THIS FEELS COMFORTABLE
            </button>
            <button
              type="button"
              onClick={deferNewNoteAdmission}
              data-testid="pf3-admission-not-yet"
              className="mt-3 min-h-12 w-full border border-amber-500/70 bg-amber-950/25 px-4 py-3 text-sm font-black tracking-widest text-amber-100"
            >
              NOT YET
            </button>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">
              No penalty. We will keep practicing the notes already in your comfortable arsenal.
            </p>
          </section>
          </div>
        )}
      </dialog>
      {newNoteUnlocked && !ceremony.active && (
        <div
          className="absolute top-16 left-1/2 z-20 flex min-h-11 -translate-x-1/2 items-center gap-3 border px-4 py-2 text-sm font-black tracking-widest text-gray-100"
          style={ceremonyBannerStyle(newNoteUnlocked)}
          role="status"
          aria-live="polite"
        >
          <span>{newNoteUnlocked} joined your arsenal</span>
        </div>
      )}
    </>
  )

  if (phase === 'songcraft') {
    return (
      <PitchforksSongcraft
        admittedNotes={unlockedNotes}
        masteryProjection={projectPitchforksMastery({ admittedNotes: unlockedNotes, voiceMemory: fsrsRef.current,
          masteryRecords: masteryProgressRef.current, nowMs: Date.now() })}
        storage={songcraftStorage}
        microphone={{
          pitchRef,
          healthRef: micSourceHealthRef,
          generationRef: pitchGenerationRef,
          isListening,
          error: micError,
          start: startListening,
          stop: stopListening,
        }}
        onReturn={quitToMenu}
        matchingSuppressed={matchingSuppressedNow}
        referenceReady={pianoSamplesReady}
        playReference={playSongcraftReference}
      />
    )
  }

  if (phase === 'menu') {
    const canRestartJourney = !!rangeProfile && unlockedNotes.length > starterPairForRange(rangeProfile).length
    return (
      <div data-testid="pf3-menu" className="fixed inset-0 overflow-y-auto bg-[#070914] text-gray-100 flex items-start justify-center px-4 py-4" style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
        {newNoteCeremonyBanner}
        {demoMode && (
          <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-orange-200 border border-orange-500/50 px-2 py-1">
            DEMO
          </div>
        )}
        <div className="w-full max-w-lg border border-orange-900/60 bg-black/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <Link href="/pitch-defender" className="text-xs text-orange-300 hover:text-orange-100">
              Back
            </Link>
            <Link href="/pitch-defender/pitchforks" className="text-xs text-gray-500 hover:text-gray-300">
              V1
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-widest text-orange-200 mb-1">PITCHFORKS III</h1>
          <div className="text-sm text-gray-400 mb-2">Frankenstein lightning ear trainer</div>
          {process.env.NODE_ENV === 'development' && (
            <a href="/pitch-defender/pitchforks-3/gradesheet" target="_blank" rel="noopener noreferrer"
              className="mb-4 flex min-h-12 items-center justify-center rounded border border-cyan-700 px-3 py-2 text-sm text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              Procedure Gradesheet · opens a new tab
            </a>
          )}
          {composerSeedProofEnabled && (
            <section
              data-testid="pf3-composer-seed-proof"
              className="mb-5 overflow-hidden border border-cyan-500/60 bg-cyan-950/20 p-3 text-[12px] leading-relaxed text-cyan-50"
              aria-labelledby="pf3-composer-seed-proof-heading"
              aria-live="polite"
              aria-atomic="true"
            >
              <h2 id="pf3-composer-seed-proof-heading" className="font-black tracking-widest text-cyan-100">
                READ-ONLY COMPOSER CHECK
              </h2>
              <p className="mt-1 text-gray-300">Proof only — this score does not control this run.</p>
              {composerSeedProofStatus === 'loading' && (
                <p className="mt-2 text-cyan-200">Reading Composer score…</p>
              )}
              {composerSeedProofStatus === 'empty' && (
                <p className="mt-2 text-amber-200">No playable pd_composed_* score found.</p>
              )}
              {composerSeedProofStatus === 'ready' && composerSeedProof && (
                <div className="mt-2 space-y-1">
                  <p><span className="font-black text-cyan-100">Source:</span> {composerSeedProof.title}</p>
                  <p><span className="font-black text-cyan-100">Extracted notes:</span> {composerSeedProof.notes.map(note => note.pitchName).join(' → ')}</p>
                  <p><span className="font-black text-cyan-100">Playable notes:</span> {composerSeedProof.notes.length}</p>
                  <p className="break-all"><span className="font-black text-cyan-100">SHA-256:</span> {composerSeedProof.sourceSha256}</p>
                </div>
              )}
            </section>
          )}
          {presentationJourney?.cathedralClear && <section role="status" className="mb-5 border border-green-400 p-4 text-green-100">
            <h2 className="font-black">THE CASTLE SINGS AGAIN</h2>
            <p className="mt-2 text-sm">Campaign complete. Revisit any world, review your notes, or make music in Songcraft.</p>
          </section>}
          {!demoMode && !fsrsDebugMode && <>
            {!rangeProfile && <p className="mb-2 border border-amber-700/70 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100">All four practice chambers are available below. Listen &amp; Tap can enter immediately with deliberate answer buttons; Voice Lightning begins the required comfortable-range check. No notes are granted by practice.</p>}
            <p className="mb-2 text-xs leading-relaxed text-cyan-100">Practice lane: <strong>{inputMode === 'buttons' ? 'LISTEN &amp; TAP · deliberate answer buttons · no microphone required' : 'VOICE LIGHTNING · real microphone · comfortable range required'}</strong>. Choose the lane above before entering a chamber.</p>
            <PitchforksPracticeArcade onEnterPractice={enterPracticeArcade} />
          </>}
          {!demoMode && !fsrsDebugMode && presentationJourney && (selectedWorld === 'village-gate' || selectedWorld === 'bell-tower') && <section className="mb-5 border border-amber-800 bg-amber-950/15 p-4 text-amber-100">
            <h2 className="font-bold">{selectedWorld === 'village-gate' ? 'THE TORCHMASTER' : 'THE CHOIRMASTER'}</h2>
            <p className="my-3 text-sm">Visit the practice chamber. Learn a short phrase at your own pace; hints are welcome.</p>
            <button type="button" disabled={inputMode !== 'voice'} className="min-h-12 w-full border border-amber-400 p-3 font-bold disabled:opacity-50" onClick={() => beginBossPreview('voice', selectedWorld === 'village-gate' ? 'torchmaster' : 'choirmaster', selectedWorld, true)}>VISIT THE PRACTICE CHAMBER</button>
          </section>}
          {(selectedWorld === 'bell-tower' || selectedWorld === 'cathedral') && !demoMode && !fsrsDebugMode && <section className="mb-5 border border-cyan-700 p-4 text-cyan-100">
            <h2 className="font-bold">{selectedWorld === 'bell-tower' ? 'THE BELLRINGER' : 'THE MAESTRO · FINAL RECITAL'}</h2>
            <p className="my-3 text-sm">An untimed musical examination using your admitted notes. Practice with hints, then return for an unaided pass.</p>
            <button type="button" className="mb-3 min-h-12 w-full border border-amber-500 p-3 font-bold" onClick={() => rehearseCampaignRecital(selectedWorld)}>LEARN THE RECITAL · HEAR ALL NOTES</button>
            <button type="button" className="min-h-12 w-full border border-cyan-300 p-3 font-bold disabled:opacity-50" disabled={inputMode !== 'voice' || !presentationJourney || !isBossAvailable(selectedWorld, projectPitchforksMastery({admittedNotes: unlockedNotes, voiceMemory: fsrsRef.current, masteryRecords: masteryProgressRef.current, nowMs: Date.now()}), projectPitchforksWorldGates(presentationJourney))} onClick={() => beginBossPreview('voice', 'bellringer', selectedWorld)}>ENTER THE RECITAL</button>
            {presentationJourney && (selectedWorld === 'bell-tower' ? presentationJourney.bellTowerClear : presentationJourney.cathedralClear) && <button type="button" className="mt-3 min-h-12 w-full border border-green-500 p-3 font-bold" disabled={inputMode !== 'voice'} onClick={() => beginBossPreview('voice', 'bellringer', selectedWorld, true)}>REVISIT FOR PRACTICE</button>}
            {inputMode !== 'voice' && <p className="mt-2 text-sm">Choose voice mode for the campaign examination.</p>}
          </section>}
          <div className="mb-5" aria-label="World Map">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-black uppercase tracking-widest text-orange-100">
              <span data-testid="pf3-selected-world">SELECTED WORLD · {WORLD_REGISTRY.find(world => world.id === selectedWorld)?.name.toUpperCase()}</span>
              <span className="text-gray-400">
                {selectedWorld === 'village-gate' ? 'Available after the Dungeon clear.' : 'Available now.'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {WORLD_REGISTRY.map(world => {
                const isDungeon = world.id === 'dungeon'
                const isVillageGate = world.id === 'village-gate'
                const normalWorld: PitchforksNormalWorld = world.id
                const hasDungeonClear = !demoMode && !fsrsDebugMode && Boolean(presentationJourney?.dungeonClear)
                const unlocked = isDungeon || (!demoMode && !fsrsDebugMode && !!presentationJourney
                  && isWorldUnlocked(world.id, projectPitchforksWorldGates(presentationJourney)))
                const artReady = isDungeon || (isVillageGate ? !!assetsRef.current.villageGatePlate
                  : world.id === 'bell-tower' ? !!assetsRef.current.bellTowerPlate : !!assetsRef.current.cathedralPlate)
                const villageGateAvailable = isVillageGate && unlocked && artReady
                const selectable = unlocked && artReady
                const selected = normalWorld !== null && selectedWorld === normalWorld
                const stateCopy = isDungeon
                  ? selected ? 'Ready to play.' : 'Choose this world.'
                  : isVillageGate
                    ? !hasDungeonClear
                      ? 'Master your current notes to unlock.'
                      : !villageGateAvailable
                        ? villageGateAssetStatus === 'missing'
                          ? 'Earned · Village Gate scene unavailable.'
                          : 'Earned · Village Gate scene loading.'
                        : selected
                          ? 'Ready to play.'
                          : 'Choose this world.'
                    : selectable ? selected ? 'Ready to play.' : 'Choose this world.' : unlocked ? 'Earned · Scene loading.' : world.id === 'bell-tower' ? 'Complete your Village interval journey.' : 'Pass the Bellringer recital.'

                return (
                  <div key={world.id} className="min-h-28 flex flex-col">
                    {normalWorld ? (
                      <button
                        type="button"
                        data-testid={`pf3-world-${world.id}`}
                        onClick={() => {
                          if (normalWorld) selectNormalWorld(normalWorld)
                        }}
                        disabled={!selectable}
                        aria-pressed={selected}
                          className={[
                           'min-h-28 flex-1 w-full border px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200',
                          selected
                            ? 'border-orange-200 bg-orange-500/10 text-orange-100'
                            : selectable
                              ? 'border-green-700/80 bg-green-950/20 text-green-100'
                              : 'border-gray-700/80 bg-black/20 text-gray-400',
                        ].join(' ')}
                      >
                        <div className="min-h-8">
                          <span className="inline-flex border border-current/50 px-1 py-0.5 text-sm font-black">
                            {selected ? 'SELECTED' : selectable ? 'AVAILABLE' : isVillageGate && hasDungeonClear ? 'EARNED' : 'LOCKED'}
                          </span>
                        </div>
                        <div className="text-sm font-black uppercase leading-tight">
                          {world.name}
                        </div>
                        <div
                          className="mt-2 text-sm leading-snug"
                          data-testid={isVillageGate ? 'pf3-village-gate-status' : undefined}
                        >
                          {stateCopy}
                        </div>
                      </button>
                    ) : (
                      <div
                        className="min-h-28 flex-1 border border-gray-700/80 bg-black/20 px-2 py-2 text-left text-gray-400"
                        aria-disabled="true"
                      >
                        <div className="min-h-8">
                          <span className="text-sm text-gray-500" aria-hidden="true">
                            &#128274;
                          </span>
                        </div>
                        <div className="text-sm font-black uppercase leading-tight">
                          {world.name}
                        </div>
                        <div className="mt-2 text-sm leading-snug text-gray-500">
                          {stateCopy}
                        </div>
                      </div>
                    )}
                    {isVillageGate && hasDungeonClear && villageGateAssetStatus === 'missing' && (
                      <button
                        type="button"
                        data-testid="pf3-village-gate-retry"
                        onClick={retryVillageGateAsset}
                        className="mt-1 min-h-12 w-full border border-amber-300/70 px-2 py-1 text-sm font-black uppercase tracking-wider text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
                      >
                        Retry Village Gate scene
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {!demoMode && !fsrsDebugMode && presentationJourney && (
              <PitchforksWorldUnlockProgress
                projection={projectPitchforksMastery({
                  admittedNotes: presentationJourney.unlockedNotes,
                  voiceMemory: fsrsRef.current,
                  earMemory: earFsrsRef.current,
                  masteryRecords: masteryProgressRef.current,
                  nowMs: Date.now(),
                })}
              />
            )}
          </div>
          {!demoMode && !fsrsDebugMode && <button type="button" data-testid="pf3-play-selected-world"
            disabled={!assetsReady}
            onClick={() => {
              if (!rangeProfile) { phaseRef.current = 'tutorial'; setPhase('tutorial') }
              else if (inputMode === 'buttons') beginPlaying()
              else startSavedRangeSetup()
            }}
            className="mb-5 min-h-14 w-full border-2 border-cyan-100 bg-cyan-200 px-4 py-3 text-base font-black text-[#071018] disabled:opacity-50">
            PLAY {WORLD_REGISTRY.find(world => world.id === selectedWorld)?.name.toUpperCase()}
          </button>}
          {!demoMode && !fsrsDebugMode && presentationJourney && <PitchforksCampaignJournal
            journey={presentationJourney}
            projection={projectPitchforksMastery({
              admittedNotes: unlockedNotes,
              voiceMemory: fsrsRef.current,
              earMemory: earFsrsRef.current,
              masteryRecords: masteryProgressRef.current,
              nowMs: Date.now(),
            })}
          />}
          <div className="mb-5">
            {rangeProfile || demoMode ? (
              <>
                <div className="text-xs text-green-200/80 mb-2">{unlockedNotes.length} notes unlocked</div>
                <div className="flex flex-wrap gap-1.5" aria-label="Unlocked notes">
                  {unlockedNotes.map(note => (
                    <span
                      key={note}
                      className="inline-flex min-h-6 min-w-10 items-center justify-center border px-2 py-1 text-[11px] font-black tracking-widest"
                      style={noteChipStyle(note, fsrsRef.current)}
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs leading-relaxed text-green-100/80">
                Range setup comes first. No note enters your arsenal until it fits your comfortable range.
              </div>
            )}
            {rangeProfile && !demoMode && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-green-900/60 bg-green-950/20 px-3 py-2">
                <span className="text-xs text-green-100">Comfortable today: {rangeProfile.lowNote}–{rangeProfile.highNote}</span>
                <button
                  type="button"
                  onClick={() => {
                    phaseRef.current = 'tutorial'
                    setPhase('tutorial')
                  }}
                  className="min-h-11 shrink-0 border border-green-700 px-3 text-xs font-bold text-green-100"
                >
                  Recheck range
                </button>
              </div>
            )}
          </div>
          {journeySaveNotice}
          {masterySaveNotice}
          {(rangeProfile || demoMode) && (
            <button
              type="button"
              data-testid="pf3-songcraft-open"
              onClick={beginSongcraft}
              className="mb-4 min-h-12 w-full border border-cyan-500/70 bg-cyan-950/25 px-4 py-3 text-left text-cyan-100"
            >
              <span className="block text-sm font-black tracking-widest">SONGCRAFT · PRACTICE A SONG</span>
              <span className="mt-1 block text-xs leading-relaxed text-gray-300">
                Your songs and built-in exercises, one note at a time. No timer. Only notes in your comfortable arsenal earn practice credit.
                {demoMode ? ' Demo keeps practice history separate.' : ''}
              </span>
            </button>
          )}
          {!demoMode && (
            <section className="mb-4 border border-cyan-900/70 bg-cyan-950/15 p-3" aria-labelledby="pf3-input-mode-heading">
              <h2 id="pf3-input-mode-heading" className="text-xs font-black tracking-widest text-cyan-100">HOW YOU DEFEND</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-300">
                Start by recognizing the note, then move into singing. Both lanes use this same storm and keep recognition separate from voice practice.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="pf3-input-buttons"
                  aria-pressed={inputMode === 'buttons'}
                  onClick={() => chooseInputMode('buttons')}
                  className={`min-h-12 border px-3 py-2 text-left ${inputMode === 'buttons' ? 'border-cyan-200 bg-cyan-200 text-[#071018]' : 'border-gray-600 bg-black/25 text-gray-200'}`}
                >
                  <span className="block text-xs font-black tracking-widest">LISTEN &amp; TAP</span>
                  <span className="mt-1 block text-[11px] leading-tight">Hear the fork, choose its note. No mic.</span>
                </button>
                <button
                  type="button"
                  data-testid="pf3-input-voice"
                  aria-pressed={inputMode === 'voice'}
                  onClick={() => chooseInputMode('voice')}
                  className={`min-h-12 border px-3 py-2 text-left ${inputMode === 'voice' ? 'border-green-200 bg-green-300 text-[#071018]' : 'border-gray-600 bg-black/25 text-gray-200'}`}
                >
                  <span className="block text-xs font-black tracking-widest">VOICE LIGHTNING</span>
                  <span className="mt-1 block text-[11px] leading-tight">Hear, sing, then recall the exact octave.</span>
                </button>
              </div>
              <div className="mt-3 text-[10px] font-bold leading-relaxed tracking-wide text-gray-400">
                LEARNING PATH · LISTEN &amp; TAP → HEAR THEN SING → SING FROM NAME → BLIND
              </div>
            </section>
          )}
          {canRestartJourney && !demoMode && (
            <section className="mb-4" aria-label="Journey controls">
              <button
                ref={journeyResetButtonRef}
                type="button"
                data-testid="pf3-restart-journey"
                onClick={() => {
                  setJourneyResetStatus(null)
                  setJourneyResetConfirm(true)
                }}
                className="min-h-12 w-full border border-cyan-700/70 bg-cyan-950/20 px-3 py-3 text-left text-cyan-100"
              >
                <span className="block text-xs font-black tracking-widest">RESTART LEARNING JOURNEY</span>
                <span className="mt-1 block text-xs font-normal leading-relaxed tracking-normal text-gray-300">
                  Go back to your first two notes and Guided cues. Your comfortable range, note memory, and mastery stay safe.
                </span>
              </button>
            </section>
          )}
          {journeyResetStatus && (
            <div
              ref={journeyResetStatusRef}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className="mb-4 border border-green-700/70 bg-green-950/25 px-3 py-2 text-xs font-bold leading-relaxed text-green-100 outline-none"
            >
              {journeyResetStatus}
            </div>
          )}
          <dialog
            ref={journeyResetDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pf3-restart-dialog-title"
            aria-describedby="pf3-restart-dialog-description"
            className="m-auto w-[calc(100%_-_2rem)] max-w-md border border-cyan-700 bg-[#070914] p-0 text-gray-100 backdrop:bg-black/80"
            onCancel={(event) => {
              event.preventDefault()
              setJourneyResetConfirm(false)
            }}
            onClose={() => {
              setJourneyResetConfirm(false)
              requestAnimationFrame(() => {
                if (journeyResetStatus) journeyResetStatusRef.current?.focus()
                else journeyResetButtonRef.current?.focus()
              })
            }}
          >
            <div className="p-5" style={{ fontFamily: 'monospace' }}>
              <h2 id="pf3-restart-dialog-title" className="text-lg font-black tracking-widest text-cyan-100">
                RESTART THE JOURNEY?
              </h2>
              <p id="pf3-restart-dialog-description" className="mt-3 text-sm leading-relaxed text-gray-300">
                Return to your first two notes and Guided cues? Your comfortable range, learned-note memory, and long-term practice history stay saved.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  ref={journeyResetCancelRef}
                  type="button"
                  data-testid="pf3-restart-journey-cancel"
                  onClick={() => setJourneyResetConfirm(false)}
                  className="min-h-12 flex-1 border border-gray-500 bg-black/30 px-4 py-3 text-sm font-black tracking-widest text-gray-100"
                >
                  KEEP MY PLACE
                </button>
                <button
                  type="button"
                  data-testid="pf3-restart-journey-confirm"
                  onClick={restartNoteJourney}
                  className="min-h-12 flex-1 border border-cyan-300 bg-cyan-200 px-4 py-3 text-sm font-black tracking-widest text-[#071018]"
                >
                  RESTART JOURNEY
                </button>
              </div>
            </div>
          </dialog>
          {assetError && <div className="text-sm text-red-300 mb-4">{assetError}</div>}
          {micError && !demoMode && <div className="text-xs text-red-300 mb-4">{micError}</div>}
          <SettingsRow
            noteNamesOn={noteNamesOn}
            setNoteNamesOn={setNoteNamesPreference}
            audioCueOn={audioCueOn}
            setAudioCueOn={setReferenceAudioPreference}
            staffNotationOn={staffNotationOn}
            setStaffNotationOn={setStaffNotationOn}
            synesthesiaOn={synesthesiaOn}
            setSynesthesiaOn={setSynesthesiaOn}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            cueVolume={cueVolume}
            setCueVolume={setReferenceGainPreference}
            microphoneGain={microphoneGain}
            setMicrophoneGain={setMicrophoneGainPreference}
            sfxVolume={sfxVolume}
            setSfxVolume={setSfxVolume}
            touchSized={layoutMode === 'portrait'}
          />
          <button
            onClick={() => {
              if (demoMode) {
                startGame()
              } else {
                phaseRef.current = 'tutorial'
                setPhase('tutorial')
              }
            }}
            disabled={!assetsReady}
            data-testid="pf3-how-to-play"
            className="mt-5 w-full py-3 text-lg font-black tracking-widest border transition active:scale-[0.99] disabled:opacity-50"
            style={{
              background: assetsReady ? '#bfefff' : '#25313c',
              color: '#071018',
              borderColor: '#e8fbff',
            }}
          >
            {demoMode ? 'START DEMO' : 'HOW TO PLAY'}
          </button>
          {!demoMode && !fsrsDebugMode && (
            <details className="mt-4 w-full border border-cyan-900/70" data-testid="pf3-mastery-disclosure">
              <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-bold text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                YOUR NOTES · Singing &amp; listening progress
              </summary>
              <PitchforksMasteryPanel projection={projectPitchforksMastery({
                admittedNotes: rangeProfile ? unlockedNotes : [],
                voiceMemory: fsrsRef.current,
                earMemory: earFsrsRef.current,
                masteryRecords: masteryProgressRef.current,
                nowMs: Date.now(),
              })} />
            </details>
          )}
          {demoMode && <section className="mt-5 border border-amber-700/60 p-3" aria-label="Torchmaster private preview">
            <p className="text-sm font-bold text-amber-100">THE TORCHMASTER · UNTIMED ROOM</p>
            <p className="mt-1 text-xs text-gray-400">Private preview. Uses demo notes and separate practice history; no world unlock.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" data-testid="pf3-boss-enter" disabled={!assetsReady || !assetsRef.current.torchmasterChamberPlate} onClick={() => beginBossPreview('voice')} className="min-h-12 border border-green-300 bg-green-950/50 px-3 text-sm font-bold text-green-100 disabled:opacity-40">SINGING DEMO</button>
              <button type="button" data-testid="pf3-boss-enter-ear" disabled={!assetsReady || !assetsRef.current.torchmasterChamberPlate} onClick={() => beginBossPreview('ear')} className="min-h-12 border border-cyan-300 bg-cyan-950/50 px-3 text-sm font-bold text-cyan-100 disabled:opacity-40">LISTEN & CHOOSE</button>
            </div>
          </section>}
          {demoMode && <section className="mt-5 border border-violet-700/60 p-3" aria-label="Bellringer private preview">
            <p className="text-sm font-bold text-violet-100">THE BELLRINGER · TWO-NOTE INTERVAL PRACTICE</p>
            <p className="mt-1 text-xs text-gray-400">DEMO ONLY · separate practice history · no world unlock. This private room uses the first two distinct admitted notes in order.</p>
            <p role="status" aria-live="polite" data-testid="pf3-bellringer-availability" className={`mt-2 text-xs ${bellringerEntry.available ? 'text-green-200' : 'text-amber-200'}`}>
              {bellringerEntryCopy}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                data-testid="pf3-bellringer-enter-voice"
                disabled={!bellringerEntry.available}
                onClick={() => beginBossPreview('voice', 'bellringer')}
                className="min-h-12 border border-violet-300 bg-violet-950/50 px-3 text-sm font-bold text-violet-100 disabled:opacity-40"
              >
                BELLRINGER SINGING DEMO
              </button>
              <button
                type="button"
                data-testid="pf3-bellringer-enter-ear"
                disabled={!bellringerEntry.available}
                onClick={() => beginBossPreview('ear', 'bellringer')}
                className="min-h-12 border border-cyan-300 bg-cyan-950/50 px-3 text-sm font-bold text-cyan-100 disabled:opacity-40"
              >
                BELLRINGER LISTEN &amp; CHOOSE
              </button>
            </div>
          </section>}
        </div>
      </div>
    )
  }

  if (phase === 'tutorial') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#070914] text-gray-100 flex flex-col items-center justify-start px-6 py-8 sm:justify-center" style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
        <h2 className="text-2xl font-black text-[#4ade80] mb-4 tracking-widest" style={{ textShadow: '0 0 15px rgba(74,222,128,0.3)' }}>
          HOW TO PLAY
        </h2>

        <div className="max-w-md space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🧟</div>
            <div>
              <div className="text-sm text-green-300 font-bold">You are the monster</div>
              <div className="text-xs text-gray-400">
                {inputMode === 'buttons' ? 'Defend yourself by hearing and choosing the notes carried by the villagers.' : 'Defend yourself by singing the notes carried by the villagers.'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔱</div>
            <div>
              <div className="text-sm text-yellow-300 font-bold">Forks and tines</div>
              <div className="text-xs text-gray-400">Each tine is one note. Multi-tine forks are {inputMode === 'buttons' ? 'answered' : 'sung'} in order.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-sm text-orange-300 font-bold">Replay anytime</div>
              <div className="text-xs text-gray-400">Use the dock&apos;s replay or Hint control to hear the active villager again.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <div className="text-sm text-purple-300 font-bold">{inputMode === 'buttons' ? 'Listen before choosing' : 'Watch the pitch bar'}</div>
              <div className="text-xs text-gray-400">
                {inputMode === 'buttons' ? 'The answer buttons stay locked while the fork sounds. A wrong answer calmly asks you to Replay.' : 'Dot left is too low, dot right is too high, green is on target.'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-sm text-gray-300 font-bold">Level 1 is slow</div>
              <div className="text-xs text-gray-400">Few villagers, generous spacing, and lots of time.</div>
            </div>
          </div>
        </div>

        <section className="mb-4 w-full max-w-md border border-cyan-900/70 bg-cyan-950/20 p-4" aria-labelledby="pf3-private-setup-heading">
          <h3 id="pf3-private-setup-heading" className="mb-2 text-sm font-black tracking-widest text-cyan-100">
            {inputMode === 'buttons' ? 'LISTEN & TAP SETUP' : 'PRIVATE VOICE SETUP'}
          </h3>
          <p className="text-xs leading-relaxed text-gray-300">
            {inputMode === 'buttons'
              ? 'No microphone is needed. Recognition answers train the EAR side of your note memory and never write to voice practice.'
              : "Pitch is analyzed on this device. We don't record or upload your voice; only your comfortable note range is saved."}
          </p>
        </section>

        <div className="w-full max-w-md space-y-3">
          {rangeProfile && inputMode === 'buttons' && (
            <button
              type="button"
              onClick={beginPlaying}
              data-testid="pf3-start-buttons"
              className="min-h-12 w-full border-2 border-cyan-200 bg-cyan-200 px-4 py-3 text-sm font-black tracking-widest text-[#071018] active:scale-[0.99]"
            >
              START LISTEN &amp; TAP · {rangeProfile.lowNote}–{rangeProfile.highNote}
            </button>
          )}
          {rangeProfile && inputMode === 'voice' && (
            <button
              type="button"
              onClick={startSavedRangeSetup}
              className="min-h-12 w-full border-2 border-green-200 bg-green-300 px-4 py-3 text-sm font-black tracking-widest text-[#071018] active:scale-[0.99]"
            >
              USE SAVED RANGE {rangeProfile.lowNote}–{rangeProfile.highNote}
            </button>
          )}
          {inputMode === 'voice' && (
            <button
              type="button"
              onClick={startGuidedRangeSetup}
              data-testid="pf3-range-check"
              className="min-h-12 w-full border border-cyan-300 bg-cyan-950/45 px-4 py-3 text-sm font-black tracking-widest text-cyan-100 active:scale-[0.99]"
            >
              CHECK MY RANGE
            </button>
          )}
          <button
            type="button"
            onClick={openManualRangeSetup}
            data-testid="pf3-range-manual"
            className="min-h-12 w-full border border-gray-600 px-4 py-3 text-sm font-bold text-gray-200 active:scale-[0.99]"
          >
            CHOOSE MANUALLY
          </button>
          <button
            type="button"
            onClick={quitToMenu}
            data-testid="pf3-range-not-now"
            className="min-h-12 w-full px-4 py-3 text-sm font-bold text-gray-400 hover:text-gray-200"
          >
            NOT NOW — RETURN TO MENU
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'range_manual') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#070914] px-5 py-8 text-gray-100" style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
        <div className="mx-auto w-full max-w-md border border-cyan-900/70 bg-black/35 p-5">
          <h2 ref={rangeHeadingRef} tabIndex={-1} className="mb-2 text-xl font-black tracking-widest text-cyan-100 outline-none">
            CHOOSE YOUR COMFORTABLE RANGE
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-gray-300">
            Choose only notes that feel relaxed today. You can recheck this later, and your learning history will stay safe.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-bold text-gray-200">
              Comfortable low
              <select
                value={manualLowNote}
                onChange={event => setManualLowNote(event.target.value)}
                className="mt-2 min-h-12 w-full border border-gray-600 bg-[#111827] px-3 text-base text-white"
              >
                {PITCHFORKS_RANGE_NOTES.map(note => <option key={note} value={note}>{note}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-gray-200">
              Comfortable high
              <select
                value={manualHighNote}
                onChange={event => setManualHighNote(event.target.value)}
                className="mt-2 min-h-12 w-full border border-gray-600 bg-[#111827] px-3 text-base text-white"
              >
                {PITCHFORKS_RANGE_NOTES.map(note => <option key={note} value={note}>{note}</option>)}
              </select>
            </label>
          </div>

          {rangeAssessmentError && <div role="alert" className="mt-4 text-xs leading-relaxed text-red-200">{rangeAssessmentError}</div>}

          <button
            type="button"
            onClick={saveManualRangeAndCheckMic}
            className="mt-6 min-h-12 w-full border-2 border-cyan-200 bg-cyan-200 px-4 py-3 text-sm font-black tracking-widest text-[#071018] active:scale-[0.99]"
          >
            {inputMode === 'buttons' ? 'SAVE RANGE & START' : 'SAVE RANGE & CHECK MIC'}
          </button>
          <button
            type="button"
            onClick={() => {
              phaseRef.current = 'tutorial'
              setPhase('tutorial')
            }}
            className="mt-3 min-h-12 w-full px-4 py-3 text-sm font-bold text-gray-400"
          >
            BACK TO SETUP
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'calibrating') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex flex-col items-center justify-center px-6" style={{ fontFamily: 'monospace' }}>
        <div className="w-full max-w-md border border-green-900/60 bg-black/35 p-6 text-center">
          <div aria-live="polite" className={`mx-auto mb-5 inline-flex items-center gap-3 border px-5 py-3 text-sm font-black tracking-widest ${activeMicHud.className}`}>
            <Mic size={28} strokeWidth={2.5} aria-hidden="true" />
            <span className={`h-4 w-4 rounded-full ${activeMicHud.dotClassName}`} aria-hidden="true" />
            <span>{calibrationHudLabel}</span>
          </div>

          <h2 className="mb-3 text-xl font-black tracking-widest text-green-200">MIC CHECK</h2>
          <div
            data-testid="pf3-mic-readiness"
            role="status"
            aria-live="polite"
            className="mb-5 border border-cyan-800/70 bg-cyan-950/20 p-4 text-left"
          >
            <div className="mb-2 text-xs font-black tracking-widest text-cyan-100">{micReadinessView.label}</div>
            <p className="text-sm leading-relaxed text-gray-300">{micReadinessView.guidance}</p>
          </div>

          {micError && <div role="alert" className="mb-5 text-xs text-red-300">{micError}</div>}

          <button
            type="button"
            onClick={rangeIntent === 'guided' ? startRangeAssessment : beginPlaying}
            disabled={!calibrationReady}
            className="min-h-12 w-full py-3 text-sm font-black tracking-widest border border-green-200 bg-green-300 text-[#071018] transition active:scale-[0.99] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-70"
          >
            {pitchforksMicReadyActionLabel(rangeIntent, selectedWorld)}
          </button>

          <button
            type="button"
            onClick={quitToMenu}
            className="mt-3 min-h-12 w-full px-4 py-3 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'range_assessment') {
    const direction = rangeStep === 'lower' ? 'low' : 'high'
    const confirmedLimit = rangeStep === 'lower' ? rangeLow : rangeHigh
    const starterNotes = pendingRangeProfile ? starterPairForRange(pendingRangeProfile) : null
    const stepTitle = rangeStep === 'anchor'
      ? 'FIND ONE EASY NOTE'
      : rangeStep === 'summary'
        ? 'YOUR COMFORTABLE RANGE'
        : rangeStep === 'lower'
          ? 'FIND YOUR COMFORTABLE LOW'
          : 'FIND YOUR COMFORTABLE HIGH'

    return (
      <div className="fixed inset-0 overflow-y-auto bg-[#070914] px-5 py-8 text-gray-100" style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}>
        <main className="mx-auto w-full max-w-md border border-green-900/60 bg-black/35 p-5">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs text-gray-400">
            <span>PRIVATE · ON DEVICE</span>
            <span>{rangeStep === 'anchor' ? '1' : rangeStep === 'lower' ? '2' : rangeStep === 'higher' ? '3' : 'READY'} / 3</span>
          </div>
          <h2 ref={rangeHeadingRef} tabIndex={-1} className="mb-3 text-xl font-black tracking-widest text-green-100 outline-none">
            {stepTitle}
          </h2>

          {rangeStep === 'summary' && pendingRangeProfile && starterNotes ? (
            <>
              <p className="mb-5 text-sm leading-relaxed text-gray-300">
                Comfortable today: <strong className="text-white">{pendingRangeProfile.lowNote}–{pendingRangeProfile.highNote}</strong>. The village starts with two neighboring notes and keeps every new target inside this range.
              </p>
              <div className="mb-5 border border-green-700/70 bg-green-950/25 p-4 text-center">
                <div className="mb-2 text-xs font-bold tracking-widest text-green-200">STARTER PAIR</div>
                <div className="flex justify-center gap-3">
                  {starterNotes.map(note => (
                    <span key={note} className="inline-flex min-h-12 min-w-16 items-center justify-center border border-green-300 bg-green-950/50 px-3 text-xl font-black text-green-100">
                      {note}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mb-5 text-xs leading-relaxed text-gray-400">
                Only note names and these boundaries are saved. No recording or microphone samples are kept.
              </p>
              <button
                type="button"
                onClick={acceptPendingRange}
                className="min-h-12 w-full border-2 border-green-200 bg-green-300 px-4 py-3 text-sm font-black tracking-widest text-[#071018] active:scale-[0.99]"
              >
                USE THIS RANGE
              </button>
              <button
                type="button"
                onClick={startRangeAssessment}
                className="mt-3 min-h-12 w-full border border-gray-600 px-4 py-3 text-sm font-bold text-gray-200"
              >
                CHECK AGAIN
              </button>
              <button
                type="button"
                onClick={openManualRangeSetup}
                className="mt-3 min-h-12 w-full px-4 py-3 text-sm font-bold text-gray-400"
              >
                CHOOSE MANUALLY
              </button>
            </>
          ) : (
            <>
              <p className="mb-5 text-sm leading-relaxed text-gray-300">
                {rangeStep === 'anchor'
                  ? 'Sing one easy middle note—not your lowest or highest. This is only the starting point; next we will walk down, then up, one note at a time.'
                  : rangeStep === 'lower'
                    ? 'Each comfortable YES moves one note lower. Hear this exact note, then sing it only if relaxed. At the first uncomfortable note, choose NOT YET; your last YES becomes your LOW limit.'
                    : 'Each comfortable YES moves one note higher. Hear this exact note, then sing it only if relaxed. At the first uncomfortable note, choose NOT YET; your last YES becomes your HIGH limit.'}
              </p>

              <div aria-live="polite" className="mb-5 border border-gray-700 bg-[#0b1020] p-4 text-center">
                <div className="mb-2 text-xs font-bold tracking-widest text-gray-400">
                  {rangeStep === 'anchor' ? 'WE HEAR' : 'TRY THIS NOTE'}
                </div>
                <div className="text-4xl font-black text-cyan-100">{rangeCandidate ?? '—'}</div>
                <div className="mx-auto mt-4 h-2 w-full max-w-64 overflow-hidden rounded bg-gray-800" aria-hidden="true">
                  <div
                    className="h-full bg-green-300"
                    style={{ width: `${Math.round(rangeMatchProgress * 100)}%`, transition: reducedMotion ? 'none' : 'width 80ms linear' }}
                  />
                </div>
                <div className="mt-3 min-h-5 text-xs font-bold text-gray-300">
                  {rangeMatched
                    ? 'Exact note held. Now tell us whether it feels comfortable.'
                    : rangeStep !== 'anchor' && !rangeCuePlayed
                      ? 'Tap HEAR NOTE first.'
                      : matchingSuppressedNow()
                        ? 'Listen… then sing after the cue.'
                        : 'Hold the note gently.'}
                </div>
              </div>

              {rangeStep !== 'anchor' && (
                <button
                  type="button"
                  onClick={playRangeCandidateTone}
                  disabled={!rangeCandidate || matchingSuppressedNow()}
                  className="mb-3 min-h-12 w-full border border-cyan-300 bg-cyan-950/45 px-4 py-3 text-sm font-black tracking-widest text-cyan-100 disabled:opacity-50"
                  aria-label={`Hear exact note ${rangeCandidate ?? ''}`}
                >
                  🔊 HEAR {rangeCandidate ?? 'NOTE'}
                </button>
              )}

              <button
                type="button"
                onClick={confirmRangeComfortable}
                disabled={!rangeMatched}
                data-testid="pf3-range-comfortable"
                className="min-h-12 w-full border-2 border-green-200 bg-green-300 px-4 py-3 text-sm font-black tracking-widest text-[#071018] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-70"
              >
                {rangeStep === 'anchor'
                  ? 'YES, THIS FEELS COMFORTABLE'
                  : `YES — TRY ONE NOTE ${rangeStep === 'lower' ? 'LOWER' : 'HIGHER'}`}
              </button>

              {rangeStep !== 'anchor' && (
                <button
                  type="button"
                  onClick={stopAtRangeLimit}
                  data-testid="pf3-range-stop-limit"
                  className="mt-3 min-h-12 w-full border border-amber-500/70 bg-amber-950/25 px-4 py-3 text-sm font-bold text-amber-100"
                >
                  NOT YET — KEEP {confirmedLimit ?? rangeAnchor} AS MY {direction.toUpperCase()} LIMIT
                </button>
              )}

              {rangeAssessmentError && <div role="alert" className="mt-4 text-xs leading-relaxed text-red-200">{rangeAssessmentError}</div>}
              <button
                type="button"
                onClick={quitToMenu}
                className="mt-4 min-h-12 w-full px-4 py-3 text-sm font-bold text-gray-400"
              >
                EXIT SETUP
              </button>
            </>
          )}
        </main>
      </div>
    )
  }

  if (phase === 'playing' && bossState) {
    const complete = bossState.status === 'complete'
    const retryNote = !bossState.claimId && bossState.status === 'active' && bossState.lastReceipt?.correct === false
    const supported = bossSupportedPracticeRef.current || bossReceiptsRef.current.some(receipt => receipt.persisted && receipt.supported)
    const activeBossId = bossIdentity ?? (bossState.attempt.startsWith('bellringer:') ? 'bellringer' : 'torchmaster')
    const earnedWorld = bossWorldRef.current
    const practiceWorld = bossPracticeWorldRef.current
    const activeSceneWorld = earnedWorld ?? practiceWorld
    const activeBossName = activeBossId === 'choirmaster' ? 'Choirmaster' : activeSceneWorld === 'cathedral' ? 'Maestro' : activeBossId === 'bellringer' ? 'Bellringer' : 'Torchmaster'
    const controlClass = 'min-h-12 rounded-sm border px-4 py-3 text-sm font-bold disabled:opacity-40'
    return <main data-testid="pf3-boss-room" className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[#070914] text-gray-100" style={{ fontFamily: 'monospace', paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
      <header className="mx-auto max-w-3xl px-4 pb-3 pt-5 text-center">
        <button type="button" data-testid="pf3-pause-toggle" aria-pressed={paused} onClick={togglePause} className="absolute right-3 top-3 min-h-8 border border-cyan-500/70 bg-black/60 px-3 py-1 text-[10px] font-black tracking-widest text-cyan-100">{paused ? 'RESUME' : 'PAUSE'}</button>
        <p className="text-[10px] tracking-widest text-amber-200">{activeSceneWorld ? bossPracticeOnlyRef.current ? 'PRACTICE CHAMBER · YOUR VOICE · NO TIMER' : 'CAMPAIGN RECITAL · YOUR VOICE · NO TIMER' : 'PRIVATE DEMO · NO TIMER · SEPARATE PRACTICE HISTORY'}</p>
        <h1 ref={bossHeadingRef} tabIndex={-1} className="mt-2 text-xl font-black tracking-widest text-amber-100">THE {activeBossName.toUpperCase()}</h1>
        <p className="mt-2 text-xs text-gray-300">{complete ? `${activeBossName} recital complete` : `Pass-off ${bossState.cursor + 1} of ${bossState.sequence.length}`} · {activeSceneWorld ? 'Your exact notes · untimed' : activeBossId === 'bellringer' ? 'Two-note interval practice' : bossState.lane === 'ear' ? 'Listen and recognize' : 'Exact-note voice simulation'}</p>
      </header>
      <div ref={canvasContainerRef} className="relative mx-auto w-full max-w-[720px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} width={W} height={H} className="block h-full w-full" style={{ imageRendering: 'pixelated' }} aria-label={`${activeBossName} chamber with original Frankenstein and the current musical challenge`} />
        {paused && <div data-testid="pf3-paused-overlay" role="status" aria-live="polite" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35"><span className="border border-cyan-300/80 bg-[#070914]/90 px-4 py-2 text-xs font-black tracking-[0.2em] text-cyan-100">PAUSED · YOUR RUN IS SAFE</span></div>}
      </div>
      <section className="mx-auto max-w-2xl px-4 py-4">
        <p role="status" aria-live="polite" aria-atomic="true" data-testid="pf3-boss-status" className="min-h-12 text-center text-sm leading-relaxed text-cyan-100">{bossMessage}</p>
        {complete ? <div className="my-3 border border-green-400/50 bg-green-950/30 p-4 text-center">
          <p className="font-bold text-green-200">{activeBossId === 'bellringer' ? `Bellringer · ${supported ? 'Completed with help' : 'Completed without a hint'}` : supported ? 'Completed with help' : 'Completed without a hint'}</p>
          <p className="mt-2 text-xs text-gray-300">{activeSceneWorld ? bossPracticeOnlyRef.current ? 'Your note practice is held in this run only. It does not grant a world clear or change your saved profile.' : supported ? 'Practice with help is saved. Try a fresh recital without hints to earn passage.' : 'Your journey records the earned passage when every response and save is confirmed.' : bossState.lane === 'voice' ? 'Simulated voice demonstration—not a singer assessment. No world unlock is granted.' : 'Recognition practice—not a vocal assessment. No world unlock is granted.'}</p>
        </div> : <div className="grid gap-3">
          {bossState.status === 'pending-save' ? <button type="button" data-testid="pf3-boss-retry-save" className={`${controlClass} border-amber-300 text-amber-100`} onClick={() => { const controller = bossControllerRef.current; if (controller) acceptBossResult(controller.retrySave()) }}>RETRY SAVING</button>
            : retryNote ? <button type="button" data-testid="pf3-boss-retry-note" className={`${controlClass} border-green-300 text-green-100`} onClick={() => { const controller = bossControllerRef.current; if (controller) acceptBossResult(controller.retryNote()) }}>TRY THIS NOTE AGAIN</button>
              : <>
                {bossState.lane === 'ear' && <button type="button" data-testid="pf3-boss-hear" disabled={bossAudioBusy} className={`${controlClass} border-cyan-300 text-cyan-100`} onClick={() => playBossCue(false)}>HEAR THE CHALLENGE</button>}
                {bossState.lane === 'voice' && activeSceneWorld ? <>
                  <p className="p-3 text-center text-green-100">{micError ? 'Microphone unavailable. Your chamber is still open; retry when ready.' : isListening ? 'Listening to your microphone. Sing when ready.' : 'Microphone is still connecting. Retry here without leaving the chamber.'}</p>
                  {(!isListening || !!micError) && <button type="button" data-testid="pf3-boss-retry-mic" onClick={() => { void startListening() }} className={`${controlClass} border-cyan-300 text-cyan-100`}>RETRY MICROPHONE</button>}
                </> : bossState.lane === 'voice' ? <button type="button" data-testid="pf3-boss-simulate" disabled={bossAudioBusy || bossSimulating || !bossState.claimId} className={`${controlClass} border-green-300 bg-green-950/50 text-green-100`} onClick={() => {
                  if (!bossControllerRef.current?.state().claimId || matchingSuppressedNow()) return
                  demoTargetRef.current = ''
                  bossHoldRef.current = { heldMs: 0, matched: false }
                  bossSimulatingRef.current = true
                  setBossSimulating(true)
                  setBossMessage('Simulated voice: finding the exact note, then holding it. No microphone is being assessed.')
                }}>{bossSimulating ? 'SIMULATED VOICE IS SINGING…' : 'SING NOTE · SIMULATED VOICE'}</button>
                  : <div className="grid grid-cols-2 gap-2" aria-label="Choose the note heard">{[...new Set(bossState.sequence)].map(note => <button key={note} type="button" data-testid={`pf3-boss-answer-${note}`} disabled={bossAudioBusy || bossHeardClaimRef.current !== bossState.claimId} onClick={() => answerBossByButton(note)} className={`${controlClass} border-cyan-400 text-cyan-100`}>{note}</button>)}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" data-testid="pf3-boss-hint" disabled={bossAudioBusy || bossSimulating} onClick={() => playBossCue(true)} className={`${controlClass} border-amber-500 text-amber-100`}>HINT · HEAR NOTE</button>
                  <button type="button" data-testid="pf3-boss-review" disabled={bossAudioBusy || bossSimulating} onClick={() => resolveBossNote(false)} className={`${controlClass} border-gray-500 text-gray-200`}>REVIEW THIS NOTE</button>
                </div>
              </>}
        </div>}
        <button type="button" data-testid="pf3-boss-return" onClick={quitToMenu} className={`${controlClass} mt-4 w-full border-gray-600 text-gray-300`}>RETURN TO THE WORLD MAP</button>
      </section>
    </main>
  }

  if (phase === 'game_over') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex items-center justify-center px-4" style={{ fontFamily: 'monospace' }}>
        {demoMode && <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-orange-200">DEMO</div>}
        <div className="w-full max-w-md border border-red-900/60 bg-black/35 p-5 text-center">
          <div className="text-3xl font-black text-red-300 tracking-widest mb-4">GAME OVER</div>
          <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
            <div><div className="text-gray-500">Score</div><div className="text-xl text-white">{hud.score}</div></div>
            <div><div className="text-gray-500">Wave</div><div className="text-xl text-orange-200">{hud.wave}</div></div>
            <div><div className="text-gray-500">Streak</div><div className="text-xl text-green-200">{hud.streak}</div></div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={restartGameAfterGameOver}
              className="min-h-11 flex-1 py-2 bg-orange-200 text-[#071018] font-bold border border-orange-100"
            >
              AGAIN
            </button>
            <button onClick={quitToMenu} className="min-h-11 flex-1 py-2 border border-gray-700 text-gray-300">
              MENU
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (artReviewMode) {
    return (
      <main ref={playRootRef} data-testid="pf3-art-review" className="pf3-play-root fixed inset-0 flex flex-col overflow-y-auto bg-black text-gray-100" style={{ fontFamily: 'monospace' }}>
        <header className="shrink-0 border-b border-amber-400/70 bg-[#070914] px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.18em] text-amber-200">PRIVATE ART REVIEW · VISUAL ONLY · NO GAMEPLAY</p>
              <p className="mt-1 text-[11px] leading-relaxed text-cyan-100">Real game canvas: original Frank · one non-overlapping 1/2/3/4-tine actor · rain cloud/gutter · Storm Heart states.</p>
            </div>
            <button type="button" data-testid="pf3-art-review-pause" aria-pressed={paused} onClick={togglePause} className="min-h-8 shrink-0 border border-cyan-500/70 bg-black/60 px-2 py-1 text-[10px] font-black tracking-widest text-cyan-100">{paused ? 'RESUME' : 'PAUSE FRAME'}</button>
          </div>
        </header>
        <div ref={canvasContainerRef} data-testid="pf3-art-review-stage" className="relative flex min-h-0 flex-1 items-center justify-center bg-[#05070d]" style={{ minHeight: STAGE_MIN_HEIGHT_CSS }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block object-contain mx-auto"
            style={{ width: canvasDisplaySize.width, height: canvasDisplaySize.height, imageRendering: 'pixelated' }}
            aria-label="Private Pitchforks art review canvas with original Frankenstein, one actor of each tine count, rain architecture, and Storm Heart state"
          />
          {paused && <div data-testid="pf3-art-review-paused" role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35"><span className="border border-cyan-300/80 bg-[#070914]/90 px-4 py-2 text-xs font-black tracking-[0.16em] text-cyan-100">PAUSED · REVIEW FRAME HELD</span></div>}
        </div>
        <section aria-label="Private art review controls" className="shrink-0 border-t border-gray-800 bg-[#070914] px-3 py-3">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2 text-[11px]">
            <div role="group" aria-label="Villager lifecycle state" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-black tracking-widest text-amber-200">BODY</span>
              {ART_REVIEW_BODY_STATES.map(state => (
                <button
                  key={state}
                  type="button"
                  data-testid={`pf3-art-review-body-${state}`}
                  aria-pressed={artReviewBody === state}
                  onClick={() => { artReviewBodyRef.current = state; setArtReviewBody(state) }}
                  className="min-h-9 border border-amber-400/70 px-2 py-1 font-black tracking-wide text-amber-100 aria-pressed:bg-amber-200 aria-pressed:text-[#071018]"
                >
                  {state === 'walk' ? 'WALK' : state === 'ash' ? 'ASH' : state.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Storm Heart state" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-black tracking-widest text-cyan-200">STORM</span>
              {ART_REVIEW_STORM_STATES.map(state => (
                <button
                  key={state}
                  type="button"
                  data-testid={`pf3-art-review-storm-${state}`}
                  aria-pressed={artReviewStorm === state}
                  onClick={() => { artReviewStormRef.current = state; setArtReviewStorm(state) }}
                  className="min-h-9 border border-cyan-400/70 px-2 py-1 font-black tracking-wide text-cyan-100 aria-pressed:bg-cyan-200 aria-pressed:text-[#071018]"
                >
                  {state.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-gray-400">Run-local fixture only. It does not start the microphone, read or write profile/unlock storage, grant gameplay credit, or alter the default game route.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div ref={playRootRef} className="pf3-play-root fixed inset-0 bg-black text-gray-100 flex flex-col" style={{ fontFamily: 'monospace' }}>
      <header data-testid="pf3-play-status" className="shrink-0 border-b border-gray-800 bg-[#070914] px-3 py-1 text-[11px]">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span>Score {hud.score}</span>
          <span>Level {levelProgress.level}</span>
          {hud.streak >= 3 && <span className="text-yellow-200">{hud.streak}x combo</span>}
          <button type="button" data-testid="pf3-pause-toggle" aria-pressed={paused} onClick={togglePause} className="min-h-7 border border-cyan-500/70 bg-black/60 px-2 text-[10px] font-black tracking-widest text-cyan-100">{paused ? 'RESUME' : 'PAUSE'}</button>
          <span className={`inline-flex items-center gap-1 font-bold ${activeInputHud.className}`} title={activeInputHud.label}>
            <span className={`h-2 w-2 rounded-full ${activeInputHud.dotClassName}`} />
            {demoMode ? 'DEMO' : activeInputHud.label}
          </span>
        </div>
        {!demoMode && <div data-testid="pf3-level-progress" aria-label={`Level ${levelProgress.level}, ${levelProgressCopy}${supportedPracticeCopy}`} className="text-center text-[10px] text-cyan-100">
          {levelProgressCopy}{supportedPracticeCopy}
        </div>}
        {journeySaveNotice}
        {masterySaveNotice}
      </header>
      <div ref={canvasContainerRef}
        data-testid="pf3-stage"
        className="relative flex-1 min-h-0 flex items-center justify-center"
        style={{ minHeight: STAGE_MIN_HEIGHT_CSS }}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block object-contain mx-auto"
          style={{ width: canvasDisplaySize.width, height: canvasDisplaySize.height, imageRendering: 'pixelated' }}
        />
        {paused && <div data-testid="pf3-paused-overlay" role="status" aria-live="polite" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35"><span className="border border-cyan-300/80 bg-[#070914]/90 px-4 py-2 text-xs font-black tracking-[0.2em] text-cyan-100">PAUSED · YOUR RUN IS SAFE</span></div>}

        {paused && villageLessonOpen && activeVillageLesson && (
          <div className="absolute bottom-3 left-1/2 z-30 w-[min(92vw,760px)] -translate-x-1/2 shadow-2xl">
            <PitchforksVillageLesson
              objective={activeVillageLesson.objective}
              contextNote={activeVillageLesson.contextNote}
              targetNote={activeVillageLesson.targetNote}
              support={activeEnvironmentHidden ? 'UNAIDED_RETURN' : 'SUPPORTED'}
              onReplay={() => {
                if (cuePlaybackActive || strikePresentationPending()) return
                const active = getActiveTarget()
                if (!active) return
                pauseSparkGuide('replay')
                playVillagerSequence(active.villager, 'replay')
              }}
            />
          </div>
        )}
        {paused && bellLessonOpen && normalBell && (
          <div className="absolute bottom-3 left-1/2 z-30 w-[min(92vw,760px)] -translate-x-1/2 shadow-2xl">
            <PitchforksBellTowerLesson
              open
              onOpenChange={setBellLessonDisclosure}
              voiceMode={inputMode === 'voice'}
              charge={normalBellState?.charge}
              requiredResponses={normalBellState?.requiredResponses}
              taughtPair={normalBellState?.taughtPair ?? null}
              powerPhase={normalBellState?.phase ?? null}
              wavePhase={bellWaveState.phase}
              contactCount={bellWaveState.contactedStableIDs.length}
            />
          </div>
        )}

        {newNoteCeremonyBanner}
      </div>

      <div
        data-testid="pf3-tuner-feedback"
        data-feedback-kind={waveReceiptResult ? waveReceiptResult.cleared ? 'level-clear' : 'level-retry' : tunerFeedback.kind}
        data-receipt-state={waveReceiptResult ? waveReceiptResult.cleared ? 'clear' : 'retry' : undefined}
        data-spark-guide-status={sparkGuideStatus}
        data-input-mode={inputMode}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`w-full shrink-0 border-y px-3 py-2 text-center ${
          waveReceiptResult
            ? waveReceiptResult.cleared
              ? 'border-emerald-500/70 bg-emerald-950/45 text-emerald-100'
              : 'border-amber-400/70 bg-amber-950/45 text-amber-100'
            : inputMode === 'buttons' && buttonFeedback.kind === 'correct'
            ? 'border-emerald-500/70 bg-emerald-950/45 text-emerald-100'
            : inputMode === 'buttons' && buttonFeedback.kind === 'wrong'
              ? 'border-amber-400/70 bg-amber-950/45 text-amber-100'
              : tunerFeedback.kind === 'on-target' || tunerFeedback.kind === 'locked'
            ? 'border-emerald-500/70 bg-emerald-950/45 text-emerald-100'
              : tunerFeedback.kind === 'octave-low' || tunerFeedback.kind === 'octave-high'
                ? 'border-orange-400/70 bg-orange-950/45 text-orange-100'
                : tunerFeedback.kind === 'voice-break' || tunerFeedback.kind === 'mic-unreliable'
                  ? 'border-amber-400/70 bg-amber-950/45 text-amber-100'
                : 'border-cyan-800/70 bg-[#071018] text-cyan-100'
        }`}
      >
        <div
          tabIndex={waveReceiptResult ? 0 : undefined}
          aria-label={waveReceiptResult ? `Level ${waveReceiptResult.level} ${waveReceiptResult.cleared ? 'clear' : 'retry'} result; scroll for all note results` : undefined}
          className={`mx-auto flex w-full max-w-[760px] leading-tight ${waveReceiptResult ? 'h-20 max-h-20 items-start justify-start overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100' : 'h-20 max-h-20 items-center justify-center flex-col sm:flex-row sm:gap-3'}`}
        >
          {waveReceiptResult ? (
            <div
              data-testid="pf3-level-result"
              data-receipt-outcome={waveReceiptResult.cleared ? 'clear' : 'retry'}
              className="flex w-full min-w-0 flex-col justify-center gap-0.5 py-0.5 text-[11px] font-bold"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                <strong className="shrink-0 font-black tracking-wider">
                  {waveReceiptResult.cleared
                    ? `LEVEL ${waveReceiptResult.level} CLEAR`
                    : `LEVEL ${waveReceiptResult.level} RETRY`}
                </strong>
                <span data-testid="pf3-result-accuracy" className="text-cyan-100">
                  {waveReceiptResult.showcase ? 'Demo sequence complete' : `Level accuracy ${waveReceiptResult.accuracyPercent}% / ${PITCHFORKS_LEVEL_ACCURACY_GOAL_PERCENT}% goal`}
                </span>
                <span data-testid="pf3-result-next-step" className="min-w-0 break-words text-gray-300">
                  {waveReceiptResult.nextStep}
                </span>
              </div>
              <div data-testid="pf3-result-notes" className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                <WaveReceiptNoteRow
                  label="HEARD"
                  testId="pf3-result-heard"
                  notes={waveReceipt.heard}
                  noteNamesVisible={waveReceiptNoteNamesVisible}
                  memory={waveReceiptMemory}
                />
                <WaveReceiptNoteRow
                  label={inputMode === 'buttons' ? 'ANSWERED' : 'SUNG'}
                  testId={inputMode === 'buttons' ? 'pf3-result-answered' : 'pf3-result-sung'}
                  notes={waveReceipt.sung}
                  noteNamesVisible={waveReceiptNoteNamesVisible}
                  memory={waveReceiptMemory}
                />
                <WaveReceiptNoteRow
                  label="MASTERED"
                  testId="pf3-result-mastered"
                  notes={waveReceipt.mastered}
                  noteNamesVisible={waveReceiptNoteNamesVisible}
                  memory={waveReceiptMemory}
                  mastered
                />
              </div>
            </div>
          ) : inputMode === 'buttons' ? (
            <span className="text-xs font-black tracking-widest sm:text-sm">{buttonFeedback.text}</span>
          ) : (
            <>
              <span className="text-[11px] font-bold tracking-wider sm:text-xs">
                {sparkGuideStatus === 'pulse' ? `PULSED GUIDE · ${tunerFeedback.headline}` : tunerFeedback.headline}
              </span>
              <span className="mt-1 text-xs font-black tracking-widest sm:mt-0 sm:text-sm">{tunerFeedback.detail}</span>
            </>
          )}
        </div>
      </div>

      <div
        data-testid="pf3-learning-dock"
        className={`w-full shrink-0 bg-[#070914] border-t border-gray-800 flex flex-col items-center gap-2 px-3 ${layoutMode === 'portrait' ? 'pt-2' : 'pt-3'}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        {inputMode === 'buttons' && (
          <div
            data-testid="pf3-button-answer-row"
            aria-label="Choose the note you heard"
            className="flex min-h-12 w-full max-w-[760px] flex-wrap items-stretch justify-center gap-2"
          >
            {unlockedNotes.map(note => (
              <button
                key={note}
                type="button"
                data-testid={`pf3-button-answer-${note}`}
                aria-label={`Choose ${note}`}
                disabled={!buttonAnswerOpen}
                onClick={() => answerWithButton(note)}
                className="min-h-12 min-w-16 flex-1 touch-manipulation border px-3 py-2 text-sm font-black tracking-widest active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:max-w-32"
                style={noteChipStyle(note, earFsrsRef.current)}
              >
                {note}
              </button>
            ))}
          </div>
        )}
        {firstMinuteCopy && (
          <div
            data-testid="pf3-first-minute-coach"
            data-beat={firstMinuteCoach.beat}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex min-h-10 w-full max-w-[760px] items-center justify-center border border-cyan-700/60 bg-cyan-950/25 px-3 py-2 text-center text-[11px] font-black tracking-wider text-cyan-100 sm:text-xs"
          >
            <span className="sr-only">First storm: </span>{firstMinuteCopy}
          </div>
        )}
        <div data-testid="pf3-action-toolbar">
        <div className="grid w-full max-w-[760px] sm:grid-cols-4 grid-cols-2 gap-2" data-testid="pf3-ability-dock">
        <div
          data-testid="pf3-close-smash-control"
          className="relative col-span-1 flex min-h-12 min-w-0 w-full flex-col gap-2 border border-fuchsia-900/70 bg-fuchsia-950/15 px-2 py-2"
          aria-label="Close Smash earned ability"
        >
          <div
            data-testid="pf3-close-smash-status"
            id="pf3-close-smash-status"
            data-close-smash-phase={closeSmashState.phase}
            data-close-smash-target={closeSmashState.receipt?.targetKey ?? undefined}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={closeSmashStatusCopy}
            className="min-w-0 break-words text-sm font-black tracking-wide text-fuchsia-100"
          >
            <span aria-hidden="true">{`CLOSE · ${closeSmashStatusLabel}${closeSmashReady && closeSmashState.receipt ? ` · ${closeSmashReceiptPitch ?? 'THE EXACT NOTE'}` : ''}`}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-stretch gap-2">
            <button
              type="button"
              data-testid="pf3-close-smash-action"
              disabled={closeSmashActionDisabled}
              aria-describedby="pf3-close-smash-status"
              title={closeSmashReady ? 'Spend the earned close lock for a two-hand Smash.' : 'Earn an exact lock at Frankenstein’s close boundary first.'}
              onClick={requestCloseSmash}
              className="min-h-12 min-w-[48px] shrink-0 border border-fuchsia-200 bg-fuchsia-200 px-3 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#180719] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-100"
            >
              {closeSmashReady ? `SMASH · ${closeSmashState.receipt?.pitch ?? ''}` : 'CLOSE SMASH'}
            </button>
            <button
              type="button"
              data-testid="pf3-close-smash-help"
              aria-expanded={closeSmashGuideOpen}
              onClick={() => setCloseSmashGuideDisclosure(!closeSmashGuideOpen)}
              className="min-h-12 min-w-[48px] shrink-0 border border-fuchsia-300/80 px-3 py-1 text-center text-xs font-black tracking-wide text-fuchsia-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-100"
            >
              HELP
            </button>
          </div>
        </div>
        {(demoMode || normalBell) && <section
          data-testid="pf3-raincall"
          aria-label="Raincall and torch ecology"
          className="col-span-1 flex min-h-12 min-w-0 w-full flex-col gap-2 border border-cyan-800/70 bg-cyan-950/20 px-2 py-2 text-cyan-50"
        >
          <div className="min-w-0 break-words text-sm font-black tracking-wide text-cyan-100">
            <div>RAIN · {rainPhaseLabel} · {rainState.charge}/{RAINCALL_REQUIRED_RESPONSES} · CYCLE {rainState.cycleID}</div>
            {torchPhaseLabel && <div className="text-amber-100">TORCH · {torchPhaseLabel}</div>}
          </div>
          <div className="flex min-w-0 flex-wrap items-stretch gap-2">
            <button
              type="button"
              data-testid="pf3-raincall-action"
              onClick={activateRaincall}
              disabled={raincallActionDisabled}
              aria-describedby={demoMode ? 'pf3-raincall-status pf3-torch-status' : 'pf3-raincall-status'}
              title={demoMode || normalBell ? 'Fill the gutter, then douse the torches.' : 'Raincall requires an eligible campaign route.'}
              className="min-h-12 min-w-[48px] shrink-0 border border-cyan-200 bg-cyan-200 px-3 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#071018] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80"
            >
              {demoMode || normalBell ? 'CALL RAIN' : 'DEMO ONLY'}
            </button>
          </div>
          <p id="pf3-raincall-status" data-testid="pf3-raincall-status" className="sr-only">
            {demoMode || normalBell
              ? `${rainPhaseCopy}. Fill the gutter, then douse the torches. Keep singing to break the forks${rainEffects.slowFactor < 1 ? ' · movement slowed' : ''}. ${torchPhaseCopy} Raincall is environmental only and never grants musical tine credit.`
              : 'Raincall requires an eligible campaign route.'}
          </p>
          {(demoMode || normalBell) && (
            <p id="pf3-torch-status" data-testid="pf3-torch-status" className="sr-only">
              {torchPhaseCopy}
            </p>
          )}
        </section>}
        {bellControlVisible && <section
          data-testid="pf3-bell-control"
          aria-label={bellProof ? 'Bell Tower private proof controls' : 'Normal Village Bell control'}
          className="col-span-2 flex min-h-12 min-w-0 w-full max-w-[760px] flex-col gap-2 border border-amber-700/80 bg-amber-950/25 px-2 py-2 text-amber-50"
        >
          <div
            data-testid="pf3-bell-status"
            id="pf3-bell-status"
            data-bell-phase={bellWaveState.phase}
            data-bell-radius={bellWaveProjection.radius.toFixed(1)}
            data-bell-contact-count={bellWaveState.contactedStableIDs.length}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={bellStatusCopy}
            className="min-w-0 w-full break-words text-sm font-black tracking-wide text-amber-100"
          >
            <div>
              {bellProof
                ? inputMode !== 'voice'
                  ? 'VOICE ONLY'
                  : bellWaveState.phase === 'active'
                    ? 'WAVE ACTIVE'
                    : bellReleaseRequestedRef.current
                      ? `RING QUEUED · ${bellChargeReceiptNote ?? ''}`
                      : bellChargeReceipt
                        ? `READY · ${bellChargeReceiptNote ?? 'THE EXACT NOTE'}`
                        : bellWaveState.phase === 'finished'
                          ? 'WAVE FINISHED'
                          : bellArmRequestedRef.current
                            ? lockProgressRef.current > 0
                              ? `CHARGING · HOLD ${activeEnvironmentNoteLabel ?? 'THE EXACT NOTE'}`
                              : `ARMED · HOLD ${activeEnvironmentNoteLabel ?? 'THE EXACT NOTE'}`
                            : 'IDLE · CHARGE THE EXACT NOTE'
                : inputMode !== 'voice'
                  ? 'VOICE ONLY'
                  : bellWaveState.phase === 'active'
                    ? 'WAVE ACTIVE'
                    : bellReleaseRequestedRef.current
                      ? `RING QUEUED · ${projectedNormalBellPair}`
                      : normalBellState?.phase === 'pending'
                        ? `PAIR READY · ${projectedNormalBellPair}`
                        : bellWaveState.phase === 'finished'
                          ? 'WAVE FINISHED'
                          : normalBellState?.phase === 'activating'
                            ? `STEP ${(normalBellState.activationNotes.length + 1)}/2 · SING ${projectedNormalBellExpected ?? 'THE NEXT NOTE'}`
                            : normalBellState?.phase === 'ready'
                              ? `READY · ${projectedNormalBellPair}`
                              : `CHARGE ${normalBellState?.charge ?? 0}/3`}
            </div>
            {!bellProof && normalBellState && (
              <div data-testid="pf3-bell-pair" className="mt-0.5 break-words text-sm font-bold tracking-wide text-amber-200">
                PAIR · {projectedNormalBellPair}
              </div>
            )}
            {!bellProof && normalBellState?.phase === 'activating' && (
              <div data-testid="pf3-bell-step" className="sr-only">
                Current activation step {(normalBellState.activationNotes.length + 1)}/2: sing {projectedNormalBellExpected ?? 'the next taught note'}.
              </div>
            )}
            <div className="sr-only">
              {bellWaveState.phase === 'idle' && !bellChargeReceipt && normalBellState?.phase !== 'pending' ? 'EXACT NOTE ONLY · NO TINE CREDIT' : 'PHYSICAL WAVE ONLY · NO TINE CREDIT'}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-stretch gap-2">
            <button
              type="button"
              data-testid="pf3-bell-arm"
              disabled={bellArmDisabled}
              aria-describedby="pf3-bell-status"
              title={bellProof
                ? bellArmDisabled ? 'Bell charge requires the next exact voice hold in the Bell Tower proof.' : 'Charge the next exact voice note for the Bell Tower wave.'
                : normalBellState?.phase === 'ready' ? `Teach the Bell pair ${projectedNormalBellPair}.` : `Earn 3 accepted voice responses before teaching ${projectedNormalBellPair}.`}
              onClick={requestBellArm}
              className="min-h-12 min-w-[48px] shrink-0 border border-amber-200 bg-amber-200 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#1a1102] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
            >
              {bellProof
                ? bellChargeReceipt ? 'BELL READY' : 'CHARGE BELL'
                : normalBellState?.phase === 'ready' ? 'TEACH PAIR' : `BELL ${normalBellState?.charge ?? 0}/3`}
            </button>
            <button
              type="button"
              data-testid="pf3-bell-release"
              disabled={bellReleaseDisabled}
              aria-describedby="pf3-bell-status"
              title={bellProof
                ? bellReleaseDisabled ? 'Charge one exact note before ringing the Bell Tower wave.' : 'Release the charged Bell Tower wave.'
                : bellReleaseDisabled ? 'Sing the taught pair first; a failed release keeps readiness for retry.' : 'Release the Bell wave.'}
              onClick={requestBellRelease}
              className="min-h-12 min-w-[48px] shrink-0 border border-yellow-100 bg-yellow-100 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#1a1102] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-100"
            >
              RING BELLS
            </button>
            {!bellProof && normalBellState?.phase === 'activating' && (
              <button
                type="button"
                data-testid="pf3-bell-cancel"
                aria-describedby="pf3-bell-status"
                onClick={cancelBellActivation}
                className="min-h-12 min-w-[48px] shrink-0 border border-amber-100 bg-amber-950/50 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
              >
                CANCEL
              </button>
            )}
          </div>
        </section>}
        {galvanicAvailable && <section
          data-testid="pf3-galvanic-control"
          aria-label="Galvanic controls"
          className="col-span-2 flex min-h-12 min-w-0 w-full max-w-[760px] flex-col gap-2 border border-emerald-700/80 bg-emerald-950/25 px-2 py-2 text-emerald-50"
        >
          <div
            data-testid="pf3-galvanic-status"
            id="pf3-galvanic-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={galvanicStatusCopy}
            className="min-w-0 w-full break-words text-sm font-black tracking-wide text-emerald-100"
          >
            <div>{galvanicStatusCopy}</div>
            <div className="mt-0.5 break-words text-sm font-bold tracking-wide text-emerald-200/90">
              {galvanicProjection.bankCount > 0 ? `BANKED NOTES · ${galvanicBankLabels}` : 'BANKED NOTES · NONE'}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-stretch gap-2">
            <button
              type="button"
              data-testid="pf3-galvanic-bank"
              disabled={galvanicBankDisabled}
              aria-describedby="pf3-galvanic-status"
              title={galvanicBankDisabled ? 'Banking requires the next exact voice hold.' : 'Arm the next exact voice hold for Galvanic.'}
              onClick={requestGalvanicArm}
              className="min-h-12 min-w-[48px] shrink-0 border border-emerald-200 bg-emerald-200 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#06150d] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100"
            >
              BANK FOR SWEEP
            </button>
            <button
              type="button"
              data-testid="pf3-galvanic-release"
              disabled={galvanicReleaseDisabled}
              aria-describedby="pf3-galvanic-status"
              title={galvanicReleaseDisabled ? 'Bank one or two exact notes before releasing the sweep.' : 'Release the banked Galvanic sweep.'}
              onClick={requestGalvanicRelease}
              className="min-h-12 min-w-[48px] shrink-0 border border-lime-200 bg-lime-200 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#101805] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-100"
            >
              RELEASE SWEEP
            </button>
            <button
              type="button"
              data-testid="pf3-galvanic-cancel"
              disabled={galvanicCancelDisabled}
              aria-describedby="pf3-galvanic-status"
              title="Discard all pending Galvanic banks and return to ordinary play."
              onClick={() => cancelGalvanic()}
              className="min-h-12 min-w-[48px] shrink-0 border border-emerald-300 bg-emerald-950/70 px-2 py-1 text-center text-sm font-black leading-tight tracking-wide text-emerald-100 disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100"
            >
              CANCEL
            </button>
          </div>
        </section>}
        {thunderheadAvailable && <section
          data-testid="pf3-thunderhead-control"
          aria-label="Thunderhead controls"
          className="col-span-2 flex min-h-12 min-w-0 w-full max-w-[760px] flex-col gap-2 border border-sky-700/80 bg-sky-950/25 px-2 py-2 text-sky-50"
        >
          <div
            data-testid="pf3-thunderhead-status"
            id="pf3-thunderhead-status"
            data-thunderhead-phase={thunderheadState.phase}
            data-thunderhead-target={thunderheadBank?.targetKey ?? undefined}
            data-thunderhead-rune-status={THUNDERHEAD_RUNE_STATUS}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={thunderheadStatusCopy}
            className="min-w-0 w-full break-words text-sm font-black tracking-wide text-sky-100"
          >
            <span aria-hidden="true">{thunderheadStatusCopy}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-stretch gap-2">
            <button
              type="button"
              data-testid="pf3-thunderhead-arm"
              disabled={thunderheadArmDisabled}
              aria-describedby="pf3-thunderhead-status"
              title={inputMode === 'voice' ? 'Bank the next exact voice note into one charge.' : 'Thunderhead requires the Voice Lightning lane.'}
              onClick={requestThunderheadArm}
              className="min-h-12 min-w-[48px] shrink-0 border border-sky-200 bg-sky-200 px-3 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#071018] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-100"
            >
              BANK NOTE
            </button>
            <button
              type="button"
              data-testid="pf3-thunderhead-release"
              disabled={thunderheadReleaseDisabled}
              aria-describedby="pf3-thunderhead-status"
              title={thunderheadReleaseDisabled ? 'Bank one exact voice note first.' : 'Send the banked cloud across the ceiling to its exact target.'}
              onClick={requestThunderheadRelease}
              className="min-h-12 min-w-[48px] shrink-0 border border-cyan-200 bg-cyan-200 px-3 py-1 text-center text-sm font-black leading-tight tracking-wide text-[#071018] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              SEND CLOUD
            </button>
          </div>
        </section>}
        </div>
        <div data-testid="pf3-secondary-actions" className="flex w-full max-w-[760px] items-stretch justify-center gap-2">
          {activeVillageLesson && <button type="button" data-testid="pf3-village-lesson-help" onClick={() => setVillageLessonDisclosure(!villageLessonOpen)} className="min-h-12 min-w-[76px] border border-amber-400/70 px-2 text-xs font-black tracking-wider text-amber-100">LESSON</button>}
          {normalBell && <button type="button" data-testid="pf3-bell-lesson-help" onClick={() => setBellLessonDisclosure(!bellLessonOpen)} className="min-h-12 min-w-[76px] border border-cyan-400/70 px-2 text-xs font-black tracking-wider text-cyan-100">BELL HELP</button>}
          <button
            type="button"
            disabled={cuePlaybackActive || strikePresentationPending()}
            onClick={() => {
              if (strikePresentationPending()) return
              const active = getActiveTarget()
              if (active) {
                pauseSparkGuide('replay')
                playVillagerSequence(active.villager, 'replay')
              }
            }}
            data-testid="pf3-replay-notes"
            className="min-h-12 min-w-0 flex-1 px-3 py-2 text-sm font-black tracking-widest text-yellow-200 border border-yellow-500 bg-yellow-950/45 active:scale-95 transition-all hover:bg-yellow-900/50 disabled:cursor-wait disabled:opacity-75"
          >
            {replayLabel}
          </button>
          {layoutMode === 'portrait' && (
            <>
              <button
                type="button"
                disabled={inputMode === 'buttons'}
                title={inputMode === 'buttons' ? 'Staff returns in Voice Lightning so the listening answer stays hidden.' : undefined}
                data-testid="pf3-staff-drawer-toggle"
                aria-expanded={portraitDockPanel === 'staff'}
                aria-controls="pf3-portrait-staff-panel"
                onClick={() => {
                  if (!staffNotationOn) setStaffNotationOn(true)
                  setPortraitDockPanel(current => current === 'staff' ? null : 'staff')
                }}
                className="min-h-12 min-w-[76px] border border-cyan-500/70 bg-cyan-950/30 px-2 text-xs font-black tracking-wider text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                STAFF
              </button>
            </>
          )}
              <button
                type="button"
                data-testid="pf3-options-drawer-toggle"
                aria-expanded={portraitDockPanel === 'settings'}
                aria-controls="pf3-portrait-options-panel"
                onClick={() => setPortraitDockPanel(current => current === 'settings' ? null : 'settings')}
                className="min-h-12 min-w-[76px] border border-gray-600 bg-black/35 px-2 text-xs font-black tracking-wider text-gray-100"
              >
                OPTIONS
              </button>
        </div>
        </div>
        {closeSmashGuideOpen && typeof document !== 'undefined' && playRootRef.current && createPortal(
          <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-[100] w-[min(92vw,760px)] -translate-x-1/2 shadow-2xl">
            <PitchforksCloseSmashGuide
              open
              onOpenChange={setCloseSmashGuideDisclosure}
              voiceMode={inputMode === 'voice'}
            />
          </div>,
          playRootRef.current ?? document.body,
        )}

        {layoutMode === 'portrait' && staffNotationOn && portraitDockPanel === 'staff' && portraitStaffDisplaySize.height >= 64 && (
          <div
            id="pf3-portrait-staff-panel"
            data-testid="pf3-portrait-staff-band"
            role="region"
            aria-label="Staff notation drawer"
            className="shrink-0 rounded-lg border border-cyan-900/50 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),rgba(7,9,20,0)_72%)] shadow-[0_0_28px_rgba(34,211,238,0.10)]"
            style={{ width: portraitStaffDisplaySize.width, height: portraitStaffDisplaySize.height }}
          >
            <canvas
              ref={staffCanvasRef}
              width={STAFF_PANEL_W * STAFF_BAND_RENDER_SCALE}
              height={STAFF_PANEL_H * STAFF_BAND_RENDER_SCALE}
              className="block h-full w-full"
              role="img"
              aria-label="Staff notation for the active pitch sequence"
            >
              Staff notation for the active pitch sequence.
            </canvas>
          </div>
        )}

        {portraitDockPanel === 'settings' && (
          <div
            id="pf3-portrait-options-panel"
            data-testid="pf3-portrait-options-panel"
            role="region"
            aria-label="Game options"
            className="flex max-h-[30svh] w-full max-w-[760px] flex-wrap items-center justify-center gap-2 overflow-y-auto overscroll-contain py-1"
          >
            <SettingsRow
              noteNamesOn={noteNamesOn}
              setNoteNamesOn={setNoteNamesPreference}
              audioCueOn={audioCueOn}
              setAudioCueOn={setReferenceAudioPreference}
              staffNotationOn={staffNotationOn}
              setStaffNotationOn={(value) => {
                setStaffNotationOn(value)
                if (layoutMode === 'portrait' && value) setPortraitDockPanel('staff')
              }}
              synesthesiaOn={synesthesiaOn}
              setSynesthesiaOn={setSynesthesiaOn}
              reducedMotion={reducedMotion}
              setReducedMotion={setReducedMotion}
              cueVolume={cueVolume}
              setCueVolume={setReferenceGainPreference}
              microphoneGain={microphoneGain}
              setMicrophoneGain={setMicrophoneGainPreference}
              sfxVolume={sfxVolume}
              setSfxVolume={setSfxVolume}
              compact
              touchSized={layoutMode === 'portrait'}
            />
            <button onClick={quitToMenu} className={`${layoutMode === 'portrait' ? 'min-h-12' : 'min-h-8'} text-xs text-gray-300 hover:text-gray-100 border border-gray-700 px-3 py-1`}>
              Quit
            </button>
            <div
              data-testid="pf3-options-scroll-cue"
              aria-hidden="true"
              className="sticky bottom-0 z-10 flex min-h-6 w-full items-center justify-center gap-1 bg-[#070914]/95 py-1 text-[10px] font-black tracking-widest text-gray-400"
            >
              <span aria-hidden="true">↕</span> SCROLL FOR MORE OPTIONS
            </div>
          </div>
        )}
      </div>
      {geometryDebug && (
        <div
          data-testid="pf3-geometry-debug"
          className="absolute bottom-2 right-2 z-50 border border-cyan-500/70 bg-black/90 px-2 py-1 text-[10px] leading-4 text-cyan-100"
        >
          <div>viewport {viewportGeometry.width}x{viewportGeometry.height}</div>
          <div>dpr {viewportGeometry.dpr.toFixed(2)} · visual {viewportGeometry.visualScale.toFixed(2)}</div>
          <div>container {viewportGeometry.containerWidth.toFixed(1)}x{viewportGeometry.containerHeight.toFixed(1)}</div>
          <div>canvas {canvasDisplaySize.width.toFixed(1)}x{canvasDisplaySize.height.toFixed(1)}</div>
          <div>mode {layoutMode}</div>
        </div>
      )}
    </div>
  )
}

function SettingsRow(props: {
  noteNamesOn: boolean
  setNoteNamesOn: (value: boolean) => void
  audioCueOn: boolean
  setAudioCueOn: (value: boolean) => void
  staffNotationOn: boolean
  setStaffNotationOn: (value: boolean) => void
  synesthesiaOn: boolean
  setSynesthesiaOn: (value: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (value: boolean) => void
  cueVolume: number
  setCueVolume: (value: number) => void
  microphoneGain: number
  setMicrophoneGain: (value: number) => void
  sfxVolume: number
  setSfxVolume: (value: number) => void
  compact?: boolean
  touchSized?: boolean
}) {
  const controlSize = props.touchSized ? 'min-h-12' : ''
  return (
    <div className={`flex max-w-full flex-wrap items-center justify-center ${props.compact ? 'gap-2 text-[11px]' : 'gap-3 text-xs'}`}>
      <button
        type="button"
        data-testid="pf3-note-names-toggle"
        aria-pressed={props.noteNamesOn}
        onClick={() => props.setNoteNamesOn(!props.noteNamesOn)}
        className={`${controlSize} px-2 py-1 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${props.noteNamesOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Note names {props.noteNamesOn ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        data-testid="pf3-reference-audio-toggle"
        aria-pressed={props.audioCueOn}
        onClick={() => props.setAudioCueOn(!props.audioCueOn)}
        className={`${controlSize} px-2 py-1 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${props.audioCueOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Audio cue {props.audioCueOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setStaffNotationOn(!props.staffNotationOn)}
        aria-pressed={props.staffNotationOn}
        data-testid="pf3-staff-notation-toggle"
        className={`${controlSize} px-2 py-1 border ${props.staffNotationOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Staff notation {props.staffNotationOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setSynesthesiaOn(!props.synesthesiaOn)}
        className={`${controlSize} px-2 py-1 border ${props.synesthesiaOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Note colors {props.synesthesiaOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setReducedMotion(!props.reducedMotion)}
        className={`${controlSize} px-2 py-1 border ${props.reducedMotion ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Reduced motion {props.reducedMotion ? 'ON' : 'OFF'}
      </button>
      <label className={`${controlSize} flex items-center gap-2 text-gray-300`}>
        Reference audio {props.cueVolume}%
        <input
          data-testid="pf3-reference-gain"
          aria-label="Reference audio volume"
          aria-valuetext={`${props.cueVolume}%`}
          type="range"
          min={0}
          max={200}
          value={props.cueVolume}
          onChange={e => props.setCueVolume(Number(e.target.value))}
          className="w-24 accent-orange-300"
        />
      </label>
      <label className={`${controlSize} flex items-center gap-2 text-gray-300`} title="Changes what the detector observes; your microphone is never played through speakers.">
        Mic sensitivity {props.microphoneGain}%
        <input
          data-testid="pf3-microphone-gain"
          aria-label="Microphone observation sensitivity"
          aria-valuetext={`${props.microphoneGain}%`}
          type="range"
          min={0}
          max={200}
          value={props.microphoneGain}
          onChange={e => props.setMicrophoneGain(Number(e.target.value))}
          className="w-24 accent-cyan-300"
        />
      </label>
      <label className={`${controlSize} flex items-center gap-2 text-gray-300`}>
        SFX
        <input
          type="range"
          min={0}
          max={200}
          value={props.sfxVolume}
          onChange={e => props.setSfxVolume(Number(e.target.value))}
          className="w-24 accent-orange-300"
        />
      </label>
    </div>
  )
}
