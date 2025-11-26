# Stripe Trial → Monthly Subscription Setup Guide

## Overview
This guide walks through setting up trial subscriptions that automatically convert to $12.99/month after 14 days.

**Two options available:**
1. **FREE Trial** (`/api/subscriptions/free-trial`) - No charge, collects payment info, charges $12.99/month after 14 days
2. **$1 Trial** (`/api/subscriptions/trial`) - Charges $1 immediately, then $12.99/month after 14 days

**Price**: $12.99/month (Basic Membership)

**Trial End Reminder**: We send a reminder 2 days before trial ends to let users cancel or leave a review.

Both options collect payment information upfront to ensure conversion after the trial period.

## Step 1: Create Product in Stripe Dashboard

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/test/products
2. **Click "Add product"**
3. **Fill in details:**
   - **Name**: Reset Biology Premium Membership
   - **Description**: Full access to peptide tracking, mental mastery modules, breathing app, vision training, and all premium features
   - **Image**: Upload logo or product image (optional)

4. **Click "Add pricing"**

## Step 2: Create Trial Price

1. **In the product page, click "Add another price"**
2. **Configure pricing:**
   - **Price model**: Standard pricing
   - **Price**: $12.99
   - **Billing period**: Monthly
   - **Currency**: USD

3. **Expand "More pricing options"**
4. **Configure trial:**
   - **Trial period**: 14 days
   - **Trial amount**: $1.00

5. **Click "Add price"**

## Step 3: Get Price ID

1. After creating the price, you'll see it listed under the product
2. Click on the price to see details
3. Copy the **Price ID** (starts with `price_`)
   - Example: `price_1ABC123def456GHI789jkl`

## Step 4: Add Price ID to Environment Variables

1. **Open `.env.local` file**
2. **Add the following line:**
```bash
STRIPE_TRIAL_PRICE_ID=price_YOUR_ACTUAL_PRICE_ID_HERE
```

3. **For production (Vercel):**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `STRIPE_TRIAL_PRICE_ID` with the same value
   - Set it for "Production", "Preview", and "Development"
   - Redeploy

## Step 5: Test the Flow

### Test Mode (Using Test Cards)

1. **Start the trial:**
   - Go to https://resetbiology.com/portal (or localhost:3000/portal)
   - Click "Start $1 Trial" button
   - You'll be redirected to Stripe Checkout

2. **Use Stripe test card:**
   - Card Number: `4242 4242 4242 4242`
   - Expiration: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - ZIP: Any 5 digits (e.g., 12345)

3. **Complete checkout:**
   - Enter test card details
   - Click "Subscribe"
   - You'll be redirected back to portal with `?trial=success`

4. **Verify in Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/subscriptions
   - You should see a new subscription with:
     - Status: "Trialing"
     - Trial end date: 14 days from now
     - Next payment: $12.99 on [trial end date]

5. **Verify in app:**
   - User's `subscriptionStatus` should be "active"
   - User should have access to all premium features
   - `subscriptionExpiry` should be set to trial end date + 1 month

### Test Cancellation During Trial

1. **In Stripe Dashboard:**
   - Go to the subscription you just created
   - Click "Cancel subscription"
   - Choose "Cancel at period end" or "Cancel immediately"

2. **Webhook will fire:**
   - `customer.subscription.updated` event
   - User's `subscriptionStatus` will update accordingly

## Step 6: Webhook Configuration (Already Done)

The webhook endpoint is already configured at `/api/stripe/webhook` and handles:
- `checkout.session.completed` - Activates subscription when trial starts
- `customer.subscription.created` - Initial subscription creation
- `customer.subscription.updated` - Status changes (active, canceled, etc.)
- `customer.subscription.deleted` - Subscription cancellation

Webhook secret is already in `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_NwKzNbtBSV2U20npOjtGPYIZGlH2dM2t
```

## Step 7: Go Live (Production) - COMPLETE CHECKLIST

When ready to accept real payments, follow these steps:

### Step 7.1: Stripe Dashboard Setup (Live Mode)

1. **Switch to Live Mode**
   - In Stripe Dashboard, toggle from "Test mode" to "Live mode" (top right corner)
   - The URL will change from `dashboard.stripe.com/test/...` to `dashboard.stripe.com/...`

2. **Create Product in Live Mode**
   - Go to: https://dashboard.stripe.com/products
   - Click "Add product"
   - **Name**: Reset Biology Premium Membership
   - **Description**: Full access to all premium features
   - Click "Add pricing"

3. **Create Monthly Price (for FREE trial)**
   - **Price**: $12.99
   - **Billing period**: Monthly
   - **Currency**: USD
   - Click "Add price"
   - **Copy the Price ID** (starts with `price_live_...`) - save this!

4. **Create Trial Price (for $1 trial, optional)**
   - Click "Add another price" on the same product
   - **Price**: $12.99 (monthly)
   - Under "More pricing options":
     - **Trial period**: 14 days
     - **Trial amount**: $1.00
   - Click "Add price"
   - **Copy this Price ID too** (for $1 trial option)

