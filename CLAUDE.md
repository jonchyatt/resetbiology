# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
**Last Updated:** November 5, 2025

# ⚡ FIRST ACTION EVERY SESSION

**READ THIS FILE IMMEDIATELY:** `.hos/SESSION-INIT.md`

This file contains:
- HOS sub-agent rules (silent, no report back)
- Playwright MCP location
- Project structure and existing analysis
- Common tasks and commands
- What NOT to recreate

**DO NOT START ANY WORK until you've read SESSION-INIT.md**

---

# 🚨 CRITICAL: Change Protocol - MUST FOLLOW BEFORE ANY CODE CHANGES

## The Four-Step Protocol (MANDATORY)

Before making ANY code changes, you MUST follow these steps:

### 1. **UNDERSTAND Phase**
- What exactly is the problem?
- What's currently working correctly?
- What's the expected behavior?

### 2. **INVESTIGATE Phase** (Read-Only)
- Look at current code
- Trace the actual flow
- Identify the MINIMAL change needed

### 3. **PROPOSE Phase**
- State: "The problem appears to be X"
- State: "The simplest fix would be Y (usually 1-2 lines)"
- Ask: "Does this make sense before I proceed?"

### 4. **IMPLEMENT Phase** (Only After User Confirmation)
- Make the minimal change
- Test if possible
- Deploy only after verification

## 🛑 Red Flags - STOP Immediately If:
- ❌ User says something "works fine" → DON'T TOUCH THAT SYSTEM
- ❌ Fix requires changing multiple files → PROPOSE FIRST
- ❌ You're about to downgrade/upgrade packages → ASK FIRST
- ❌ The fix seems complex → TRY A ONE-LINE FIX FIRST
- ❌ You're making assumptions → ASK FOR CLARIFICATION

## 📚 Learning From Past Mistakes

### The Auth0 Redirect Incident (September 29, 2025)
**Problem:** "Login redirects to hero page instead of portal"
**What I Did Wrong:** 
- Assumed Auth0 was broken
- Downgraded packages from v4 to v3
- Changed multiple import paths
- Modified authentication system
- Broke working code

**What I Should Have Done:**
- Added `?returnTo=/portal` to login links (2 lines)
- Total time: 2 minutes instead of 30+

**Lesson:** ALWAYS start with the simplest possible change.

---

# Reset Biology Website Development

## Project Overview
Building a complex medical/wellness platform with public marketing site, secure client portal, gamification system, and integrated breath training application.

## Current Session Status (Update This When Ending Session)
- **Date:** November 26, 2025
- **Last Action:** Comprehensive feature update - admin access, breath admin, Stripe trial, email, quiz lookup
- **Deployment:** Pending - TypeScript passes, ready for deploy
- **Next Priority:** Test all new features on production after deployment
- **Watch Out For:** Stripe price ID needs to be set to $12.99 in Stripe Dashboard

## 🎯 Session Progress (November 26, 2025)

### ✅ Completed This Session:

#### 1. **Admin Full Access System**
- Updated `src/lib/subscriptionHelpers.ts` with `isAdmin()` function
- Admin users now bypass all subscription checks
- Admin status returned in `/api/subscriptions/status` endpoint

#### 2. **Breath Exercise Admin System**
- Created `BreathExercise` model in Prisma schema with full customization options
- Built `/admin/breath` page for creating/editing exercises
- Created `/api/breath/exercises` API (GET/POST/PATCH/DELETE)
- Added link to admin dashboard

#### 3. **Predefined Breath Exercises** (Research-Based)
- **Vagal Reset** - 4-8 breathing pattern for parasympathetic activation
- **Deep Relaxation** - 4-6 pattern with 2s hold
- **4-7-8 Sleep Breath** - Dr. Andrew Weil's famous technique
- **Box Breathing** - Navy SEAL stress management (4-4-4-4)
- **Energizing Breath** - Quick 2-2 pattern for energy
- **Quick Calm (Sample)** - For hero page demo

#### 4. **Mini Breath Exercise Component**
- Created `MiniBreathExercise.tsx` for compact breath training
- Created `BreathSample.tsx` for hero page integration
- Fetches sample exercise from database

