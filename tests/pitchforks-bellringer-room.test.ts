import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  assessPitchforksBossEntry,
  distinctPitchforksAdmittedNotes,
  isPitchforksBossId,
  pitchforksBossEntryCopy,
  selectPitchforksBossSequence,
  PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC,
  PITCHFORKS_BELLRINGER_REST_SRC,
} from '../src/components/PitchDefender/PitchforksIII'

const completeArt = {
  torchmasterChamberPlate: true,
  bellringerChamberPlate: true,
  bellringerRest: true,
} as const

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const chamberViewSource = readFileSync(new URL('../src/components/PitchDefender/PitchforksBossChamberView.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  assert.equal(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC, '/images/pitchforks/village_gate_plate.png')
  assert.equal(PITCHFORKS_BELLRINGER_REST_SRC, '/images/pitchforks/bellringer_rest.png')
  assert.equal(isPitchforksBossId('torchmaster'), true)
  assert.equal(isPitchforksBossId('bellringer'), true)
  assert.equal(isPitchforksBossId('choirmaster'), true)
  assert.equal(isPitchforksBossId('unknown-boss'), false)
  assert.deepEqual(selectPitchforksBossSequence('choirmaster', ['C4', 'A4', 'C4', 'E4']), ['C4', 'A4', 'E4'])
  assert.equal(selectPitchforksBossSequence('unknown-boss', ['C4', 'A4']), null)
  assert.equal(selectPitchforksBossSequence('choirmaster', []), null)
})

check(() => {
  const nonDemo = assessPitchforksBossEntry('bellringer', false, completeArt, ['C4', 'A4'])
  assert.equal(nonDemo.available, false)
  assert.equal(nonDemo.reason, 'demo-only')
  assert.match(pitchforksBossEntryCopy(nonDemo), /private demo only/i)
})

check(() => {
  const missingPlate = assessPitchforksBossEntry('bellringer', true, { ...completeArt, bellringerChamberPlate: false }, ['C4', 'A4'])
  assert.equal(missingPlate.available, false)
  assert.equal(missingPlate.reason, 'missing-art')
  assert.deepEqual(missingPlate.missingAssets, ['chamber-plate'])

  const missingRest = assessPitchforksBossEntry('bellringer', true, { ...completeArt, bellringerRest: false }, ['C4', 'A4'])
  assert.equal(missingRest.available, false)
  assert.equal(missingRest.reason, 'missing-art')
  assert.deepEqual(missingRest.missingAssets, ['rest'])
  assert.match(pitchforksBossEntryCopy(missingRest), /artwork is preparing/i)
})

check(() => {
  const unavailable = assessPitchforksBossEntry('bellringer', true, completeArt, ['C4', 'C4', 'C4'])
  assert.equal(unavailable.available, false)
  assert.equal(unavailable.reason, 'fewer-than-two-notes')
  assert.deepEqual(unavailable.sequence, ['C4'])
  assert.match(pitchforksBossEntryCopy(unavailable), /two distinct admitted notes/i)
})

check(() => {
  const admitted = ['C4', 'C4', 'A4', 'G4', 'A4'] as const
  assert.deepEqual(distinctPitchforksAdmittedNotes(admitted), ['C4', 'A4', 'G4'])
  const bellringer = assessPitchforksBossEntry('bellringer', true, completeArt, admitted)
  assert.equal(bellringer.available, true)
  assert.deepEqual(bellringer.sequence, ['C4', 'A4'])
  assert.deepEqual(selectPitchforksBossSequence('bellringer', admitted), ['C4', 'A4'])
  // Literal octave identity remains visible: C4 and C5 are different notes.
  assert.deepEqual(selectPitchforksBossSequence('bellringer', ['C4', 'C5', 'D4']), ['C4', 'C5'])
  // The whole snapshot is still the controller's admitted arsenal, not a new
  // two-note progression policy (the runtime source assertion below checks the
  // controller call receives `admitted`).
  assert.equal(admitted.length, 5)
})

check(() => {
  // Torchmaster keeps its existing first-two sequence, including duplicate
  // literals; only Bellringer deduplicates its bounded private proof.
  assert.deepEqual(selectPitchforksBossSequence('torchmaster', ['C4', 'C4', 'A4']), ['C4', 'C4'])
  assert.equal(assessPitchforksBossEntry('torchmaster', true, completeArt, ['C4']).available, true)
})

check(() => {
  // Source-contract assertions are intentionally labeled: runtime behavior is
  // exercised by the mounted component/browser gate, not by regex alone.
  assert.match(source, /const beginBossPreview = useCallback\(\(lane: 'voice' \| 'ear', bossId: PitchforksBossId = 'torchmaster'/)
  assert.match(source, /if \(!entry\.available \|\| !entry\.sequence\.length\) return/)
  assert.match(source, /lane, sequence: practiceOnly && bossId !== 'bellringer' \? entry\.sequence : earnedWorld === 'bell-tower'[\s\S]*?: entry\.sequence,\s*admittedNotes: admitted/)
  assert.match(source, /attempt: `\$\{bossId\}:\$\{runGenerationRef\.current\}:\$\{Date\.now\(\)\}`/)
  assert.match(source, /a\.bellringerChamberPlate = await loadImage\(PITCHFORKS_BELLRINGER_CHAMBER_PLATE_SRC\)\.catch\(\(\) => undefined\)/)
  assert.match(source, /a\.bellringerRest = await loadImage\(PITCHFORKS_BELLRINGER_REST_SRC\)\.catch\(\(\) => undefined\)/)
  assert.match(chamberViewSource, /ctx\.drawImage\(assets\.bellringerRest, 540, FRANK_Y, 96, 144\)/)
  assert.match(chamberViewSource, /export function renderBossChamber\(/)
  assert.match(source, /data-testid="pf3-bellringer-enter-voice"/)
  assert.match(source, /BELLRINGER SINGING DEMO/)
  assert.match(source, /data-testid="pf3-bellringer-enter-ear"/)
  assert.match(source, /BELLRINGER LISTEN &amp; CHOOSE/)
  assert.match(source, /TWO-NOTE INTERVAL PRACTICE/)
  assert.match(source, /earnedWorld \|\| practiceWorld \? true : demoRef\.current, \{[\s\S]*bellringerChamberPlate: !!assetsRef\.current\.bellringerChamberPlate/)
})

check(() => {
  // The existing examination-integration AST harness owns earned recital
  // policy. Supporting practice must keep its explicit no-world-award guard.
  const acceptStart = source.indexOf('const acceptBossResult')
  const acceptEnd = source.indexOf('}, [savePresentationJourney])', acceptStart)
  assert.ok(acceptStart >= 0 && acceptEnd > acceptStart)
  const accept = source.slice(acceptStart, acceptEnd)
  assert.match(accept, /if \(\(world === 'bell-tower' \|\| world === 'cathedral'\) && !bossPracticeOnlyRef\.current && journey && range && result\.completed && result\.outcome === 'success'\)/)
  assert.match(source, /bossPracticeOnlyRef\.current = practiceOnly/)
  assert.match(source, /beginBossPreview\('voice', selectedWorld === 'village-gate' \? 'torchmaster' : 'choirmaster', selectedWorld, true\)/)
})

console.log(`pitchforks Bellringer room integration: ${checks}/${checks} PASS (pure entry/sequence behavior + labeled source contract)`)