### Step 7.2: Set Up Webhook (Live Mode)

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. **Endpoint URL**: `https://resetbiology.com/api/stripe/webhook`
4. **Select events to listen for:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. **Click on the endpoint** → Click "Reveal signing secret"
7. **Copy the signing secret** (starts with `whsec_...`) - save this!

### Step 7.3: Get API Keys (Live Mode)

1. Go to: https://dashboard.stripe.com/apikeys
2. **Copy these keys:**
   - **Publishable key**: starts with `pk_live_...`
   - **Secret key**: Click "Reveal" → starts with `sk_live_...`

### Step 7.4: Update Environment Variables (Vercel)

1. Go to: https://vercel.com/your-project/settings/environment-variables
2. **Update/Add these variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_xxx...` | Live secret key |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx...` | Live publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx...` | From webhook endpoint |
| `STRIPE_MONTHLY_PRICE_ID` | `price_live_xxx...` | For FREE trial ($12.99/mo) |
| `STRIPE_TRIAL_PRICE_ID` | `price_live_xxx...` | For $1 trial (optional) |

3. **Set variables for all environments**: Production, Preview, Development
4. **Click "Save"**

### Step 7.5: Redeploy Application

1. Go to your Vercel dashboard
2. Click "Redeploy" on the latest deployment
3. Wait for deployment to complete

### Step 7.6: Test with Real Card

1. Go to https://resetbiology.com/portal
2. Click "Start FREE Trial"
3. Enter a **real card** (your own card)
4. Complete checkout
5. Verify in Stripe Dashboard:
   - Go to https://dashboard.stripe.com/subscriptions
   - You should see a new subscription with status "Trialing"
6. **Cancel the test subscription** in Stripe Dashboard to avoid charges

### Troubleshooting Go-Live Issues

| Issue | Solution |
|-------|----------|
| "Stripe not configured" | Check `STRIPE_SECRET_KEY` is set in Vercel |
| Webhook signature failed | Ensure `STRIPE_WEBHOOK_SECRET` matches live endpoint |
| Wrong price charged | Verify `STRIPE_MONTHLY_PRICE_ID` is the live price ID |
| Subscription not activating | Check webhook logs in Stripe Dashboard |
| "Invalid API key" | Make sure you're using `sk_live_` not `sk_test_` |

### Important Notes

- **Never commit live keys to git** - always use environment variables
- **Test mode keys** start with `pk_test_` and `sk_test_`
- **Live mode keys** start with `pk_live_` and `sk_live_`
- Webhooks in test mode won't work in production (and vice versa)

## How the Trial Works

1. **User clicks "Start $1 Trial"**
   - Redirected to Stripe Checkout
   - Enters payment method
   - Charged $1 immediately

2. **Trial period (14 days):**
   - User has full access to all premium features
   - `subscriptionStatus` = "active"
   - User can cancel anytime without additional charges

3. **After 14 days:**
   - If user hasn't canceled:
     - Automatically charged $12.99
     - Subscription continues monthly at $12.99
   - If user canceled during trial:
     - No additional charges
     - Access ends at trial expiry
     - `subscriptionStatus` = "expired"

## Files Created/Modified

**Created:**
- `/src/components/Subscriptions/TrialSubscription.tsx` - Trial subscription modal UI
- `/app/api/subscriptions/trial/route.ts` - Trial checkout session endpoint
- `/STRIPE_TRIAL_SETUP.md` - This setup guide

**Existing (already working):**
- `/app/api/stripe/webhook/route.ts` - Handles subscription events
- `/app/api/subscriptions/status/route.ts` - Returns user subscription status
- `/src/components/Subscriptions/SubscriptionGate.tsx` - Premium feature gate
- `/src/lib/subscriptionHelpers.ts` - Subscription helper functions

## Troubleshooting

### Issue: "Stripe not configured" error
**Solution:** Ensure `STRIPE_SECRET_KEY` is set in `.env.local` and Vercel environment variables

### Issue: Webhook signature verification failed
**Solution:**
1. Check that `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe Dashboard
2. Ensure webhook endpoint URL is correct
3. Check that you're using the right secret for test/live mode

### Issue: User subscription not activating
**Solution:**
1. Check webhook logs in Stripe Dashboard
2. Verify webhook endpoint is receiving events
3. Check server logs for errors in `/api/stripe/webhook`
4. Ensure user email matches between Stripe and Auth0

### Issue: Trial not appearing as 14 days
**Solution:**
1. Verify the Stripe price has `trial_period_days: 14` configured
2. Check the checkout session includes `subscription_data.trial_period_days`
3. Look in Stripe Dashboard subscription details for trial end date

## Integration Points

To add the trial button to any page:

```typescript
import TrialSubscription from '@/components/Subscriptions/TrialSubscription'

// In your component:
const [showTrial, setShowTrial] = useState(false)

// Render:
{showTrial && <TrialSubscription onClose={() => setShowTrial(false)} />}

// Trigger:
<button onClick={() => setShowTrial(true)}>
  Start $1 Trial
</button>
```

Or use the SubscriptionGate to protect premium features:

```typescript
import SubscriptionGate from '@/components/Subscriptions/SubscriptionGate'

<SubscriptionGate featureName="Peptide Tracking">
  <YourPremiumComponent />
</SubscriptionGate>
```
