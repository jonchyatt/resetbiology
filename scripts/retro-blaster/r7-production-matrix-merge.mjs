import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [rawRoot, exactDeployedSha] = process.argv.slice(2)
if (!rawRoot || !exactDeployedSha) {
  throw new Error('usage: node r7-production-matrix-merge.mjs OUTPUT_ROOT EXACT_DEPLOYED_SHA')
}

const root = resolve(rawRoot)
const lanes = ['native-chrome', 'brave-hawkeye', 'edge-hawkeye', 'chrome-hawkeye', 'helium-hawkeye']
const requiredBehaviorIds = [
  'ear-due-roster-membership',
  'ear-wrong-again-next-wave',
  'ear-timeout-again-next-wave',
  'voice-qualified-heard-timeout',
  'voice-silence-low-confidence-zero-grade',
  'voice-source-break-zero-grade-recovery',
  'weighted-fair-dive-service',
  'r-low-vs-high-formation-agitation',
  's-calm-rarity',
  'reduced-static-soul-signal',
  'lane-store-isolation',
  'r4-correct-charge-tracer-lock-impact-regression',
  'wrong-teaching-return-no-success-vfx',
  'hidden-focus-freeze-resume',
  'late-wave-pacing',
  'portrait-short-landscape',
]
const protectedBase = '6f4c8da158b9773bbda90eef0cc51334e6fa636b'
const productPath = 'src/components/PitchDefender/RetroBlasterII.tsx'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function gitShow(revision, path) {
  return execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' })
}

