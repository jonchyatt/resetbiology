import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { todayLocalKey, utcMidnightToDayKey } from '@/lib/localDay'
import { computeDayStreak } from '@/lib/streak'

// ponytail: there is no DB-backed Mental Mastery module catalog — the
// portal_modules table (scripts/seed-portal-modules.ts) is dashboard nav
// tiles, a different thing. The real modules are two hardcoded arrays:
// src/components/Audio/ModuleLibrary.tsx (7, /audio route) and
// app/modules/foundation/page.tsx (5, /modules/foundation route), which
// already write into the same free-form ModuleCompletion.moduleId column.
// 12 is their combined size — the real total of what's offered today. If a
// DB-backed module catalog ever ships, swap this constant for a query
// against it instead of hardcoding a bigger number.
const KNOWN_MODULE_CATALOG_SIZE = 12

// GET: real per-user progress numbers for the Profile page's Progress tab
// (app/profile/page.tsx) — replaces the "0/30" hardcoded literals.
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [moduleCompletions, breathSessionCount, peptideTaskDays, completedTaskDays] = await Promise.all([
      prisma.moduleCompletion.findMany({ where: { userId: user.id }, select: { moduleId: true } }),
      prisma.breathSession.count({ where: { userId: user.id } }),
      // "Protocol Days" = distinct local days the user marked their peptide
      // dose task complete (DailyTask.taskName === 'peptides', written by
      // app/api/peptides/doses/route.ts — read only here, not touched).
      prisma.dailyTask.findMany({
        where: { userId: user.id, taskName: 'peptides', completed: true },
        select: { date: true },
      }),
      prisma.dailyTask.findMany({
        where: { userId: user.id, completed: true },
        select: { date: true },
      }),
    ])

    const modulesCompleted = new Set(moduleCompletions.map((m) => m.moduleId)).size
    const protocolDays = new Set(peptideTaskDays.map((t) => utcMidnightToDayKey(new Date(t.date)))).size
    const dayStreak = computeDayStreak(
      completedTaskDays.map((t) => utcMidnightToDayKey(new Date(t.date))),
      todayLocalKey()
    )

    return NextResponse.json({
      success: true,
      modulesCompleted,
      modulesTotal: KNOWN_MODULE_CATALOG_SIZE,
      breathSessions: breathSessionCount,
      protocolDays,
      dayStreak,
      grantExpiry: user.subscriptionExpiry ? user.subscriptionExpiry.toISOString() : null,
    })
  } catch (error) {
    console.error('GET /api/profile/progress error:', error)
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 })
  }
}
