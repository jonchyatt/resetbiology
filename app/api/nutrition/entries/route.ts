import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load user's food entries
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter
    let dateFilter: any = {}

    if (startDate && endDate) {
      // Date range
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z')
      }
    } else {
      // Single day
      const dayStart = new Date(date + 'T00:00:00.000Z')
      const dayEnd = new Date(date + 'T23:59:59.999Z')
      dateFilter = {
        gte: dayStart,
        lte: dayEnd
      }
    }

    // Load food entries
    const entries = await prisma.foodEntry.findMany({
      where: {
        userId: user.id,
        loggedAt: dateFilter
      },
      orderBy: { loggedAt: 'asc' }
    })

    // Calculate totals
    const totals = entries.reduce((acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      carbs: acc.carbs + entry.carbs,
      fats: acc.fats + entry.fats
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 })

    return NextResponse.json({
      success: true,
      entries,
      totals,
      date
    })

  } catch (error) {
    console.error('GET /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to load nutrition entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Log new food entry
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      calories,
      protein,
      carbs,
      fats,
      mealType,
      serving,
      loggedAt
    } = body

    if (!name || calories === undefined || protein === undefined || carbs === undefined || fats === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: name, calories, protein, carbs, fats'
      }, { status: 400 })
    }

    // Create food entry
    const entry = await prisma.foodEntry.create({
      data: {
        userId: user.id,
        name,
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fats: parseFloat(fats),
        mealType: mealType || 'meal',
        loggedAt: loggedAt ? new Date(loggedAt) : new Date()
      }
    })

    // Award gamification points
    const today = new Date().toISOString().split('T')[0]
    const todayStart = new Date(today + 'T00:00:00.000Z')
    const todayEnd = new Date(today + 'T23:59:59.999Z')

    // Check if this is the first entry today
    const todaysEntries = await prisma.foodEntry.count({
      where: {
        userId: user.id,
        loggedAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    })

    let pointsAwarded = 0
    if (todaysEntries === 1) {
      // First entry of the day - award points
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          points: 10,
          category: 'nutrition',
          description: 'Logged nutrition for today',
          awardedAt: new Date()
        }
      })
      pointsAwarded = 10

      // Update daily task
      const dailyTask = await prisma.dailyTask.findFirst({
        where: {
          userId: user.id,
          date: today,
          category: 'nutrition'
        }
      })

      if (dailyTask && !dailyTask.completed) {
        await prisma.dailyTask.update({
          where: { id: dailyTask.id },
          data: { completed: true }
        })
      }
    }

    return NextResponse.json({
      success: true,
      entry,
      pointsAwarded
    })

  } catch (error) {
    console.error('POST /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to log food entry',
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

    // Find user
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('id')

    if (!entryId) {
      return NextResponse.json({
        error: 'Missing entry ID'
      }, { status: 400 })
    }

    // Verify ownership
    const entry = await prisma.foodEntry.findUnique({
      where: { id: entryId }
    })

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({
        error: 'Entry not found or access denied'
      }, { status: 404 })
    }

    // Delete entry
    await prisma.foodEntry.delete({
      where: { id: entryId }
    })

    return NextResponse.json({
      success: true,
      message: 'Food entry deleted'
    })

  } catch (error) {
    console.error('DELETE /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to delete food entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update food entry
export async function PATCH(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { entryId, ...updates } = body

    if (!entryId) {
      return NextResponse.json({
        error: 'Missing entryId'
      }, { status: 400 })
    }

    // Verify ownership
    const entry = await prisma.foodEntry.findUnique({
      where: { id: entryId }
    })

    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({
        error: 'Entry not found or access denied'
      }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.calories !== undefined) updateData.calories = parseFloat(updates.calories)
    if (updates.protein !== undefined) updateData.protein = parseFloat(updates.protein)
    if (updates.carbs !== undefined) updateData.carbs = parseFloat(updates.carbs)
    if (updates.fats !== undefined) updateData.fats = parseFloat(updates.fats)
    if (updates.mealType !== undefined) updateData.mealType = updates.mealType

    // Update entry
    const updated = await prisma.foodEntry.update({
      where: { id: entryId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      entry: updated
    })

  } catch (error) {
    console.error('PATCH /api/nutrition/entries error:', error)
    return NextResponse.json({
      error: 'Failed to update food entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}