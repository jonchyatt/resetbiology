import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

interface FavoriteFood {
  source: string
  sourceId: string
  description: string
  brand: string | null
  per: '100g' | 'serving'
  nutrients: any
  defaultGrams?: number
  defaultServings?: number
  gramWeight?: number
}

// GET - List user's favorite foods
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profileData = user.profileData as any
    const favoriteFoods = profileData?.favoriteFoods || []

    return NextResponse.json({ favorites: favoriteFoods })
  } catch (error) {
    console.error('Get favorites error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    )
  }
}

// POST - Toggle favorite (add or remove)
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { food, action } = body as { food: FavoriteFood; action: 'add' | 'remove' }

    if (!food || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const profileData = (user.profileData as any) || {}
    let favoriteFoods: FavoriteFood[] = profileData.favoriteFoods || []

    if (action === 'add') {
      // Check if already favorited
      const exists = favoriteFoods.some(
        (f) => f.source === food.source && f.sourceId === food.sourceId
      )

      if (!exists) {
        favoriteFoods.push(food)
      }
    } else if (action === 'remove') {
      favoriteFoods = favoriteFoods.filter(
        (f) => !(f.source === food.source && f.sourceId === food.sourceId)
      )
    }

    // Update user profileData
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileData: {
          ...profileData,
          favoriteFoods
        }
      }
    })

    return NextResponse.json({
      success: true,
      favorites: favoriteFoods,
      action
    })
  } catch (error) {
    console.error('Toggle favorite error:', error)
    return NextResponse.json(
      { error: 'Failed to update favorites' },
      { status: 500 }
    )
  }
}
