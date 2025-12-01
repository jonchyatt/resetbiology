# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
**Last Updated:** November 30, 2025

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
- **Date:** November 30, 2025
- **Last Action:** HOS system review, Playwright multi-device config, Voice Agent architecture planning
- **Deployment:** Production is current
- **Next Priority:** Google Drive sync + Voice Agent ecosystem implementation
- **Watch Out For:** PWA notifications CONFIRMED WORKING (stop marking as incomplete!)

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

---

# 🔧 ADMIN TODO LIST (User Must Complete)

These are manual tasks the user needs to complete outside of Claude Code. Mark as ✅ when done.

## Stripe & Payment Setup

- [ ] **Create $12.99/month Price in Stripe Dashboard**
  1. Go to Stripe Dashboard → Products → Add Product (or select existing)
  2. Click "Add pricing" → Price: $12.99 → Billing period: Monthly
  3. Copy the Price ID (starts with `price_`)
  4. Do this for BOTH test mode and live mode

- [ ] **Update Vercel Environment Variables**
  ```
  STRIPE_MONTHLY_PRICE_ID=price_xxx  (your $12.99 price ID)
  SELLER_EMAILS=email1@x.com,email2@x.com  (for order notifications)
  ```
  - Go to: https://vercel.com/your-project/settings/environment-variables
  - Add/update the variables above
  - Set for: Production, Preview, and Development
  - Click Save

- [ ] **Redeploy to Apply Environment Changes**
  ```bash
  npx vercel --prod
  ```

- [ ] **Test Stripe Integration**
  1. Visit resetbiology.com/portal
  2. Click "Start FREE Trial"
  3. Use test card: 4242 4242 4242 4242
  4. Verify in Stripe Dashboard → Subscriptions

## Live Mode Checklist (When Ready for Real Payments)

- [ ] **Switch Stripe to Live Mode**
  - Toggle to "Live mode" in Stripe Dashboard (top right)
  - Create the $12.99 product/price in live mode
  - Copy live Price ID

- [ ] **Set Up Live Webhook**
  - Go to: https://dashboard.stripe.com/webhooks
  - Add endpoint: `https://resetbiology.com/api/stripe/webhook`
  - Select events: checkout.session.completed, customer.subscription.*
  - Copy signing secret

- [ ] **Update Vercel with Live Keys**
  ```
  STRIPE_SECRET_KEY=sk_live_xxx
  STRIPE_PUBLISHABLE_KEY=pk_live_xxx
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  STRIPE_MONTHLY_PRICE_ID=price_live_xxx
  ```

- [ ] **Test with Real Card**
  - Make a test purchase with your own card
  - Cancel immediately in Stripe Dashboard to avoid charges

---

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

## ✅ COMPLETED FEATURES (Do Not Recreate!)

| Feature | Status | Notes |
|---------|--------|-------|
| Workout Tracking `/workout` | ✅ DONE | 30+ exercises, gamification integrated |
| Nutrition Tracking `/nutrition` | ✅ DONE | Food database, daily logging |
| PWA + Push Notifications | ✅ DONE | **WORKING PERFECTLY - CONFIRMED Nov 30** |
| Trial Subscription | ✅ DONE | FREE trial, $12.99/mo after |
| Breath Training `/breath` | ✅ DONE | Admin panel, predefined exercises |
| Peptide Tracker `/peptides` | ✅ DONE | Protocols, doses, reminders |

---

## 🔴 CURRENT PRIORITIES (Work on These First)

### 1. **Google Drive Vault Integration** (HIGH PRIORITY)
User data stored on CLIENT'S Google Drive, not our servers.
- OAuth connection flow (`drive.file` scope)
- Create `/My_Reset_Biology_Vault/` folder structure:
  - `/Logs/` - nutrition_tracker.csv, peptide_schedule.csv, workout_log.csv
  - `/Journal/` - Voice journal transcripts
  - `/Profile/` - user_preferences.json
- Sync existing MongoDB data → Drive on connect
- Real-time write on new entries
- "Connect Drive" button in Portal Settings

### 2. **Voice Agent Ecosystem** (MAJOR NEW FEATURE)
Build multi-agent AI coaching system using Gemini 3 Multimodal Live API.

**Agent Roster:**
| Agent | Role | Priority |
|-------|------|----------|
| Concierge | Master Router / Triage | Build First |
| Bio-Coach | Nutrition + Peptides | HIGH |
| Vision Tutor | Eye Exercise Guide | MEDIUM |
| Mind Gym | Memory/N-Back Games | MEDIUM |
| Breathwork Guide | Breathing Protocols | MEDIUM |
| Journal Companion | Voice Journaling | HIGH |
| The Professor | Educational / Citations | MEDIUM |
| Sales Closer | Objection Handling | HIGH |
| Intake Agent | Onboarding Interview | HIGH |

**Architecture:**
- Voice Minutes "Gas Tank" economy (usage-based billing protection)
- Text fallback when voice minutes exhausted
- Cross-reference data (Vision Agent checks Nutrition logs)
- Stateless agents → read/write to Google Drive Vault

### 3. **Gamification System Enhancement**
- Points calculation engine
- Achievement badges
- Tier system (Bronze/Silver/Gold/Platinum)
- Use existing GamificationPoint table

### 4. **Journal System Completion**
- Rich text editor for `/journal`
- Entry templates
- History view
- Mood tracking

---

## 🟢 FUTURE FEATURES

### 5. **Stripe Payment Enhancements**
- ⚠️ Partial (trial exists, basic checkout works)
- Complete subscription management UI
- Upgrade/downgrade flows
- Voice Minutes tier integration

### 6. **Affiliate System**
- Referral tracking
- Commission calculation
- Payout system

### 7. **Accountability Deposits ("Treasure Chest")**
- Goal tracking with financial stakes
- Partner payouts on goal completion

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

### ✅ All Tables Exist & Working:
- User (Auth0 integrated)
- Product (peptides)
- BreathSession, BreathExercise
- ModuleCompletion
- GamificationPoint
- DailyTask
- JournalEntry
- FoodEntry, FoodLog, MealPlan
- WorkoutSession, WorkoutProgram
- NotificationPreference, ScheduledNotification, PushSubscription
- user_peptide_protocols, peptide_doses

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
