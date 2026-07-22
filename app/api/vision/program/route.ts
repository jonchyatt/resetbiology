import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { visionMasterProgram } from '@/data/visionProtocols'
import { visionExerciseMap } from '@/data/visionExercises'
import { parseEngineResults, performanceBonusFor } from '@/lib/vision/engineResultsPayload'
import {
  isVisionSessionCompleteForDay,
  previousVisionDayKey,
  validateVisionLocalDayInput,
  visionProgramSessionForLocalDay,
} from '@/lib/vision/localDayInput'
import { localDayKey } from '@/lib/localDay'

// Tester allowlist for the "rip through the program" traversal bypass.
// Gates isTester payload flag + the advance_day/reset_test_cursor PATCH actions.
const TESTER_EMAILS = ['jonchyatt@gmail.com', 'drmccrna@gmail.com']

function invalidLocalDay(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function invalidJson() {
  return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
}

async function parseRequestJson(req: NextRequest): Promise<{ ok: true; body: any } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() }
  } catch {
    return { ok: false }
  }
}

// GET: Get user's program enrollment and today's session
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const localDay = validateVisionLocalDayInput({
      localDate: req.nextUrl.searchParams.get('localDate'),
      timeZone: req.nextUrl.searchParams.get('timeZone'),
    })
    if (!localDay.ok) return invalidLocalDay(localDay.error)

    // Get or check enrollment
    const enrollment = await prisma.visionProgramEnrollment.findUnique({
      where: { userId: user.id },
      include: {
        dailySessions: {
          orderBy: [{ week: 'asc' }, { day: 'asc' }]
        }
      }
    })

    if (!enrollment) {
      // User not enrolled - return program info for enrollment
      return NextResponse.json({
        success: true,
        enrolled: false,
        program: {
          id: visionMasterProgram.id,
          name: visionMasterProgram.name,
          totalWeeks: visionMasterProgram.totalWeeks,
          description: visionMasterProgram.description,
          phases: [
            { name: 'Foundation', weeks: '1-2', focus: 'Baseline & habits' },
            { name: 'Integration', weeks: '3-4', focus: 'Peripheral & movement' },
            { name: 'Speed & Resilience', weeks: '5-6', focus: 'Saccades & endurance' },
            { name: 'Advanced', weeks: '7-8', focus: 'Peak performance' },
            { name: 'Distance Mastery', weeks: '9-10', focus: 'Far vision & range' },
            { name: 'Integration & Maintenance', weeks: '11-12', focus: 'Graduation' }
          ]
        }
      })
    }

    const isTester = TESTER_EMAILS.includes(user.email ?? '')

    // Calculate today's session based on enrollment start date (shifted by the
    // tester traversal cursor, if any).
    const today = visionProgramSessionForLocalDay(
      enrollment,
      localDay.value.localDate,
      localDay.value.timeZone,
    )
    const weekPlan = visionMasterProgram.weeklyPlans[today.week - 1]

    // Get exercise details for today's session
    let exerciseDetails = null
    if (today.session) {
      exerciseDetails = today.session.exerciseIds.map(id => visionExerciseMap[id]).filter(Boolean)
    }

    // Check if today's session is already completed
    const todayLocalDate = localDay.value.localDate
    const todayCompleted = isVisionSessionCompleteForDay(
      enrollment.dailySessions,
      todayLocalDate,
      today.week,
      today.day,
    )

    return NextResponse.json({
      success: true,
      enrolled: true,
      isTester,
      enrollment: {
        id: enrollment.id,
        startDate: enrollment.startDate,
        currentWeek: today.week,
        currentDay: today.day,
        status: enrollment.status,
        sessionsCompleted: enrollment.sessionsCompleted,
        totalPracticeMinutes: enrollment.totalPracticeMinutes,
        streakDays: enrollment.streakDays,
        longestStreak: enrollment.longestStreak,
        lastSessionDate: enrollment.lastSessionDate,
        currentReaderStage: enrollment.currentReaderStage,
        initialNearSnellen: enrollment.initialNearSnellen,
        initialFarSnellen: enrollment.initialFarSnellen,
        currentNearSnellen: enrollment.currentNearSnellen,
        currentFarSnellen: enrollment.currentFarSnellen,
        phaseProgress: {
          phase1: enrollment.phase1Complete,
          phase2: enrollment.phase2Complete,
          phase3: enrollment.phase3Complete,
          phase4: enrollment.phase4Complete,
          phase5: enrollment.phase5Complete,
          phase6: enrollment.phase6Complete
        }
      },
      todaySession: {
        week: today.week,
        day: today.day,
        isRestDay: today.isRestDay,
        completed: todayCompleted,
        weekTitle: weekPlan?.title || '',
        phase: weekPlan?.phase || '',
        weekGoals: weekPlan?.goals || [],
        weekendRecovery: today.isRestDay ? weekPlan?.weekendRecovery : null,
        session: today.session ? {
          ...today.session,
          exercises: exerciseDetails,
          totalMinutes: today.session.baselineMinutes + today.session.exerciseMinutes
        } : null
      },
      recentSessions: enrollment.dailySessions
    })

  } catch (error) {
    console.error('GET /api/vision/program error:', error)
    return NextResponse.json({
      error: 'Failed to load vision program',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Enroll in program or complete a session
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await parseRequestJson(req)
    if (!parsed.ok) return invalidJson()
    const body = parsed.body
    const localDay = validateVisionLocalDayInput(body)
    if (!localDay.ok) return invalidLocalDay(localDay.error)
    const { action, data } = body

    if (action === 'enroll') {
      // Check if already enrolled
      const existing = await prisma.visionProgramEnrollment.findUnique({
        where: { userId: user.id }
      })

      if (existing) {
        return NextResponse.json({ error: 'Already enrolled in program' }, { status: 400 })
      }

      // Create enrollment
      const enrollment = await prisma.visionProgramEnrollment.create({
        data: {
          userId: user.id,
          programId: 'vision-12week',
          startDate: new Date(),
          initialNearSnellen: data?.initialNearSnellen || null,
          initialFarSnellen: data?.initialFarSnellen || null,
          initialNearPointCm: data?.initialNearPointCm || null
        }
      })

      // Award gamification points for enrolling
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'vision_program_enrolled',
          amount: 100,
          activitySource: 'Enrolled in 12-week Vision Recovery Program'
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Successfully enrolled in Vision Recovery Program',
        enrollment,
        pointsAwarded: 100
      })
    }

    if (action === 'complete_past_session') {
      // Allow marking a past session as complete (for catching up)
      const enrollment = await prisma.visionProgramEnrollment.findUnique({
        where: { userId: user.id }
      })

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in program' }, { status: 400 })
      }

      const { week, day } = data

      // Check if session already exists for this week/day
      const existingSession = await prisma.visionDailySession.findFirst({
        where: {
          enrollmentId: enrollment.id,
          week,
          day
        }
      })

      if (existingSession) {
        return NextResponse.json({ error: 'Session already completed for this week/day' }, { status: 400 })
      }

      // Get session title from program
      const weekPlan = visionMasterProgram.weeklyPlans[week - 1]
      const sessionData = weekPlan?.sessions.find(s => s.day === day)

      if (!sessionData) {
        return NextResponse.json({ error: 'Invalid week/day combination' }, { status: 400 })
      }

      // Create the past session record
      const dailySession = await prisma.visionDailySession.create({
        data: {
          enrollmentId: enrollment.id,
          userId: user.id,
          week,
          day,
          sessionTitle: sessionData.title,
          baselineMinutes: sessionData.baselineMinutes,
          exerciseMinutes: sessionData.exerciseMinutes,
          breathWarmupMinutes: 0,
          totalMinutes: sessionData.baselineMinutes + sessionData.exerciseMinutes,
          exercisesCompleted: sessionData.exerciseIds,
          localDate: localDay.value.localDate,
          notes: 'Marked as complete retroactively'
        }
      })

      // Update enrollment stats
      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          sessionsCompleted: enrollment.sessionsCompleted + 1,
          totalPracticeMinutes: enrollment.totalPracticeMinutes + sessionData.baselineMinutes + sessionData.exerciseMinutes
        }
      })

      // Award reduced points for retroactive completion (15 instead of 25)
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'vision_session_completed',
          amount: 15,
          activitySource: `Marked ${sessionData.title} complete (Week ${week} Day ${day})`
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Past session marked as complete',
        dailySession,
        pointsAwarded: 15
      })
    }

    if (action === 'complete_session') {
      // Get enrollment
      const enrollment = await prisma.visionProgramEnrollment.findUnique({
        where: { userId: user.id }
      })

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in program' }, { status: 400 })
      }

      const { week, day, baselineMinutes, exerciseMinutes, breathWarmupMinutes, exercisesCompleted, nearSnellenResult, farSnellenResult, notes } = data
      const completedBaselineMinutes = baselineMinutes || 0
      const completedExerciseMinutes = exerciseMinutes || 0
      const completedBreathWarmupMinutes = Math.max(0, Math.min(3, Number(breathWarmupMinutes) || 0))

      // Optional guided-runner engine results (additive; training-performance proxies)
      const engineResults = data.engineResults === undefined
        ? undefined
        : parseEngineResults(data.engineResults)
      if (engineResults === null) {
        return NextResponse.json({
          error: 'engineResults must be an array of valid engine result objects'
        }, { status: 400 })
      }
      const performanceBonus = performanceBonusFor(engineResults)

      // Check if session already completed today
      const todayLocalDate = localDay.value.localDate
      const existingSession = await prisma.visionDailySession.findFirst({
        where: {
          enrollmentId: enrollment.id,
          week,
          day,
          localDate: todayLocalDate
        }
      })

      if (existingSession) {
        return NextResponse.json({ error: 'Session already completed today' }, { status: 400 })
      }

      // Get session title from program
      const weekPlan = visionMasterProgram.weeklyPlans[week - 1]
      const sessionData = weekPlan?.sessions.find(s => s.day === day)

      // Create daily session record
      const dailySession = await prisma.visionDailySession.create({
        data: {
          enrollmentId: enrollment.id,
          userId: user.id,
          week,
          day,
          sessionTitle: sessionData?.title || `Week ${week} Day ${day}`,
          baselineMinutes: completedBaselineMinutes,
          exerciseMinutes: completedExerciseMinutes,
          breathWarmupMinutes: completedBreathWarmupMinutes,
          totalMinutes: completedBaselineMinutes + completedExerciseMinutes + completedBreathWarmupMinutes,
          exercisesCompleted: exercisesCompleted || [],
          nearSnellenResult,
          farSnellenResult,
          notes,
          localDate: todayLocalDate
        }
      })

      // MongoDB is schemaless; persist the additive engine-results payload on the
      // created document without touching typed legacy fields (same pattern as
      // /api/vision/sessions).
      if (engineResults !== undefined) {
        await prisma.$runCommandRaw({
          update: 'vision_daily_sessions',
          updates: [{
            q: { _id: { $oid: dailySession.id } },
            u: { $set: { engineResults } }
          }]
        })
      }

      // Calculate streak
      let newStreakDays = enrollment.streakDays
      const lastSession = enrollment.lastSessionDate
      if (lastSession) {
        const lastDate = localDayKey(new Date(lastSession), localDay.value.timeZone)
        const yesterday = previousVisionDayKey(todayLocalDate)
        if (lastDate === yesterday) {
          newStreakDays += 1
        } else if (lastDate !== todayLocalDate) {
          newStreakDays = 1 // Reset streak
        }
      } else {
        newStreakDays = 1
      }

      // Determine phase completion
      const phaseUpdates: any = {}
      if (week === 2 && day === 5) phaseUpdates.phase1Complete = true
      if (week === 4 && day === 5) phaseUpdates.phase2Complete = true
      if (week === 6 && day === 5) phaseUpdates.phase3Complete = true
      if (week === 8 && day === 5) phaseUpdates.phase4Complete = true
      if (week === 10 && day === 5) phaseUpdates.phase5Complete = true
      if (week === 12 && day === 5) {
        phaseUpdates.phase6Complete = true
        phaseUpdates.status = 'completed'
        phaseUpdates.completedAt = new Date()
      }

      // Update enrollment
      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          sessionsCompleted: enrollment.sessionsCompleted + 1,
          totalPracticeMinutes: enrollment.totalPracticeMinutes + completedBaselineMinutes + completedExerciseMinutes + completedBreathWarmupMinutes,
          streakDays: newStreakDays,
          longestStreak: Math.max(enrollment.longestStreak, newStreakDays),
          lastSessionDate: new Date(),
          currentWeek: week,
          currentDay: day,
          currentNearSnellen: nearSnellenResult || enrollment.currentNearSnellen,
          currentFarSnellen: farSnellenResult || enrollment.currentFarSnellen,
          ...phaseUpdates
        }
      })

      // Award gamification points (completion points are the floor;
      // measured performance from the guided runner stacks on top)
      let pointsAwarded = 25 // Base points for completing session
      if (week === 2 && day === 5) pointsAwarded += 50 // Phase 1 bonus
      if (week === 4 && day === 5) pointsAwarded += 75 // Phase 2 bonus
      if (week === 6 && day === 5) pointsAwarded += 100 // Phase 3 bonus
      if (week === 8 && day === 5) pointsAwarded += 125 // Phase 4 bonus
      if (week === 10 && day === 5) pointsAwarded += 150 // Phase 5 bonus
      if (week === 12 && day === 5) pointsAwarded += 500 // Graduation bonus!
      pointsAwarded += performanceBonus

      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'vision_session_completed',
          amount: pointsAwarded,
          activitySource: `Completed ${sessionData?.title || 'Vision Session'} - Week ${week} Day ${day}`
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Session completed!',
        dailySession,
        pointsAwarded,
        performanceBonus,
        newStreak: newStreakDays,
        phaseCompleted: Object.keys(phaseUpdates).length > 0 ? phaseUpdates : null
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('POST /api/vision/program error:', error)
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update enrollment (pause, resume, update baselines)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await parseRequestJson(req)
    if (!parsed.ok) return invalidJson()
    const body = parsed.body
    const localDay = validateVisionLocalDayInput(body)
    if (!localDay.ok) return invalidLocalDay(localDay.error)
    const { action, data } = body

    const enrollment = await prisma.visionProgramEnrollment.findUnique({
      where: { userId: user.id },
      include: { dailySessions: true }
    })

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in program' }, { status: 404 })
    }

    if (action === 'pause') {
      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'paused',
          pausedAt: new Date()
        }
      })
      return NextResponse.json({ success: true, message: 'Program paused' })
    }

    if (action === 'resume') {
      // Calculate new start date to maintain week/day position
      const pausedAt = enrollment.pausedAt || new Date()
      const pauseDuration = Date.now() - new Date(pausedAt).getTime()
      const newStartDate = new Date(new Date(enrollment.startDate).getTime() + pauseDuration)

      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'active',
          startDate: newStartDate,
          pausedAt: null
        }
      })
      return NextResponse.json({ success: true, message: 'Program resumed' })
    }

    if (action === 'reset_program') {
      // Full reset: delete all daily-session history for this enrollment, then the
      // enrollment itself, returning the user to the pre-enrollment state so they
      // can enroll again and start Week 1 Day 1 fresh. Additive-only doctrine (§4.7)
      // covers new fields/tables, not a user-requested reset of their own data.
      await prisma.visionDailySession.deleteMany({
        where: { enrollmentId: enrollment.id }
      })
      await prisma.visionProgramEnrollment.delete({
        where: { id: enrollment.id }
      })
      return NextResponse.json({ success: true, message: 'Program reset — ready to start over' })
    }

    if (action === 'update_baselines') {
      // Additive: a user's FIRST measurement (e.g. Day-1 guided quick-check) also
      // becomes the baseline if one was never recorded — initial*Snellen otherwise
      // stays null forever for anyone who skipped the optional enroll-time baseline.
      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentNearSnellen: data?.nearSnellen || enrollment.currentNearSnellen,
          currentFarSnellen: data?.farSnellen || enrollment.currentFarSnellen,
          currentNearPointCm: data?.nearPointCm || enrollment.currentNearPointCm,
          currentReaderStage: data?.readerStage ?? enrollment.currentReaderStage,
          initialNearSnellen: enrollment.initialNearSnellen ?? (data?.nearSnellen || null),
          initialFarSnellen: enrollment.initialFarSnellen ?? (data?.farSnellen || null)
        }
      })
      return NextResponse.json({ success: true, message: 'Baselines updated' })
    }

    if (action === 'advance_day' || action === 'reset_test_cursor') {
      // Tester-only traversal bypass so an allowlisted tester can rip through
      // the 12-week program day-by-day without waiting on the real calendar.
      if (!TESTER_EMAILS.includes(user.email ?? '')) {
        return NextResponse.json({ error: 'Tester access required' }, { status: 403 })
      }

      if (action === 'reset_test_cursor') {
        // Exact restore of real-calendar state — non-destructive, unlike reset_program.
        await prisma.visionProgramEnrollment.update({
          where: { id: enrollment.id },
          data: { testDayOffset: null }
        })
        return NextResponse.json({ success: true, message: 'Test cursor reset' })
      }

      // advance_day: double-tap/serialization guard — only advance once the
      // CURRENT effective day is finished (a completed session or a rest day).
      const today = visionProgramSessionForLocalDay(
        enrollment,
        localDay.value.localDate,
        localDay.value.timeZone,
      )
      const todayDone = today.isRestDay || enrollment.dailySessions.some(
        s => s.week === today.week && s.day === today.day
      )
      if (!todayDone) {
        return NextResponse.json({ error: 'finish today first' }, { status: 409 })
      }

      // Advance the cursor one day at a time, skipping rest days (max 3 total
      // increments per Sol H1) so the tester always lands on a trainable
      // session or the program-complete terminal state.
      let offset = (enrollment.testDayOffset ?? 0) + 1
      let next = visionProgramSessionForLocalDay(
        { startDate: enrollment.startDate, testDayOffset: offset },
        localDay.value.localDate,
        localDay.value.timeZone,
      )
      let advances = 1
      while (next.isRestDay && advances < 3) {
        offset += 1
        next = visionProgramSessionForLocalDay(
          { startDate: enrollment.startDate, testDayOffset: offset },
          localDay.value.localDate,
          localDay.value.timeZone,
        )
        advances += 1
      }

      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: { testDayOffset: offset }
      })

      return NextResponse.json({
        success: true,
        week: next.week,
        day: next.day,
        isRestDay: next.isRestDay,
        testDayOffset: offset
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('PATCH /api/vision/program error:', error)
    return NextResponse.json({
      error: 'Failed to update program',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