#### 5. **FREE Trial Subscription ($0 with Payment Collection)**
- Created `/api/subscriptions/free-trial` endpoint
- Updated `TrialSubscription.tsx` to support both FREE and $1 trial
- Price updated to **$12.99/month** (was $29.99)
- Added review reminder text

#### 6. **Multiple Email Recipients for Orders**
- Updated `src/lib/email.ts` with `getOrderNotificationRecipients()`
- Supports `SELLER_EMAILS` env var (comma-separated)
- Falls back to `SELLER_EMAIL` for backwards compatibility

#### 7. **Quiz Results Lookup for Returning Users**
- Created `/api/assessment/my-results` endpoint
- Looks up assessment by authenticated user's email
- Portal shows previous quiz results banner

#### 8. **Portal Trial Banner Logic**
- Banner hidden for subscribers and admins
- Shows FREE trial messaging (was $1)
- Previous assessment results displayed for non-subscribers

### 📋 New Files Created:
```
app/api/breath/exercises/route.ts
app/api/subscriptions/free-trial/route.ts
app/api/assessment/my-results/route.ts
app/admin/breath/page.tsx
src/components/Breath/MiniBreathExercise.tsx
src/components/Hero/BreathSample.tsx
scripts/seed-breath-exercises.ts
```

### 📋 Files Modified:
- `prisma/schema.prisma` - Added BreathExercise model
- `src/lib/subscriptionHelpers.ts` - Added isAdmin() function
- `src/lib/email.ts` - Multiple email recipient support
- `src/components/Subscriptions/TrialSubscription.tsx` - FREE trial, $12.99 price
- `src/components/Portal/EnhancedDashboard.tsx` - Updated trial banner, quiz results
- `app/admin/page.tsx` - Added Breath Exercises link
- `STRIPE_TRIAL_SETUP.md` - Updated documentation

### ⚠️ Action Required After Deploy:
1. **Stripe Dashboard**: Create $12.99/month price in both test and live mode
2. **Vercel Environment Variables**:
   - `STRIPE_MONTHLY_PRICE_ID` = your $12.99 price ID
   - `SELLER_EMAILS` = comma-separated list of notification recipients

## ⚠️ CRITICAL PERFORMANCE REMINDERS
- **CHECK AVAILABLE TOOLS FIRST** - Run `claude mcp list` to see what's connected
- **USE CHROME-DEVTOOLS MCP** - Already configured for browser testing
- **FOLLOW THE FOUR-STEP PROTOCOL** - No exceptions, no shortcuts
- **ONE-LINE FIXES FIRST** - Always try the simplest solution
- **READ THE ERROR** - Don't assume, read what actually failed

## Session Management Guidelines

### When to Keep Same Session:
- Working on same project/feature
- Need context from recent changes
- Debugging ongoing issues

### When to Start New Session:
- Switching to different project
- After major milestone completion
- Session becoming slow/unresponsive
- Need fresh perspective

### Carrying Work Forward:
1. Update this CLAUDE.md file before ending session
2. Mark TODO items as complete/in-progress
3. Add any new learnings to Change Protocol section
4. Note any pending deployments or issues

