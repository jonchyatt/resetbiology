import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = '4a2465b8dcfc7d912d2406373bf220b232e50295'
const SELF = fileURLToPath(import.meta.url)
const MODE = process.argv[2] === '--green' ? '--green' : '--red'
const OUTPUT = resolve(process.argv[3] ??
  (MODE === '--green'
    ? 'data/retro-blaster-rework/runtime-logs/r9b-green-local/result.json'
    : 'data/retro-blaster-rework/runtime-logs/r9b-red-4a2465b8/result.json'))

const PATHS = {
  engine: 'src/components/PitchDefender/retroBlasterEngine.ts',
  shell: 'src/components/PitchDefender/RetroBlasterII.tsx',
  renderer: 'src/components/PitchDefender/retroBlasterRenderer.ts',
  audio: 'src/components/PitchDefender/audioEngine.ts',
  detector: 'src/components/PitchDefender/usePitchDetection.ts',
  sibling: 'src/components/PitchDefender/RetroBlaster.tsx',
  types: 'src/components/PitchDefender/types.ts',
  family: 'src/lib/fsrsFamily.ts',
  r8c: 'scripts/retro-blaster/r8c-signal-check-fixture.ts',
  r10: 'scripts/retro-blaster/r10-first-player-fixture.ts',
} as const

const PROTECTED_HASHES = {
  audio: 'B513FFAC628518A936C140BC0D6C9BC30B18C263DC6672C12ED120AD0CD23744',
  detector: '8515917A3F0B4066D23D85C4D7E4B0B9553F25FF332332604BE0412CCA5EA9F5',
  sibling: 'CAA31FCE012E82DA1BD7E6DA2AEE5300522BD0450DEC1D293AAAA1FA6FE407C5',
  types: 'FE36957396DF11499A3508C89D773E419DB5767894F80F072B067EB3AE0AFDEB',
  family: '8711C1C5E66427AE32C641D1C60E0B393894E828FEF85DD8579D643B3A078E46',
} as const

type Evidence = Record<string, unknown>
type Expectation = 'PASS' | 'RED'
type EvidenceClass = 'source-backed' | 'runtime-measured' | 'reference-oracle'
type ProbeResult = boolean | { pass: boolean; evidence?: Evidence }
type Probe = () => ProbeResult | Promise<ProbeResult>
type Row = {
  id: string
  group: string
  contract: string
  expectation: Expectation
  evidenceClass: EvidenceClass
  actual: 'PASS' | 'RED'
  classification: 'MATCH' | 'UNEXPECTED_PASS' | 'UNEXPECTED_FAIL'
  evidence: Evidence
  error?: string
}

const source = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, readFileSync(path, 'utf8')]),
) as Record<keyof typeof PATHS, string>
const hashes = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, sha256(readFileSync(path))]),
) as Record<keyof typeof PATHS, string>
const rows: Row[] = []

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex').toUpperCase()
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function hasAll(haystack: string, needles: readonly string[]): boolean {
  return needles.every(needle => haystack.includes(needle))
}

function passIf(haystack: string, needles: readonly string[]): ProbeResult {
  const found = Object.fromEntries(needles.map(needle => [needle, haystack.includes(needle)]))
  return { pass: Object.values(found).every(Boolean), evidence: { found } }
}

async function add(
  id: string,
  group: string,
  contract: string,
  expectation: Expectation,
  evidenceClass: EvidenceClass,
  probe: Probe,
): Promise<void> {
  const effectiveExpectation: Expectation = MODE === '--green' ? 'PASS' : expectation
  try {
    const result = await probe()
    const pass = typeof result === 'boolean' ? result : result.pass
    const evidence = typeof result === 'boolean' ? {} : result.evidence ?? {}
    rows.push({
      id, group, contract, expectation: effectiveExpectation, evidenceClass,
      actual: pass ? 'PASS' : 'RED',
      classification: effectiveExpectation === 'PASS'
        ? pass ? 'MATCH' : 'UNEXPECTED_FAIL'
        : pass ? 'UNEXPECTED_PASS' : 'MATCH',
      evidence,
    })
  } catch (error) {
    rows.push({
      id, group, contract, expectation: effectiveExpectation, evidenceClass,
      actual: 'RED',
      classification: effectiveExpectation === 'RED' ? 'MATCH' : 'UNEXPECTED_FAIL',
      evidence: {},
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    })
  }
}

