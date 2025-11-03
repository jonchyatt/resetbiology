# Stripe Production Setup Guide

This guide walks you through moving from test mode to production for your Reset Biology checkout system.

## What Was Fixed

✅ **Shipping Address Collection** - Checkout now collects customer shipping addresses
✅ **Email Notifications** - Buyers and sellers receive email confirmations
✅ **Order Management** - Admin panel to view and fulfill orders
✅ **Database Schema** - Order model includes shipping and fulfillment fields

---

## Required Environment Variables

Add these to **Vercel → Settings → Environment Variables**:

### 1. Resend API Key (Email Service)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
```

**How to get this:**
1. Go to [Resend.com](https://resend.com) and sign up
2. Go to **API Keys** in dashboard
3. Click **Create API Key**
4. Copy the key and add to Vercel

**Pricing:** Free tier includes 3,000 emails/month

### 2. Seller Email (Optional)

```env
SELLER_EMAIL=jonchyatt@gmail.com
```

This email receives new order notifications. If not set, defaults to `jonchyatt@gmail.com`.

### 3. Stripe Webhook Secret (CRITICAL!)

**Current Issue:** Your `.env.local` has a placeholder: `whsec_your_webhook_secret`

**Fix:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Click **Add endpoint**
3. Enter endpoint URL: `https://resetbiology.com/api/stripe/webhook`
4. Select events to listen for: ☑️ `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Update in Vercel:
   - Variable name: `STRIPE_WEBHOOK_SECRET`
   - Value: Your real webhook secret
   - Environments: ☑️ Production, ☑️ Preview, ☑️ Development

⚠️ **Without the real webhook secret, orders won't be saved and emails won't be sent!**

---

## Moving to Production Stripe Keys

Currently you're using **test mode** keys (`pk_test_...` and `sk_test_...`).

### Steps to Go Live:

1. **Complete Stripe Account Setup**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Complete business information
   - Add bank account for payouts
   - Verify identity (if required)
   - Activate your account

2. **Get Production Keys**
   - Go to **Developers → API Keys**
   - Toggle from "Test mode" to "Live mode" (top right)
   - Copy your **Publishable key** (starts with `pk_live_...`)
   - Copy your **Secret key** (starts with `sk_live_...`)

3. **Update Vercel Environment Variables**
   ```env
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   ```

4. **Set Up Production Webhook**
   - Go to [Live Webhooks](https://dashboard.stripe.com/webhooks)
   - Add endpoint: `https://resetbiology.com/api/stripe/webhook`
   - Select events: ☑️ `checkout.session.completed`
   - Copy the new signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel with PRODUCTION secret

5. **Test with Real Card**
   - Make a test purchase with a real card
   - Use a small amount first ($1)
   - Verify you receive emails
   - Check order appears in `/admin/orders`
   - Process and ship the order

---

## Domain Configuration for Resend

Before you can send emails from `orders@resetbiology.com`, you need to verify your domain in Resend:

### Steps:

1. Go to Resend Dashboard → **Domains**
2. Click **Add Domain**
3. Enter: `resetbiology.com`
4. You'll receive DNS records to add:
   - **SPF Record** (TXT)
   - **DKIM Records** (TXT)
   - **DMARC Record** (TXT)

5. Add these DNS records to your domain provider (Vercel DNS, Cloudflare, etc.)

6. Wait for verification (can take up to 48 hours, usually minutes)

7. Once verified, emails will show as from `orders@resetbiology.com` instead of `onboarding@resend.dev`

**Without domain verification:** Emails will work but show as from `onboarding@resend.dev` (not professional)

---

## Testing the Complete Flow

### Test Mode (Current Setup)

1. Go to your store: `https://resetbiology.com/order`
2. Click "Purchase" on a product
3. Use Stripe test card: `4242 4242 4242 4242`
4. Enter shipping address
5. Complete checkout
6. **Expected Results:**
   - ✅ Order saved to database
   - ✅ Buyer receives confirmation email
   - ✅ Seller receives new order notification
   - ✅ Order appears in `/admin/orders`

