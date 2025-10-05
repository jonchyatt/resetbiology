# Fix: Use Different Stripe Plugin (Allows Manual API Keys)

## Problem
The official "WooCommerce Stripe Gateway" plugin removed manual API key entry in 2024. It now forces OAuth connection, which creates a SEPARATE Stripe account instead of using your existing one.

## Solution: Use "Stripe For WooCommerce" by Payment Plugins

This plugin still allows manual API key entry so you can use YOUR EXISTING Stripe account.

### Step 1: Remove Current Stripe Plugin

1. Go to **Plugins** → **Installed Plugins**
2. Find **"WooCommerce Stripe Payment Gateway"**
3. Click **Deactivate**
4. Click **Delete**

### Step 2: Install Alternative Stripe Plugin

1. Go to **Plugins** → **Add New Plugin**
2. Search for: **"Stripe For WooCommerce"**
3. Look for the one by **"Payment Plugins, support@paymentplugins.com"**
4. Click **Install Now**
5. Click **Activate**

### Step 3: Configure with YOUR API Keys

1. Go to **WooCommerce** → **Settings** → **Payments**
2. Find **"Stripe Credit Cards"** or similar
3. Click **Manage** or **Set up**
4. You should now see fields for:
   - **Test Publishable Key**
   - **Test Secret Key**

5. Paste your keys from `woocommerce/.env` file:
   - **Test Publishable Key:** `pk_test_...` (from your Stripe dashboard)
   - **Test Secret Key:** `sk_test_...` (from your Stripe dashboard)

6. Enable **Test Mode**

7. Click **Save Changes**

### Step 4: Test It Works

1. Visit your store: http://localhost:8080
2. Add a product to cart
3. Go to checkout
4. Use test card: **4242 4242 4242 4242**
5. Should process successfully using YOUR Stripe account

## Why This Plugin?

✅ **Same Stripe Account** - Uses your existing account (same as main portal)
✅ **Unified Revenue** - All sales in one Stripe dashboard
✅ **Manual API Keys** - No forced OAuth connection
✅ **Same Features** - Credit cards, Apple Pay, Google Pay, etc.
✅ **Free Plugin** - No additional costs

## Alternative Plugin Names to Search:

If "Stripe For WooCommerce" by Payment Plugins isn't available, try:
- "WP Simple Pay" (lite version allows basic Stripe)
- "Payment Gateway for Stripe on WooCommerce" by WebToffee
- Any plugin that explicitly mentions "manual API keys" in description

The key is finding one that allows **manual API key entry** instead of forcing OAuth.
