import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [rawRoot, exactBaseSha = 'local-uncommitted'] = process.argv.slice(2)
if (!rawRoot) throw new Error('usage: node r8a-matrix-merge.mjs OUTPUT_ROOT EXACT_BASE_SHA')

const root = resolve(rawRoot)
const lanes = ['native-chrome', 'brave-hawkeye', 'edge-hawkeye', 'chrome-hawkeye', 'helium-hawkeye']
const requiredBehaviors = [
  'ear-failure-retry',
  'ear-wrong-no-write',
  'voice-stale-silence-blocked',
  'voice-dead-track-blocked',
  'voice-pass-live-meter',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

const results = lanes.map(browserLane => {
  const receiptPath = resolve(root, browserLane, 'result.json')
  const raw = readFileSync(receiptPath)
  const receipt = JSON.parse(raw)
  assert(receipt.verdict === 'PASS', `${browserLane} verdict is not PASS`)
  assert(receipt.lane === browserLane, `${browserLane} receipt lane mismatch`)
  assert(receipt.deployedSha === exactBaseSha, `${browserLane} exact base mismatch`)
  assert(receipt.pageErrors.length === 0, `${browserLane} has page errors`)
  assert(receipt.behaviorManifest.length === requiredBehaviors.length, `${browserLane} behavior count mismatch`)
  for (const behaviorId of requiredBehaviors) {
    const row = receipt.behaviorManifest.find(candidate => candidate.behaviorId === behaviorId)
    assert(row, `${browserLane} missing ${behaviorId}`)
    assert(row.durationMs >= 6000, `${browserLane}/${behaviorId} is shorter than 6000ms`)
    assert(row.frameDelta >= 30, `${browserLane}/${behaviorId} lacks live frame evidence`)
  }
  assert(receipt.ear.readyState.readiness.status === 'awaiting-ear', `${browserLane} EAR never reached awaiting-ear`)
  assert(receipt.ear.readyState.readiness.toneArmed === 'true', `${browserLane} EAR named tone was not armed`)
  assert(receipt.ear.baseline === receipt.voice.baseline.replace('true', 'easy'),
    `${browserLane} lane baseline comparison changed outside the explicit difficulty choice`)
  assert(receipt.voice.passState.mic.gumCalls === 2 && receipt.voice.passState.mic.matchingCalls === 2,
    `${browserLane} VOICE retry/source count mismatch`)
  assert(receipt.voice.liveMeterState.vocalMeter.present && receipt.voice.liveMeterState.vocalMeter.visible &&
    receipt.voice.liveMeterState.vocalMeter.widthPct > 0, `${browserLane} live vocal meter proof failed`)
  assert(receipt.responsive.length === 4 && receipt.responsive.every(row =>
    row.horizontalOverflow <= 1 && row.clippedButtons.length === 0 && row.belowFoldButtons.length === 0),
  `${browserLane} responsive proof failed`)
  assert(receipt.inherited.gains === 'deferred-r14', `${browserLane} R14 gain deferral is not truthful`)
  assert(receipt.inherited.jonEar === 'pending-act-boundary', `${browserLane} Jon-ear status is not pending`)
  return {
    browserLane,
    status: 'PASS',
    receiptPath,
    receiptSha256: sha256(raw),
    behaviorCount: receipt.behaviorManifest.length,
    minimumBehaviorDurationMs: Math.min(...receipt.behaviorManifest.map(row => row.durationMs)),
    minimumFrameDelta: Math.min(...receipt.behaviorManifest.map(row => row.frameDelta)),
    pageErrorCount: receipt.pageErrors.length,
    responsiveRows: receipt.responsive.map(row => row.name),
  }
})

const aggregate = {
  status: 'PASS',
  matrix: 'R8a local predeploy five-lane',
  exactBaseSha,
  laneCount: results.length,
  requiredBehaviors,
  totalBehaviorRows: results.reduce((sum, result) => sum + result.behaviorCount, 0),
  allPageErrorsZero: results.every(result => result.pageErrorCount === 0),
  gains: 'deferred-r14',
  jonEar: 'pending-act-boundary',
  lanes: results,
}
const outputPath = resolve(root, 'local-matrix-result.json')
writeFileSync(outputPath, `${JSON.stringify(aggregate, null, 2)}\n`)
console.log(`PASS R8a local matrix: ${results.length} lanes, ${aggregate.totalBehaviorRows} causal rows, 0 page errors`)
