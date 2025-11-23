import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { getStripe } from '@/lib/stripe'

/**
 * Create a Stripe checkout session for $1 trial → monthly subscription
 *
 * Flow:
 * 1. User pays $1 for 14-day trial
 * 2. After trial, automatically converts to $29.99/month subscription
 * 3. User can cancel anytime during trial to avoid charges
 */
export async function POST(req: NextRequest) {
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

    const { redirectUrl } = await req.json()

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
          auth0Sub: user.auth0Sub || ''
        }
      })
      customerId = customer.id

      // Update user with Stripe customer ID
      const { prisma } = await import('@/lib/prisma')
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId }
      })
    }

    // Create Stripe checkout session with trial
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          // Use the trial price ID from environment variable
          // This should be created in Stripe Dashboard as a recurring price with trial
          price: process.env.STRIPE_TRIAL_PRICE_ID || 'price_trial_placeholder',
          quantity: 1
        }
      ],
      subscription_data: {
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        },
        trial_period_days: 14,
        metadata: {
          userId: user.id,
          planType: 'trial'
        }
      },
      payment_method_collection: 'always', // Collect payment method during trial
      success_url: redirectUrl
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}${redirectUrl}?trial=success`
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}/portal?trial=success`,
      cancel_url: redirectUrl
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}${redirectUrl}?trial=cancelled`
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}/portal?trial=cancelled`,
      client_reference_id: user.auth0Sub || undefined,
      metadata: {
        userId: user.id,
        planType: 'trial'
      }
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url
    })
  } catch (error: any) {
    console.error('Error creating trial checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create trial checkout session', details: error.message },
      { status: 500 }
    )
  }
}
