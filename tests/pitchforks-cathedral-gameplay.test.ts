import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  acceptsPitchforksSongcraftPauseCallback,
  createPitchforksSongcraftPauseGate,
  nextPitchforksSongcraftSourceKey,
  transitionPitchforksSongcraftPauseGate,
} from '../src/components/PitchDefender/PitchforksSongcraft'
import {
  createPitchforksSongcraftPractice,
} from '../src/components/PitchDefender/pitchforksSongcraftPractice'
import {
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftPhrase,
  type SongcraftPhraseOccurrence,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const occurrence = (
  ordinal: number,
  pitchName: string,
  semi: number,
  beatOffset: number,
): SongcraftPhraseOccurrence => ({
  ordinal,
  isRest: false,
  semi,
  pitchName,
  octave: 4,
  midi: semi + 60,
  beats: 1,
  measureIdx: 1,
  beatOffset,
})

const phrase: SongcraftPhrase = {
  sourceKey: 'pd_composed_cathedral_fixture',
  title: 'Cathedral fixture',
  sourceSha256: 'c'.repeat(64),
  provenance: {
    source: 'composer',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  },
  occurrences: [
    occurrence(0, 'C4', 0, 0),
    occurrence(1, 'D4', 2, 1),
  ],
}

async function main(): Promise<void> {
  const source = readFileSync(
    new URL('../src/components/PitchDefender/PitchforksSongcraft.tsx', import.meta.url),
    'utf8',
  )
  const integration = readFileSync(
    new URL('../data/pitchforks-repair-20260914/cathedral-gameplay/INTEGRATION.md', import.meta.url),
    'utf8',
  )
  const panelSource = readFileSync(
    new URL('../src/components/PitchDefender/PitchforksSongcraftPanel.tsx', import.meta.url),
    'utf8',
  )

  // Next-song is derived from the loaded Composer/preset library, never from
  // an invented catalog or an unlock threshold.
  const songs = [
    { sourceKey: 'pd_composed_current' },
    { sourceKey: 'builtin:practice:lantern-steps:1:first' },
    { sourceKey: 'builtin:practice:lantern-steps:1:second' },
  ] as const
  check(() => assert.equal(nextPitchforksSongcraftSourceKey(songs, songs[0].sourceKey), songs[1].sourceKey))
  check(() => assert.equal(nextPitchforksSongcraftSourceKey(songs, songs[1].sourceKey), songs[2].sourceKey))
  check(() => assert.equal(nextPitchforksSongcraftSourceKey(songs, songs[2].sourceKey), null))
  check(() => assert.equal(nextPitchforksSongcraftSourceKey(songs, 'missing'), null))

  // Pause invalidates old async ownership and resume requires a fresh
  // generation/fence. The durable practice controller is not involved.
  const initial = createPitchforksSongcraftPauseGate()
  const beforePause = { generation: initial.generation, fence: initial.fence }
  const paused = transitionPitchforksSongcraftPauseGate(initial, 'pause')
  check(() => assert.equal(paused.paused, true))
  check(() => assert.equal(acceptsPitchforksSongcraftPauseCallback(paused, beforePause.generation, beforePause.fence), false))
  const resumed = transitionPitchforksSongcraftPauseGate(paused, 'resume')
  check(() => assert.equal(resumed.paused, false))
  check(() => assert.equal(resumed.generation, initial.generation + 1))
  check(() => assert.equal(acceptsPitchforksSongcraftPauseCallback(resumed, resumed.generation, resumed.fence), true))
  check(() => assert.equal(acceptsPitchforksSongcraftPauseCallback(resumed, paused.generation, paused.fence), false))

  // The real controller still owns exact phrase progression and completion.
  let store: Record<string, unknown> = {}
  const practice = createPitchforksSongcraftPractice({
    phrase,
    attemptId: 'cathedral-gameplay-attempt',
    lane: 'voice',
    admittedNotes: ['C4', 'D4'],
    storage: {
      loadStore: () => ({ ...store }),
      saveStore: (_lane, next) => {
        store = { ...next }
        return true
      },
      readback: (_lane, note) => (store[note] as never) ?? null,
    },
  })
  const first = practice.state().current
  check(() => assert.equal(first.kind, 'note'))
  if (first.kind !== 'note') throw new Error('expected first note')
  const firstResult = practice.resolve({ ...first.identity, note: 'C4', correct: true })
  check(() => assert.equal(firstResult.kind, 'persisted'))
  check(() => assert.equal(practice.state().cursor, 1))
  const second = practice.state().current
  if (second.kind !== 'note') throw new Error('expected second note')
  const secondResult = practice.resolve({ ...second.identity, note: 'D4', correct: true })
  check(() => assert.equal(secondResult.kind, 'persisted'))
  check(() => assert.equal(practice.state().current.kind, 'complete'))
  check(() => assert.equal(practice.state().summary.unaidedComplete, true))

  // Connector-to-panel handoff: the panel worker consumes these additive
  // props; this test intentionally stops short of visual/native acceptance.
  check(() => assert.match(source, /const replayPhrase = useCallback\(/))
  check(() => assert.match(source, /const nextSong = useCallback\(/))
  check(() => assert.match(source, /const PitchforksTempoEncore = lazy\(async \(\) =>/))
  check(() => assert.match(source, /import\('\.\/PitchforksTempoEncorePanel'\)/))
  check(() => assert.doesNotMatch(source, /import \{ PitchforksTempoEncore \} from '\.\/PitchforksTempoEncorePanel'/))
  check(() => assert.match(source, /state\.status !== 'complete'/))
  check(() => assert.match(source, /nextPitchforksSongcraftSourceKey\(songsRef\.current, selectedKeyRef\.current\)/))
  check(() => assert.match(source, /setSelectedKey\(nextKey\)/))
  check(() => assert.match(source, /onReplayPhrase: replayPhrase/))
  check(() => assert.match(source, /onNextSong: nextSong/))
  check(() => assert.match(source, /onTogglePause: togglePause/))
  check(() => assert.match(source, /hasNextSong:/))
  check(() => assert.match(source, /acceptsPitchforksSongcraftPauseCallback/))
  check(() => assert.match(source, /releaseAudioWhenIdle/))
  check(() => assert.match(source, /playReference\(target\)/))
  check(() => assert.match(source, /controller\.resolve\(/))
  check(() => assert.match(source, /setPracticeSnapshot\(null\)/))
  check(() => assert.match(source, /onReturn: returnToMenu/))

  check(() => assert.match(integration, /PitchforksSongcraft\.tsx/))
  check(() => assert.match(integration, /PitchforksSongcraftPanel\.tsx/))
  check(() => assert.match(integration, /does not claim visual,\s*\nnative-browser,\s*physical-microphone/))
  check(() => assert.match(panelSource, /data-testid="pitchforks-songcraft-completion-actions"/))
  check(() => assert.match(panelSource, /data-testid="pitchforks-songcraft-replay-phrase"/))
  check(() => assert.match(panelSource, /data-testid="pitchforks-songcraft-next-song"/))
  check(() => assert.match(panelSource, /data-testid="pitchforks-songcraft-pause-toggle"/))

  console.log(`pitchforks cathedral Songcraft gameplay: ${checks}/${checks} PASS (source/controller contract; visual acceptance unverified)`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
