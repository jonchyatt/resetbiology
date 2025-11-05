# Reset Biology - Discovered Vision & Analysis

**Analysis Date:** November 4, 2025
**Production URL:** https://resetbiology.com
**Tech Stack:** Next.js 15, React 19, MongoDB Atlas, Auth0, Stripe, Vercel

---

## Mission Statement (From Actual Content)

> "We built Reset Biology to fix what's broken: people trying to make change but trapped on health damaging meds, by providers who really should know better."

**Core Purpose:** Bridge users from pharmaceutical dependency (specifically GLP-1 drugs like semaglutide/tirzepatide) to metabolic independence using retatrutide protocols while preventing muscle loss.

### The Problem Being Solved
- Conventional weight loss drugs (Ozempic, Mounjaro) cause **40% muscle loss**
- Patients become dependent on lifetime pharmaceutical subscriptions
- Profit-driven clinics don't address root psychological causes
- People lose weight but end up weaker, with loose skin and metabolic damage

### The Solution Offered
- **IRB-approved retatrutide protocols** for muscle-preserving weight loss
- **Psychological integration** addressing emotional drivers (Mental Mastery Library)
- **Community accountability** with gamification and variable reward systems
- **Bridge to independence** rather than lifetime drug dependency
- **Breath training** stimulating autophagy and growth hormone for skin tightening

---

## Core User Personas

### Primary Persona: "The Ozempic Escapee"
- **Demographics:** Adults 30-55, currently on or considering GLP-1 drugs
- **Psychographics:** Health-conscious but frustrated with conventional medicine, seeking independence from pharmaceutical systems
- **Pain Points:** Muscle loss, metabolic damage, pharmaceutical dependency, loose skin, lack of holistic support
- **Goals:** Lose weight without muscle loss, achieve metabolic health, build sustainable habits

### Secondary Persona: "The Biohacker"
- **Demographics:** 25-45, tech-savvy, self-optimization focused
- **Psychographics:** Already tracking metrics, researching peptides, wants cutting-edge protocols
- **Pain Points:** Information overload, lack of structured protocols, no IRB oversight
- **Goals:** Optimize cellular health, access research-grade peptides with medical backing

### Tertiary Persona: "The Accountability Seeker"
- **Demographics:** 35-60, previous failed attempts at lifestyle change
- **Psychographics:** Needs external motivation, responds to gamification, values community
- **Pain Points:** Low willpower, lack of consistency, needs psychological support
- **Goals:** Build streaks, earn rewards, feel supported, see measurable progress

---

## Complete Feature Map

### 🔐 Authentication & Onboarding
- **Auth0 Google OAuth** (v4.10.0) - working production system
- **Readiness Quiz** - personalized path assessment (entry point)
- **IRB Handoff** - research compliance submission
- **Trial System** - 14-day trial tracking
- **User Profiles** - display name, avatar, role, access level

### 📊 Client Portal Dashboard
- **Daily Check-in System** - 6 trackable activities:
  - Peptides (dose logging)
  - Journal (mood, weight, reflections)
  - Workout (strength/cardio sessions)
  - Meals (nutrition tracking)
  - Module (Mental Mastery completion)
  - Breath (breath training sessions)
- **Streak Counter** - days of consecutive completion
- **Gamification Points Display** - total points earned
- **Quick Links** - navigate to all tracking tools
- **Recent Activity Timeline** - cross-feature activity feed

### 💉 Peptide Tracking System
**Status:** Production-ready, database-connected, fully functional

**Features:**
- **Protocol Management**
  - Browse peptide library (10+ peptides seeded)
  - Add custom protocols with:
    - Dosage (customizable units: mg, mcg, IU)
    - Frequency (daily, 3x/week, every-other-day, custom)
    - Timing (AM, PM, twice daily, custom times)
    - Duration (cycle length, on/off periods)
    - Vial amount + reconstitution instructions
  - Edit active protocols (inline time picker)
  - Archive/deactivate protocols

- **Dosage Calculator**
  - Visual syringe unit calculator
  - Inputs: vial amount, reconstitution volume, target dose
  - Output: exact syringe units to draw

