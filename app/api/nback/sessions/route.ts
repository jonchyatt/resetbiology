import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { syncUserDataForDate } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper to find user by auth0Sub or email
async function resolveUser(session: any) {
  const authUser = session?.user
  if (!authUser) return null

  let user = authUser.sub
    ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } })
    : null

  if (!user && authUser.email) {
    user = await prisma.user.findUnique({ where: { email: authUser.email } })
    // Auto-link auth0Sub if found by email
    if (user && authUser.sub && user.auth0Sub !== authUser.sub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: authUser.sub }
      })
    }
  }

  return user
}

/**
 * GET /api/nback/sessions
 * Fetch user's N-Back session history
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await resolveUser(session)

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const gameMode = searchParams.get('gameMode') || undefined

    const whereClause: any = { userId: user.id }
    if (gameMode) whereClause.gameMode = gameMode

    const [sessions, total] = await Promise.all([
      prisma.nBackSession.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.nBackSession.count({ where: whereClause })
    ])

    // Calculate stats
    const allSessions = await prisma.nBackSession.findMany({
      where: { userId: user.id },
      select: {
        overallAccuracy: true,
        levelAdvanced: true,
        nLevel: true,
        gameMode: true
      }
    })

    const stats = {
      totalSessions: allSessions.length,
      avgAccuracy: allSessions.length > 0
        ? Math.round(allSessions.reduce((sum, s) => sum + s.overallAccuracy, 0) / allSessions.length)
        : 0,
      advancementRate: allSessions.length > 0
        ? Math.round((allSessions.filter(s => s.levelAdvanced).length / allSessions.length) * 100)
        : 0,
      highestNLevel: allSessions.length > 0
        ? Math.max(...allSessions.map(s => s.nLevel))
        : 2
    }

    return NextResponse.json({
      success: true,
      sessions,
      stats,
      total,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('GET /api/nback/sessions error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/nback/sessions
 * Save a new N-Back training session
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await resolveUser(session)

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      gameMode,
      nLevel,
      totalTrials,
      positionHits,
      positionMisses,
      positionFalse,
      audioHits,
      audioMisses,
      audioFalse,
      letterHits,
      letterMisses,
      letterFalse,
      overallAccuracy,
      positionAccuracy,
      audioAccuracy,
      letterAccuracy,
      durationSeconds,
      levelAdvanced
    } = body

    // Validate required fields
    if (!gameMode || nLevel === undefined || totalTrials === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create session record
    const nbackSession = await prisma.nBackSession.create({
      data: {
        userId: user.id,
        gameMode,
        nLevel,
        totalTrials,
        positionHits: positionHits || 0,
        positionMisses: positionMisses || 0,
        positionFalse: positionFalse || 0,
        audioHits: audioHits || 0,
        audioMisses: audioMisses || 0,
        audioFalse: audioFalse || 0,
        letterHits: gameMode === 'triple' ? (letterHits || 0) : null,
        letterMisses: gameMode === 'triple' ? (letterMisses || 0) : null,
        letterFalse: gameMode === 'triple' ? (letterFalse || 0) : null,
        overallAccuracy: overallAccuracy || 0,
        positionAccuracy: positionAccuracy || 0,
        audioAccuracy: audioAccuracy || 0,
        letterAccuracy: gameMode === 'triple' ? (letterAccuracy || 0) : null,
        durationSeconds: durationSeconds || 0,
        levelAdvanced: levelAdvanced || false
      }
    })

    // Update or create progress record
    const existingProgress = await prisma.nBackProgress.findUnique({
      where: {
        userId_gameMode: {
          userId: user.id,
          gameMode
        }
      }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let newStreakDays = 1
    if (existingProgress?.lastSessionDate) {
      const lastDate = new Date(existingProgress.lastSessionDate)
      lastDate.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        newStreakDays = existingProgress.streakDays // Same day, keep streak
      } else if (diffDays === 1) {
        newStreakDays = existingProgress.streakDays + 1 // Consecutive day
      }
      // Otherwise reset to 1
    }

    if (existingProgress) {
      const newTotalSessions = existingProgress.totalSessions + 1
      const newTotalTrials = existingProgress.totalTrials + totalTrials
      const newAvgAccuracy = (existingProgress.avgAccuracy * existingProgress.totalSessions + overallAccuracy) / newTotalSessions

      await prisma.nBackProgress.update({
        where: { id: existingProgress.id },
        data: {
          currentNLevel: levelAdvanced ? Math.max(existingProgress.currentNLevel, nLevel + 1) : existingProgress.currentNLevel,
          highestNLevel: Math.max(existingProgress.highestNLevel, nLevel),
          bestAccuracy: Math.max(existingProgress.bestAccuracy, overallAccuracy),
          totalSessions: newTotalSessions,
          totalTrials: newTotalTrials,
          avgAccuracy: Math.round(newAvgAccuracy * 10) / 10,
          streakDays: newStreakDays,
          lastSessionDate: new Date()
        }
      })
    } else {
      await prisma.nBackProgress.create({
        data: {
          userId: user.id,
          gameMode,
          currentNLevel: levelAdvanced ? nLevel + 1 : nLevel,
          highestNLevel: nLevel,
          bestAccuracy: overallAccuracy,
          totalSessions: 1,
          totalTrials,
          avgAccuracy: overallAccuracy,
          streakDays: 1,
          lastSessionDate: new Date()
        }
      })
    }

    // Award gamification points
    // Base: 20 points for completing a session
    // Bonus: +10 for >80% accuracy, +20 for >90%, +30 for level advancement
    let pointsAwarded = 20
    if (overallAccuracy >= 90) pointsAwarded += 20
    else if (overallAccuracy >= 80) pointsAwarded += 10
    if (levelAdvanced) pointsAwarded += 30

    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'nback_training',
        amount: pointsAwarded,
        activitySource: `${gameMode} ${nLevel}-back, ${Math.round(overallAccuracy)}% accuracy${levelAdvanced ? ' (level up!)' : ''}`
      }
    })

    // Add to journal if accuracy is notable
    if (overallAccuracy >= 80 || levelAdvanced) {
      const journalNote = levelAdvanced
        ? `Advanced to ${nLevel + 1}-back in ${gameMode} N-Back training with ${Math.round(overallAccuracy)}% accuracy!`
        : `Completed ${gameMode} ${nLevel}-back training with ${Math.round(overallAccuracy)}% accuracy.`

      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          entry: JSON.stringify({ mentalTrainingNotes: journalNote }),
          date: new Date()
        }
      })
    }

    // Sync to Google Drive (non-blocking)
    syncUserDataForDate(user.id, new Date()).catch(err => {
      console.error('Drive sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      session: nbackSession,
      pointsAwarded,
      levelAdvanced
    })
  } catch (error: any) {
    console.error('POST /api/nback/sessions error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save session' },
      { status: 500 }
    )
  }
}
