import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  runVisionEnrollmentAttempt,
  visionTrainingFocusCopy,
  VISION_SIGN_IN_URL,
} from '../src/components/Vision/VisionTraining'
import { visionEnrollmentActionLabel } from '../src/components/Vision/Training/FirstSessionPreview'
import { visionPhaseDisplayName } from '../src/components/Vision/Training/CurriculumOverview'
import { visionMasterProgram } from '../src/data/visionProtocols'

type MockResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function response(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

async function attempt(
  request: () => Promise<MockResponse>,
  reconcile: () => Promise<boolean> = async () => true,
) {
  const busyStates: boolean[] = []
  let busy = false
  const result = await runVisionEnrollmentAttempt(
    request,
    value => {
      busy = value
      busyStates.push(value)
    },
    async () => {
      assert.equal(busy, true, 'the control must remain busy while server state is reconciled')
      return reconcile()
    },
  )
  assert.deepEqual(busyStates, [true, false], 'every attempt must re-enable the enrollment control')
  return result
}

async function main() {
  assert.equal(
    VISION_SIGN_IN_URL,
    '/auth/login?returnTo=%2Fvision-training',
    'sign-in must return the member to vision training',
  )
  assert.equal(visionEnrollmentActionLabel(true, false), 'Sign In to Start')
  assert.equal(visionEnrollmentActionLabel(true, true), 'Sign In to Continue')
  assert.equal(visionEnrollmentActionLabel(false, false), 'Start 12-Week Program')
  assert.equal(visionEnrollmentActionLabel(false, true), 'Continue into the Program')
  assert.equal(visionPhaseDisplayName('Distance Mastery'), 'Distance Practice')
  assert.doesNotMatch(visionTrainingFocusCopy('near'), /myopic|nearsighted|cure|restore/i)
  assert.doesNotMatch(visionTrainingFocusCopy('far'), /hyperopic|farsighted|cure|restore/i)

  const structuralProjection = {
    id: visionMasterProgram.id,
    totalWeeks: visionMasterProgram.totalWeeks,
    weeks: visionMasterProgram.weeklyPlans.map(week => ({
      week: week.week,
      phase: week.phase,
      sessions: week.sessions.map(session => ({
        day: session.day,
        baselineMinutes: session.baselineMinutes,
        exerciseMinutes: session.exerciseMinutes,
        exerciseIds: session.exerciseIds,
      })),
    })),
  }
  assert.equal(
    createHash('sha256').update(JSON.stringify(structuralProjection)).digest('hex'),
    '2b93da6db6268e6c304312d95a004fac006785fba9985d75446fd3e5ca7dbcee',
    'honest-copy edits must not change curriculum structure, timing, order, or exercise identity',
  )

  const memberFacingProgramCopy = [
    visionMasterProgram.name,
    visionMasterProgram.description,
    ...visionMasterProgram.weeklyPlans.flatMap(week => [
      week.title,
      ...week.goals,
      ...week.sessions.flatMap(session => [
        session.title,
        session.focus,
        ...session.coachingCues,
      ]),
    ]),
  ].join(' | ')
  for (const banned of [
    /vision recovery program/i,
    /vision restoration/i,
    /lock in gains/i,
    /push far vision limits/i,
    /distance progression with readers/i,
    /reader progression/i,
    /record new far max/i,
    /maximum range test/i,
    /personal best near \+ far/i,
    /near point optimization/i,
    /full spectrum clarity/i,
    /rapid accommodation/i,
  ]) {
    assert.doesNotMatch(memberFacingProgramCopy, banned, `member-facing copy must exclude ${banned}`)
  }

  assert.deepEqual(
    await attempt(async () => response(401, { error: 'Unauthorized' })),
    { kind: 'sign-in' },
    'a signed-out visitor must be routed to sign-in',
  )

  let malformed401BodyRead = false
  assert.deepEqual(
    await attempt(async () => ({
      ok: false,
      status: 401,
      json: async () => {
        malformed401BodyRead = true
        throw new SyntaxError('HTML login response')
      },
    })),
    { kind: 'sign-in' },
    'an empty or malformed 401 must still route to sign-in',
  )
  assert.equal(malformed401BodyRead, false, '401 handling must not depend on parsing its body')

  let successReconciliations = 0
  assert.deepEqual(
    await attempt(
      async () => response(200, { success: true }),
      async () => {
        successReconciliations += 1
        return true
      },
    ),
    { kind: 'enrolled' },
    'a successful enrollment must enter the program',
  )
  assert.equal(successReconciliations, 1, 'success must refresh persisted enrollment state exactly once')

  let existingReconciliations = 0
  assert.deepEqual(
    await attempt(
      async () => response(400, { error: 'Already enrolled in program' }),
      async () => {
        existingReconciliations += 1
        return true
      },
    ),
    { kind: 'already-enrolled' },
    'an already-enrolled response must trigger state reconciliation',
  )
  assert.equal(existingReconciliations, 1, 'already-enrolled must refresh server state exactly once')

  const failedReconciliation = await attempt(
    async () => response(200, { success: true }),
    async () => false,
  )
  assert.equal(failedReconciliation.kind, 'retry', 'a failed state refresh must stay visible and retryable')

  const malformed = await attempt(async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new SyntaxError('invalid JSON') },
  }))
  assert.equal(malformed.kind, 'retry', 'a malformed response must remain retryable')

  const networkFailure = await attempt(async () => {
    throw new Error('offline')
  })
  assert.equal(networkFailure.kind, 'retry', 'a network failure must remain retryable')

  const serverFailure = await attempt(async () => response(503, { error: 'Unavailable' }))
  assert.equal(serverFailure.kind, 'retry', 'a server failure must remain retryable')

  const retrySuccess = await attempt(async () => response(200, { success: true }))
  assert.deepEqual(retrySuccess, { kind: 'enrolled' }, 'a retry must be able to succeed')

  console.log('vision enrollment entry: response matrix, CTA parity, structure, and honest-copy checks passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
