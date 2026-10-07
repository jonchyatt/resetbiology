import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

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

  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  const startKey = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-01`
  return { start, end, startKey, endKey }
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
    const { start, end, startKey, endKey } = getMonthRange(searchParams.get('month'))

    const [journalEntries, foodLogs, workouts, breathSessions, peptideDoses, moduleCompletions] = await Promise.all([
      prisma.journalEntry.findMany({
        where: {
          userId: user.id,
          OR: [
            { localDate: { gte: startKey, lt: endKey } },
            { localDate: null, date: { gte: start, lt: end } },
          ],
        },
      }),
      prisma.foodLog.findMany({
        where: {
          userId: user.id,
          OR: [
            { localDate: { gte: startKey, lt: endKey } },
            { localDate: null, loggedAt: { gte: start, lt: end } },
          ],
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

    const ensureDay = (date: Date, localDate?: string) => {
      // New writes carry the user's local date. Legacy writes fall back to UTC.
      const key = localDate || (() => {
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        const day = String(date.getUTCDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })()

      if (!days.has(key)) {
        const entryDate = new Date(`${key}T00:00:00.000Z`)
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
      const bucket = ensureDay(date, entry.localDate ?? undefined)
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

    foodLogs.forEach((log: any) => {
      const date = log.loggedAt instanceof Date ? log.loggedAt : new Date(log.loggedAt)
      const bucket = ensureDay(date, log.localDate)
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

    workouts.forEach((session: any) => {
      const date = session.completedAt instanceof Date ? session.completedAt : new Date(session.completedAt)
      const bucket = ensureDay(date, session.localDate)
      bucket.workouts.push(session)
      bucket.eventCount += 1
    })

    breathSessions.forEach((session: any) => {
      const date = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt)
      const bucket = ensureDay(date, session.localDate)
      bucket.breathSessions.push(session)
      bucket.eventCount += 1
    })

    peptideDoses.forEach((dose: any) => {
      const date = dose.doseDate instanceof Date ? dose.doseDate : new Date(dose.doseDate)
      const bucket = ensureDay(date, dose.localDate)
      bucket.peptideDoses.push(dose)
      bucket.eventCount += 1
    })

    moduleCompletions.forEach((completion: any) => {
      const date = completion.completedAt instanceof Date ? completion.completedAt : new Date(completion.completedAt)
      const bucket = ensureDay(date, completion.localDate)
      bucket.modules.push(completion)
      bucket.eventCount += 1
    })

    const calendar: Array<{ date: string; iso: string; count: number }> = []
    const cursor = new Date(start)
    while (cursor < end) {
      const year = cursor.getUTCFullYear()
      const month = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const day = String(cursor.getUTCDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`

      calendar.push({
        date: key,
        iso: cursor.toISOString(),
        count: days.get(key)?.eventCount ?? 0,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
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

