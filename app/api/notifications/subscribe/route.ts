import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('📱 Push subscription request:', { userId: user.id, hasSubscription: !!body.subscription })

    const { subscription } = body

    // Validate subscription format
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      console.error('❌ Invalid subscription format:', { subscription })
      return NextResponse.json({
        error: 'Invalid subscription format',
        details: 'Missing endpoint or keys',
        received: { hasSubscription: !!subscription, hasEndpoint: !!subscription?.endpoint, hasKeys: !!subscription?.keys }
      }, { status: 400 })
    }

    // Validate keys structure
    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      console.error('❌ Invalid subscription keys:', { keys: subscription.keys })
      return NextResponse.json({
        error: 'Invalid subscription keys',
        details: 'Missing p256dh or auth',
        received: { hasP256dh: !!subscription.keys.p256dh, hasAuth: !!subscription.keys.auth }
      }, { status: 400 })
    }

    // Validate endpoint is a valid URL
    try {
      new URL(subscription.endpoint)
    } catch (urlError) {
      console.error('❌ Invalid endpoint URL:', subscription.endpoint)
      return NextResponse.json({
        error: 'Invalid endpoint URL',
        details: 'Endpoint must be a valid URL'
      }, { status: 400 })
    }

    console.log('✅ Upserting push subscription for user:', user.id)

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

    console.log('✅ Push subscription saved successfully')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Push subscription error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n')[0]
    })
    return NextResponse.json({
      error: 'Failed to save subscription',
      details: error.message || 'Unknown error',
      errorCode: error.code || 'UNKNOWN'
    }, { status: 500 })
  }
}