- **Dose Logging**
  - Mark doses as complete
  - Add notes and side effects
  - Timezone-safe local date/time tracking
  - Calendar view with completion dots
  - Dose history by month

- **Smart Scheduling**
  - Next dose calculation based on frequency
  - "Scheduled" indicator for upcoming doses
  - Time-based reminders (15min, 30min, 1hr before)

- **Notification System** (PWA-ready, database schema exists)
  - Push notification preferences per protocol
  - Email fallback option
  - Scheduled notifications model (not yet cron-triggered)

**Database Models:**
- `Peptide` - library of available peptides
- `user_peptide_protocols` - active user protocols
- `peptide_doses` - logged dose entries with `localDate`/`localTime`
- `NotificationPreference` - per-protocol notification settings
- `ScheduledNotification` - queued reminders
- `PushSubscription` - web push subscriptions

**API Endpoints:**
- `GET /api/peptides` - fetch peptide library
- `GET /api/peptides/protocols` - user's active protocols
- `POST /api/peptides/protocols` - create/update protocol
- `GET /api/peptides/doses?date=YYYY-MM-DD` - doses for specific day
- `POST /api/peptides/doses` - log a dose
- `PATCH /api/peptides/doses/[id]` - update dose entry
- `DELETE /api/peptides/doses/[id]` - remove dose

### 🏋️ Workout Tracking System
**Status:** Production-ready, WGER exercise library integrated

**Features:**
- **Exercise Library**
  - WGER API integration for professional exercises
  - Search: bench press, deadlift, squat, pull up, plank
  - Custom exercise creation
  - Bulk import support (CSV/JSON)

- **Session Logging**
  - Log sets, reps, weight
  - Track duration, active time
  - Bodyweight measurements
  - Custom notes per session

- **Progress Metrics**
  - Total sets, reps, volume per session
  - Weekly charts (coming soon)
  - PR tracking (coming soon)

- **Gamification**
  - 50 points per completed workout
  - Streak mechanics ("Log at least one workout to keep streak alive")

- **Views**
  - Today tab (current session)
  - History tab (past workouts)
  - Daily History link

**Database Models:**
- `WorkoutSession` - logged sessions with exercises JSON
- `WorkoutProgram` - saved templates (Push/Pull/Legs, Full Body)

**API Endpoints:**
- `GET /api/workout/sessions` - user's workout history
- `POST /api/workout/sessions` - log workout
- `PATCH /api/workout/sessions/[id]` - update session
- `GET /api/workout/exercises` - exercise library
- `POST /api/workout/exercises` - add custom exercise
- `DELETE /api/workout/exercises` - remove exercise
- `GET /api/workouts/search?q={query}` - WGER search

### 🍎 Nutrition Tracking System
**Status:** Production-ready, food database connected

**Features:**
- **Food Logging**
  - Meal categories: Breakfast, Lunch, Dinner, Snack
  - Portion tracking (per 100g or per serving)
  - Search common foods database
  - Quick-add interface

- **Macro Tracking**
  - Calories (kcal)
  - Protein (g)
  - Carbohydrates (g)
  - Fats (g)

- **Daily Snapshot**
  - Meals logged count
  - Last entry timestamp
  - Total caloric intake

- **Integration**
  - "Review daily trendlines across peptides, workouts, meals, breath work, and journal"
  - Cross-feature timeline view

- **Gamification**
  - 10 points for daily nutrition logging

- **Import/Export**
  - Bulk import custom foods

**Database Models:**
- `FoodEntry` - logged meals with macros
- `FoodRef` - reference food database
- `FoodLog` - detailed food logs with `localDate`/`localTime`
- `MealPlan` - saved templates (Muscle Building, Fat Loss, Keto)

**API Endpoints:**
- `GET /api/nutrition/entries` - user's food logs
- `POST /api/nutrition/entries` - log food
- `PATCH /api/nutrition/entries/[id]` - update entry
- `DELETE /api/nutrition/entries/[id]` - remove entry
- `GET /api/nutrition/foods` - food database
- `POST /api/nutrition/foods` - add custom food
- `GET /api/foods/search?q={query}` - search foods
- `GET /api/foods/recent` - recently logged foods

