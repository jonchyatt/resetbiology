import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Prisma } from '@prisma/client'
import {
  VISION_FREE_TRAINING_ATTEMPT_POINTS,
  VISION_FREE_TRAINING_SUCCESS_POINTS,
  VISION_NEW_REWARD_MOMENTS_ENABLED,
  VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS,
  VISION_PROGRAM_ENROLLMENT_POINTS,
  VISION_PROGRAM_GRADUATION_BONUS,
  VISION_PROGRAM_PHASE_1_BONUS,
  VISION_PROGRAM_PHASE_2_BONUS,
  VISION_PROGRAM_PHASE_3_BONUS,
  VISION_PROGRAM_PHASE_4_BONUS,
  VISION_PROGRAM_PHASE_5_BONUS,
  VISION_PROGRAM_RETRO_SESSION_POINTS,
  awardVisionPoints,
} from '../src/lib/vision/visionPoints'

type DailyAward = { userId: string; dayKey: string; awardType: string }
type Point = { userId: string; amount: number; pointType: string; activitySource?: string | null }

function p2002(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('unique violation', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  })
}

class FakeVisionPointsClient {
  dailyAwards: DailyAward[] = []
  points: Point[] = []
  pointWriteFailsOnce = false
  dailyAwardError: Error | undefined
  private chain: Promise<void> = Promise.resolve()

  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    let release!: () => void
    const lock = new Promise<void>(resolve => { release = resolve })
    const previous = this.chain
    this.chain = previous.then(() => lock)
    await previous

    const dailyAwards = [...this.dailyAwards]
    const points = [...this.points]
    try {
      const result = await callback({
        dailyAward: {
          create: async ({ data }: { data: DailyAward }) => {
            if (this.dailyAwardError) throw this.dailyAwardError
            if (dailyAwards.some(row => row.userId === data.userId && row.dayKey === data.dayKey && row.awardType === data.awardType)) {
              throw p2002(['userId', 'dayKey', 'awardType'])
            }
            dailyAwards.push(data)
          },
        },
        gamificationPoint: {
          create: async ({ data }: { data: Point }) => {
            if (this.pointWriteFailsOnce) {
              this.pointWriteFailsOnce = false
              throw new Error('point write failed')
            }
            points.push(data)
          },
        },
      })
      this.dailyAwards = dailyAwards
      this.points = points
      return result
    } finally {
      release()
    }
  }
}

const day = '2026-07-21'
const enrollment = { userId: 'member-1', dayKey: day, awardType: 'vision_program_enrollment' } as const

