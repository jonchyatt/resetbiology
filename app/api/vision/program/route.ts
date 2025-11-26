import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { visionMasterProgram, getTodaySession } from '@/data/visionProtocols'
import { visionExerciseMap } from '@/data/visionExercises'

// GET: Get user's program enrollment and today's session
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or check enrollment
    const enrollment = await prisma.visionProgramEnrollment.findUnique({
      where: { userId: user.id },
      include: {
        dailySessions: {
          orderBy: { completedAt: 'desc' },
          take: 10
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

    // Calculate today's session based on enrollment start date
    const today = getTodaySession(new Date(enrollment.startDate))
    const weekPlan = visionMasterProgram.weeklyPlans[today.week - 1]

    // Get exercise details for today's session
    let exerciseDetails = null
    if (today.session) {
      exerciseDetails = today.session.exerciseIds.map(id => visionExerciseMap[id]).filter(Boolean)
    }

    // Check if today's session is already completed
    const todayLocalDate = new Date().toISOString().split('T')[0]
    const todayCompleted = enrollment.dailySessions.some(
      s => s.localDate === todayLocalDate && s.week === today.week && s.day === today.day
    )

    return NextResponse.json({
      success: true,
      enrolled: true,
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

    const body = await req.json()
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
          programId: 'screenfit-12week',
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

    if (action === 'complete_session') {
      // Get enrollment
      const enrollment = await prisma.visionProgramEnrollment.findUnique({
        where: { userId: user.id }
      })

      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in program' }, { status: 400 })
      }

      const { week, day, baselineMinutes, exerciseMinutes, exercisesCompleted, nearSnellenResult, farSnellenResult, notes } = data

      // Check if session already completed today
      const todayLocalDate = new Date().toISOString().split('T')[0]
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
          baselineMinutes: baselineMinutes || 0,
          exerciseMinutes: exerciseMinutes || 0,
          totalMinutes: (baselineMinutes || 0) + (exerciseMinutes || 0),
          exercisesCompleted: exercisesCompleted || [],
          nearSnellenResult,
          farSnellenResult,
          notes,
          localDate: todayLocalDate
        }
      })

      // Calculate streak
      let newStreakDays = enrollment.streakDays
      const lastSession = enrollment.lastSessionDate
      if (lastSession) {
        const lastDate = new Date(lastSession).toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
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
          totalPracticeMinutes: enrollment.totalPracticeMinutes + (baselineMinutes || 0) + (exerciseMinutes || 0),
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

      // Award gamification points
      let pointsAwarded = 25 // Base points for completing session
      if (week === 2 && day === 5) pointsAwarded += 50 // Phase 1 bonus
      if (week === 4 && day === 5) pointsAwarded += 75 // Phase 2 bonus
      if (week === 6 && day === 5) pointsAwarded += 100 // Phase 3 bonus
      if (week === 8 && day === 5) pointsAwarded += 125 // Phase 4 bonus
      if (week === 10 && day === 5) pointsAwarded += 150 // Phase 5 bonus
      if (week === 12 && day === 5) pointsAwarded += 500 // Graduation bonus!

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

    const body = await req.json()
    const { action, data } = body

    const enrollment = await prisma.visionProgramEnrollment.findUnique({
      where: { userId: user.id }
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

    if (action === 'update_baselines') {
      await prisma.visionProgramEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentNearSnellen: data?.nearSnellen || enrollment.currentNearSnellen,
          currentFarSnellen: data?.farSnellen || enrollment.currentFarSnellen,
          currentNearPointCm: data?.nearPointCm || enrollment.currentNearPointCm,
          currentReaderStage: data?.readerStage ?? enrollment.currentReaderStage
        }
      })
      return NextResponse.json({ success: true, message: 'Baselines updated' })
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
