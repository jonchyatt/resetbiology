import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { getStripe } from '@/lib/stripe'

/**
 * Get Stripe customer portal URL for managing subscription
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }

    // Find customer by email
    const customers = await stripe.customers.list({
      email: user.email || undefined,
      limit: 1
    })

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: 'No customer found. Please subscribe first.' },
        { status: 404 }
      )
    }

    const customer = customers.data[0]

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}/portal`
    })

    return NextResponse.json({
      url: portalSession.url
    })
  } catch (error: any) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session', details: error.message },
      { status: 500 }
    )
  }
}
