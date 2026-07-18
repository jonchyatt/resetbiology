import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [rawRoot, exactBaseSha = 'local-uncommitted'] = process.argv.slice(2)
if (!rawRoot) throw new Error('usage: node r8b-matrix-merge.mjs OUTPUT_ROOT EXACT_BASE_SHA')

const root = resolve(rawRoot)
const lanes = ['native-chrome', 'brave-hawkeye', 'edge-hawkeye', 'chrome-hawkeye', 'helium-hawkeye']
const requiredBehaviors = [
  'real-unlock-to-new-signal',
  'pre-ack-hidden-freeze',
  'blocked-output-freeze-and-responsive-actions',
  'post-ack-hidden-freeze',
  'acknowledged-resume-to-one-next-wave',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function validateBehaviorRows(receipt, browserLane, expected) {
  assert(receipt.behaviorManifest.length === expected.length, `${browserLane} behavior count mismatch`)
  for (const behaviorId of expected) {
    const row = receipt.behaviorManifest.find(candidate => candidate.behaviorId === behaviorId)
    assert(row, `${browserLane} missing ${behaviorId}`)
    assert(row.durationMs >= 6000, `${browserLane}/${behaviorId} is shorter than 6000ms`)
    assert(row.frameDelta >= 30, `${browserLane}/${behaviorId} lacks live frame evidence`)
  }
}

const results = lanes.map(browserLane => {
  const receiptPath = resolve(root, browserLane, 'result.json')
  const raw = readFileSync(receiptPath)
  const receipt = JSON.parse(raw)
  assert(receipt.verdict === 'PASS', `${browserLane} verdict is not PASS`)
  assert(receipt.lane === browserLane, `${browserLane} receipt lane mismatch`)
  assert(receipt.mode === 'standard', `${browserLane} did not run the standard flow`)
  assert(receipt.deployedSha === exactBaseSha, `${browserLane} exact base mismatch`)
  assert(receipt.pageErrors.length === 0, `${browserLane} has page errors`)
  assert(receipt.correctAnswers >= 10, `${browserLane} did not earn NEW SIGNAL through real attacks`)
  validateBehaviorRows(receipt, browserLane, requiredBehaviors)
  assert(receipt.responsive.length === 4 && receipt.responsive.every(row =>
    row.actions.length === 3 && row.actions.every(action =>
      action.height >= 44 && action.insideRegion && action.insideViewport)),
  `${browserLane} responsive ceremony proof failed`)
  assert(receipt.contract.firstSignal.startsWith('D4'), `${browserLane} introduced the wrong first signal`)
  assert(receipt.contract.blockedOutput.startsWith('PASS'), `${browserLane} blocked-output proof failed`)
  assert(receipt.contract.keyInertness.startsWith('PASS'), `${browserLane} gameplay-key inertness proof failed`)
  assert(receipt.contract.hiddenFreeze.startsWith('PASS'), `${browserLane} hidden-freeze proof failed`)
  assert(receipt.contract.toneDispatch.startsWith('PASS'), `${browserLane} tone-dispatch proof failed`)
  assert(receipt.contract.r8c.startsWith('CLOSED'), `${browserLane} crossed the R8c boundary`)
  return {
    browserLane,
    status: 'PASS',
    receiptPath,
    receiptSha256: sha256(raw),
    behaviorCount: receipt.behaviorManifest.length,
    minimumBehaviorDurationMs: Math.min(...receipt.behaviorManifest.map(row => row.durationMs)),
    minimumFrameDelta: Math.min(...receipt.behaviorManifest.map(row => row.frameDelta)),
    pageErrorCount: receipt.pageErrors.length,
    correctAnswers: receipt.correctAnswers,
    responsiveRows: receipt.responsive.map(row => row.name),
  }
})

const quitPath = resolve(root, 'native-chrome-quit', 'result.json')
const quitRaw = readFileSync(quitPath)
const quitReceipt = JSON.parse(quitRaw)
assert(quitReceipt.verdict === 'PASS' && quitReceipt.mode === 'quit', 'native quit lane did not PASS')
assert(quitReceipt.deployedSha === exactBaseSha, 'native quit exact base mismatch')
assert(quitReceipt.pageErrors.length === 0, 'native quit lane has page errors')
validateBehaviorRows(quitReceipt, 'native-chrome-quit', [
  'real-unlock-to-new-signal',
  'pre-ack-hidden-freeze',
  'blocked-output-freeze-and-responsive-actions',
  'ceremony-quit-no-resurrection',
])
assert(quitReceipt.contract.quitCleanup.startsWith('PASS'), 'native quit cleanup proof failed')

const aggregate = {
  status: 'PASS',
  matrix: 'R8b local predeploy five-lane plus native ceremony-quit',
  exactBaseSha,
  standardLaneCount: results.length,
  requiredBehaviors,
  totalBehaviorRows: results.reduce((sum, result) => sum + result.behaviorCount, 0) + quitReceipt.behaviorManifest.length,
  allPageErrorsZero: results.every(result => result.pageErrorCount === 0) && quitReceipt.pageErrors.length === 0,
  r8c: 'CLOSED',
  lanes: results,
  quitLane: {
    browserLane: 'native-chrome-quit',
    status: 'PASS',
    receiptPath: quitPath,
    receiptSha256: sha256(quitRaw),
    behaviorCount: quitReceipt.behaviorManifest.length,
    minimumBehaviorDurationMs: Math.min(...quitReceipt.behaviorManifest.map(row => row.durationMs)),
    minimumFrameDelta: Math.min(...quitReceipt.behaviorManifest.map(row => row.frameDelta)),
  },
}
const outputPath = resolve(root, 'local-matrix-result.json')
writeFileSync(outputPath, `${JSON.stringify(aggregate, null, 2)}\n`)
console.log(`PASS R8b local matrix: ${results.length} standard lanes + native quit, ${aggregate.totalBehaviorRows} causal rows, 0 page errors`)
