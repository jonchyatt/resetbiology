import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

export async function POST(req: NextRequest) {
  const session = await auth0.getSession()
  const user = await getUserFromSession(session)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subscription } = await req.json()

  try {
    // Validate subscription format
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({
        error: 'Invalid subscription format',
        details: 'Missing endpoint or keys'
      }, { status: 400 })
    }

    // Validate keys structure
    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json({
        error: 'Invalid subscription keys',
        details: 'Missing p256dh or auth'
      }, { status: 400 })
    }

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint: subscription.endpoint
        }
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      update: {
        keys: subscription.keys
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Push subscription error:', error)
    return NextResponse.json({
      error: 'Failed to save subscription',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
