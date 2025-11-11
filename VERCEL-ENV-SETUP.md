# Vercel Environment Variables Setup

## ⚠️ CRITICAL: Required for Notification System

The notification system will NOT work in production without these environment variables configured in the Vercel dashboard.

## How to Set Up (Vercel Dashboard)

1. Go to: https://vercel.com/jonchyatts-projects/reset-biology-website/settings/environment-variables
2. Add each variable below to **Production** environment
3. Click "Save" after adding each one

---

## Required Environment Variables

### 1. **VAPID Keys (Push Notifications)**

These are already generated and in `.env.local`. Copy them to Vercel:

```bash
VAPID_PUBLIC_KEY=BIJMd8YBi-qe2Ni7O2sf78wqRFQeFULXkcXG-xzFCaP6k1-Zqmq8nMEcGs-ECX9k8DtU-95ifFn0xRzD03qD3V4
```

```bash
VAPID_PRIVATE_KEY=SDjnu9EPisCf_YPHR-rfad3h2oeisilzRmj5qXxJPj0
```

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BIJMd8YBi-qe2Ni7O2sf78wqRFQeFULXkcXG-xzFCaP6k1-Zqmq8nMEcGs-ECX9k8DtU-95ifFn0xRzD03qD3V4
```

**Note:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be set as a **Build** environment variable (not just runtime).

---

### 2. **Cron Job Authentication**

```bash
CRON_SECRET=resetbio-cron-secret-2025
```

**Alternative:** Instead of setting `CRON_SECRET`, you can set:

```bash
CRON_ALLOW_HEADER=true
```

This allows Vercel's `x-vercel-cron` header to authenticate cron jobs automatically.

**Recommended:** Use `CRON_ALLOW_HEADER=true` for simplicity.

---

### 3. **Resend API Key (Email Notifications)**

```bash
RESEND_API_KEY=re_4AUfjCz_Fw9DsgujTcXg32fnwtFtDtBJ
```

---

### 4. **Auth0 (Already Set, Verify These)**

```bash
AUTH0_SECRET=oaZ0uKqOOpIa0JgX+pyGEFMZOp61aiYDJA6fgTjZqyDNWWJ1sR5OvHoJKp9E0QWQP1UKE21feOqFu7PICnXuWg==
AUTH0_BASE_URL=https://resetbiology.com
AUTH0_ISSUER_BASE_URL=https://dev-4n4ucz3too5e3w5j.us.auth0.com
AUTH0_CLIENT_ID=YDXQaFLWq8e5FuW5GMRBJ4wceomdAdzt
AUTH0_CLIENT_SECRET=3sZkNiaeXNQC-rrHfQrYIxu6mev0WDM-_vF-HpZT0ICZZMkycFQeUK9KPb4Mu5sd
```

---

### 5. **Database (Already Set, Verify)**

```bash
DATABASE_URL=mongodb+srv://resetbiology-app:_DN8QDEm.XK.J8P@cluster0.weld7bm.mongodb.net/resetbiology?retryWrites=true&w=majority&appName=Cluster0
```

---

## Quick Checklist

After setting all variables in Vercel, verify with this checklist:

- [ ] VAPID_PUBLIC_KEY (Production)
- [ ] VAPID_PRIVATE_KEY (Production)
- [ ] NEXT_PUBLIC_VAPID_PUBLIC_KEY (Production + **Build**)
- [ ] CRON_ALLOW_HEADER=true (Production) **OR** CRON_SECRET (Production)
- [ ] RESEND_API_KEY (Production)
- [ ] AUTH0_* variables (already set)
- [ ] DATABASE_URL (already set)

---

## Testing After Setup

1. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "fix: Notification system - all issues resolved"
   git push origin master
   ```

2. **Wait 5 minutes** for first cron job to run

3. **Check cron logs:**
   - Go to: https://vercel.com/jonchyatts-projects/reset-biology-website/logs
   - Filter by: `/api/notifications/send`
   - Should see "🔔 Cron job triggered notification send"
   - Should NOT see "401 Unauthorized" or "Missing environment variables"

4. **Test notifications manually:**
   - Go to: https://resetbiology.com/peptides
   - Click "Remind Me" on any protocol
   - Triple-click "Notification Preferences" title to activate test mode
   - Click "Test (60s)" then "Send Now"
   - Should receive push notification on your device

---

## Troubleshooting

### Issue: "401 Unauthorized" in cron logs
**Solution:** Set `CRON_ALLOW_HEADER=true` in Vercel environment variables

### Issue: "Missing environment variables: VAPID_PUBLIC_KEY"
**Solution:** Add all VAPID keys to Vercel environment variables (Production)

### Issue: "VAPID public key not configured" in browser console
**Solution:** Ensure `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set as a **Build** environment variable, then redeploy

### Issue: Push subscriptions failing silently
**Solution:** Check browser console for errors. Ensure VAPID key conversion is working (should see "✅ VAPID key converted to Uint8Array")

### Issue: No notifications after 30 days
**Solution:** Fixed! Replenish cron runs daily at 2 AM UTC to refill queue

---

## What Changed (For Reference)

1. ✅ Fixed cron authentication (CRON_ALLOW_HEADER)
2. ✅ Fixed push notification error handling (doesn't mark failed as sent)
3. ✅ Added 30-day queue replenishment cron
4. ✅ Fixed dose-time parsing (supports "AM & PM", "twice daily")
5. ✅ Fixed VAPID key conversion in auto-subscribe
6. ✅ Fixed edit modal time preloading for "AM & PM"
7. ✅ Added automatic cleanup of expired push subscriptions
8. ✅ Added environment variable validation with helpful error messages
9. ✅ Fixed UI to show correct dose count from slash-separated times

---

**Last Updated:** $(date)
