# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
**Last Updated:** September 30, 2025

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
- **Date:** September 30, 2025
- **Last Action:** Moved project from WSL2 to Windows environment
- **Next Priority:** Workout & Nutrition tracking pages (see TODO list)
- **Watch Out For:** Tendency to overcomplicate simple fixes

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

## Authentication System (Auth0)
- **Domain**: dev-4n4ucz3too5e3w5j.us.auth0.com
- **Current Version**: v4.10.0 (working - don't change!)
- **Login Redirect**: Add `?returnTo=/portal` to login links
- **Routes**: `/api/auth/[...auth0]`
- **Status**: WORKING - Do not modify unless specifically broken

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

### 1. **Workout Tracking Page** (`/workout`)
- Link exists but page not implemented
- Create workout logging interface
- Connect to WorkoutSession table

### 2. **Nutrition Tracking Page** (`/nutrition`)  
- Link exists but page not implemented
- Create meal logging interface
- Connect to FoodEntry table

## 🟡 NEXT UP (After Priorities)

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

## ✅ RECENTLY COMPLETED (September 2025)

### Completed This Session:
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
- `/api/auth/[...auth0]` - Authentication
- `/api/profile/update` - Profile updates
- `/api/daily-tasks` - Task management
- `/api/journal/entry` - Journal entries
- `/api/products` - Peptide management

### 🔴 Need to Build:
- `/api/workout/*` - Workout tracking
- `/api/nutrition/*` - Meal tracking
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