## Development Environment & Capabilities
- **Operating System**: Windows (moved from WSL2 September 30, 2025)
- **Development Tool**: Claude Code running in Windows VS Code
- **Browser Testing**: ChromeMCP (preferred) or Playwright MCP
- **Production Site**: https://resetbiology.com
- **Testing Preference**: Test on production site when possible using ChromeMCP
- **Screenshots Location**: `C:\Users\jonch\Pictures\Screenshots\` - Check here first for deployment/UI screenshots
- **Note**: Moved out of WSL2 due to Docker conflicts and performance issues

## Testing Strategy - USE CHROME-DEVTOOLS MCP

### Setup Check (RUN FIRST EACH SESSION):
```bash
claude mcp list  # Should show: chrome-devtools: ✓ Connected
```

### Preferred Testing Workflow:
1. **Make changes locally**
2. **Deploy to production** (Vercel) 
3. **Use chrome-devtools MCP to test on production site**
4. **Visual verification directly in Chrome**
5. **No need for complex Playwright scripts**

### Chrome-DevTools MCP Advantages:
- Test on actual production environment
- See real user experience
- Faster than writing test scripts
- Visual debugging in browser
- Direct interaction with live site

### When to Use Localhost:
- Only for initial development
- Database schema changes
- API endpoint testing
- When production deploy would break users

## Architecture & Tech Stack
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **Database**: MongoDB Atlas (production), SQLite (local dev)
- **Authentication**: Auth0 with Google OAuth
- **Deployment**: Vercel (primary), Cloudflare Pages (backup)
- **Styling**: Tailwind CSS with custom design system

## Authentication System (Auth0) - CRITICAL INFO

### How It Works Now (October 1, 2025 Fix):
1. **User logs in via Auth0** → Google OAuth
2. **Auth0 callback** (`app/auth/callback/route.ts`) automatically:
   - Checks if user exists by Auth0 ID
   - If not, checks by email (handles Auth0 ID changes)
   - Creates new user if needed
   - Updates Auth0 ID if user exists with email
3. **All API endpoints** check user via:
   - Auth0 session → get user.sub
   - Find user by auth0Sub OR email
   - Auto-link if needed

### Key Files:
- **Domain**: dev-4n4ucz3too5e3w5j.us.auth0.com
- **Version**: v4.10.0 (WORKING - DON'T CHANGE!)
- **Callback**: `/app/auth/callback/route.ts` (handles user creation)
- **Middleware**: `/middleware.ts` (handles Auth0 session)
- **User Lookup**: APIs use email fallback if Auth0 ID not found

### Common Issues & Fixes:
- **"User not found"**: User exists but Auth0 ID changed → APIs now auto-link by email
- **Protocols not persisting**: Fixed - PeptideTracker now calls `fetchUserProtocols()`
- **New users can't save data**: Fixed - callback auto-creates users

## Common Development Commands

### Quick Start:
```bash
# Start dev server
npm run dev

# Test on production
npx vercel --prod

# Check TypeScript
npx tsc --noEmit
```

### Database:
```bash
# MongoDB production
DATABASE_URL="mongodb+srv://..." npm run dev

# Local SQLite
DATABASE_URL="file:./dev.db" npx prisma db push
```

### Playwright Testing:
```bash
# Save auth state (one time)
npx playwright test tests/save-auth-state.spec.ts --headed --project=chromium

# Open persistent browser (stays open)
npx playwright test tests/open-persistent-browser.spec.ts --headed --project=chromium

# Run timing test with auth
npx playwright test tests/test-timing-with-auth.spec.ts --headed --project=chromium
```

## Deployment Guidelines

### Vercel Deployment (Primary):
1. **Simple Structure**: Keep Next.js in root directory
2. **No vercel.json**: Let Vercel auto-detect
3. **Test locally first**: `npm run build`
4. **Deploy**: `npx vercel --prod`

### Pre-Deployment Checklist:
- [ ] Changes are minimal and tested
- [ ] Build passes locally
- [ ] TypeScript has no errors
- [ ] Committed to git
- [ ] Ready for user testing

## Brand Colors & Styling
- Primary Teal: #3FBFB5
- Secondary Green: #72C247
- Use transparency: `/20` or `/30` with `backdrop-blur-sm`
- Reference: `/order` page for styling patterns

---

# 🚨 PERMANENT FEATURE DEVELOPMENT TODO LIST

## 🔴 CURRENT PRIORITIES (Work on These First)

### ~~1. **Workout Tracking Page** (`/workout`)~~ ✅ COMPLETE!
- ✅ Component exists at `src/components/Workout/WorkoutTracker.tsx`
- ✅ Connected to database via `/api/workout/sessions`
- ✅ Exercise library with 30+ exercises at `/api/workout/exercises`
- ✅ Saves to WorkoutSession table
- ✅ Awards 50 gamification points per workout
- ✅ Supports bulk import of custom exercises

### ~~2. **Nutrition Tracking Page** (`/nutrition`)~~ ✅ COMPLETE!
- ✅ Component exists at `src/components/Nutrition/NutritionTracker.tsx`
- ✅ Connected to database via `/api/nutrition/entries`
- ✅ Food database with search at `/api/nutrition/foods`
- ✅ Saves to FoodEntry table
- ✅ Awards 10 points for daily logging
- ✅ Supports bulk import of custom foods

### ~~3. **PWA + Notification System for Peptide Dose Reminders**~~ ✅ COMPLETE!
- ✅ Progressive Web App with manifest.json
- ✅ Service worker for push notifications
- ✅ NotificationPreferences component
- ✅ Database schema with NotificationPreference, ScheduledNotification, PushSubscription models
- ✅ API endpoints for push notifications
- ✅ "Remind Me" button in peptide tracker
- ✅ 100% free (no Twilio/SMS costs)

### ~~4. **$1 Trial Subscription System**~~ ✅ COMPLETE! (November 23, 2025)
- ✅ TrialSubscription modal component with beautiful UI
- ✅ `/api/subscriptions/trial` endpoint with Stripe integration
- ✅ Trial banner on portal dashboard (auto-shows for non-subscribers)
- ✅ Subscription status checking throughout app
- ✅ Added stripeCustomerId to User model
- ✅ Complete setup guide in STRIPE_TRIAL_SETUP.md
- ✅ 14-day trial for $1, then $29.99/month
- ✅ Webhook integration for subscription events

## 🟡 NEXT UP (After Priorities)

**Phase 1: Database Schema (30 min)**
1. Add to `prisma/schema.prisma`:
```prisma
model NotificationPreference {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  userId          String   @db.ObjectId
  protocolId      String   @db.ObjectId
  pushEnabled     Boolean  @default(true)
  emailEnabled    Boolean  @default(false)
  reminderMinutes Int      @default(15)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id])

  @@unique([userId, protocolId])
  @@map("notification_preferences")
}

