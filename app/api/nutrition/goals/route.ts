import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

interface MacroGoals {
  calories: number
  protein: number
  carbs: number
  fats: number
}

// GET - Load user's macro goals
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profileData = user.profileData as any
    const goals = profileData?.macroGoals || null

    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Get macro goals error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    )
  }
}

// POST - Save user's macro goals
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { goals } = body as { goals: MacroGoals }

    if (!goals || typeof goals.calories !== 'number' || typeof goals.protein !== 'number' || typeof goals.carbs !== 'number' || typeof goals.fats !== 'number') {
      return NextResponse.json(
        { error: 'Invalid goals format' },
        { status: 400 }
      )
    }

    const profileData = (user.profileData as any) || {}

    // Update user profileData with macro goals
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...profileData,
          macroGoals: goals
        }
      }
    })

    return NextResponse.json({
      success: true,
      goals
    })
  } catch (error) {
    console.error('Save macro goals error:', error)
    return NextResponse.json(
      { error: 'Failed to save goals' },
      { status: 500 }
    )
  }
}
