---
name: checkout-flow-tester
description: Tests Stripe checkout, order processing, and payment flow validation
category: reset-biology
tags: [stripe, payments, checkout, testing]
version: 1.0.0
---

# Checkout Flow Tester

## Purpose
Tests Stripe checkout integration, validates order processing, ensures payment flow works correctly, and confirms post-purchase user experience in the Reset Biology platform.

## When to Use
- When testing new payment integrations
- When debugging failed checkouts
- When validating webhook handlers
- When investigating order fulfillment issues
- Before deploying payment-related changes

## Validation Checklist

### 1. Stripe Configuration
- [ ] API keys set correctly (test vs. production)
- [ ] Webhook endpoint configured
- [ ] Webhook secret set in environment
- [ ] Payment methods enabled (card, Apple Pay, etc.)
- [ ] Products/prices exist in Stripe dashboard

### 2. Checkout Flow
- [ ] Product selection works
- [ ] Price displays correctly
- [ ] Checkout session creates successfully
- [ ] Redirects to Stripe Checkout
- [ ] Test card completes payment

### 3. Webhook Processing
- [ ] Webhook receives events
- [ ] Signature verification passes
- [ ] Order created in database
- [ ] User access granted
- [ ] Confirmation email sent (if applicable)

### 4. Post-Purchase Experience
- [ ] Success page displays
- [ ] User can access purchased content
- [ ] Order appears in user's history
- [ ] Gamification points awarded
- [ ] Receipt available

## Implementation Steps

### Step 1: Validate Stripe Configuration
```typescript
// Check Stripe keys are set
// File: /lib/stripe.ts

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

// Test connection
export const validateStripeConnection = async () => {
  try {
    await stripe.products.list({ limit: 1 })
    console.log('✓ Stripe connection successful')
    return true
  } catch (error) {
    console.error('✗ Stripe connection failed:', error)
    return false
  }
}
```

### Step 2: Test Checkout Session Creation
```typescript
// File: /app/api/checkout/create-session/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId, productName } = await req.json()

  console.log('=== CHECKOUT SESSION CREATE ===')
  console.log('User:', session.user.email)
  console.log('Price ID:', priceId)

  try {
    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      customer_email: session.user.email,
      metadata: {
        userId: session.user.sub,
        productName
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order`
    })

    console.log('Session created:', checkoutSession.id)
    console.log('================================')

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout session creation failed:', error)
    return NextResponse.json({
      error: 'Failed to create checkout session'
    }, { status: 500 })
  }
}
```

### Step 3: Implement Webhook Handler
```typescript
// File: /app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { headers } from 'next/headers'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  console.log('=== STRIPE WEBHOOK ===')
  console.log('Signature:', signature?.slice(0, 20) + '...')

  let event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log('Event type:', event.type)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({
      error: 'Invalid signature'
    }, { status: 400 })
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    console.log('Payment succeeded for session:', session.id)
    console.log('Customer email:', session.customer_email)
    console.log('Metadata:', session.metadata)

    // Create order in database
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { auth0Sub: session.metadata?.userId },
            { email: session.customer_email! }
          ]
        }
      })

      if (!user) {
        console.error('User not found:', session.customer_email)
        return NextResponse.json({
          error: 'User not found'
        }, { status: 404 })
      }

      // Create order
      const order = await prisma.order.create({
        data: {
          userId: user.id,
          stripeSessionId: session.id,
          amount: session.amount_total! / 100,
          status: 'completed',
          productName: session.metadata?.productName || 'Product'
        }
      })

      console.log('Order created:', order.id)

      // Grant access to product (if applicable)
      if (session.metadata?.productId) {
        await prisma.userAccess.create({
          data: {
            userId: user.id,
            productId: session.metadata.productId,
            expiresAt: null // Lifetime access
          }
        })
        console.log('Access granted to product:', session.metadata.productId)
      }

      // Award gamification points
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          points: 500, // Purchase bonus
          source: 'purchase',
          metadata: { orderId: order.id }
        }
      })
      console.log('Awarded 500 points')

      console.log('======================')
      return NextResponse.json({ received: true })
    } catch (error) {
      console.error('Order creation failed:', error)
      return NextResponse.json({
        error: 'Order processing failed'
      }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
```

### Step 4: Test Checkout Flow End-to-End
```typescript
// Test script to run locally
// File: /scripts/test-checkout.ts

import { stripe } from '@/lib/stripe'

async function testCheckout() {
  console.log('🧪 Testing Checkout Flow\n')

  // 1. Check Stripe connection
  console.log('1. Validating Stripe connection...')
  try {
    await stripe.products.list({ limit: 1 })
    console.log('   ✓ Connected\n')
  } catch (error) {
    console.error('   ✗ Connection failed:', error)
    return
  }

  // 2. Create test checkout session
  console.log('2. Creating checkout session...')
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product'
            },
            unit_amount: 5000 // $50.00
          },
          quantity: 1
        }
      ],
      customer_email: 'test@example.com',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel'
    })

    console.log('   ✓ Session created:', session.id)
    console.log('   URL:', session.url)
    console.log('\n3. Open this URL in browser and use test card:')
    console.log('   Card: 4242 4242 4242 4242')
    console.log('   Expiry: Any future date')
    console.log('   CVC: Any 3 digits\n')
  } catch (error) {
    console.error('   ✗ Session creation failed:', error)
  }
}