model ScheduledNotification {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  userId       String    @db.ObjectId
  protocolId   String    @db.ObjectId
  doseTime     DateTime
  reminderTime DateTime
  type         String    // "push" | "email"
  sent         Boolean   @default(false)
  sentAt       DateTime?
  createdAt    DateTime  @default(now())
  user         User      @relation(fields: [userId], references: [id])

  @@index([reminderTime, sent])
  @@map("scheduled_notifications")
}

model PushSubscription {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  userId       String   @db.ObjectId
  endpoint     String
  keys         Json     // {p256dh, auth}
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])

  @@unique([userId, endpoint])
  @@map("push_subscriptions")
}
```

2. Update User model to add relations:
```prisma
model User {
  // ... existing fields ...
  notificationPreferences NotificationPreference[]
  scheduledNotifications  ScheduledNotification[]
  pushSubscriptions       PushSubscription[]
}
```

3. Run: `npx prisma db push`

**Phase 2: PWA Manifest & Service Worker (45 min)**

4. Create `/public/manifest.json`:
```json
{
  "name": "Reset Biology",
  "short_name": "Reset Bio",
  "description": "Cellular health optimization platform",
  "start_url": "/portal",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#3FBFB5",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

5. Create `/public/service-worker.js`:
```javascript
const CACHE_NAME = 'reset-biology-v1'

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated')
  event.waitUntil(clients.claim())
})

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const options = {
    body: data.body || 'Time for your dose!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'dose-reminder',
    data: {
      url: data.url || '/peptides'
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Dose Reminder', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})
```

6. Update `/app/layout.tsx` to register service worker:
```typescript
// Add to <head> section:
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3FBFB5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

// Add script before closing </body>:
<Script id="register-sw" strategy="afterInteractive">
  {`
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(reg => console.log('SW registered:', reg))
          .catch(err => console.log('SW registration failed:', err))
      })
    }
  `}
</Script>
```

**Phase 3: API Endpoints (60 min)**

7. Create `/app/api/notifications/subscribe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subscription } = await req.json()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { auth0Sub: session.user.sub },
        { email: session.user.email }
      ]
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: user.id,
        endpoint: subscription.endpoint
      }
    },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys
    },
    update: {
      keys: subscription.keys
    }
  })

  return NextResponse.json({ success: true })
}
```