### 🌬️ Breath Training Application
**Status:** Interactive application, session tracking enabled

**Features:**
- **Guided Training Cycles**
  - 3 cycles per session
  - 40 breaths per cycle (customizable pace)
  - 4 phases:
    1. Breathing Phase (rhythmic inhale/exhale)
    2. Exhale Hold (space to start retention)
    3. Inhale Hold (hold as long as possible)
    4. Cycle Completion (space to finish)

- **Interactive Orb Visualization**
  - Visual breathing guide (expands/contracts with breath)
  - Particle effects
  - Real-time breath counter (0 of 40)
  - Cycle indicator (1 of 3)

- **Pace Settings**
  - Adjustable breathing rhythm
  - Preset: Medium (3s in • 3s out)
  - Pause (P) and End (Escape) controls

- **Performance Tracking**
  - Best exhale hold time
  - Best inhale hold time
  - Session duration
  - Progress score

- **Physiological Claims**
  - "Low oxygen practice stimulates autophagy better than HIIT"
  - "Hypercarbia stimulates growth hormone"
  - "Both crucial for reducing loose skin during weight loss"

- **Session Logging**
  - Saves to `BreathSession` table
  - `localDate` and `localTime` for timezone safety
  - Visible in portal dashboard

**Database Models:**
- `BreathSession` - logged breath sessions with cycles, duration, score

**API Endpoints:**
- `POST /api/breath/sessions` - log session
- `GET /api/breath/export` - export session data

### 📔 Journal System
**Status:** Basic functionality, rich editor pending

**Features:**
- **Daily Entries**
  - Mood tracking
  - Weight logging
  - Free-form text entry
  - Date-based organization

- **History View**
  - Review past entries
  - Timeline integration

- **Future Plans** (from CLAUDE.md TODO):
  - Rich text editor
  - Entry templates
  - Enhanced mood tracking

**Database Models:**
- `JournalEntry` - user journal entries with JSON data, mood, weight

**API Endpoints:**
- `GET /api/journal/entry` - get entry for date
- `POST /api/journal/entry` - create/update entry
- `GET /api/journal/history` - get all entries
- `GET /api/journal/entry/[id]` - specific entry

### 🎯 Gamification System
**Status:** Core points system working, enhancement planned

**Features:**
- **Points Engine**
  - 50 points per workout
  - 10 points per nutrition log
  - Points for module completions
  - Points for breath sessions

- **Visual Elements**
  - Trophy icon with total points display
  - Streak counter with flame icon
  - Achievement notifications (basic)

- **Future Enhancements** (from TODO):
  - Achievement badges
  - Tier system (Bronze/Silver/Gold/Platinum)
  - Advanced point calculation rules

**Database Models:**
- `GamificationPoint` - point transactions with `pointType`, `amount`, `activitySource`

### 🧠 Mental Mastery Library
**Status:** Audio module system with progress tracking

**Features:**
- **Module Structure**
  - Foundation level
  - Integration level
  - Mastery level

- **Audio Playback**
  - Built-in audio player
  - Progress tracking
  - Completion detection

- **Completion Tracking**
  - Full vs. partial completion
  - `localDate` and `localTime` for timezone safety
  - Dashboard integration

**Database Models:**
- `ModuleCompletion` - track completed audio modules

**API Endpoints:**
- `POST /api/modules/complete` - mark module complete

### 💰 Success Deposit System
**Status:** Database model exists, UI pending

**Concept:**
- "Treasure Chest" accountability deposits
- Refundable stakes using loss-aversion psychology
- Partner payout conditions
- Goal-based completion tracking

**Database Models:**
- `SuccessDeposit` - deposits with status, conditions, partner share

**API Endpoints:**
- `POST /api/deposits` - create deposit
- `GET /api/deposits` - user's deposits

### 👥 Affiliate System
**Status:** Tracking infrastructure ready

**Features:**
- Referral code generation (unique per user)
- Click tracking
- Conversion tracking
- Commission calculation
- Referral dashboard

**Database Models:**
- `AffiliateTracking` - referral codes with clicks, conversions, commissions

**API Endpoints:**
- `GET /api/affiliates` - user's affiliate stats

