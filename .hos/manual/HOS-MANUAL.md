# HOS Manual - Reset Biology Platform

**Version:** 1.0
**Last Updated:** November 4, 2025
**Platform:** https://resetbiology.com
**Tech Stack:** Next.js 15, React 19, MongoDB Atlas, Auth0, Stripe, Vercel

---

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Agent Commands](#agent-commands)
3. [Testing Workflows](#testing-workflows)
4. [ResetBiology-Specific Workflows](#resetbiology-specific-workflows)
5. [Troubleshooting](#troubleshooting)
6. [Common Fixes](#common-fixes)

---

## Quick Reference

### Emergency Fixes

```bash
# Auth0 broken? REVERT IMMEDIATELY
git revert HEAD
git push origin master

# TypeScript errors blocking build?
npx tsc --noEmit

# Database connection issues?
curl https://resetbiology.com/api/health/db

# Quick production test
curl https://resetbiology.com/api/health
```

### Most Common Commands

```bash
# Test locally
npm run dev

# Production build test
npm run build

# Deploy to production
npx vercel --prod

# Run E2E tests
npx playwright test

# Database schema update
npx prisma db push
```

---

## Agent Commands

### Architect Agent
**When to invoke:** Adding new features, changing database schema, architectural decisions

```markdown
@architect Design a new [feature] system that integrates with:
- Peptide tracking
- Gamification points
- Timeline feed
```

**Example scenarios:**
- "Design the Success Deposit system architecture"
- "Plan PWA notification system database schema"
- "Architect the affiliate tracking system"

**Key patterns to request:**
- API endpoint structure for feature
- Database model relationships
- Component hierarchy design
- Integration with existing features

---

### Implementer Agent
**When to invoke:** Writing code following TDD, implementing specs from Architect

```markdown
@implementer Implement [feature] according to this spec:
[paste ADR or architecture doc]
```

**TDD Workflow:**
1. Write failing test first (Red)
2. Implement minimal code (Green)
3. Refactor while tests pass

**Example scenarios:**
- "Implement peptide dose logging API endpoint"
- "Build nutrition tracker React component"
- "Create gamification point award function"

**Pre-commit checklist:**
```bash
npx tsc --noEmit      # TypeScript check
npm run build         # Build check
npm test              # Unit tests
npx playwright test   # E2E tests
```

---

### Design Enforcer Agent
**When to invoke:** UI/UX validation, design system compliance, visual consistency

```markdown
@design-enforcer Review this component for:
- Design system compliance
- Responsive design
- Accessibility
- Brand consistency
```

**Example scenarios:**
- "Validate peptide tracker modal styling"
- "Check mobile responsiveness of workout logger"
- "Audit accessibility of gamification displays"

**Design System Reference:**
- **Primary Teal:** `#3FBFB5` (`text-primary-400`, `bg-primary-500`)
- **Secondary Green:** `#72C247` (`text-secondary-400`)
- **Glassmorphism:** `bg-gray-800/50 backdrop-blur-sm`
- **Typography:** `text-4xl md:text-5xl lg:text-6xl` (hero)
- **Spacing:** `p-4`, `p-6`, `p-8` (consistent padding)

---

### Test Oracle Agent
**When to invoke:** Writing tests, discovering edge cases, quality assurance

```markdown
@test-oracle Generate tests for [feature]:
- Unit tests for business logic
- Integration tests for API
- E2E tests for user flow
- Edge case scenarios
```

**Example scenarios:**
- "Create E2E tests for peptide protocol workflow"
- "Generate edge cases for timezone-safe date handling"
- "Write integration tests for Stripe webhook"

**Critical test paths:**
1. Authentication: Login → Portal → Features
2. Peptide Tracking: Add Protocol → Log Dose → View History
3. Workout Logging: Add Exercise → Log Session → View Progress
4. Nutrition Tracking: Add Food → Log Meal → View Totals
5. Gamification: Complete Action → Award Points → Update Streak

---

### Peptide Protocol Agent
**When to invoke:** Peptide tracking features, dosing calculations, protocol management

```markdown
@peptide-protocol-agent [task]:
- Validate dosage calculation
- Calculate next dose time
- Handle reconstitution math
- Debug protocol scheduling
```

**Example scenarios:**
- "Calculate next dose for every-other-day protocol"
- "Validate syringe units for 5mg BPC-157 in 2ml BAC water"
- "Handle timezone edge case for midnight dose logging"

**Common calculations:**
```typescript
// Reconstitution calculator
vialAmount: 5mg
reconstitutionVolume: 2ml
targetDose: 250mcg
// Result: 10 units on insulin syringe

// Next dose (3x/week - M/W/F pattern)
lastDose: Monday 9:00 AM
// Result: Wednesday 9:00 AM
```

---

### Gamification Agent
**When to invoke:** Points system, achievements, streaks, engagement mechanics

```markdown
@gamification-agent [task]:
- Design point award structure
- Create achievement badge
- Implement streak mechanics
- Build tier progression
```

**Example scenarios:**
- "Award 50 points for workout completion"
- "Check if user unlocked 30-day streak badge"
- "Calculate tier progression from Bronze to Silver"

**Point structure:**
- Peptide Dose: 10 points
- Workout: 50 points
- Nutrition Daily Log: 10 points
- Breath Session: 20 points
- Journal Entry: 15 points
- Module Completion: 30 points

**Tier thresholds:**
- Bronze: 0 points
- Silver: 1000 points
- Gold: 5000 points
- Platinum: 20000 points

---

### Auth0 Guardian Agent
**When to invoke:** BEFORE making ANY Auth0 changes

```markdown
@auth0-guardian Can I safely:
- Upgrade Auth0 package?
- Modify callback route?
- Change middleware config?
- Update session settings?
```

**⚠️ CRITICAL RULES:**
1. NEVER downgrade Auth0 from v4.10.0
2. NEVER remove email fallback from user lookups
3. NEVER change imports without approval
4. ALWAYS test auth changes extensively

**The Incident We Must Never Repeat:**
```yaml
Problem: "Login redirects to hero page instead of portal"
Wrong Solution: Downgrade Auth0 to v3 (30+ min wasted)
Right Solution: Add ?returnTo=/portal to login link (2 min)
Lesson: Try simplest fix first
```

**User Lookup Pattern (MANDATORY):**
```typescript
const user = await prisma.user.findFirst({
  where: {
    OR: [
      { auth0Sub: session.user.sub },
      { email: session.user.email }
    ]
  }
})
```

---

## Testing Workflows

### Mobile Testing Commands

#### iPhone 12 Simulation
```bash
# Playwright test with iPhone 12 viewport
npx playwright test --project="iPhone 12"

# Manual testing
# Device: iPhone 12
# Viewport: 390x844
# User Agent: iOS 15
```

#### Pixel 7 Simulation
```bash
# Playwright test with Pixel 7 viewport
npx playwright test --project="Pixel 7"

# Manual testing
# Device: Pixel 7
# Viewport: 412x915
# User Agent: Android 13
```

#### iPad Simulation
```bash
# Playwright test with iPad viewport
npx playwright test --project="iPad Pro"

# Manual testing
# Device: iPad Pro
# Viewport: 1024x1366
# User Agent: iOS 15
```

### User Journey Testing

#### Complete Onboarding Flow
```typescript
// Playwright E2E test
test('new user onboarding', async ({ page }) => {
  // 1. Landing page
  await page.goto('https://resetbiology.com')

  // 2. Login via Auth0
  await page.click('text=Login')
  // ... complete Auth0 OAuth

  // 3. Redirected to portal
  await page.waitForURL('**/portal')
  expect(page.locator('text=Wellness Warrior')).toBeVisible()

  // 4. Empty state check
  expect(page.locator('text=No protocols added yet')).toBeVisible()
})
```

#### Peptide Tracking Journey
```typescript
test('peptide protocol workflow', async ({ page }) => {
  await page.goto('https://resetbiology.com/peptides')

  // Add protocol
  await page.click('button:has-text("Add Protocol")')
  await page.fill('input[name="peptideName"]', 'BPC-157')
  await page.fill('input[name="dosage"]', '250')
  await page.selectOption('select[name="unit"]', 'mcg')
  await page.click('button:has-text("Save")')

  // Log dose
  await page.click('button:has-text("Log Dose")')
  await page.fill('textarea[name="notes"]', 'Morning injection')
  await page.click('button:has-text("Complete")')

  // Verify points awarded
  expect(page.locator('text=/\\d+ pts/')).toBeVisible()
})
```

#### Workout Logging Journey
```typescript
test('workout session tracking', async ({ page }) => {
  await page.goto('https://resetbiology.com/workout')

  // Add exercise
  await page.click('button:has-text("Add Exercise")')
  await page.fill('input[name="search"]', 'bench press')
  await page.click('text=Bench Press')

  // Log sets
  await page.fill('input[name="sets"]', '3')
  await page.fill('input[name="reps"]', '10')
  await page.fill('input[name="weight"]', '135')

  // Complete workout
  await page.click('button:has-text("Complete Workout")')

  // Verify 50 points awarded
  const points = await page.locator('[data-testid="points-display"]').textContent()
  expect(parseInt(points)).toBeGreaterThanOrEqual(50)
})
```

### Performance Testing

```bash
# Lighthouse CI (run on production)
npm install -g @lhci/cli
lhci autorun --collect.url=https://resetbiology.com

# Check critical metrics
# - Performance: > 90
# - Accessibility: > 95
# - Best Practices: > 90
# - SEO: > 90
```

---

## ResetBiology-Specific Workflows

### Peptide Protocol Workflows

#### Add New Peptide to Library
```typescript
// 1. Add to database via Prisma
await prisma.peptide.create({
  data: {
    name: 'Thymosin Beta-4',
    description: 'Tissue repair and regeneration peptide',
    commonDosage: '2-5mg twice weekly',
    frequency: '2x per week',
    benefits: ['Injury healing', 'Inflammation reduction', 'Hair growth'],
    contraindications: ['Active cancer'],
    sideEffects: ['Injection site reactions'],
    researchLinks: ['https://pubmed.ncbi.nlm.nih.gov/...']
  }
})

// 2. Verify via API
curl https://resetbiology.com/api/peptides

// 3. Test in UI
# Navigate to /peptides
# Click "Add Protocol"
# Verify new peptide appears in dropdown
```

#### Fix Broken Dose Scheduling
```yaml
Issue: Next dose calculation incorrect for 3x/week protocol

Debug Steps:
  1. Check current protocol:
     GET /api/peptides/protocols

  2. Check last dose:
     GET /api/peptides/doses?date=YYYY-MM-DD

  3. Verify calculation logic:
     # M/W/F pattern
     if (lastDose.dayOfWeek === 1): nextDose = Monday + 2 days (Wed)
     if (lastDose.dayOfWeek === 3): nextDose = Wed + 2 days (Fri)
     if (lastDose.dayOfWeek === 5): nextDose = Fri + 3 days (Mon)

  4. Fix in: /app/api/peptides/protocols/route.ts
  5. Test edge cases:
     - Protocol starting on Tuesday
     - Dose logged at 11:59 PM
     - Timezone boundary crossing
```

#### Export User Protocol Data
```bash
# API endpoint (authenticated)
curl -H "Cookie: appSession=..." \
  https://resetbiology.com/api/peptides/export

# Returns CSV:
# Date,Time,Peptide,Dose,Unit,Notes,Side Effects
# 2025-11-04,09:30:00,BPC-157,250,mcg,Morning injection,None
```

---

### Nutrition Tracking Workflows

#### Add Custom Food to Database
```typescript
await prisma.foodRef.create({
  data: {
    name: 'Grass-Fed Ribeye Steak',
    brand: 'Local Ranch',
    servingSize: 8,
    servingSizeUnit: 'oz',
    calories: 544,
    protein: 56,
    carbs: 0,
    fats: 34,
    fiber: 0,
    sugar: 0,
    sodium: 140,
    category: 'Meat'
  }
})
```

#### Bulk Import Foods
```bash
# CSV format:
# name,brand,servingSize,servingSizeUnit,calories,protein,carbs,fats
# Chicken Breast,Generic,4,oz,187,35,0,4
# Brown Rice,Generic,1,cup,218,5,46,2

# Import via API
curl -X POST https://resetbiology.com/api/nutrition/foods/import \
  -F "file=@foods.csv" \
  -H "Cookie: appSession=..."
```

#### Fix Macro Calculation Bug
```yaml
Issue: Total calories don't match sum of macros

Debug Steps:
  1. Check entry:
     GET /api/nutrition/entries?date=YYYY-MM-DD

  2. Validate formula:
     totalCalories = (protein * 4) + (carbs * 4) + (fats * 9)

  3. Check for:
     - Negative values (impossible)
     - Missing fields (default to 0)
     - Decimal precision (round to 1 decimal)

  4. Fix in: /src/components/Nutrition/NutritionTracker.tsx
```

---

### Workout Logging Workflows

#### Add Exercise from WGER API
```bash
# Search WGER
curl "https://wger.de/api/v2/exercise/?search=deadlift&language=2"

# Save to database
POST /api/workout/exercises
{
  "name": "Conventional Deadlift",
  "category": "Strength",
  "equipment": "Barbell",
  "primaryMuscles": ["Back", "Glutes", "Hamstrings"],
  "instructions": "...",
  "videoUrl": "https://..."
}
```

#### Export Workout History
```bash
curl -H "Cookie: appSession=..." \
  https://resetbiology.com/api/workout/export?format=csv

# Returns:
# Date,Time,Exercise,Sets,Reps,Weight,Duration,Notes
# 2025-11-04,07:00:00,Bench Press,3,10,135,45,Felt strong
```

#### Calculate Personal Records
```typescript
// Get all sessions for exercise
const sessions = await prisma.workoutSession.findMany({
  where: {
    userId: user.id,
    exercises: {
      path: '$.name',
      equals: 'Bench Press'
    }
  }
})

// Find max weight
const maxWeight = Math.max(...sessions.map(s =>
  s.exercises.find(e => e.name === 'Bench Press')?.weight || 0
))

// Find max volume (sets * reps * weight)
const maxVolume = Math.max(...sessions.map(s => {
  const exercise = s.exercises.find(e => e.name === 'Bench Press')
  return (exercise?.sets || 0) * (exercise?.reps || 0) * (exercise?.weight || 0)
}))
```

---

### Breath Training Workflows

#### Debug Breath Session Not Saving
```yaml
Issue: Breath session completes but doesn't appear in dashboard

Debug Steps:
  1. Check browser console for errors
  2. Verify API call:
     POST /api/breath/sessions
     {
       "localDate": "2025-11-04",
       "localTime": "08:30:00",
       "duration": 720,
       "cycles": 3,
       "bestExhaleHold": 75,
       "bestInhaleHold": 45,
       "score": 85
     }

  3. Check response:
     { "success": true, "data": {...} }

  4. Verify in database:
     db.breath_sessions.find({ userId: "..." })

  5. Check dashboard query:
     GET /api/breath/sessions?date=YYYY-MM-DD
```

#### Extract Session Analytics
```typescript
// Calculate average hold times
const sessions = await prisma.breathSession.findMany({
  where: {
    userId: user.id,
    localDate: {
      gte: '2025-10-01',
      lte: '2025-10-31'
    }
  }
})

const avgExhaleHold = sessions.reduce((sum, s) => sum + s.bestExhaleHold, 0) / sessions.length
const avgInhaleHold = sessions.reduce((sum, s) => sum + s.bestInhaleHold, 0) / sessions.length
const totalSessions = sessions.length
```

---

### Gamification Workflows

#### Award Points Manually (Admin)
```typescript
// Emergency point award (bug fix, compensation, etc.)
await prisma.gamificationPoint.create({
  data: {
    userId: 'user-id',
    pointType: 'manual_adjustment',
    amount: 100,
    activitySource: 'admin_manual',
    metadata: {
      reason: 'Compensation for bug',
      adminId: 'admin-id',
      timestamp: new Date()
    }
  }
})

// Update user total
await prisma.user.update({
  where: { id: 'user-id' },
  data: {
    totalPoints: { increment: 100 }
  }
})
```

#### Check Achievement Unlock Eligibility
```typescript
// Check if user should unlock "30-day streak" badge
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { currentStreak: true }
})

if (user.currentStreak === 30) {
  await prisma.achievement.create({
    data: {
      userId: userId,
      badgeType: 'iron_will',
      unlockedAt: new Date(),
      pointsAwarded: 200
    }
  })

  // Award bonus points
  await awardPoints(userId, 'achievement_unlock', 200, 'iron_will_badge')
}
```

#### Debug Missing Streak Update
```yaml
Issue: User completed activity but streak didn't increment

Debug Steps:
  1. Check if activity was logged:
     GET /api/peptides/doses?date=YYYY-MM-DD
     # OR other feature endpoints

  2. Verify date is user's local date:
     # NOT UTC date
     # User's browser timezone determines date boundary

  3. Check streak update cron job:
     # Runs at midnight user's timezone
     # Vercel cron: /api/gamification/update-streaks

  4. Manual streak fix:
     await prisma.user.update({
       where: { id: userId },
       data: {
         currentStreak: { increment: 1 },
         longestStreak: Math.max(currentStreak + 1, longestStreak)
       }
     })
```

---

### Auth0 Troubleshooting

#### User Not Found After Login
```yaml
Issue: API returns 404 for authenticated user

Root Cause: User exists but Auth0 ID changed

Solution:
  1. Verify email fallback is working:
     const user = await prisma.user.findFirst({
       where: {
         OR: [
           { auth0Sub: session.user.sub },
           { email: session.user.email }
         ]
       }
     })

  2. Check callback route auto-created user:
     GET /app/auth/callback/route.ts

  3. If user exists with different auth0Sub:
     await prisma.user.update({
       where: { email: session.user.email },
       data: { auth0Sub: session.user.sub }
     })

Status: ✅ RESOLVED - Email fallback prevents this
```

#### Login Redirects to Wrong Page
```yaml
Issue: After login, redirects to / instead of /portal

Root Cause: Missing returnTo parameter

Solution:
  # SIMPLE FIX (2 minutes)
  <a href="/api/auth/login?returnTo=/portal">Login</a>

  # NOT THIS (30 minutes wasted)
  # - Downgrade Auth0
  # - Change imports
  # - Modify middleware

Status: ✅ RESOLVED
```

#### New User Can't Save Data
```yaml
Issue: First-time user logs in but API returns "user not found"

Root Cause: User not created in database on first login

Solution:
  1. Check callback route:
     GET /app/auth/callback/route.ts

  2. Verify user creation logic exists:
     if (!user) {
       user = await prisma.user.create({
         data: {
           auth0Sub: session.user.sub,
           email: session.user.email,
           displayName: session.user.name,
           role: 'customer',
           accessLevel: 'trial'
         }
       })
     }

  3. Test with new Google account:
     # Login
     # Check database: db.users.find({ email: "test@gmail.com" })
     # Should exist immediately after login

Status: ✅ RESOLVED - Callback auto-creates users
```

---

### Database Migration Commands

#### Add New Model
```bash
# 1. Edit prisma/schema.prisma
model NewFeature {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  data      Json
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@map("new_features")
}

# 2. Update User model relations
model User {
  # ... existing fields
  newFeatures NewFeature[]
}

# 3. Push schema to MongoDB
npx prisma db push

# 4. Verify migration
npx prisma db pull
```

#### Seed Initial Data
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Seed peptides
  const peptides = [
    {
      name: 'BPC-157',
      description: 'Body Protection Compound',
      commonDosage: '250-500 mcg daily',
      benefits: ['Healing', 'Recovery', 'Gut health']
    },
    // ... more peptides
  ]

  for (const peptide of peptides) {
    await prisma.peptide.upsert({
      where: { name: peptide.name },
      update: peptide,
      create: peptide
    })
  }
}

main()
```

```bash
# Run seed
npx prisma db seed

# Or via npm script
npm run db:seed
```

#### Backup Database
```bash
# MongoDB Atlas backup (via mongodump)
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/resetbiology" --out=./backup

# Restore backup
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/resetbiology" ./backup
```

---

## Troubleshooting

### Common Issues & Solutions

#### TypeScript Errors

```bash
# Problem: "Cannot find module '@/lib/prisma'"
# Solution: Check tsconfig.json paths
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*", "./app/*", "./lib/*"]
    }
  }
}

# Problem: "Type 'ObjectId' is not assignable to type 'string'"
# Solution: Use @db.ObjectId in Prisma schema
model User {
  id String @id @default(auto()) @map("_id") @db.ObjectId
}
```

#### Build Failures

```bash
# Problem: "Module not found: Can't resolve 'X'"
# Solution: Install missing dependency
npm install X

# Problem: "Out of memory" during build
# Solution: Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm run build

# Problem: "Unexpected token '<'" (JSX in .ts file)
# Solution: Rename .ts to .tsx
mv component.ts component.tsx
```

#### API Route Issues

```yaml
Problem: API returns 500 Internal Server Error

Debug Steps:
  1. Check Vercel logs:
     npx vercel logs

  2. Check local console:
     # Look for console.error() output

  3. Add error logging:
     try {
       // ... code
     } catch (error) {
       console.error('API Error:', error)
       return NextResponse.json({ error: error.message }, { status: 500 })
     }

  4. Test locally:
     npm run dev
     curl http://localhost:3000/api/endpoint
```

#### Database Connection Issues

```yaml
Problem: "Can't reach database server"

Solutions:
  1. Check DATABASE_URL in .env.local:
     DATABASE_URL="mongodb+srv://..."

  2. Verify MongoDB Atlas IP whitelist:
     # Add 0.0.0.0/0 for Vercel
     # Or specific Vercel IPs

  3. Test connection:
     curl https://resetbiology.com/api/health/db

  4. Check Prisma client generation:
     npx prisma generate
```

#### Gamification Points Not Awarded

```yaml
Problem: User completes action but doesn't get points

Debug Steps:
  1. Check if action triggers point award:
     # Search codebase for:
     fetch('/api/gamification/points', {
       method: 'POST',
       body: JSON.stringify({ pointType: '...' })
     })

  2. Verify API endpoint works:
     curl -X POST https://resetbiology.com/api/gamification/points \
       -H "Content-Type: application/json" \
       -d '{"pointType":"test","amount":10,"activitySource":"manual"}'

  3. Check user total:
     db.users.findOne({ email: "user@example.com" })
     # Check totalPoints field

  4. Verify point transaction saved:
     db.gamification_points.find({ userId: "..." })
```

#### Timezone Issues

```yaml
Problem: Dose logged shows wrong date

Root Cause: UTC conversion instead of local date storage

Solution:
  1. NEVER convert to UTC for user dates
  2. ALWAYS store localDate and localTime strings:
     {
       localDate: "2025-11-04",  // User's local date
       localTime: "09:30:00"     // User's local time
     }

  3. Fix in code:
     // WRONG
     const date = new Date().toISOString() // ❌

     // CORRECT
     const now = new Date()
     const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
     const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
```

---

## Common Fixes

### Quick Fixes Library

#### Fix Broken Login Redirect
```javascript
// File: Any login link
// Change from:
<a href="/api/auth/login">Login</a>

// To:
<a href="/api/auth/login?returnTo=/portal">Login</a>
```

#### Fix Missing User Auto-Creation
```typescript
// File: /app/auth/callback/route.ts
// Ensure this logic exists:
if (!user) {
  user = await prisma.user.create({
    data: {
      auth0Sub: session.user.sub,
      email: session.user.email,
      displayName: session.user.name || session.user.email,
      role: 'customer',
      accessLevel: 'trial'
    }
  })
}
```

#### Fix Dose Calculator Precision
```typescript
// File: /src/components/Peptides/Calculator.tsx
// Add rounding:
const syringeUnits = Math.round((requiredVolume / 0.01) * 10) / 10
```

#### Fix Streak Breaking at Midnight
```typescript
// File: /api/gamification/update-streaks/route.ts
// Use user's local timezone, not UTC:
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const localDate = dateToLocalKey(yesterday) // "2025-11-03"

// Check if user had ANY activity on this local date
const hasActivity = await checkActivityForDate(user.id, localDate)
```

#### Fix Mobile Responsive Button
```jsx
// Change from:
<button className="px-6 py-3">Click Me</button>

// To:
<button className="px-4 py-2 md:px-6 md:py-3">Click Me</button>
```

#### Fix Missing Gamification Points
```typescript
// After workout completion, add:
await fetch('/api/gamification/points', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pointType: 'workout_completed',
    amount: 50,
    activitySource: 'workout_tracker'
  })
})
```

---

## Contact & Resources

### HOS System
- **Agents Directory:** `.hos/agents/`
- **Orchestra Config:** `.hos/orchestra/`
- **Manual Location:** `.hos/manual/HOS-MANUAL.md`

### ResetBiology Platform
- **Production URL:** https://resetbiology.com
- **Repository:** Current working directory
- **Database:** MongoDB Atlas
- **Hosting:** Vercel

### Documentation
- **CLAUDE.md:** Project guidelines and lessons learned
- **Discovered Vision:** `.hos/orchestra/discovered-vision.md`
- **Prisma Schema:** `prisma/schema.prisma`

### Support
- Consult relevant agent before making changes
- Follow the Four-Step Protocol (Understand → Investigate → Propose → Implement)
- Test locally before deploying
- Monitor production after deployment

---

**Remember:** Simple fixes first. One line > multiple files. Test before deploy. Never break Auth0. 🚀