8. Create `/app/api/notifications/preferences/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { auth0Sub: session.user.sub },
        { email: session.user.email }
      ]
    },
    include: {
      notificationPreferences: true
    }
  })

  return NextResponse.json(user?.notificationPreferences || [])
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { protocolId, pushEnabled, emailEnabled, reminderMinutes } = await req.json()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { auth0Sub: session.user.sub },
        { email: session.user.email }
      ]
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const preference = await prisma.notificationPreference.upsert({
    where: {
      userId_protocolId: {
        userId: user.id,
        protocolId
      }
    },
    create: {
      userId: user.id,
      protocolId,
      pushEnabled,
      emailEnabled,
      reminderMinutes
    },
    update: {
      pushEnabled,
      emailEnabled,
      reminderMinutes
    }
  })

  return NextResponse.json(preference)
}
```

9. Create `/app/api/notifications/send/route.ts` (for cron job):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import webpush from 'web-push'

// Set VAPID keys (generate with: npx web-push generate-vapid-keys)
webpush.setVapidDetails(
  'mailto:admin@resetbiology.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find notifications to send
  const notifications = await prisma.scheduledNotification.findMany({
    where: {
      reminderTime: {
        lte: now
      },
      sent: false
    },
    include: {
      user: {
        include: {
          pushSubscriptions: true
        }
      }
    }
  })

  const results = []

  for (const notification of notifications) {
    // Send push notifications
    if (notification.type === 'push') {
      for (const sub of notification.user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as any
            },
            JSON.stringify({
              title: 'Dose Reminder',
              body: 'Time for your peptide dose!',
              url: '/peptides',
              tag: `dose-${notification.id}`
            })
          )
          results.push({ id: notification.id, status: 'sent' })
        } catch (error) {
          console.error('Push notification failed:', error)
          results.push({ id: notification.id, status: 'failed' })
        }
      }
    }

    // Mark as sent
    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: { sent: true, sentAt: new Date() }
    })
  }

  return NextResponse.json({ sent: results.length, results })
}
```

**Phase 4: UI Components (60 min)**

10. Create `/src/components/Notifications/NotificationPreferences.tsx`:
```typescript
'use client'
import { useState, useEffect } from 'react'
import { Bell, Mail } from 'lucide-react'

interface Props {
  protocolId: string
  onClose: () => void
}

export default function NotificationPreferences({ protocolId, onClose }: Props) {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(15)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const requestPushPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission === 'granted') {
        // Subscribe to push
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })

        // Send to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        })
      }
    }
  }

  const savePreferences = async () => {
    await fetch('/api/notifications/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocolId,
        pushEnabled,
        emailEnabled,
        reminderMinutes
      })
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Notification Preferences</h3>

        {/* Push Notifications */}
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-400" />
              <span className="text-white font-semibold">Push Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              disabled={pushPermission !== 'granted'}
              className="w-5 h-5"
            />
          </div>

          {pushPermission !== 'granted' && (
            <button
              onClick={requestPushPermission}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Enable push notifications →
            </button>
          )}
        </div>

        {/* Email Notifications */}
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">Email Reminders</span>
            </div>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="w-5 h-5"
            />
          </div>
        </div>

        {/* Reminder Timing */}
        <div className="mb-6">
          <label className="text-white font-semibold mb-2 block">
            Remind me before dose:
          </label>
          <select
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(Number(e.target.value))}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={savePreferences}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

11. Update `/src/components/Peptides/PeptideTracker.tsx`:
- Import notification component
- Replace "Scheduled" label with "Remind Me" button (line ~1041)
- Add click handler to show notification preferences modal

```typescript
// Add imports
import NotificationPreferences from '@/components/Notifications/NotificationPreferences'
import { Bell } from 'lucide-react'

// Add state
const [showNotificationModal, setShowNotificationModal] = useState(false)
const [selectedProtocolForNotif, setSelectedProtocolForNotif] = useState<string | null>(null)

// Replace the "Scheduled" label section (around line 1040):
<button
  onClick={() => {
    setSelectedProtocolForNotif(protocol.id)
    setShowNotificationModal(true)
  }}
  className={`flex items-center gap-1 text-xs ${isNext ? 'text-primary-200 font-semibold' : 'text-gray-400 hover:text-primary-400'} transition-colors`}
>
  <Bell className="w-3 h-3" />
  <span>{isNext ? 'Remind Me' : 'Set Reminder'}</span>
</button>

// Add modal at bottom of component:
{showNotificationModal && selectedProtocolForNotif && (
  <NotificationPreferences
    protocolId={selectedProtocolForNotif}
    onClose={() => {
      setShowNotificationModal(false)
      setSelectedProtocolForNotif(null)
    }}
  />
)}
```