### 🛒 E-Commerce & Payments
**Status:** Stripe integration production-ready

**Features:**
- **Product Catalog**
  - Peptide products from MongoDB
  - Variant support (e.g., GHK-Cu 50mg vs 100mg)
  - Bundle products (e.g., "Glow Protocol")
  - Inventory tracking with low stock alerts
  - Waitlist for out-of-stock items

- **Checkout Flow**
  - Stripe Checkout Sessions
  - Shipping address collection
  - Email receipts via Resend
  - Webhook order confirmation

- **Order Management**
  - Admin order dashboard (`/admin/orders`)
  - Fulfillment status tracking
  - Tracking number updates
  - Order history

- **Inventory System**
  - Track inventory per product
  - Bundle component deduction
  - Inventory transaction audit trail
  - Backorder support

**Database Models:**
- `Product` - product catalog with pricing, variants, protocols
- `Price` - pricing options (one-time, subscription)
- `Order` - Stripe orders with shipping and fulfillment
- `BundleItem` - defines bundle components
- `WaitlistEntry` - customer waitlist for OOS products
- `InventoryTransaction` - audit log for stock changes

**API Endpoints:**
- `POST /api/checkout` - create Stripe session
- `POST /api/stripe/webhook` - handle Stripe events
- `GET /api/products` - product catalog
- `GET /api/products/trackable` - peptides for tracker
- `GET /api/products/storefront` - public shop products
- `GET /api/products/by-slug/[slug]` - specific product
- `GET /api/admin/orders` - order management
- `POST /api/admin/stripe-sync` - sync Stripe catalog

### 🔧 Admin Tools
**Status:** Basic admin dashboard operational

**Features:**
- Product management UI
- Image uploads
- Order fulfillment interface
- User list (`/api/admin/list-users`)
- Stripe sync tools
- MongoDB health checks (`/api/health/db`)

---

## User Journey Map

### Discovery Phase
1. **Landing Page Visit** → Alarming muscle loss warning
2. **Readiness Quiz** → Personalized assessment
3. **IRB Explanation** → Build medical credibility
4. **CTA: "Get Started"** → Begin trial

### Onboarding Phase
1. **Auth0 Login** → Google OAuth (instant account creation)
2. **Quiz Sync** → Save assessment responses to `quizResponses` JSON
3. **Portal Access** → First view of dashboard
4. **Trial Start** → 14-day trial period begins

### Engagement Phase (Daily Loop)
1. **Portal Dashboard** → See daily tasks checklist
2. **Track Activities:**
   - Log peptide doses
   - Record workout session
   - Log meals
   - Complete breath training
   - Write journal entry
   - Listen to Mental Mastery module
3. **Earn Points** → Gamification feedback
4. **Build Streak** → Social commitment
5. **Return Tomorrow** → Habit formation

### Retention Phase
1. **Weekly Progress Review** → Charts, PRs, trendlines
2. **Module Progression** → Advance through Mental Mastery
3. **Community Features** → (Future: forums, challenges)
4. **Referral Rewards** → Affiliate system

### Conversion Phase
1. **Trial End** → Decision point
2. **Subscription Purchase** → Stripe checkout
3. **Ongoing Membership** → Full platform access
4. **Peptide Orders** → E-commerce purchases

### Advocacy Phase
1. **Success Milestone** → Weight loss, muscle gain, independence
2. **Referral Generation** → Share unique code
3. **Commission Earnings** → Affiliate payouts
4. **Testimonials** → (Future: testimonial collection)

---

## Tech Stack Analysis

### Frontend
- **Framework:** Next.js 15.5.2 (App Router)
- **React:** 19.1.0 (latest stable)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 (with custom config)
- **Icons:** Lucide React 0.542.0
- **Animations:** Framer Motion 12.23.12
- **State:** React hooks (useState, useEffect, useMemo, useCallback)
- **Offline Support:** Dexie 4.2.0 (IndexedDB wrapper)