testCheckout()
```

## Common Issues & Fixes

### Issue: Webhook not receiving events
**Check:**
1. Verify webhook endpoint is registered in Stripe dashboard
2. Check webhook secret matches environment variable
3. Ensure endpoint is publicly accessible (use ngrok for local testing)

**Fix:**
```bash
# Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

### Issue: Signature verification fails
**Check:**
1. Verify webhook secret is correct
2. Ensure raw body is used (not parsed JSON)
3. Check signature header is present

**Fix:**
```typescript
// Read raw body correctly
const body = await req.text() // Not req.json()!

// Verify signature
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  webhookSecret
)
```

### Issue: Order not created after payment
**Check:**
1. Verify webhook handler runs without errors
2. Check database connection
3. Ensure user lookup works

**Fix:**
```typescript
// Add detailed logging
console.log('User lookup:', session.customer_email)
const user = await prisma.user.findFirst({
  where: { email: session.customer_email! }
})
console.log('User found:', !!user)

if (!user) {
  // Create user if doesn't exist
  user = await prisma.user.create({
    data: {
      email: session.customer_email!,
      name: 'Customer'
    }
  })
}
```

## Testing Scenarios

### Test 1: Successful Payment
```typescript
// Use Stripe test card
// Card: 4242 4242 4242 4242
// Expected:
// 1. Checkout session creates
// 2. Redirects to Stripe Checkout
// 3. Payment succeeds
// 4. Webhook fires
// 5. Order created in database
// 6. User redirected to success page
```

### Test 2: Failed Payment
```typescript
// Use Stripe decline test card
// Card: 4000 0000 0000 0002
// Expected:
// 1. Checkout session creates
// 2. Payment fails with error
// 3. No webhook fired
// 4. No order created
// 5. User stays on checkout page
```

### Test 3: Webhook Replay Attack
```typescript
// Send same webhook twice
// Expected:
// 1. First webhook: Order created
// 2. Second webhook: Duplicate detected, no new order
```

## Integration with Existing Code

### Where this skill applies:
- `/app/api/checkout/create-session/route.ts` - Session creation
- `/app/api/webhooks/stripe/route.ts` - Webhook handler
- `/app/order/page.tsx` - Product selection page
- `/app/checkout/success/page.tsx` - Success page
- `/lib/stripe.ts` - Stripe client initialization

### Add to environment variables:
```bash
# Test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Production keys (different!)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

## Success Criteria
- [ ] Checkout session creates without errors
- [ ] Payment completes with test card
- [ ] Webhook receives and processes events
- [ ] Order created in database
- [ ] User access granted
- [ ] Success page displays
- [ ] Points awarded (500 pts for purchase)

## Related Skills
- `auth0-session-debugger` - User must be authenticated
- `gamification-calculator` - Purchase awards points
- `peptide-protocol-validator` - Purchased peptides available

## Notes
- Always test with Stripe test keys first
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to`
- Test cards: https://stripe.com/docs/testing
- Webhook events may arrive out of order
- Always verify webhook signatures
- Log everything during testing
- Consider idempotency for webhook handlers