**Phase 5: Environment & Cron Setup (30 min)**

12. Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

13. Add to `.env.local`:
```
VAPID_PUBLIC_KEY=<public_key>
VAPID_PRIVATE_KEY=<private_key>
CRON_SECRET=<random_secure_string>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
```

14. Create Vercel Cron Job in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/notifications/send",
    "schedule": "*/5 * * * *"
  }]
}
```

**Phase 6: Testing & Deployment (30 min)**

15. Test locally:
```bash
npm run build
npm run dev
```

16. Test on phone:
- Visit localhost:3000 (use ngrok if needed)
- Check for install prompt
- Enable notifications
- Set reminder on a dose
- Verify notification arrives

17. Deploy to production:
```bash
git add .
git commit -m "feat: Add PWA with push notification system for dose reminders"
git push origin master
```

18. Test on production with ChromeMCP:
- Open https://resetbiology.com on mobile
- Install PWA
- Enable notifications
- Set reminder
- Wait for notification

#### 🎯 Success Criteria:
- [ ] Service worker registered
- [ ] Install prompt appears on mobile
- [ ] Push notification permission requested
- [ ] "Remind Me" button visible on doses
- [ ] Notification preferences modal works
- [ ] Push notifications sent at correct times
- [ ] Email fallback works
- [ ] Admin workflow unchanged

#### 📝 Files Created/Modified:
**Created:**
- `/public/manifest.json`
- `/public/service-worker.js`
- `/app/api/notifications/subscribe/route.ts`
- `/app/api/notifications/preferences/route.ts`
- `/app/api/notifications/send/route.ts`
- `/src/components/Notifications/NotificationPreferences.tsx`
- `/vercel.json`

**Modified:**
- `/prisma/schema.prisma` (3 new models + User relations)
- `/app/layout.tsx` (manifest link + SW registration)
- `/src/components/Peptides/PeptideTracker.tsx` (Remind Me button)
- `/.env.local` (VAPID keys)

#### 🚀 How to Trigger in New Session:
Simply say any of:
- "Implement the PWA notification system"
- "Start the dose reminder project"
- "Build the notification feature we discussed"
- "Let's add push notifications for peptides"

Claude will read this plan and execute it step-by-step with a todo list.

---

### 4. **Gamification System Enhancement**
- Points calculation engine
- Achievement badges
- Tier system (Bronze/Silver/Gold/Platinum)
- Use existing GamificationPoint table

### 4. **Journal System Completion**
- Rich text editor for `/journal`
- Entry templates
- History view
- Mood tracking

### 5. **Google Drive Journal Sync**
- OAuth connection flow that lets a user pick/authorize a Drive folder (use `drive.file` scope, store encrypted refresh token + folderId per user).
- Snapshot generator that bundles each day’s journal entry, workout summary, peptide doses, breath notes, and food photos into a single PDF/HTML file with branded styling.
- Background job/queue that runs on journal finalize (or nightly) to push the snapshot to the user’s folder and log Drive fileIds/status for re-sync.
- Portal settings toggle with “Connect Drive”, status indicator, and “Resend Latest Entry” button for manual retries or folder changes.

## 🟢 FUTURE FEATURES

### 5. **Stripe Payment Integration**
- Set up Stripe account
- Checkout flow
- Subscription management

### 6. **Affiliate System**
- Referral tracking
- Commission calculation
- Payout system

### 7. **Accountability Deposits**
- "Treasure Chest" system
- Goal tracking
- Partner payouts

## ✅ RECENTLY COMPLETED (October 2025)

### Completed This Session (October 1, 2025):
- ✅ **CRITICAL FIX: Auto-create users on Auth0 login** (`app/auth/callback/route.ts`)
- ✅ **CRITICAL FIX: PeptideTracker loads saved protocols** (added `fetchUserProtocols()`)
- ✅ **Fixed API routes location** (moved from `src/app/api` to `app/api`)
- ✅ **Seeded peptides database** (10 core peptides available)
- ✅ **Fixed API response format** (peptides endpoint returns correct structure)
- ✅ **User lookup by email fallback** (handles Auth0 ID changes)
- ✅ **WORKOUT TRACKING COMPLETE** - Full database persistence with 30+ exercises
- ✅ **NUTRITION TRACKING COMPLETE** - Food logging with common foods database
- ✅ **Gamification integrated** - Points for workouts (50) and nutrition (10)
- ✅ **Import/Export support** - Bulk import exercises and foods

### Previous Session (September 30, 2025):
- ✅ Migrated project from WSL2 to Windows environment
- ✅ Login redirect fix (added `?returnTo=/portal` parameter)
- ✅ Journal link fixed (changed `/journal` to `#journal` for same-page scroll)
- ✅ Breathing app settings modal positioning (proper centering with translate)

