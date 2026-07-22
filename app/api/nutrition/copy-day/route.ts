import { NextRequest, NextResponse } from 'next/server'
import { auth0Edge } from '@/lib/auth0-edge'
import { isValidDayKey, shiftDayKey } from '@/lib/localDay'

type ValidCopyDayRequest = {
  daysAgo: 1
  sourceLocalDate: string
  destinationLocalDate: string
}

type CopyableMeal = {
  source: string
  sourceId: string | null
  itemName: string
  brand: string | null
  quantity: number
  unit: string
  gramWeight: number | null
  nutrients: any
  mealType: string
}

type CopyDayDatabase = {
  getUserId: (session: any) => Promise<string | null>
  findMeals: (userId: string, sourceLocalDate: string) => Promise<CopyableMeal[]>
  createMeal: (
    userId: string,
    meal: CopyableMeal,
    loggedAt: Date,
    destinationLocalDate: string,
    localTime: string,
  ) => Promise<unknown>
}

type CopyDayDependencies = {
  getSession: () => Promise<any>
  loadDatabase: () => Promise<CopyDayDatabase>
  now: () => Date
}

function validateCopyDayRequest(body: unknown): ValidCopyDayRequest | null {
  if (!body || typeof body !== 'object') return null

  const { daysAgo, sourceLocalDate, destinationLocalDate } = body as Record<string, unknown>
  if (typeof daysAgo !== 'number' || !Number.isInteger(daysAgo) || daysAgo !== 1) return null
  if (!isValidDayKey(sourceLocalDate) || !isValidDayKey(destinationLocalDate)) return null
  try {
    if (sourceLocalDate !== shiftDayKey(destinationLocalDate, -1)) return null
  } catch {
    return null
  }

  return { daysAgo, sourceLocalDate, destinationLocalDate }
}

// Exported dependency seam lets the contract test execute every branch with
// fake sign-in and database spies. Production still supplies the real services.
function createCopyDayPostHandler(dependencies: CopyDayDependencies) {
  return async function copyDayPost(req: NextRequest) {
    try {
      const session = await dependencies.getSession()
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      let body: unknown
      try {
        body = await req.json()
      } catch {
        return NextResponse.json({ error: 'Invalid copy-day request' }, { status: 400 })
      }

      const validated = validateCopyDayRequest(body)
      if (!validated) {
        return NextResponse.json({ error: 'Invalid copy-day request' }, { status: 400 })
      }

      const { daysAgo, sourceLocalDate, destinationLocalDate } = validated
      const database = await dependencies.loadDatabase()
      const userId = await database.getUserId(session)

      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const previousDayMeals = await database.findMeals(userId, sourceLocalDate)

      if (previousDayMeals.length === 0) {
        return NextResponse.json({
          ok: false,
          error: `No meals found from ${daysAgo} day(s) ago`,
        })
      }

      // Preserve existing copied timestamps and server-local time behavior. The
      // server clock never discovers either calendar date.
      const now = dependencies.now()
      const todayHours = String(now.getHours()).padStart(2, '0')
      const todayMinutes = String(now.getMinutes()).padStart(2, '0')
      const todaySeconds = String(now.getSeconds()).padStart(2, '0')
      const todayLocalTime = `${todayHours}:${todayMinutes}:${todaySeconds}`

      const copiedMeals = await Promise.all(
        previousDayMeals.map((meal) =>
          database.createMeal(userId, meal, now, destinationLocalDate, todayLocalTime),
        ),
      )

      return NextResponse.json({
        ok: true,
        count: copiedMeals.length,
        message: `Copied ${copiedMeals.length} meals from ${daysAgo} day(s) ago`,
      })
    } catch (error) {
      console.error('Copy day error:', error)
      return NextResponse.json({ error: 'Failed to copy meals' }, { status: 500 })
    }
  }
}

const productionDependencies: CopyDayDependencies = {
  getSession: () => auth0Edge.getSession(),
  loadDatabase: async () => {
    // Database-bearing modules load only after the signed session and complete
    // browser-day contract have passed. Rejected input has a zero-DB path.
    const [{ getUserFromSession }, { prisma }] = await Promise.all([
      import('@/lib/getUserFromSession'),
      import('@/lib/prisma'),
    ])

    return {
      getUserId: async (session) => (await getUserFromSession(session))?.id ?? null,
      findMeals: (userId, sourceLocalDate) =>
        prisma.foodLog.findMany({
          where: { userId, localDate: sourceLocalDate },
          orderBy: { loggedAt: 'asc' },
        }),
      createMeal: (userId, meal, loggedAt, destinationLocalDate, localTime) =>
        prisma.foodLog.create({
          data: {
            userId,
            source: meal.source,
            sourceId: meal.sourceId,
            itemName: meal.itemName,
            brand: meal.brand,
            quantity: meal.quantity,
            unit: meal.unit,
            gramWeight: meal.gramWeight,
            nutrients: meal.nutrients || {},
            mealType: meal.mealType,
            loggedAt,
            localDate: destinationLocalDate,
            localTime,
          },
        }),
    }
  },
  now: () => new Date(),
}

// POST - Copy yesterday's meals to the authenticated member's browser-owned Today.
export const POST = Object.assign(createCopyDayPostHandler(productionDependencies), {
  testContract: { createCopyDayPostHandler, validateCopyDayRequest },
})