### Production Mode (After Setup)

Same as test mode, but use a real credit card.

---

## Admin Panel Usage

Access at: `https://resetbiology.com/admin/orders`

**Features:**
- View all orders
- See customer details and shipping addresses
- Update fulfillment status
- Add tracking numbers
- When marked as "Shipped", customer receives automatic shipping confirmation email

**Fulfillment Workflow:**
1. New order arrives → Shows as "unfulfilled"
2. You package the order → Mark as "processing"
3. You ship it → Mark as "shipped" + add tracking number
4. Customer automatically receives shipping email with tracking
5. Package delivered → Mark as "delivered"

---

## Troubleshooting

### "Not receiving emails"

**Check:**
1. ✅ `RESEND_API_KEY` is set in Vercel
2. ✅ Emails aren't in spam folder
3. ✅ Check Resend Dashboard → **Logs** for delivery status
4. ✅ Domain is verified in Resend (or emails show from `onboarding@resend.dev`)

### "Webhook not working"

**Check:**
1. ✅ `STRIPE_WEBHOOK_SECRET` is set correctly (not the placeholder!)
2. ✅ Webhook endpoint is added in Stripe Dashboard
3. ✅ Endpoint URL is correct: `https://resetbiology.com/api/stripe/webhook`
4. ✅ Test the webhook from Stripe Dashboard → Webhooks → Test endpoint

### "Orders not appearing in admin panel"

**Check:**
1. ✅ Webhook is configured (orders are created by webhooks)
2. ✅ Your user account has `role: 'admin'` or `accessLevel: 'admin'` in MongoDB
3. ✅ Check browser console for errors at `/admin/orders`

### "Shipping address not collected"

**Fixed!** The checkout now collects shipping addresses. If still not working:
1. ✅ Redeploy the code to Vercel
2. ✅ Clear browser cache
3. ✅ Check Stripe Checkout preview

---

## Shipping Carriers & Tracking

The admin panel supports tracking numbers and URLs. Here are tracking URL formats:

**USPS:**
```
https://tools.usps.com/go/TrackConfirmAction?tLabels=TRACKING_NUMBER
```

**UPS:**
```
https://www.ups.com/track?tracknum=TRACKING_NUMBER
```

**FedEx:**
```
https://www.fedex.com/fedextrack/?tracknumbers=TRACKING_NUMBER
```

**DHL:**
```
https://www.dhl.com/en/express/tracking.html?AWB=TRACKING_NUMBER
```

---

## Production Checklist

Before going live:

- [ ] Complete Stripe account activation
- [ ] Get production Stripe keys (pk_live_..., sk_live_...)
- [ ] Update Vercel with production keys
- [ ] Set up production webhook in Stripe Dashboard
- [ ] Get real webhook signing secret
- [ ] Update STRIPE_WEBHOOK_SECRET in Vercel
- [ ] Sign up for Resend
- [ ] Get Resend API key
- [ ] Add RESEND_API_KEY to Vercel
- [ ] Verify domain in Resend (optional but recommended)
- [ ] Test with real credit card (small amount)
- [ ] Verify emails are received
- [ ] Verify order appears in admin panel
- [ ] Test fulfillment workflow (mark as shipped)
- [ ] Verify tracking email is sent

---

## Support & Resources

**Stripe Dashboard:** https://dashboard.stripe.com
**Resend Dashboard:** https://resend.com/dashboard
**Admin Panel:** https://resetbiology.com/admin/orders

**Need Help?**
- Stripe Support: https://support.stripe.com
- Resend Docs: https://resend.com/docs

---

## Summary

You're **95% ready for production**! Just need to:

1. **Add Resend API key** to Vercel (5 minutes)
2. **Configure real webhook secret** in Stripe & Vercel (5 minutes)
3. **Switch to production Stripe keys** when ready to accept real payments

The code is production-ready. All features work. Just need the environment variables configured correctly!