### Previously Completed:
- ✅ Profile Management with Auth0 integration
- ✅ Portal Dashboard with daily tasks
- ✅ Peptide Dosage Calculator (fully integrated)
- ✅ Peptide Import Safety System
- ✅ Enhanced Portal with Journal
- ✅ Auth0 Authentication (v4 working)
- ✅ MongoDB unification for peptides
- ✅ Admin store management

## 📊 Database Tables Status

### ✅ Existing & Working:
- User (Auth0 integrated)
- Product (peptides)
- BreathSession
- ModuleCompletion
- GamificationPoint
- DailyTask
- JournalEntry

### 🔴 Need to Create:
```prisma
model FoodEntry {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  name        String
  calories    Float
  protein     Float
  carbs       Float
  fats        Float
  mealType    String
  loggedAt    DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

model WorkoutSession {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  exercises   Json
  duration    Int
  programId   String?
  completedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}
```

## 🎯 API Endpoints Status

### ✅ Working:
- `/api/auth/callback` - Auth0 callback with auto user creation
- `/api/peptides` - Peptide library
- `/api/peptides/protocols` - User protocols (save/load)
- `/api/peptides/doses` - Dose logging
- `/api/workout/sessions` - Workout session tracking (GET/POST/PATCH)
- `/api/workout/exercises` - Exercise library with import (GET/POST/DELETE)
- `/api/nutrition/entries` - Food diary entries (GET/POST/PATCH/DELETE)
- `/api/nutrition/foods` - Food database with search (GET/POST/DELETE)
- `/api/profile/update` - Profile updates
- `/api/daily-tasks` - Task management
- `/api/journal/entry` - Journal entries
- `/api/products` - Legacy peptide management
- `/api/gamification/*` - Points system
- `/api/payments/*` - Stripe integration

---

## Important Reminders

1. **ALWAYS use the Change Protocol** before making any changes
2. **Test on production** with ChromeMCP when possible
3. **Keep changes minimal** - one-line fixes are best
4. **Update this file** before ending sessions
5. **Don't fix what isn't broken**

## Environment Variables (Don't Change)
```bash
# Auth0 - WORKING, DON'T MODIFY
AUTH0_SECRET=oaZ0uKqOOpIa0JgX+pyGEFMZOp61aiYDJA6fgTjZqyDNWWJ1sR5OvHoJKp9E0QWQP1UKE21feOqFu7PICnXuWg==
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-4n4ucz3too5e3w5j.us.auth0.com
AUTH0_CLIENT_ID=YDXQaFLWq8e5FuW5GMRBJ4wceomdAdzt
AUTH0_CLIENT_SECRET=3sZkNiaeXNQC-rrHfQrYIxu6mev0WDM-_vF-HpZT0ICZZMkycFQeUK9KPb4Mu5sd

# MongoDB Atlas
DATABASE_URL="mongodb+srv://resetbiology-app:_DN8QDEm.XK.J8P@cluster0.weld7bm.mongodb.net/resetbiology?retryWrites=true&w=majority&appName=Cluster0"
```

---

*This file is the source of truth for how Claude Code should behave. Update it regularly to improve future interactions.*
