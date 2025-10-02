# Stripe Setup Instructions for Reset Biology

## Current Status
- ✅ 32 products imported from CellularPeptide.com to MongoDB
- ❌ Products NOT synced with Stripe (missing stripePriceId)
- ❌ Stripe keys NOT configured in production (Vercel)
- ✅ Checkout flow code is ready and waiting for Stripe configuration

## What's Needed to Enable Orders

### Step 1: Add Stripe Keys to Vercel Environment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the `reset-biology-website` project
3. Go to Settings → Environment Variables
4. Add these variables:

```
STRIPE_SECRET_KEY=sk_test_... (your test key from Stripe Dashboard)
STRIPE_PUBLISHABLE_KEY=pk_test_... (your test key from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (optional for now, needed for webhooks)
```

5. Click "Save" and redeploy the site

### Step 2: Get Your Stripe Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test Mode** (toggle in top right)
3. Go to Developers → API Keys
4. Copy your test keys:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)

### Step 3: Sync Products to Stripe

After adding the keys and redeploying:

1. Go to https://resetbiology.com/admin/store
2. Log in with admin account
3. For each product, click "Sync to Stripe" button
4. This creates the product and price in Stripe and saves the stripePriceId

### Step 4: Test the Order Flow

1. Go to https://resetbiology.com/order
2. Click "Buy Now" on any product
3. You should be redirected to Stripe Checkout
4. Use test card: 4242 4242 4242 4242
5. Complete the test purchase

## How the System Works

### Two Admin Systems (Currently Separate):
1. **Portal Admin** (`/admin`) - Manages peptides, workouts, food for the portal features
2. **Store Admin** (`/admin/store`) - Manages products and Stripe integration for ordering

### Product Flow:
```
CellularPeptide.com → Scraped Data → MongoDB → Sync to Stripe → Customer Orders
```

### Current Database State:
- Products table has 32 items from CellularPeptide import
- Each product has name, description, price, and protocol info
- Products need stripePriceId to work with checkout

## Troubleshooting

### "Payment System Not Available" Error
- Stripe keys are not configured in environment variables
- Add keys to Vercel and redeploy

### "No Price Configured" on Products
- Product hasn't been synced to Stripe
- Use /admin/store to sync each product

### Can't Access /admin/store
- User needs admin role in database
- Update user.role = 'admin' in MongoDB

## Test Cards for Stripe

Use these in test mode:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Requires Auth: 4000 0025 0000 3155

## Next Steps After Setup

1. ✅ Navigation simplified (Portal as hub)
2. ✅ Admin links hidden for non-admin users
3. ✅ Store Management linked from Admin dashboard
4. ⏳ Enable Auth0 authentication (waiting for Next.js 15 compatibility)
5. ⏳ Connect portal features with store (unified user experience)
6. ⏳ Add subscription/recurring payments
7. ⏳ Implement order history and tracking