import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_PRESENTATION_JOURNEY_KEY,
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const order = ['D4', 'E4', 'C4', 'F4']
const rangeAssessedAt = '2026-07-20T18:00:00.000Z'
const journey = createPitchforksPresentationJourney({
  rangeAssessedAt,
  unlockedNotes: order.slice(0, 3),
  guidedNotes: order.slice(0, 2),
  startedAt: '2026-07-20T19:00:00.000Z',
})

check(() => assert.equal(PITCHFORKS_PRESENTATION_JOURNEY_KEY, 'pitchforks3_presentation_journey_v1'))
check(() => assert.deepEqual(journey, {
  version: 1,
  rangeAssessedAt,
  startedAt: '2026-07-20T19:00:00.000Z',
  unlockedNotes: ['D4', 'E4', 'C4'],
  guidedNotes: ['D4', 'E4'],
}))
check(() => assert.deepEqual(
  parsePitchforksPresentationJourney(JSON.stringify(journey), rangeAssessedAt, order),
  journey,
))
check(() => assert.equal(
  parsePitchforksPresentationJourney(JSON.stringify(journey), '2026-07-20T20:00:00.000Z', order),
  null,
))
check(() => assert.equal(
  parsePitchforksPresentationJourney(JSON.stringify({ ...journey, unlockedNotes: ['D4', 'C4'] }), rangeAssessedAt, order),
  null,
))
check(() => assert.equal(
  parsePitchforksPresentationJourney(JSON.stringify({ ...journey, unlockedNotes: ['D4'] }), rangeAssessedAt, order),
  null,
))
check(() => assert.equal(
  parsePitchforksPresentationJourney(JSON.stringify({ ...journey, guidedNotes: ['F4'] }), rangeAssessedAt, order),
  null,
))
check(() => assert.equal(parsePitchforksPresentationJourney('{bad json', rangeAssessedAt, order), null))

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(component, /PITCHFORKS_PRESENTATION_JOURNEY_KEY/))
check(() => assert.match(component, /parsePitchforksPresentationJourney/))
check(() => assert.match(component, /savePresentationJourney/))
check(() => assert.match(component, /restartNoteJourney/))
check(() => assert.match(component, /data-testid="pf3-restart-journey"/))
check(() => assert.match(component, /data-testid="pf3-restart-journey-confirm"/))
check(() => assert.match(component, /data-testid="pf3-restart-journey-cancel"/))
check(() => assert.match(component, /Your comfortable range, learned-note memory, and long-term practice history stay saved/))
check(() => assert.match(component, /Journey restarted with .*Your range and mastery are safe/))
check(() => assert.doesNotMatch(component, /localStorage\.clear\(/))
check(() => assert.doesNotMatch(component, /localStorage\.removeItem\((?:FSRS_KEY|MASTERY_PROGRESS_KEY|CUE_SUPPORT_KEY|PITCHFORKS_RANGE_PROFILE_KEY)/))

console.log(`pitchforks presentation-reset contract: ${checks}/${checks} PASS`)
