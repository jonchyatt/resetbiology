# 🚨 MASTER TODO LIST - UPDATED 2025-09-17

## 🔴 IMMEDIATE PRIORITIES

### 1. Complete Peptide Import & Stripe Integration
**Status: BLOCKED - Need display for browser automation**

**What's Done:**
- ✅ Stripe SDK installed and configured
- ✅ Product/Price models created in Prisma
- ✅ Admin sync endpoints built
- ✅ Checkout flow with JIT Stripe publish
- ✅ Webhook for order capture
- ✅ Chrome cookies extracted (13 cookies saved)
- ✅ Scraping scripts created

**What's Needed:**
- [ ] **Get peptide data from cellularpeptide.com** (manual or automated)
- [ ] **Import all peptides to MongoDB** with 50% markup
- [ ] **Test admin panel** at /admin/store
- [ ] **Sync products to Stripe**
- [ ] **Test checkout flow** end-to-end

**Alternative Approach:** Manual data collection via browser console

### 2. Fix Profile Management Page
- [ ] Pull REAL user data from MongoDB User table
- [ ] Remove SMS notification toggle completely
- [ ] Fix Sign Out button to use Auth0
- [ ] Fix Save Changes to update MongoDB
- [ ] Create `/api/profile/update` endpoint

### 3. Portal Dashboard Redesign
- [x] Daily check-in with checkboxes
- [x] Journal integration with David Snyder format
- [ ] Connect checkboxes to DailyTask database
- [ ] Calculate streaks from database
- [ ] Points system using GamificationPoint table

## 🟡 STRIPE INTEGRATION STATUS

### What We Have (30% Complete):
- ✅ Stripe SDK v18.5.0 installed
- ✅ Basic API endpoints created
- ✅ UI components built (order page, deposit component)
- ✅ Product/Price models in database
- ✅ Admin store page framework

### What's Missing (70%):
- ❌ Real Stripe API keys (using placeholders)
- ❌ Actual payment processing
- ❌ Stripe Elements for card input
- ❌ Customer management
- ❌ Subscription handling
- ❌ Product catalog in Stripe

## 🏗️ DATABASE TABLES TO ADD

```prisma
model DailyTask {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  date        DateTime
  taskName    String   
  completed   Boolean  @default(false)
  user        User     @relation(fields: [userId], references: [id])
}

model JournalEntry {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  entry       String
  mood        String?
  affirmationGoal     String?  // "I am..."
  affirmationBecause  String?  // "Because..."
  affirmationMeans    String?  // "And that means..."
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

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
  completedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}
```

## 📋 PHASE-BASED ROADMAP

### PHASE 1 - THIS WEEK (In Progress)
1. **Complete Peptide Import** 🔴 BLOCKED
   - Need alternative to browser automation
   - Consider manual data entry
2. **Fix Profile Management bugs** 
3. **Portal Dashboard with real data**
4. **Database tables for tracking**

### PHASE 2 - NEXT SPRINT
1. **Complete Stripe Integration**
   - Get real API keys
   - Implement Stripe Elements
   - Test payment flow
2. **Peptide import safety system**
3. **Connect portal checkboxes to database**
4. **Daily Journal & Affirmations**

### PHASE 3 - FOLLOWING
1. **Affiliate System**
2. **Accountability Deposit System**
3. **Gamification rewards**
4. **Email automation**

## 🔧 TECHNICAL NOTES

### Current Reality:
- **Auth0 v4** working correctly
- **MongoDB Atlas** connected and functional
- **User data IS saved** via upsertUserFromAuth0
- **Portal redesigned** with journal integration
- **Vercel deployment** successful

### Environment Issues:
- **WSL2 headless** - Can't open browser windows
- **Playwright MCP** not connected
- **Display not available** for automation

### Files Created This Session:
- `PEPTIDE_IMPORT_MASTER_PLAN.md` - Complete import strategy
- `get-chrome-cookies.js` - Cookie extraction (worked!)
- `scrape-peptides.js` - Scraping logic
- `/tmp/cellularpeptide_cookies.json` - 13 saved cookies

## 🚀 IMMEDIATE NEXT STEPS

1. **For Peptide Import:**
   - Option A: Start new session on machine with display
   - Option B: Manual browser console extraction
   - Option C: Contact cellularpeptide.com for API

2. **For Stripe:**
   - Create Stripe account
   - Get production API keys
   - Update `.env.local`

3. **For Portal:**
   - Add missing database tables
   - Connect checkboxes to database
   - Implement points calculation

---
**Last Updated:** 2025-09-17 02:05 UTC
**Session Status:** Browser automation blocked, data saved for continuation