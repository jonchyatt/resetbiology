import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load food entries for authenticated user
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get optional query params
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const limit = searchParams.get('limit')

    let where: any = { userId: user.id }

    // Filter by specific date if provided
    if (date) {
      const targetDate = new Date(date)
      targetDate.setHours(0, 0, 0, 0)
      const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

      where.loggedAt = {
        gte: targetDate,
        lt: endDate
      }
    }

    const entries = await prisma.foodEntry.findMany({
      where,
      orderBy: { loggedAt: 'desc' },
      take: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      entries
    })

  } catch (error) {
    console.error('GET /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to load nutrition entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Create new food entry
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, calories, protein, carbs, fats, mealType, serving } = body

    if (!name || !calories || !mealType) {
      return NextResponse.json({
        error: 'Invalid request body. Required: name, calories, mealType'
      }, { status: 400 })
    }

    // Create food entry
    const entry = await prisma.foodEntry.create({
      data: {
        userId: user.id,
        name,
        calories: parseFloat(calories),
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fats: parseFloat(fats) || 0,
        mealType
      }
    })

    // Award gamification points
    const pointsAwarded = 15
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'nutrition_log',
        amount: pointsAwarded,
        activitySource: `Logged meal: ${name}`
      }
    })

    return NextResponse.json({
      success: true,
      entry,
      pointsAwarded
    })

  } catch (error) {
    console.error('POST /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to save food entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove food entry
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const entry = await prisma.foodEntry.findUnique({
      where: { id }
    })

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: 'Entry not found or unauthorized' }, { status: 404 })
    }

    await prisma.foodEntry.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Entry deleted'
    })

  } catch (error) {
    console.error('DELETE /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to delete entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