### Backend
- **Hosting:** Vercel (primary), Cloudflare Pages (backup via OpenNext)
- **Database:** MongoDB Atlas (production), SQLite (local dev)
- **ORM:** Prisma 6.15.0
- **Authentication:** Auth0 v4.10.0 (NextJS SDK)
- **Payments:** Stripe 18.5.0
- **Email:** Resend 6.4.0
- **Push Notifications:** web-push 3.6.7
- **Cron Jobs:** Vercel Cron (configured in `vercel.json`)
- **File Storage:** Google Drive API (googleapis 159.0.0)

### Development Tools
- **Testing:** Playwright 1.56.0 (@playwright/test 1.55.0)
- **Build:** OpenNext Cloudflare 1.8.0 (for CF Pages)
- **Scripts:** tsx 4.20.6, ts-node 10.9.2
- **Linting:** ESLint 9 with Next.js config

### APIs & Integrations
- **Auth0 Domain:** dev-4n4ucz3too5e3w5j.us.auth0.com
- **WGER Exercise API** - external exercise database
- **Food Database API** - nutrition data source
- **Stripe Webhook** - order processing
- **Google OAuth** - social login

### Database Schema Highlights
- **37 models** defined in Prisma schema
- **MongoDB ObjectId** primary keys
- **Timezone-safe fields:** `localDate` (YYYY-MM-DD string), `localTime` (HH:MM:SS string)
- **JSON fields** for flexible data (nutrients, exercises, metadata)
- **Unique constraints** on emails, slugs, subscription endpoints
- **Indexes** on user lookups, date queries

### Environment Variables
- `AUTH0_SECRET`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- `DATABASE_URL` (MongoDB Atlas connection string)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (for push notifications)
- `CRON_SECRET` (for authenticated cron endpoints)

---

## Design Patterns Discovered

### Visual Design System
- **Color Palette:**
  - Primary Teal: `#3FBFB5` (`text-primary-400`, `bg-primary-500`)
  - Secondary Green: `#72C247` (`text-secondary-400`)
  - Dark Gradients: `from-gray-900 to-gray-800`
  - Transparency layers: `/20`, `/30` with `backdrop-blur-sm`

- **Glassmorphism:**
  - `bg-white/10`, `bg-gray-800/50`
  - `backdrop-blur-sm`, `backdrop-blur-md`
  - Frosted glass effect on modals and cards

- **Typography:**
  - Large hero text: `text-4xl md:text-5xl lg:text-6xl`
  - Font weights: `font-bold`, `font-semibold`, `font-medium`
  - Text shadows: `text-shadow-lg`

- **Spacing:**
  - Consistent padding: `p-4`, `p-6`, `p-8`
  - Responsive margins: `mb-4`, `mb-6`, `mb-8`
  - Container max-width: `max-w-7xl mx-auto`

- **Interactive Elements:**
  - Hover states: `hover:bg-primary-600`, `hover:text-white`
  - Transitions: `transition-colors`, `transition-transform`
  - Card hover effects: `card-hover-primary` (custom class)
  - Icon animations: `animate-fade-in`

### Code Architecture Patterns

**1. API Route Structure:**
```
app/api/[feature]/[action]/route.ts
```
- Consistent GET/POST/PATCH/DELETE exports
- Session validation via `getSession()` from Auth0
- User lookup by `auth0Sub` OR `email` (fallback for ID changes)
- Returns `{ success: boolean, data: any, error?: string }`

**2. Component Organization:**
```
src/components/[Feature]/[ComponentName].tsx
```
- Feature-based folders (Peptides, Workout, Nutrition, etc.)
- Client components marked with `"use client"`
- Reusable sub-components (Calculator, Library, Tracker)

**3. Database Access Pattern:**
```typescript
import prisma from '@/lib/prisma'

const user = await prisma.user.findFirst({
  where: {
    OR: [
      { auth0Sub: session.user.sub },
      { email: session.user.email }
    ]
  }
})
```
- Single Prisma instance import
- Email fallback for user lookups
- Relation loading with `include`

**4. Timezone-Safe Date Handling:**
```typescript
const dateToLocalKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```
- Store `localDate` and `localTime` strings in database
- Never rely on UTC conversion for user-facing dates
- User's browser timezone determines date boundaries

**5. State Management:**
- No Redux/Zustand - pure React hooks
- `useState` for component state
- `useEffect` for data fetching
- `useMemo` for expensive computations
- `useCallback` for function memoization
- `useRef` for persistent values without re-renders

