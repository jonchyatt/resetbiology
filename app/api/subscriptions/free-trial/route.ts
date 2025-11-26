import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { getStripe } from '@/lib/stripe'

/**
 * Create a Stripe checkout session for FREE trial (no charge) but collects payment method
 *
 * This uses Stripe's subscription with trial_period_days and trial_end to create
 * a free trial that still collects payment information.
 *
 * Flow:
 * 1. User enters payment info ($0 charged)
 * 2. 14-day free trial begins
 * 3. After trial, automatically converts to $29.99/month subscription
 * 4. User can cancel anytime during trial to avoid charges
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

    // Get the price ID from environment (this should be a recurring monthly price)
    const priceId = process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_TRIAL_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price not configured. Set STRIPE_MONTHLY_PRICE_ID in environment variables.' },
        { status: 500 }
      )
    }

    // Create Stripe checkout session with FREE trial
    // Key difference: We set trial_period_days without any upfront charge
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      subscription_data: {
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        },
        trial_period_days: 14, // 14-day FREE trial
        metadata: {
          userId: user.id,
          planType: 'free-trial'
        }
      },
      // This collects payment method but doesn't charge
      payment_method_collection: 'always',
      // Custom text to explain the trial
      custom_text: {
        submit: {
          message: 'Start your 14-day FREE trial. You won\'t be charged today. Your subscription will begin at $29.99/month after the trial ends. Cancel anytime.'
        }
      },
      success_url: redirectUrl
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}${redirectUrl}?trial=success&type=free`
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}/portal?trial=success&type=free`,
      cancel_url: redirectUrl
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}${redirectUrl}?trial=cancelled`
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'https://resetbiology.com'}/portal?trial=cancelled`,
      client_reference_id: user.auth0Sub || undefined,
      metadata: {
        userId: user.id,
        planType: 'free-trial'
      }
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url
    })
  } catch (error: any) {
    console.error('Error creating free trial checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create free trial checkout session', details: error.message },
      { status: 500 }
    )
  }
}
