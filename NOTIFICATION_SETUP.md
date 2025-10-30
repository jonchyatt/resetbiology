# Push Notification Setup Guide

This guide explains how to set up push notifications for peptide dose reminders.

## Required Environment Variables

Add these environment variables to your Vercel deployment:

### 1. VAPID Keys (Web Push Notifications)

These keys were generated for your application and must be added to Vercel:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BP1b4aywJDsvvM0bJeYYjfptTZPUjFsrvn6Yqq029-FDzVyOWxkWcMpfx_e3V1AA4kpbvoPQs0JXZB0gi8jwkfY

VAPID_PUBLIC_KEY=BP1b4aywJDsvvM0bJeYYjfptTZPUjFsrvn6Yqq029-FDzVyOWxkWcMpfx_e3V1AA4kpbvoPQs0JXZB0gi8jwkfY

VAPID_PRIVATE_KEY=Nk4W1iYxu7xBjPRK-IYlJJGMlglK5mB3uUdyYI6JIao
```

**⚠️ IMPORTANT:** Keep the VAPID_PRIVATE_KEY secret! Do not commit it to git.

### 2. Cron Secret

Generate a random secret for securing the cron endpoint:

```bash
# Generate a random secret
openssl rand -base64 32
```

Then add it to Vercel:

```env
CRON_SECRET=<your-generated-secret-here>
```

## How to Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - Variable name: (e.g., `VAPID_PUBLIC_KEY`)
   - Value: (paste the key)
   - Environments: Select **Production**, **Preview**, and **Development**
4. Click **Save**

## Vercel Cron Job Configuration

The cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/send",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes to check for and send pending notifications.

## How It Works

### 1. User Adds a Protocol
When a user creates a new peptide protocol:
1. Default notification preferences are created (push enabled, 15 min reminder)
2. Notifications are scheduled for the next 30 days
3. Each notification is created in the `ScheduledNotification` table

### 2. User Enables/Disables Notifications
When a user changes notification preferences:
1. If **enabled**: Old notifications are deleted and new ones are created with updated preferences
2. If **disabled**: All future notifications are canceled

### 3. Cron Job Sends Notifications
Every 5 minutes, the cron job:
1. Finds notifications where `reminderTime <= now` and `sent = false`
2. Sends push notifications to all user's devices
3. Marks notifications as `sent`

### 4. User Receives Notification
The service worker (`public/service-worker.js`) handles the push event:
1. Shows a notification with title, body, and icon
2. When clicked, opens the peptides page
3. Vibrates the device

## Testing Notifications

### Local Testing

1. **Enable notifications in your browser:**
   - Open the peptides page on your phone/PWA
   - Click the bell icon next to a protocol
   - Click "Enable push notifications →"
   - Grant permission when prompted

2. **Manually trigger the cron job:**
   ```bash
   curl -X POST http://localhost:3000/api/notifications/send \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Check the database:**
   ```sql
   SELECT * FROM scheduled_notifications
   WHERE sent = false
   ORDER BY reminderTime ASC;
   ```

### Production Testing

1. Add a protocol with a dose time 20 minutes from now
2. Wait 5 minutes for the cron to run
3. You should receive a notification 15 minutes before the dose time

## Notification Flow Diagram

```
User Creates Protocol
         ↓
Default Preferences Created
    (push enabled)
         ↓
Schedule Next 30 Days of Notifications
         ↓
         ├─→ ScheduledNotification 1 (dose time - 15 min)
         ├─→ ScheduledNotification 2 (dose time - 15 min)
         └─→ ... (more notifications)

Every 5 minutes:
         ↓
    Cron Job Runs
         ↓
    Find Unsent Notifications
    (reminderTime <= now)
         ↓
    Send Push to User's Devices
         ↓
    Mark as Sent
```

## Troubleshooting

### Notifications Not Sending

1. **Check environment variables are set in Vercel**
   - Go to Settings → Environment Variables
   - Verify all VAPID keys and CRON_SECRET are present

2. **Check cron job is running**
   - Go to Vercel Deployment Logs
   - Filter by `/api/notifications/send`
   - Should run every 5 minutes

3. **Check database has scheduled notifications**
   ```sql
   SELECT COUNT(*) FROM scheduled_notifications WHERE sent = false;
   ```

4. **Check user has granted notification permission**
   - In browser console: `Notification.permission` should return `"granted"`

5. **Check push subscription exists**
   ```sql
   SELECT * FROM push_subscriptions WHERE userId = 'USER_ID';
   ```

### Notifications Not Appearing on Phone

1. **PWA must be installed** - Notifications only work when the app is installed to home screen
2. **Check phone notification settings** - Ensure browser/PWA notifications are enabled
3. **Test with browser DevTools** - Use Chrome DevTools → Application → Push Messaging

## Files Modified/Created

### New Files
- `src/lib/scheduleNotifications.ts` - Notification scheduling logic
- `NOTIFICATION_SETUP.md` - This file

### Modified Files
- `app/api/notifications/preferences/route.ts` - Added scheduling on preference save
- `app/api/peptides/protocols/route.ts` - Added scheduling on protocol create/update
- `app/api/notifications/send/route.ts` - Already existed (cron job handler)
- `public/service-worker.js` - Already existed (push event handler)
- `src/components/Notifications/NotificationPreferences.tsx` - Already existed (UI)

## Next Steps

1. ✅ Add environment variables to Vercel
2. ✅ Deploy the changes
3. ✅ Test on your phone by adding a protocol
4. ✅ Verify notifications arrive 15 minutes before dose time
5. ✅ Adjust cron frequency if needed (currently every 5 minutes)

## Security Notes

- VAPID private key must be kept secret
- Cron endpoint is protected by CRON_SECRET
- Only authenticated users can create/modify their own notifications
- Push subscriptions are tied to user accounts