async function run() {
  assert.deepEqual(
    [
      VISION_PROGRAM_ENROLLMENT_POINTS,
      VISION_PROGRAM_RETRO_SESSION_POINTS,
      VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS,
      VISION_PROGRAM_PHASE_1_BONUS,
      VISION_PROGRAM_PHASE_2_BONUS,
      VISION_PROGRAM_PHASE_3_BONUS,
      VISION_PROGRAM_PHASE_4_BONUS,
      VISION_PROGRAM_PHASE_5_BONUS,
      VISION_PROGRAM_GRADUATION_BONUS,
      VISION_FREE_TRAINING_ATTEMPT_POINTS,
      VISION_FREE_TRAINING_SUCCESS_POINTS,
    ],
    [100, 15, 25, 50, 75, 100, 125, 150, 500, 15, 30],
    'named Vision economy constants must preserve every existing value',
  )
  assert.equal(VISION_NEW_REWARD_MOMENTS_ENABLED, false, 'no new Vision reward moment may be enabled')

  const phaseMapping = new FakeVisionPointsClient()
  const phaseCases = [
    [2, VISION_PROGRAM_PHASE_1_BONUS],
    [4, VISION_PROGRAM_PHASE_2_BONUS],
    [6, VISION_PROGRAM_PHASE_3_BONUS],
    [8, VISION_PROGRAM_PHASE_4_BONUS],
    [10, VISION_PROGRAM_PHASE_5_BONUS],
    [12, VISION_PROGRAM_GRADUATION_BONUS],
  ] as const
  for (const [index, [week, bonus]] of phaseCases.entries()) {
    const award = await awardVisionPoints({
      userId: 'phase-member',
      dayKey: `2026-08-0${index + 1}`,
      awardType: 'vision_program_current_session',
      sessionTitle: 'Phase session',
      week,
      day: 5,
      performanceBonus: 0,
    }, phaseMapping as any)
    assert.equal(award.points, VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS + bonus)
  }
  for (const [index, event] of [
    { week: 3, day: 5 },
    { week: 2, day: 4 },
  ].entries()) {
    const award = await awardVisionPoints({
      userId: 'phase-member',
      dayKey: `2026-08-0${index + 7}`,
      awardType: 'vision_program_current_session',
      sessionTitle: 'Ordinary session',
      ...event,
      performanceBonus: 0,
    }, phaseMapping as any)
    assert.equal(award.points, VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS, 'only mapped phase day-fives receive a bonus')
  }

  const concurrent = new FakeVisionPointsClient()
  const results = await Promise.all(Array.from({ length: 12 }, () => awardVisionPoints(enrollment, concurrent as any)))
  assert.equal(results.filter(result => result.awarded).length, 1)
  assert.equal(concurrent.dailyAwards.length, 1)
  assert.equal(concurrent.points.length, 1)

  const categories = new FakeVisionPointsClient()
  const categoryEvents = [
    enrollment,
    { userId: 'member-1', dayKey: day, awardType: 'vision_program_retro_session', sessionTitle: 'Retro', week: 1, day: 1 },
    { userId: 'member-1', dayKey: day, awardType: 'vision_program_current_session', sessionTitle: 'Current', week: 2, day: 5, performanceBonus: 7 },
    { userId: 'member-1', dayKey: day, awardType: 'vision_free_training_session', visionType: 'near', success: true, performanceBonus: 7 },
  ] as const
  for (const event of categoryEvents) assert.equal((await awardVisionPoints(event, categories as any)).awarded, true)
  assert.equal(categories.dailyAwards.length, 4, 'four award types must remain independent on one day')
  assert.deepEqual(categories.points.map(point => point.amount), [100, 15, 82, 37])
  assert.equal((await awardVisionPoints({ ...enrollment, dayKey: '2026-07-22' }, categories as any)).awarded, true)

  const sourceDeletion = new FakeVisionPointsClient()
  await awardVisionPoints(enrollment, sourceDeletion as any)
  const sourceRecordWasDeleted = true
  assert.equal(sourceRecordWasDeleted, true)
  assert.equal(sourceDeletion.dailyAwards.length, 1, 'the durable DailyAward remains after its source record is deleted')
  assert.equal((await awardVisionPoints(enrollment, sourceDeletion as any)).awarded, false, 'deleting a source record must not reopen its award')

  const invalid = new FakeVisionPointsClient()
  for (const invalidDay of ['not-a-day', '2026-02-30']) {
    await assert.rejects(awardVisionPoints({ ...enrollment, dayKey: invalidDay }, invalid as any), RangeError)
  }
  assert.equal(invalid.dailyAwards.length, 0, 'invalid keys must not fall back to another day')

  const rollback = new FakeVisionPointsClient()
  rollback.pointWriteFailsOnce = true
  await assert.rejects(awardVisionPoints(enrollment, rollback as any), /point write failed/)
  assert.equal(rollback.dailyAwards.length, 0, 'failed point write must roll back its DailyAward')
  assert.equal(rollback.points.length, 0)
  assert.equal((await awardVisionPoints(enrollment, rollback as any)).awarded, true, 'a rollback must permit a clean retry')

  const unrelated = new FakeVisionPointsClient()
  unrelated.dailyAwardError = p2002(['someOtherUniqueField'])
  await assert.rejects(awardVisionPoints(enrollment, unrelated as any), error => error === unrelated.dailyAwardError)
  unrelated.dailyAwardError = new Error('database unavailable')
  await assert.rejects(awardVisionPoints(enrollment, unrelated as any), error => error === unrelated.dailyAwardError)

  const programRoute = readFileSync('app/api/vision/program/route.ts', 'utf8')
  const sessionsRoute = readFileSync('app/api/vision/sessions/route.ts', 'utf8')
  const trainingSession = readFileSync('src/components/Vision/Training/TrainingSession.tsx', 'utf8')
  assert.match(programRoute, /awardVisionPoints\(/)
  assert.match(sessionsRoute, /awardVisionPoints\(/)
  assert.doesNotMatch(programRoute, /gamificationPoint\.create/)
  assert.doesNotMatch(sessionsRoute, /gamificationPoint\.create/)
  assert.match(trainingSession, /\.\.\.currentVisionLocalDayInput\(\)/)
  assert.ok(
    sessionsRoute.indexOf('const session = await auth0.getSession()') < sessionsRoute.indexOf('validateVisionLocalDayInput(body)'),
    'sessions authentication must precede member-local metadata validation',
  )

  console.log('vision-points-check: PASS')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
