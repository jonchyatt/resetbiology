import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load meal plans for authenticated user
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

    const plans = await prisma.mealPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      plans
    })

  } catch (error) {
    console.error('GET /api/nutrition/plans error:', error)
    return NextResponse.json({
      error: 'Failed to load meal plans',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Create new meal plan
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
    const { name, planType, dailyCalories, proteinTarget, carbsTarget, fatsTarget, notes } = body

    if (!name || !planType || !dailyCalories) {
      return NextResponse.json({
        error: 'Invalid request body. Required: name, planType, dailyCalories'
      }, { status: 400 })
    }

    // Create meal plan
    const plan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        name,
        planType,
        dailyCalories: parseFloat(dailyCalories),
        proteinTarget: parseFloat(proteinTarget) || 0,
        carbsTarget: parseFloat(carbsTarget) || 0,
        fatsTarget: parseFloat(fatsTarget) || 0,
        notes: notes || '',
        isActive: true
      }
    })

    // Award gamification points
    const pointsAwarded = 25
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'meal_plan_created',
        amount: pointsAwarded,
        activitySource: `Created meal plan: ${name}`
      }
    })

    return NextResponse.json({
      success: true,
      plan,
      pointsAwarded
    })

  } catch (error) {
    console.error('POST /api/nutrition/plans error:', error)
    return NextResponse.json({
      error: 'Failed to create meal plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update existing meal plan
export async function PATCH(request: Request) {
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
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
    }

    // Verify ownership before updating
    const existingPlan = await prisma.mealPlan.findUnique({
      where: { id }
    })

    if (!existingPlan || existingPlan.userId !== user.id) {
      return NextResponse.json({ error: 'Plan not found or unauthorized' }, { status: 404 })
    }

    const plan = await prisma.mealPlan.update({
      where: { id },
      data: updates
    })

    return NextResponse.json({
      success: true,
      plan
    })

  } catch (error) {
    console.error('PATCH /api/nutrition/plans error:', error)
    return NextResponse.json({
      error: 'Failed to update meal plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove meal plan
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
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const plan = await prisma.mealPlan.findUnique({
      where: { id }
    })

    if (!plan || plan.userId !== user.id) {
      return NextResponse.json({ error: 'Plan not found or unauthorized' }, { status: 404 })
    }

    await prisma.mealPlan.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Plan deleted'
    })

  } catch (error) {
    console.error('DELETE /api/nutrition/plans error:', error)
    return NextResponse.json({
      error: 'Failed to delete plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
