import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { getSubscriptionAccess } from '@/lib/subscriptionHelpers'

/**
 * Get current user's subscription status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscriptionAccess = getSubscriptionAccess(user)

    return NextResponse.json({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry,
      ...subscriptionAccess
    })
  } catch (error: any) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status', details: error.message },
      { status: 500 }
    )
  }
}
