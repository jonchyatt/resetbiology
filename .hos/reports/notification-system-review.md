# Notification System Review
**Date:** November 8, 2025
**Reviewer:** Claude Code

## Executive Summary

The notification system updates make significant improvements but have **1 critical schema bug (FIXED)** and **1 medium-priority timezone handling concern**. Overall the architecture is solid.

---

## ✅ What's Working Well

### 1. **Database Schema Design**
- ✅ Timezone field added to `NotificationPreference` (line 549)
- ✅ Protocol relation added to `ScheduledNotification` (line 569)
- ✅ Both push and email channels supported via `type` field
- ✅ Proper indexing on `[reminderTime, sent]` for efficient cron queries

**FIXED:** Added missing `scheduledNotifications` relation to `user_peptide_protocols` model (line 269)

### 2. **Channel Management**
The system now properly handles both push and email:
```typescript
const channels: NotificationChannel[] = []
if (prefs.pushEnabled) channels.push('push')
if (prefs.emailEnabled) channels.push('email')
```
- Cleans up old notifications when both channels disabled (scheduleNotifications.ts:54-62)
- Creates separate notification records for each channel

### 3. **Cron Authorization** (route.ts:25-34)
Flexible auth that supports:
- Bearer token with `CRON_SECRET`
- Query param `?secret=CRON_SECRET`
- Vercel's `x-vercel-cron` header (if `CRON_ALLOW_HEADER=true`)

This is production-ready and secure.

### 4. **Email Integration**
New `sendDoseReminderEmail` function (email.ts:260-314):
- ✅ Uses existing Resend client
- ✅ Professional HTML template
- ✅ Localizes reminder time for user
- ✅ Includes deep link to peptide tracker

### 5. **Frontend Improvements**
NotificationPreferences.tsx now:
- ✅ Fetches existing settings on mount
- ✅ Shows clear error states (denied, no browser support)
- ✅ Guides iOS users to install PWA first
- ✅ Displays user's timezone
- ✅ Allows refreshing timezone from device

---

## ⚠️ Issues Found

### 1. **CRITICAL: Missing Schema Relation** (FIXED ✅)
**File:** `prisma/schema.prisma` line 255-271

**Problem:** The `user_peptide_protocols` model was missing the back-reference to `ScheduledNotification[]`.

**Status:** **FIXED** - Added `scheduledNotifications ScheduledNotification[]` on line 269

**Action Required:** Already ran `npx prisma generate` successfully.

---

### 2. **MEDIUM: Timezone Conversion Logic** ⚠️
**File:** `src/lib/scheduleNotifications.ts` lines 157-171

**Current Implementation:**
```javascript
function getZonedDate(date: Date, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0))

  const tzDate = new Date(
    utcDate.toLocaleString('en-US', {
      timeZone,
      hour12: false
    })
  )

  const diff = utcDate.getTime() - tzDate.getTime()
  return new Date(utcDate.getTime() + diff)
}
```

**Concerns:**
1. **String parsing fragility**: `new Date(string)` parses in the server's local timezone, not UTC
2. **DST edge cases**: May have issues during daylight saving time transitions
3. **No validation**: Doesn't verify if timezone string is valid
4. **Hard to test**: The math approach is difficult to reason about

**Example Trace:**
```
Input: date=2025-01-08, time="08:00", timeZone="America/New_York"
Expected: Date representing 08:00 EST = 13:00 UTC

Step 1: utcDate = 2025-01-08T08:00:00.000Z (WRONG - this is 08:00 UTC, not local)
Step 2: toLocaleString converts UTC 08:00 to EST = "01/08/2025, 03:00:00"
Step 3: new Date("01/08/2025, 03:00:00") - PARSED IN SERVER TIMEZONE (could be anything!)
Step 4: diff calculation will be wrong if server isn't UTC
```

**Recommended Fix:** Use a proper timezone library
```bash
npm install date-fns-tz
```

```typescript
import { zonedTimeToUtc } from 'date-fns-tz'

function getZonedDate(date: Date, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number)

  // Construct ISO string in local timezone
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(hours).padStart(2, '0')
  const minute = String(minutes).padStart(2, '0')

  const localDateString = `${year}-${month}-${day}T${hour}:${minute}:00`

  // Convert to UTC using the timezone
  return zonedTimeToUtc(localDateString, timeZone)
}
```

**Impact:**
- **Current**: May work if Vercel server timezone is UTC (which it usually is)
- **Risk**: Could break in local development or different deployment environments
- **DST**: May calculate wrong times during spring forward / fall back

**Priority:** Medium - Should be fixed before relying on notifications for production

---

### 3. **LOW: Missing Environment Variable** ℹ️
**File:** `.env.local`

The code references `CRON_ALLOW_HEADER` (send/route.ts:33) but it's not defined in `.env.local`.

**Fix:** Add to `.env.local` and Vercel environment:
```bash
# Allow Vercel cron header instead of secret
CRON_ALLOW_HEADER=true
```

**Current Status:** Will fall back to secret-based auth (which works fine)

---

## 📋 Testing Recommendations

### Before Deploying:

1. **Test Timezone Handling:**
```bash
# Create a test script
node -e "
const date = new Date('2025-01-08')
const time = '08:00'
const tz = 'America/New_York'
// Run getZonedDate and verify UTC timestamp
"
```

2. **Test Notification Flow:**
- Create protocol with 15min reminder
- Wait for notification
- Verify arrives at correct time in user's timezone

3. **Test iOS PWA:**
- Install to home screen
- Request notification permission
- Verify push works when app closed

4. **Test Email Fallback:**
- Disable push
- Enable email
- Verify email arrives via Resend

---

## 🎯 Deployment Checklist

- [x] Run `npx prisma generate` (DONE)
- [ ] Add `CRON_ALLOW_HEADER=true` to Vercel env
- [ ] Deploy to production
- [ ] Test timezone conversion with real user data
- [ ] Consider adding `date-fns-tz` for timezone handling
- [ ] Monitor Vercel cron logs for errors

---

## 📊 Overall Assessment

**Architecture:** ✅ Excellent
**Database Design:** ✅ Correct (after fix)
**API Security:** ✅ Production-ready
**Email System:** ✅ Well-implemented
**Frontend UX:** ✅ User-friendly
**Timezone Handling:** ⚠️ Needs improvement

**Recommendation:** The system is **functional and ready to test**, but I recommend fixing the timezone conversion logic with `date-fns-tz` before relying on it for production notifications. The current implementation may work on Vercel (UTC servers) but could have edge cases.

---

## 🔧 Quick Fix Command

```bash
npm install date-fns-tz
```

Then replace the `getZonedDate` function in `src/lib/scheduleNotifications.ts` with the version shown in section 2 above.

---

**End of Review**