**6. Error Handling:**
```typescript
try {
  await fetch('/api/...')
} catch (error) {
  console.error('Operation failed:', error)
  // Graceful degradation
}
```
- Try-catch blocks around API calls
- Console logging for debugging
- User-facing error messages in modals
- No global error boundary (yet)

### UI/UX Patterns

**1. Progressive Disclosure:**
- Dashboard → Feature Page → Detail Modal
- Nested modals for complex workflows
- Expandable sections for advanced options

**2. Gamification Mechanics:**
- Streaks create daily commitment
- Points provide instant feedback
- Badges/tiers signal progress (planned)
- Variable rewards increase engagement

**3. Quick Actions:**
- One-click dose logging
- Quick-add food/workout interfaces
- Recent items for fast repeat entry
- Keyboard shortcuts (Space, P, Escape in breath app)

**4. Visual Feedback:**
- Loading states during API calls
- Success/error notifications (basic)
- Animated transitions between states
- Color-coded status indicators

**5. Mobile-First Design:**
- Responsive breakpoints: `sm:`, `md:`, `lg:`
- Touch-friendly tap targets
- PWA-ready (manifest.json, service worker)
- Install prompts for home screen

---

## Issues & Incomplete Features Found

### High Priority Issues
1. **PWA Notification System Not Fully Deployed**
   - Database schema exists (`NotificationPreference`, `ScheduledNotification`, `PushSubscription`)
   - UI component exists (`NotificationPreferences.tsx`)
   - Missing: Vercel cron job not triggering `/api/notifications/send`
   - Missing: VAPID keys not in production environment
   - Impact: Users can't receive dose reminders

2. **Rich Text Journal Editor**
   - Currently plain text input
   - TODO item mentions "rich text editor" needed
   - No formatting, image embeds, or templates

3. **Success Deposit UI**
   - Database model complete
   - No user-facing interface to create deposits
   - No dashboard to track deposit status
   - Concept exists but not implemented

4. **Weekly Charts & PR Tracking**
   - Workout tracker shows "coming soon" message
   - Data exists in `WorkoutSession` but not visualized
   - No progress charts for nutrition or peptides either

5. **Affiliate Dashboard**
   - Tracking infrastructure complete
   - No user-facing referral dashboard
   - Can't view clicks, conversions, or commissions

### Medium Priority Issues
1. **No Global Error Boundary**
   - API failures logged to console only
   - Users see broken UI if fetch fails
   - Need toast notifications or error modal

2. **Incomplete Gamification**
   - Points awarded but no badges shown
   - No tier system (Bronze/Silver/Gold)
   - No achievement unlocks or celebrations

3. **Timeline Integration Missing**
   - Dashboard mentions "Review daily trendlines across peptides, workouts, meals..."
   - Feature described but not visible in portal
   - Would require unified activity feed API

4. **Mental Mastery Library Not Visible**
   - Module completion tracking works
   - No browseable library in portal
   - Audio player component exists but not linked

5. **Bundle Inventory Deduction**
   - `BundleItem` model exists
   - Unclear if purchasing "Glow Protocol" deducts component inventory
   - Needs testing/verification

### Low Priority / Polish
1. **No Onboarding Flow**
   - Users go straight to empty dashboard after login
   - No tutorial or feature tour
   - Could improve activation rate

2. **Empty States Could Be Better**
   - "No workouts logged yet" is bland
   - Opportunity for motivational messaging
   - CTAs to guide first actions

3. **No Search on Peptide Library**
   - Must scroll through all peptides
   - No filter by purpose/category

4. **Workout Programs Not Utilized**
   - `WorkoutProgram` model exists
   - No UI to create/follow programs
   - Sessions logged individually only

5. **Meal Plans Not Utilized**
   - `MealPlan` model exists
   - No UI to set targets or compare against plan
   - Just raw food logging

---

## Brand Voice Analysis

