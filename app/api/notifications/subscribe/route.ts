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
}
