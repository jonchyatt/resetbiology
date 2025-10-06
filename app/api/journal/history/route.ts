import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

async function resolveUser(sessionUser: any) {
  if (!sessionUser?.sub) return null

  let user = await prisma.user.findUnique({ where: { auth0Sub: sessionUser.sub } })

  if (!user && sessionUser.email) {
    user = await prisma.user.findUnique({ where: { email: sessionUser.email } })
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: sessionUser.sub },
      })
    }
  }

  return user
}

function getMonthRange(param?: string | null) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()

  if (param) {
    const [y, m] = param.split('-').map(Number)
    if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const start = new Date(year, month, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await resolveUser(session.user)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const { start, end } = getMonthRange(searchParams.get('month'))

    const [journalEntries, foodLogs, workouts, breathSessions, peptideDoses, moduleCompletions] = await Promise.all([
      prisma.journalEntry.findMany({
        where: {
          userId: user.id,
          date: {
            gte: start,
            lt: end,
          },
        },
      }),
      prisma.foodLog.findMany({
        where: {
          userId: user.id,
          loggedAt: {
            gte: start,
            lt: end,
          },
        },
        orderBy: { loggedAt: 'asc' },
      }),
      prisma.workoutSession.findMany({
        where: {
          userId: user.id,
          completedAt: {
            gte: start,
            lt: end,
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.breathSession.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.peptide_doses.findMany({
        where: {
          doseDate: {
            gte: start,
            lt: end,
          },
          user_peptide_protocols: {
            userId: user.id,
          },
        },
        include: {
          user_peptide_protocols: {
            include: {
              peptides: true,
            },
          },
        },
        orderBy: { doseDate: 'asc' },
      }),
      prisma.moduleCompletion.findMany({
        where: {
          userId: user.id,
          completedAt: {
            gte: start,
            lt: end,
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
    ])

    type DaySummary = {
      date: string
      iso: string
      journalEntry: any | null
      nutrition: {
        logs: typeof foodLogs
        totals: { calories: number; protein: number; carbs: number; fats: number }
      }
      workouts: typeof workouts
      breathSessions: typeof breathSessions
      peptideDoses: typeof peptideDoses
      modules: typeof moduleCompletions
      eventCount: number
    }

    const days = new Map<string, DaySummary>()

    const ensureDay = (date: Date) => {
      // Convert UTC timestamp to local date by creating new date from local string
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const year = localDate.getFullYear()
      const month = String(localDate.getMonth() + 1).padStart(2, '0')
      const day = String(localDate.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`

      if (!days.has(key)) {
        const entryDate = new Date(date)
        entryDate.setHours(0, 0, 0, 0)
        days.set(key, {
          date: key,
          iso: entryDate.toISOString(),
          journalEntry: null,
          nutrition: {
            logs: [],
            totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
          },
          workouts: [],
          breathSessions: [],
          peptideDoses: [],
          modules: [],
          eventCount: 0,
        })
      }
      return days.get(key)!
    }

    journalEntries.forEach((entry) => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
      const bucket = ensureDay(date)
      let parsed: any = {}
      try {
        parsed = entry.entry ? JSON.parse(entry.entry as string) : {}
      } catch {
        parsed = {}
      }
      bucket.journalEntry = {
        ...entry,
        entry: parsed,
      }
      bucket.eventCount += 1
    })

    foodLogs.forEach((log) => {
      const date = log.loggedAt instanceof Date ? log.loggedAt : new Date(log.loggedAt)
      const bucket = ensureDay(date)
      bucket.nutrition.logs.push(log)
      const nutrients = log.nutrients as any
      const kcal = typeof nutrients?.kcal === 'number' ? nutrients.kcal : 0
      const protein = typeof nutrients?.protein_g === 'number' ? nutrients.protein_g : 0
      const carbs = typeof nutrients?.carb_g === 'number' ? nutrients.carb_g : 0
      const fats = typeof nutrients?.fat_g === 'number' ? nutrients.fat_g : 0
      bucket.nutrition.totals.calories += kcal
      bucket.nutrition.totals.protein += protein
      bucket.nutrition.totals.carbs += carbs
      bucket.nutrition.totals.fats += fats
      bucket.eventCount += 1
    })

    workouts.forEach((session) => {
      const date = session.completedAt instanceof Date ? session.completedAt : new Date(session.completedAt)
      const bucket = ensureDay(date)
      bucket.workouts.push(session)
      bucket.eventCount += 1
    })

    breathSessions.forEach((session) => {
      const date = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt)
      const bucket = ensureDay(date)
      bucket.breathSessions.push(session)
      bucket.eventCount += 1
    })

    peptideDoses.forEach((dose) => {
      const date = dose.doseDate instanceof Date ? dose.doseDate : new Date(dose.doseDate)
      const bucket = ensureDay(date)
      bucket.peptideDoses.push(dose)
      bucket.eventCount += 1
    })

    moduleCompletions.forEach((completion) => {
      const date = completion.completedAt instanceof Date ? completion.completedAt : new Date(completion.completedAt)
      const bucket = ensureDay(date)
      bucket.modules.push(completion)
      bucket.eventCount += 1
    })

    const calendar: Array<{ date: string; iso: string; count: number }> = []
    const cursor = new Date(start)
    while (cursor < end) {
      // Use local date components instead of UTC
      const year = cursor.getFullYear()
      const month = String(cursor.getMonth() + 1).padStart(2, '0')
      const day = String(cursor.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`

      calendar.push({
        date: key,
        iso: cursor.toISOString(),
        count: days.get(key)?.eventCount ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    const dayList = Array.from(days.values()).sort((a, b) => (a.iso < b.iso ? -1 : 1))

    return NextResponse.json({
      success: true,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      days: dayList,
      calendar,
    })

  } catch (error) {
    console.error('GET /api/journal/history error:', error)
    return NextResponse.json({
      error: 'Failed to load journal history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