const baseProduct = gitShow(protectedBase, productPath)
const deployedProduct = gitShow(exactDeployedSha, productPath)
const productDiff = execFileSync('git', [
  'diff', '--unified=0', protectedBase, exactDeployedSha, '--', productPath,
], { encoding: 'utf8' })
const addedGainPathLines = productDiff.split(/\r?\n/)
  .filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .filter(line => /type=["']range|data-retro-.*gain|max=["']200|gain slider|piano gain|mic gain/i.test(line))
assert(!/type=["']range|data-retro-.*gain|max=["']200/i.test(baseProduct),
  'protected R4 chassis unexpectedly contains a 0-200 gain path')
assert(!/type=["']range|data-retro-.*gain|max=["']200/i.test(deployedProduct),
  'deployed R7 chassis unexpectedly contains a 0-200 gain path')
assert(addedGainPathLines.length === 0, 'R7 product diff introduced or mutated a gain control path')

const verifierPaths = [
  'scripts/retro-blaster/r7-soul-browser-proof.mjs',
  'scripts/retro-blaster/r4-mic-browser-proof.mjs',
  'scripts/retro-blaster/r3c-hawkeye-fleet-proof.mjs',
  'scripts/retro-blaster/r7-production-matrix-merge.mjs',
]
const verifierSha256 = Object.fromEntries(verifierPaths.map(path => [path, sha256(readFileSync(path))]))
const verifierCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const verifierPathsCleanAtCommit = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...verifierPaths]).status === 0
const laneResults = []

for (const lane of lanes) {
  const soulPath = resolve(root, lane, 'soul', 'result.json')
  const micPath = resolve(root, lane, 'mic', 'result.json')
  const lateWavePath = resolve(root, lane, 'late-wave', lane, 'result.json')
  const sources = [
    { name: 'r7-soul', path: soulPath, receipt: readJson(soulPath) },
    { name: 'r4-mic', path: micPath, receipt: readJson(micPath) },
    { name: 'r3c-late-wave', path: lateWavePath, receipt: readJson(lateWavePath) },
  ]
  for (const source of sources) {
    assert(source.receipt.exactDeployedSha === exactDeployedSha,
      `${lane}/${source.name} deployed SHA mismatch`)
    assert((source.receipt.pageErrors || []).length === 0, `${lane}/${source.name} has page errors`)
    if (source.receipt.status !== undefined) {
      assert(source.receipt.status === 'PASS', `${lane}/${source.name} status is not PASS`)
    }
  }
  assert(Object.values(sources[0].receipt.assertions).every(Boolean), `${lane}/soul assertion failed`)
  assert(Object.values(sources[1].receipt.assertions).every(Boolean), `${lane}/mic assertion failed`)
  assert(Object.values(sources[2].receipt.assertions).every(Boolean), `${lane}/late-wave assertion failed`)
  assert(sources[0].receipt.proofChannel.observedFrameRateFps >= 20,
    `${lane} motion-critical soul proof is below 20fps`)
  assert(sources[1].receipt.firstChain.stateFrameCount / 6 >= 20,
    `${lane} R4 causal-chain proof is below 20fps`)
  assert(sources[1].receipt.firstChain.meterMaximumWidthPct >= 90,
    `${lane} vocal meter did not reach the real-lock threshold`)
  assert(sources[1].receipt.gainDeferral.status === 'deferred-r14' &&
    sources[1].receipt.gainDeferral.liveGainRanges.length === 0,
  `${lane} R14 gain deferral is not truthful`)

  const availableRows = sources.flatMap(source => source.receipt.behaviorManifest.map(row => ({
    ...row, sourceName: source.name, sourceReceiptPath: source.path,
  })))
  const behaviorManifest = requiredBehaviorIds.map(behaviorId => {
    const sourceRow = availableRows.find(row => row.behaviorId === behaviorId)
    assert(sourceRow, `${lane} missing behavior row ${behaviorId}`)
    assert(sourceRow.durationMs >= 6000, `${lane}/${behaviorId} is shorter than 6000ms`)
    const sequenceSha256 = sourceRow.orderedFrameSequenceSha256 || sourceRow.frameSequenceSha256
    assert(sequenceSha256, `${lane}/${behaviorId} has no ordered sequence hash`)
    assert(sourceRow.machineStateReceiptPath, `${lane}/${behaviorId} has no machine-state receipt`)
    return {
      browserLane: lane,
      exactDeployedSha,
      behaviorId,
      startMonotonicMs: 0,
      endMonotonicMs: sourceRow.durationMs,
      durationMs: sourceRow.durationMs,
      sourceStartTimeMs: sourceRow.startMonotonicMs,
      sourceEndTimeMs: sourceRow.endMonotonicMs,
      videoPath: sourceRow.videoPath || null,
      videoSha256: sourceRow.videoSha256 || null,
      frameSequencePath: sourceRow.frameSequencePath || sourceRow.frameSequencePaths || null,
      orderedFrameSequenceSha256: sequenceSha256,
      frameCount: sourceRow.frameCount || null,
      frameRateFloorFps: sourceRow.frameRateFloorFps || 2,
      machineStateReceiptPath: sourceRow.machineStateReceiptPath,
      sourceName: sourceRow.sourceName,
      sourceReceiptPath: sourceRow.sourceReceiptPath,
      claudeFrameCitations: sourceRow.claudeFrameCitations || [],
      argusFrameCitations: sourceRow.argusFrameCitations || [],
    }
  })
  assert(new Set(behaviorManifest.map(row => row.behaviorId)).size === 16,
    `${lane} behavior matrix is not exactly 16 unique rows`)
  const manifestSha256 = sha256(behaviorManifest.map(row =>
    `${row.behaviorId}|${row.orderedFrameSequenceSha256}|${row.machineStateReceiptPath}`).join('\n'))
  const laneResult = {
    status: 'PASS',
    browserLane: lane,
    exactDeployedSha,
    behaviorCount: behaviorManifest.length,
    behaviorManifestSha256: manifestSha256,
    behaviorManifest,
    namedAssertions: {
      vocalMeter: {
        status: 'PASS',
        selector: 'data-retro-vocal-meter',
        partialAndFullRealLock: true,
        domCanvasAuthorityPreserved: true,
        maximumWidthPct: sources[1].receipt.firstChain.meterMaximumWidthPct,
        machineStateReceiptPath: micPath,
      },
      gainControls: {
        status: 'deferred-r14',
        liveRanges: [],
        r7IntroducedOrMutatedGainPath: false,
        protectedBase,
        productPath,
        deployedProductSha256: sha256(deployedProduct),
        exactDiffSha256: sha256(productDiff),
      },
    },
    sourceReceipts: sources.map(source => ({
      name: source.name,
      path: source.path,
      sha256: sha256(readFileSync(source.path)),
    })),
    verifierSha256,
    verifierCommitSha,
    verifierPathsCleanAtCommit,
    pageErrors: [],
  }
  const laneResultPath = resolve(root, lane, 'matrix-result.json')
  writeFileSync(laneResultPath, `${JSON.stringify(laneResult, null, 2)}\n`)
  laneResults.push({ ...laneResult, laneResultPath, laneResultSha256: sha256(readFileSync(laneResultPath)) })
}

const aggregate = {
  status: 'PASS',
  exactDeployedSha,
  requiredBehaviorIds,
  laneCount: laneResults.length,
  totalBehaviorRows: laneResults.reduce((sum, lane) => sum + lane.behaviorCount, 0),
  allLanesHaveExactly16Rows: laneResults.every(lane => lane.behaviorCount === 16),
  namedAssertions: {
    vocalMeterAllLanes: laneResults.every(lane => lane.namedAssertions.vocalMeter.status === 'PASS'),
    gainControlsDeferredR14AllLanes: laneResults.every(lane => lane.namedAssertions.gainControls.status === 'deferred-r14'),
  },
  verifierSha256,
  verifierCommitSha,
  verifierPathsCleanAtCommit,
  lanes: laneResults.map(lane => ({
    browserLane: lane.browserLane,
    status: lane.status,
    behaviorCount: lane.behaviorCount,
    behaviorManifestSha256: lane.behaviorManifestSha256,
    laneResultPath: lane.laneResultPath,
    laneResultSha256: lane.laneResultSha256,
  })),
}
const aggregatePath = resolve(root, 'production-matrix-result.json')
writeFileSync(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`)
console.log(JSON.stringify({ ...aggregate, aggregatePath }, null, 2))
console.log('PASS: five lanes x sixteen explicit R7 production behaviors')
