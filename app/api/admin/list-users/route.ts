import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'

export async function GET() {
  try {
    const session = await auth0.getSession()

    // Only allow admin user
    if (!session?.user || session.user.email !== 'jonchyatt@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all users from MongoDB
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        auth0Sub: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      total: users.length,
      users
    })

  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json({
      error: 'Failed to list users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