### Tone Characteristics
- **Urgent but Authoritative** - Uses alarm language ("🚨 STOP!") backed by medical credentials
- **Skeptical of Conventional Medicine** - Positions doctors/clinics as "profit-driven"
- **Empowering** - "Bridge to independence" vs "lifetime dependency"
- **Research-Focused** - Emphasizes IRB approval, protocols, scientific mechanisms
- **Community-Oriented** - Gamification, accountability partners, referrals

### Messaging Patterns
- **Problem-Agitate-Solution:**
  - Problem: GLP-1s cause muscle loss
  - Agitate: You'll be weak, with loose skin, forever dependent
  - Solution: Reset Biology's retatrutide + holistic approach

- **Social Proof:**
  - Testimonials (carousel on homepage)
  - IRB approval (medical legitimacy)
  - Success metrics ("40% muscle loss" statistic)

- **Loss Aversion:**
  - "Success Deposit" uses stakes to prevent quitting
  - Streak mechanics punish missed days
  - Variable rewards keep users guessing

- **Aspirational Identity:**
  - "Wellness Warrior" greeting in dashboard
  - Mastery progression in Mental Library
  - Tier systems (coming) for status

### Copy Style
- **Short, punchy sentences**
- **Bullet points for scanability**
- **Bold emphasis** on key claims
- **Questions to engage reader** ("Ready to take control?")
- **Direct address** ("You're losing MUSCLE")

---

## Competitive Advantages Identified

1. **IRB Oversight** - Legitimacy over sketchy peptide vendors
2. **Muscle Preservation Focus** - Differentiator vs. Ozempic/Mounjaro
3. **Psychological Integration** - Not just drugs, but mindset work
4. **Holistic Tracking Suite** - 6 interconnected systems (peptides, workout, nutrition, breath, journal, modules)
5. **Gamification Engine** - Engagement mechanics most health apps lack
6. **Bridge Narrative** - Independence vs. dependency is compelling positioning
7. **Breath Training for Skin** - Unique claim about autophagy/growth hormone

---

## Recommendations for Future Development

### Immediate Priorities (Next 2 Weeks)
1. **Deploy PWA Notification System** - All code exists, just needs cron activation
2. **Add Global Error Handling** - Toast notifications library
3. **Build Success Deposit UI** - High-impact feature for accountability
4. **Create Affiliate Dashboard** - Enable word-of-mouth growth
5. **Add Rich Text Journal Editor** - Improve daily engagement

### Short-Term (Next Month)
1. **Unified Activity Timeline** - Cross-feature trendlines
2. **Weekly Charts** - Visualize workout/nutrition progress
3. **Mental Mastery Library UI** - Make modules discoverable
4. **Onboarding Tutorial** - Increase activation rate
5. **Achievement Badges** - Complete gamification system

### Long-Term (Next Quarter)
1. **Community Features** - Forums, challenges, leaderboards
2. **AI Coaching** - Personalized recommendations based on tracking data
3. **Wearable Integrations** - Sync with Apple Health, Oura, etc.
4. **Telehealth Integration** - Video consults with doctors
5. **Advanced Analytics** - Correlation analysis (e.g., "breath training days = better workouts")

---

## Technical Debt & Refactoring Needs

### Code Quality
- **No TypeScript strict mode** - Many `any` types in database queries
- **Inconsistent error handling** - Some routes return errors, others don't
- **Duplicate API routes** - `app/api/` and `src/app/api/` both exist
- **Unused legacy code** - `src/legacy_app/` and `wp-content/` folders
- **No unit tests** - Only Playwright e2e tests

### Performance
- **No caching** - Every dashboard load hits database for same data
- **No pagination** - Dose history loads entire month at once
- **Large bundle size** - Framer Motion and Prisma add weight
- **No CDN for images** - Product images served from Vercel

### Security
- **No rate limiting** - API routes vulnerable to spam
- **No CSRF protection** - Rely on Auth0 session only
- **Webhook secret in .env** - Should be in Vercel secrets
- **No input sanitization** - User notes/text fields could have XSS risk

### Scalability
- **MongoDB Atlas free tier** - Will hit limits with growth
- **Vercel hobby plan** - Limited serverless invocations
- **No database connection pooling** - Each API route creates new connection
- **No background job queue** - Cron only, no retries

---

**End of Discovery Analysis**