async function main(): Promise<void> {
  await add('P-01', 'protected-baseline', 'candidate is an exact descendant of the inspected base', 'PASS', 'runtime-measured', () => {
    const head = git('rev-parse', 'HEAD')
    const originMaster = git('rev-parse', 'origin/master')
    const mergeBase = git('merge-base', BASE, head)
    const redExact = MODE === '--red' && head === BASE && originMaster === BASE
    const greenDescendant = MODE === '--green' && mergeBase === BASE && (originMaster === BASE || originMaster === head)
    return { pass: redExact || greenDescendant, evidence: { head, originMaster, mergeBase } }
  })
  await add('P-02', 'protected-baseline', 'audio engine remains byte-protected', 'PASS', 'source-backed', () => hashes.audio === PROTECTED_HASHES.audio)
  await add('P-03', 'protected-baseline', 'pitch detector remains byte-protected', 'PASS', 'source-backed', () => hashes.detector === PROTECTED_HASHES.detector)
  await add('P-04', 'protected-baseline', 'Retro Blaster v1 sibling remains byte-protected', 'PASS', 'source-backed', () => hashes.sibling === PROTECTED_HASHES.sibling)
  await add('P-05', 'protected-baseline', 'shared note types remain byte-protected', 'PASS', 'source-backed', () => hashes.types === PROTECTED_HASHES.types)
  await add('P-06', 'protected-baseline', 'family store contract remains byte-protected', 'PASS', 'source-backed', () => hashes.family === PROTECTED_HASHES.family)
  await add('P-07', 'protected-baseline', 'EAR and VOICE family keys remain distinct', 'PASS', 'source-backed', () =>
    hasAll(source.family, ["FSRS_VOICE_KEY = 'pitch_fsrs_memory'", "FSRS_EAR_KEY = 'pitch_fsrs_memory_ear'"]))
  await add('P-08', 'protected-baseline', 'closed R8c request/ack identity-mask seam remains present', 'PASS', 'source-backed', () =>
    hasAll(source.engine, ['blindProbePending', "cuePolicy === 'blind'", 'blindStimulusRequest', 'identityMaskActive']))
  await add('P-09', 'protected-baseline', 'accepted R10 first-player pace/protection contract remains present', 'PASS', 'source-backed', () =>
    hasAll(source.r10, ['four-threshold pace placement and manual override', 'explicit pre-flight safe practice placement and C/A launch source contract', 'protectedCount', 'demotions']))
  await add('P-10', 'protected-baseline', 'source changes stay inside the phase-authorized Retro ceiling', 'PASS', 'runtime-measured', () => {
    const tracked = git('diff', '--name-only', BASE, '--', 'src').split(/\r?\n/).filter(Boolean)
    const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'src').split(/\r?\n/).filter(Boolean)
    const authorized = new Set([PATHS.engine, PATHS.shell, PATHS.renderer])
    return {
      pass: untracked.length === 0 && (MODE === '--red'
        ? tracked.length === 0
        : tracked.length === authorized.size && tracked.every(path => authorized.has(path as typeof PATHS.engine))),
      evidence: { tracked, untracked, authorized: [...authorized] },
    }
  })

  await add('R-01', 'cue-ownership', 'construction-safe AttackCuePlan discriminated union exists', 'RED', 'source-backed', () =>
    passIf(source.engine, ['type AttackCuePlan', "owner: 'r8c-probe'", "owner: 'ordinary'", 'cue: AttackCuePlan']))
  await add('R-02', 'cue-ownership', 'one guarded cue constructor rejects invalid owner-policy pairs', 'RED', 'source-backed', () =>
    passIf(source.engine, ['buildAttackCuePlan', 'ordinary + blind', 'r8c-probe + safe-try']))
  await add('R-03', 'cue-ownership', 'R8c ownership is assigned before ordinary cue decoration', 'RED', 'source-backed', () => {
    const startAttack = source.engine.slice(source.engine.indexOf('function startAttack'), source.engine.indexOf('function deactivateAttackLasers'))
    return {
      pass: startAttack.includes('cueOwner') && startAttack.indexOf('cueOwner') < startAttack.indexOf('const armed'),
      evidence: { cueOwner: startAttack.indexOf('cueOwner'), ordinaryArmRead: startAttack.indexOf('const armed') },
    }
  })
  await add('R-04', 'volatile-state', 'sparse EAR-only safeTryArms state starts empty and is never serialized', 'RED', 'source-backed', () =>
    passIf(source.engine, ['safeTryArms', 'safeTryArms: {}', 'SafeTryArmMap']))
  await add('R-05', 'volatile-state', 'single private guarded EAR-click writer owns every arm mutation', 'RED', 'source-backed', () =>
    passIf(source.engine, ['function tryArmOrdinaryEarSafeTry', "inputMode !== 'click'", "cue.owner !== 'ordinary'", 'answerHelpUsed']))
  await add('R-06', 'volatile-state', 'qualifying writer reads reviewed not-due immutable snapshot and output readiness', 'RED', 'source-backed', () =>
    passIf(source.engine, ['tryArmOrdinaryEarSafeTry', 'soul.reviewed', '!soul.due', 'outputReady']))
  await add('R-07', 'volatile-state', 'starting any safe try clears the complete arm map before telegraph', 'RED', 'source-backed', () =>
    passIf(source.engine, ['clearSafeTryArms', 'cuePolicy: \'safe-try\'', 'telegraphStartedAtMs']))
  await add('R-08', 'volatile-state', 'dual-arm C/A sequence has a global guided barrier', 'RED', 'source-backed', () =>
    passIf(source.engine, ['clearSafeTryArms', 'safeTryArms = {}', 'safe-try']))
  await add('R-09', 'volatile-state', 'R8c owns and freezes the complete ordinary arm map in every disposition', 'RED', 'source-backed', () =>
    passIf(source.engine, ["owner: 'r8c-probe'", 'safeTryArms', 'signalCheckDisposition']))
  await add('R-10', 'volatile-state', 'first encounter reload mode reset and stale state fail to guided', 'RED', 'source-backed', () =>
    passIf(source.engine + source.shell, ['safeTryArms: {}', 'clearSafeTryArms', 'resetOrdinaryCueSupport']))

  await add('R-11', 'assist-boundary', 'ActiveAttack records non-persisted answerHelpUsed', 'RED', 'source-backed', () =>
    passIf(source.engine, ['answerHelpUsed: boolean', 'answerHelpUsed: false']))
  await add('R-12', 'assist-boundary', 'baseline guided projection and Tone Replay do not mark answer help', 'RED', 'source-backed', () =>
    passIf(source.engine + source.shell, ['answerHelpUsed', 'tone-replay-answer-neutral']))
  await add('R-13', 'assist-boundary', 'timed exact-answer hint marks answer help', 'RED', 'source-backed', () =>
    passIf(source.engine, ['Hint: try', 'answerHelpUsed = true']))
  await add('R-14', 'assist-boundary', 'Full Help is an engine-owned same-attack same-deadline transition', 'RED', 'source-backed', () =>
    passIf(source.engine, ['requestFullCueHelp', 'attackId', 'deadlineAtMs', 'answerHelpUsed = true']))
  await add('R-15', 'assist-boundary', 'safe try and answer-revealing assist can never re-arm themselves', 'RED', 'source-backed', () =>
    passIf(source.engine, ["cue.policy === 'guided'", '!attack.answerHelpUsed', 'tryArmOrdinaryEarSafeTry']))

  await add('R-16', 'sanitized-view', 'ViewState exposes distinct supportMode and answerMaskActive', 'RED', 'source-backed', () =>
    passIf(source.engine, ['supportMode', 'answerMaskActive']))
  await add('R-17', 'sanitized-view', 'safe-try view removes target note alien association and spotlight', 'RED', 'source-backed', () => {
    const found = {
      safeTryProjection: source.engine.includes('safeTryProjection'),
      neutralSpotlight: /spotlightIdx:\s*safeTryProjection\s*\?\s*-1/.test(source.engine),
      neutralNote: source.engine.includes("note: '?'"),
      neutralAlien: source.engine.includes("alienId: '?'"),
    }
    return { pass: Object.values(found).every(Boolean), evidence: { found } }
  })
  await add('R-18', 'sanitized-view', 'safe-try renderer input neutralizes formation hue chip soul laser and particle channels', 'RED', 'source-backed', () =>
    passIf(source.engine + source.renderer, ['answerMaskActive', 'neutralSoul', 'safeTryProjection', 'targetInvariant']))
  await add('R-19', 'sanitized-view', 'R8c identityMaskActive remains separate from ordinary answer mask', 'RED', 'source-backed', () =>
    passIf(source.engine + source.shell, ['answerMaskActive', 'identityMaskActive', 'data-retro-support-mode']))
  await add('R-20', 'sanitized-view', 'safe try never emits blind replay-lock or signal-check evidence attributes', 'RED', 'source-backed', () =>
    passIf(source.shell, ['data-retro-support-mode', 'safe-try', 'data-retro-identity-mask']))
  await add('R-21', 'sanitized-view', 'renderer has an explicit target-invariant answer-mask branch', 'RED', 'source-backed', () =>
    passIf(source.renderer, ['answerMaskActive', 'targetInvariant']))
  await add('R-22', 'sanitized-view', 'renderer fixture exposes deterministic canvas-buffer hashing with scrim removed', 'RED', 'source-backed', () =>
    passIf(source.renderer, ['answerMaskActive', 'safe-try-canvas-hash']))

  await add('R-23', 'shell-contract', 'playfield-only safe-try scrim exists with no answer-bearing art', 'RED', 'source-backed', () =>
    passIf(source.shell, ['data-retro-safe-try-scrim', 'SAFE TRY', 'aria-hidden']))
  await add('R-24', 'shell-contract', 'scrim is canvas-bound absolute inset and does not intercept pointers', 'RED', 'source-backed', () =>
    passIf(source.shell, ['data-retro-safe-try-scrim', 'absolute inset-0', 'pointer-events-none']))
  await add('R-25', 'shell-contract', 'covered canvas answer coordinates are inert and DOM answers are sole live choices', 'RED', 'source-backed', () =>
    passIf(source.shell, ['answerMaskActive', 'handleCanvasClick', 'canvas-answer-inert']))
  await add('R-26', 'shell-contract', 'live choice copy is canonical dynamic and never hardcodes C OR A', 'RED', 'source-backed', () => ({
    pass: source.shell.includes('liveChoiceNames') && source.shell.includes('const neutralAnswerChoice = answerMaskActive') &&
      !source.shell.includes('CHOOSE C OR A'),
    evidence: {
      dynamic: source.shell.includes('liveChoiceNames'),
      neutralComputedStyle: source.shell.includes('const neutralAnswerChoice = answerMaskActive'),
      hardcoded: source.shell.includes('CHOOSE C OR A'),
    },
  }))
  await add('R-27', 'shell-contract', 'safe-try entry moves focus to a distinct neutral tabindex target', 'RED', 'source-backed', () =>
    passIf(source.shell, [
      'safeTryFocusRef',
      'tabIndex={-1}',
      'data-retro-safe-try-focus',
      "displayView?.activeAttack?.phase === 'outbound'",
    ]))
  await add('R-28', 'shell-contract', 'one stable polite live region owns the atomic instruction', 'RED', 'source-backed', () =>
    passIf(source.shell, ['data-retro-safe-try-status', 'aria-live="polite"', 'liveChoiceNames']))
  await add('R-29', 'shell-contract', 'Tone Replay remains on Space R and pointer without changing help state', 'RED', 'source-backed', () =>
    passIf(source.shell, [
      'TONE REPLAY [SPACE / R]',
      "ev.key === ' '",
      "ev.key === 'r'",
      'tone-replay-answer-neutral',
      'onMouseDown={event => { if (answerMaskActive) event.preventDefault() }}',
    ]))
  await add('R-30', 'shell-contract', 'Full Help uses otherwise-unbound H and submits no answer', 'RED', 'source-backed', () =>
    passIf(source.shell, ['FULL HELP [H]', "ev.key === 'h'", 'requestFullCueHelp']))

  await add('R-31', 'receipt-lifecycle', 'unresolved safe try defers raw audio receipt outside DOM', 'RED', 'source-backed', () =>
    passIf(source.shell, [
      'pendingSafeTryAudioReceiptRef',
      'defer-safe-try-receipt',
      'result.viewState.answerMaskActive && !renderedAnswerMaskRef.current',
      'clearRetroAudioReceipt(canvasRef.current)',
    ]))
  await add('R-32', 'receipt-lifecycle', 'answer help timeout life loss game over and wave transition publish once after reveal', 'RED', 'source-backed', () =>
    passIf(source.shell, ['flushPendingSafeTryAudioReceipt', 'publish-after-reveal', 'gameOver', 'waveComplete']))
  await add('R-33', 'receipt-lifecycle', 'QUIT unmount and route teardown discard pending receipt', 'RED', 'source-backed', () =>
    passIf(source.shell, ['discardPendingSafeTryAudioReceipt', 'clearRetroAudioReceipt']))
  await add('R-34', 'receipt-lifecycle', 'hidden blur resize orientation and phase exits cannot leave stale scrim', 'RED', 'source-backed', () =>
    passIf(source.shell, ['resetOrdinaryCueSupport', 'visibilitychange', 'data-retro-safe-try-scrim']))

  await add('R-35', 'ceiling-and-causality', 'safe try writes no storage curriculum FSRS selector cadence grade or mic-lock authority', 'RED', 'source-backed', () => ({
    pass: hasAll(source.engine, ['safeTryArms', 'tryArmOrdinaryEarSafeTry']) &&
      !/localStorage|sessionStorage|pitch_fsrs_memory/.test(source.engine.slice(source.engine.indexOf('tryArmOrdinaryEarSafeTry'), source.engine.indexOf('tryArmOrdinaryEarSafeTry') + 1800)),
    evidence: { writerIndex: source.engine.indexOf('tryArmOrdinaryEarSafeTry') },
  }))
  await add('R-36', 'ceiling-and-causality', 'R9b source contract preserves R8c R10 routes VOICE meter gain deferral and no-clinical-claim boundaries', 'RED', 'source-backed', () =>
    passIf(source.shell + source.engine, ['data-retro-support-mode', 'data-retro-vocal-meter', 'safe-try']))

  const orderedIds = [
    ...Array.from({ length: 10 }, (_, index) => `P-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 36 }, (_, index) => `R-${String(index + 1).padStart(2, '0')}`),
  ]
  const actualIds = rows.map(row => row.id)
  const shapeValid = rows.length === orderedIds.length && new Set(actualIds).size === orderedIds.length &&
    JSON.stringify(actualIds) === JSON.stringify(orderedIds)
  const unexpected = rows.filter(row => row.classification !== 'MATCH')
  const protectedPass = rows.filter(row => row.id.startsWith('P-') && row.actual === 'PASS').length
  const contractPass = rows.filter(row => row.id.startsWith('R-') && row.actual === 'PASS').length
  const expectedRed = rows.filter(row => row.expectation === 'RED' && row.actual === 'RED').length
  const unexpectedPass = rows.filter(row => row.classification === 'UNEXPECTED_PASS').length
  const unexpectedFail = rows.filter(row => row.classification === 'UNEXPECTED_FAIL').length
  const status = shapeValid && unexpected.length === 0
    ? MODE === '--green' ? 'PASS' : 'EXPECTED_RED_CONFIRMED'
    : 'UNEXPECTED_RESULT'
  const result = {
    schema: MODE === '--green'
      ? 'retro-blaster-r9b-cue-taper/green-v1'
      : 'retro-blaster-r9b-cue-taper/red-first-v1',
    generatedAt: new Date().toISOString(),
    mode: MODE,
    exactBase: BASE,
    head: git('rev-parse', 'HEAD'),
    originMaster: git('rev-parse', 'origin/master'),
    fixture: { path: 'scripts/retro-blaster/r9b-cue-taper-fixture.ts', sha256: sha256(readFileSync(SELF)) },
    output: OUTPUT,
    inspectedSourceHashes: hashes,
    counts: { total: rows.length, protectedPass, contractPass, expectedRed, unexpectedPass, unexpectedFail },
    shapeValid,
    status,
    touchedPathAudit: {
      trackedSourceDiff: git('diff', '--name-only', BASE, '--', 'src').split(/\r?\n/).filter(Boolean),
      untrackedSource: git('ls-files', '--others', '--exclude-standard', '--', 'src').split(/\r?\n/).filter(Boolean),
    },
    rows,
  }
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = status === 'EXPECTED_RED_CONFIRMED' || status === 'PASS' ? 0 : 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
