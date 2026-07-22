import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isValidVisionDayKey } from '@/lib/vision/localDayInput'

export const VISION_PROGRAM_ENROLLMENT_POINTS = 100
export const VISION_PROGRAM_RETRO_SESSION_POINTS = 15
export const VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS = 25
export const VISION_PROGRAM_PHASE_1_BONUS = 50
export const VISION_PROGRAM_PHASE_2_BONUS = 75
export const VISION_PROGRAM_PHASE_3_BONUS = 100
export const VISION_PROGRAM_PHASE_4_BONUS = 125
export const VISION_PROGRAM_PHASE_5_BONUS = 150
export const VISION_PROGRAM_GRADUATION_BONUS = 500
export const VISION_FREE_TRAINING_ATTEMPT_POINTS = 15
export const VISION_FREE_TRAINING_SUCCESS_POINTS = 30

// Reserved for a separately approved product moment; this award helper only
// preserves existing ledger behavior.
export const VISION_NEW_REWARD_MOMENTS_ENABLED = false

type VisionPointsClient = Pick<typeof prisma, '$transaction'>

export type VisionAwardEvent =
  | { userId: string; dayKey: string; awardType: 'vision_program_enrollment' }
  | {
      userId: string
      dayKey: string
      awardType: 'vision_program_retro_session'
      sessionTitle: string
      week: number
      day: number
    }
  | {
      userId: string
      dayKey: string
      awardType: 'vision_program_current_session'
      sessionTitle: string
      week: number
      day: number
      performanceBonus: number
    }
  | {
      userId: string
      dayKey: string
      awardType: 'vision_free_training_session'
      visionType: string
      success: boolean
      performanceBonus: number
    }

function isDailyAwardUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }

  const target = (error.meta as { target?: unknown } | undefined)?.target
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : []
  return ['userId', 'dayKey', 'awardType'].every(field => fields.some(value => value.includes(field)))
}

function phaseBonusFor(week: number, day: number): number {
  if (day !== 5) return 0
  if (week === 2) return VISION_PROGRAM_PHASE_1_BONUS
  if (week === 4) return VISION_PROGRAM_PHASE_2_BONUS
  if (week === 6) return VISION_PROGRAM_PHASE_3_BONUS
  if (week === 8) return VISION_PROGRAM_PHASE_4_BONUS
  if (week === 10) return VISION_PROGRAM_PHASE_5_BONUS
  if (week === 12) return VISION_PROGRAM_GRADUATION_BONUS
  return 0
}

function awardDetails(event: VisionAwardEvent): Pick<Prisma.GamificationPointCreateInput, 'pointType' | 'amount' | 'activitySource'> {
  switch (event.awardType) {
    case 'vision_program_enrollment':
      return {
        pointType: 'vision_program_enrolled',
        amount: VISION_PROGRAM_ENROLLMENT_POINTS,
        activitySource: 'Enrolled in 12-week Vision Recovery Program',
      }
    case 'vision_program_retro_session':
      return {
        pointType: 'vision_session_completed',
        amount: VISION_PROGRAM_RETRO_SESSION_POINTS,
        activitySource: `Marked ${event.sessionTitle} complete (Week ${event.week} Day ${event.day})`,
      }
    case 'vision_program_current_session':
      return {
        pointType: 'vision_session_completed',
        amount: VISION_PROGRAM_CURRENT_SESSION_BASE_POINTS + phaseBonusFor(event.week, event.day) + event.performanceBonus,
        activitySource: `Completed ${event.sessionTitle} - Week ${event.week} Day ${event.day}`,
      }
    case 'vision_free_training_session':
      return {
        pointType: 'vision_training',
        amount: (event.success ? VISION_FREE_TRAINING_SUCCESS_POINTS : VISION_FREE_TRAINING_ATTEMPT_POINTS) + event.performanceBonus,
        activitySource: `Vision training session: ${event.visionType}`,
      }
  }
}

/** Atomically grant one existing Vision award category for a member-local day. */
export async function awardVisionPoints(
  event: VisionAwardEvent,
  client: VisionPointsClient = prisma,
): Promise<{ awarded: boolean; points: number; dayKey: string }> {
  if (!isValidVisionDayKey(event.dayKey)) {
    throw new RangeError('Vision awards require a real YYYY-MM-DD member-local day key')
  }

  const details = awardDetails(event)
  try {
    await client.$transaction(async tx => {
      await tx.dailyAward.create({
        data: { userId: event.userId, dayKey: event.dayKey, awardType: event.awardType },
      })
      await tx.gamificationPoint.create({
        data: { userId: event.userId, ...details },
      })
    })
    return { awarded: true, points: details.amount, dayKey: event.dayKey }
  } catch (error) {
    if (isDailyAwardUniqueViolation(error)) {
      return { awarded: false, points: 0, dayKey: event.dayKey }
    }
    throw error
  }
}
