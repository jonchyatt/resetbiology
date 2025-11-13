import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

// POST - Copy meals from a previous day to today
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { daysAgo } = body as { daysAgo: number }

    if (!daysAgo || daysAgo < 1) {
      return NextResponse.json(
        { error: 'Invalid daysAgo parameter' },
        { status: 400 }
      )
    }

    // Calculate target date (yesterday or X days ago)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysAgo)
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const targetLocalDate = `${year}-${month}-${day}`

    // Fetch meals from that day
    const previousDayMeals = await prisma.foodLog.findMany({
      where: {
        userId: user.id,
        localDate: targetLocalDate
      },
      orderBy: {
        loggedAt: 'asc'
      }
    })

    if (previousDayMeals.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No meals found from ${daysAgo} day(s) ago`
      })
    }

    // Create new entries for today
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = String(now.getMonth() + 1).padStart(2, '0')
    const todayDay = String(now.getDate()).padStart(2, '0')
    const todayHours = String(now.getHours()).padStart(2, '0')
    const todayMinutes = String(now.getMinutes()).padStart(2, '0')
    const todaySeconds = String(now.getSeconds()).padStart(2, '0')
    const todayLocalDate = `${todayYear}-${todayMonth}-${todayDay}`
    const todayLocalTime = `${todayHours}:${todayMinutes}:${todaySeconds}`

    const copiedMeals = await Promise.all(
      previousDayMeals.map(async (meal) => {
        return prisma.foodLog.create({
          data: {
            userId: user.id,
            source: meal.source,
            sourceId: meal.sourceId,
            itemName: meal.itemName,
            brand: meal.brand,
            quantity: meal.quantity,
            unit: meal.unit,
            gramWeight: meal.gramWeight,
            nutrients: meal.nutrients || {},
            mealType: meal.mealType,
            loggedAt: now,
            localDate: todayLocalDate,
            localTime: todayLocalTime
          }
        })
      })
    )

    return NextResponse.json({
      ok: true,
      count: copiedMeals.length,
      message: `Copied ${copiedMeals.length} meals from ${daysAgo} day(s) ago`
    })
  } catch (error) {
    console.error('Copy day error:', error)
    return NextResponse.json(
      { error: 'Failed to copy meals' },
      { status: 500 }
    )
  }
}
