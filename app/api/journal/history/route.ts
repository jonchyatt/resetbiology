import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { localDayKey, utcMidnightToDayKey } from '@/lib/localDay'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
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

    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const { start, end } = getMonthRange(searchParams.get('month'))

    const [journalEntries, foodLogs, foodEntries, dailyTasks, workouts, breathSessions, peptideDoses, moduleCompletions] = await Promise.all([
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
      // NEW-7: the reader used to query foodLog only — anything logged
      // through the older FoodEntry stack (app/api/nutrition/entries)
      // never appeared in the timeline at all.
      prisma.foodEntry.findMany({
        where: {
          userId: user.id,
          loggedAt: {
            gte: start,
            lt: end,
          },
        },
        orderBy: { loggedAt: 'asc' },
      }),
      // NEW-6: history never showed the daily check-in (DailyTask) even
      // though the site's own retention loop is built on it.
      prisma.dailyTask.findMany({
        where: {
          userId: user.id,
          date: {
            gte: start,
            lt: end,
          },
        },
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

    // Unified shape for both nutrition sources (NEW-7) — FoodLog and
    // FoodEntry have different column names for the same facts. `source`
    // tells the client which route owns edit/delete for this row (NEW-4
    // pattern: label source so edit routes stay correct).
    type NutritionLogItem = {
      id: string
      source: 'foodLog' | 'foodEntry'
      itemName: string
      brand: string | null
      mealType: string
      quantity: number
      unit: string
      loggedAt: Date
      notes: string | null
      nutrients: { kcal: number; protein_g: number; carb_g: number; fat_g: number }
    }

    type DaySummary = {
      date: string
      iso: string
      journalEntry: any | null
      nutrition: {
        logs: NutritionLogItem[]
        totals: { calories: number; protein: number; carbs: number; fats: number }
      }
      dailyTasks: typeof dailyTasks
      workouts: typeof workouts
      breathSessions: typeof breathSessions
      peptideDoses: typeof peptideDoses
      modules: typeof moduleCompletions
      eventCount: number
    }

    const days = new Map<string, DaySummary>()

    const ensureDay = (date: Date, localDate?: string) => {
      // Prefer the writer-captured localDate string (timezone-safe — it was
      // computed in the visitor's real browser timezone). Legacy rows with
      // no localDate fall back to the shared helper's own-local-component
      // reading (F1.3 — replaces the hardcoded UTC-4 offset that broke the
      // calendar for every non-Eastern visitor).
      const key = localDate || localDayKey(date)

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
          dailyTasks: [],
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
      let parsed: any = {}
      try {
        parsed = entry.entry ? JSON.parse(entry.entry as string) : {}
      } catch {
        parsed = {}
      }
      // JournalEntry has no localDate column (schema.prisma:426-438) — the
      // writer stores it inside the entry JSON blob instead (NEW-8).
      const bucket = ensureDay(date, typeof parsed?.localDate === 'string' ? parsed.localDate : undefined)
      bucket.journalEntry = {
        ...entry,
        entry: parsed,
      }
      bucket.eventCount += 1
    })

    foodLogs.forEach((log: any) => {
      const date = log.loggedAt instanceof Date ? log.loggedAt : new Date(log.loggedAt)
      const bucket = ensureDay(date, log.localDate)
      const nutrients = log.nutrients as any
      const kcal = typeof nutrients?.kcal === 'number' ? nutrients.kcal : 0
      const protein = typeof nutrients?.protein_g === 'number' ? nutrients.protein_g : 0
      const carbs = typeof nutrients?.carb_g === 'number' ? nutrients.carb_g : 0
      const fats = typeof nutrients?.fat_g === 'number' ? nutrients.fat_g : 0
      bucket.nutrition.logs.push({
        id: log.id,
        source: 'foodLog',
        itemName: log.itemName,
        brand: log.brand ?? null,
        mealType: log.mealType ?? 'snack',
        quantity: log.quantity ?? 1,
        unit: log.unit ?? 'serving',
        loggedAt: date,
        notes: log.notes ?? null,
        nutrients: { kcal, protein_g: protein, carb_g: carbs, fat_g: fats },
      })
      bucket.nutrition.totals.calories += kcal
      bucket.nutrition.totals.protein += protein
      bucket.nutrition.totals.carbs += carbs
      bucket.nutrition.totals.fats += fats
      bucket.eventCount += 1
    })

    // NEW-7 — FoodEntry has no localDate column, so it buckets through the
    // shared helper's own-local-component fallback (same as any legacy row).
    foodEntries.forEach((entry) => {
      const date = entry.loggedAt instanceof Date ? entry.loggedAt : new Date(entry.loggedAt)
      const bucket = ensureDay(date)
      bucket.nutrition.logs.push({
        id: entry.id,
        source: 'foodEntry',
        itemName: entry.name,
        brand: null,
        mealType: entry.mealType ?? 'snack',
        quantity: 1,
        unit: 'serving',
        loggedAt: date,
        notes: null,
        nutrients: { kcal: entry.calories, protein_g: entry.protein, carb_g: entry.carbs, fat_g: entry.fats },
      })
      bucket.nutrition.totals.calories += entry.calories
      bucket.nutrition.totals.protein += entry.protein
      bucket.nutrition.totals.carbs += entry.carbs
      bucket.nutrition.totals.fats += entry.fats
      bucket.eventCount += 1
    })

    // NEW-6 — DailyTask has no localDate column, but (per F1.3) its `date`
    // IS a UTC-midnight-stamped day-key container (daily-tasks/route.ts) —
    // read the key straight back out rather than relying on the generic
    // legacy-row fallback's server-timezone assumption.
    dailyTasks.forEach((task) => {
      const date = task.date instanceof Date ? task.date : new Date(task.date)
      const bucket = ensureDay(date, utcMidnightToDayKey(date))
      bucket.dailyTasks.push(task)
      // Check-in completion isn't a "loggable event" the way a meal or
      // workout is — it doesn't bump eventCount / the calendar density dot.
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

    // `start`/`end` were built purely from calendar integers (getMonthRange
    // above), so the cursor's own local components already ARE the correct
    // calendar day — no timezone shift belongs here at all. The hardcoded
    // "convert to EDT" offset this replaces is what rendered June 30 -> July
    // 30 for a July calendar and omitted July 31 entirely (F1.3 NEW-1a/b).
    const calendar: Array<{ date: string; iso: string; count: number }> = []
    const cursor = new Date(start)
    while (cursor < end) {
      const key = localDayKey(cursor)

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

