# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Reset Biology Website Development

## Project Overview
Building a complex medical/wellness platform with public marketing site, secure client portal, gamification system, and integrated breath training application.

Reset Biology is a modern web application built with Next.js, featuring comprehensive wellness tracking, breath training, and metabolic optimization tools. The project uses containerization and includes modern web development tools.

## Development Environment & Capabilities
- **Operating System**: WSL2 (Ubuntu on Windows)
- **Containerization**: Docker Desktop with container orchestration
- **Development Tool**: Claude Code running in WSL2
- **Browser Dependencies**: Chromium with full headless capabilities installed
- **Testing Framework**: Playwright with browser automation
- **Testing Integration**: Playwright MCP connected for automated testing

## Available Testing & Debugging Capabilities
You have access to Playwright MCP which enables you to:
- Automatically test website functionality across browsers
- Read and analyze browser console logs for debugging
- Take screenshots of UI states for visual verification
- Identify and fix bugs by observing actual browser behavior
- Implement self-healing code that responds to runtime errors

## Architecture Requirements
- **Frontend**: Next.js with React/TypeScript
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: SQLite (local development), PostgreSQL (production)
- **Authentication**: Auth0 with Google OAuth and email connections
- **Deployment**: Containerized for consistent environments

## Authentication System (Auth0)
- **Domain**: dev-4n4ucz3too5e3w5j.us.auth0.com
- **Integration**: @auth0/nextjs-auth0 SDK
- **Routes**: `/api/auth/[...auth0]` (login, logout, callback, me)
- **Protection**: ProtectedRoute component for secured pages
- **User Management**: Auth0 dashboard + Prisma user sync via upsertFromAuth0

## SUCCESSFUL Peptide Data Scraping Process (September 17, 2025)

### What Worked - Complete Process Documentation

**Environment Setup Required:**
- WSL2 with working display (DISPLAY=:0)
- Chromium browser via Playwright
- Node.js with Playwright installed
- Existing cookies saved (optional but helpful)

**The Working Scraper Process:**

1. **Launch browser in headed mode** (not headless) with Playwright
```javascript
const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled']
});
```

2. **Navigate to collections pages** - Must scrape all 3 pages:
- Page 1: https://cellularpeptide.com/collections/all
- Page 2: https://cellularpeptide.com/collections/all?page=2
- Page 3: https://cellularpeptide.com/collections/all?page=3

3. **Extract product URLs from listing pages FIRST**
- Get product name from listing (more reliable than product page)
- Get list price from listing
- Get product URL for detailed scraping

4. **Visit each product page individually**
- Wait for page load with domcontentloaded (not networkidle - it times out)
- Extract protocol instructions using regex patterns
- Click "Learn More" button for educational content
- Click "More Protocol Information" for expanded protocols

5. **Key extraction patterns that worked:**
```javascript
// Protocol extraction regex patterns
/Reconstitution[:\s]*([^\n]+)/i
/Protocol Length[:\s]*([^\n]+)/i
/Dosage[:\s]*([^\n]+)/i
/Timing[:\s]*([^\n]+)/i
```

6. **Apply 50% markup**: retail = partner * 1.5

**Files Created:**
- `improved-scraper.js` - The final working version
- `cellularpeptide-final-data.json` - Complete scraped data

**Results Achieved:**
- ✅ 32 peptides scraped successfully
- ✅ 32 with prices
- ✅ 28 with protocol instructions
- ✅ 11 with educational content

**Critical Success Factors:**
- Use headed browser (headless doesn't work well)
- Scrape listing pages first for names/prices
- Use shorter timeouts (15s) with domcontentloaded
- Add delays between products (1.5s)
- Extract from listing AND detail pages
- Handle buttons that may or may not exist gracefully

## Key Components to Build
1. Public marketing landing pages with conversion optimization
2. Secure client portal with comprehensive progress tracking
3. **Mental Mastery Modules** - Audio training library with 30 foundation modules
4. **Breath Training Application** - Advanced breathing exercises with session tracking  
5. **Peptide Dosing and Tracking App** - Comprehensive peptide management system
6. **Peptide and Package Ordering** - E-commerce platform with subscription management
7. **Physical Workout Planner and Tracker** - Custom fitness programs with analytics
8. **Food and Nutrition Planner and Tracker** - Comprehensive meal planning and macro tracking
9. **Peptide Wellness and Education** - Interactive educational content library
10. **Reward Tracker** - Gamification system with achievement tiers and variable rewards
11. Affiliate program system with advanced tracking
12. Educational content management with progress-based unlocking

## Development Approach
- Use Next.js development server for local development
- Implement comprehensive testing with Playwright automation
- Build iteratively with continuous testing feedback
- Leverage self-healing capabilities to catch and fix issues

## CRITICAL: TypeScript Error Debugging Protocol

**ALWAYS BE PROACTIVE, NOT REACTIVE** when fixing TypeScript errors for deployment:

### 1. Before ANY deployment attempt:
```bash
# Run comprehensive TypeScript check on entire codebase (includes ALL files)
npx tsc --noEmit --skipLibCheck --project . 2>&1 | grep -E "error TS|Type error" | head -20

# Test files specific check (since they're excluded from main tsconfig)
npx tsc --noEmit --skipLibCheck tests/*.ts 2>&1 | grep -E "error TS|Type error" | head -10

# Final build check to catch Next.js runtime issues
npm run build
```

### 2. Fix ALL errors systematically before first deployment:
- **Never fix one error at a time** - this leads to endless deployment cycles
- **Use type assertions liberally**: `as any` or `as any as TargetType` for complex cases
- **Check property mappings**: Verify interface properties match actual data structures
- **Focus on source files first**: Test files don't affect deployment

### 3. Common TypeScript fixes for this project:
- **Session handling**: Authentication system temporarily simplified during migration
- **Permissions casting**: `permissions: data.permissions as any as UserPermissions`
- **SessionData properties**: Use `endedAt/startedAt` not `endAt/startAt`, `settings.cyclesTarget` not `targetCycles`
- **Type assertions**: Use liberal type assertions with `as any` for complex interface mappings
- **Test interfaces**: Cloudflare enforces stricter interface requirements than local builds - always provide ALL required properties even if marked optional locally
- **Session strategy**: Use `strategy: "jwt" as const`

### 4. Deployment-specific considerations:
- **Cloudflare Pages is stricter** than local development

## CRITICAL: Cloudflare Pages Deployment Guidelines

### **🚨 FILE SIZE LIMITS (25 MiB per file)**
**Common issues and fixes:**
- **Source maps**: Disable with `productionBrowserSourceMaps: false` and webpack `config.devtool = false`
- **Webpack cache**: Disable with webpack `config.cache = false` for production
- **Build with standard webpack**: Remove `--turbopack` from production build script
- **Add .vercelignore**: Exclude cache directories (.next/cache/, node_modules/, *.log)

### **Build Configuration for Cloudflare:**
```javascript
// next.config.ts
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (!dev) {
      config.devtool = false;
      config.cache = false;
    }
    return config;
  },
};
```

```json
// package.json
"build": "next build"  // Remove --turbopack for production
```

```
// .vercelignore
.next/cache/
node_modules/
.env.local
*.log
```

### **Pre-deployment checklist:**
1. Run full TypeScript check (including test files)
2. Run production build locally to verify file sizes
3. Commit AND push changes to GitHub (Cloudflare builds from git)
4. Check that no files exceed 25 MiB in .next output
- **ESLint is disabled during builds** (`eslint: { ignoreDuringBuilds: true }`)
- **Test comprehensive builds locally**: `npx next build --no-lint` before pushing

### 5. Signs you need this protocol:
- Getting repeated "Failed to compile" errors from Cloudflare
- TypeScript errors appearing one-by-one in deployment logs
- Build passing locally but failing in production

**Remember**: 30 minutes of proactive TypeScript checking saves 3+ hours of reactive deployment debugging.

## CRITICAL: Vercel Deployment Guidelines - NEVER REPEAT THESE MISTAKES

### **🚨 HARD-LEARNED LESSONS FROM SEPTEMBER 2025 DEPLOYMENT HELL**

**GOLDEN RULE:** Keep it simple! Standard Next.js in root directory with minimal configuration.

### **✅ CORRECT Vercel Setup (What Finally Worked):**

1. **Project Structure:**
   ```
   /reset-biology-website/          ← Root directory
   ├── package.json                 ← Next.js project files here
   ├── next.config.ts
   ├── src/app/                     ← App router
   ├── public/                      ← Static assets
   ├── prisma/
   └── tsconfig.json
   ```

2. **Vercel Dashboard Settings:**
   - **Root Directory**: `.` (root, not `app` subdirectory)
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: Leave empty (auto-detected)
   - **Output Directory**: Leave empty (auto-detected)

3. **NO vercel.json file needed!** Delete it entirely. Vercel auto-detects everything correctly.

### **❌ WHAT BROKE DEPLOYMENT (Never Do This Again):**

1. **Subdirectory Structure:** Having Next.js project in `/app` subdirectory
   - Causes static asset serving failures (404 errors on all images)
   - Path resolution issues with imports
   - Complex build configuration requirements

2. **Custom vercel.json with invalid runtimes:**
   ```json
   // ❌ WRONG - This breaks deployment
   {
     "functions": {
       "src/app/api/**/*.ts": {
         "runtime": "nodejs18.x"  // Invalid format!
       }
     }
   }
   ```

3. **Wrong Root Directory Settings:**
   - Setting Root Directory to `app` when project is in root
   - Trying to fix with complex build commands instead of fixing structure

### **🛠 Emergency Fix Protocol (If Deployment Breaks):**

1. **Check for these common issues first:**
   ```bash
   # 1. Verify project is in root directory
   ls -la package.json next.config.ts  # Should be in root
   
   # 2. Remove any problematic vercel.json
   rm vercel.json  # Let Vercel auto-detect
   
   # 3. Test build locally
   npm run build  # Must pass before deploying
   
   # 4. Test static assets locally
   npm run dev
   curl http://localhost:3000/logo1.png  # Should return 200
   ```

2. **Vercel Dashboard Quick Fixes:**
   - Root Directory: Set to `.` (root)
   - Framework: Next.js
   - Build Command: Leave empty
   - Clear all custom settings

3. **If images still don't load:**
   - Check if `public/` directory exists in root
   - Verify image files are committed to git
   - Wait for Vercel CDN cache to clear (5-10 minutes)

### **📋 Pre-Deployment Checklist:**

**Before every deployment:**
- [ ] Project files in root directory (not subdirectory)
- [ ] No `vercel.json` file (delete if exists)
- [ ] `npm run build` passes locally
- [ ] Static assets work locally: `curl localhost:3000/logo1.png`
- [ ] All changes committed and pushed to GitHub
- [ ] Vercel Root Directory set to `.` (root)

### **🎯 Success Indicators:**
- Build logs show: "Detected Next.js project"
- No "Function Runtimes must have a valid version" errors
- Images load correctly: `https://resetbiology.com/logo1.png` returns 200
- No 404 errors on static assets

**LESSON LEARNED:** Complexity kills deployments. Keep Next.js projects simple and let Vercel handle the magic.

## Testing Strategy
Always use Playwright MCP to:
- Test user flows after implementing features
- Verify responsive design across screen sizes
- Check form submissions and error handling
- Monitor console for JavaScript errors
- Take screenshots for visual regression testing
- Validate accessibility features

## Environment Variables & Configuration
Store sensitive configuration in environment files:
- Database connection strings
- API keys for external services
- JWT secrets for authentication
- Payment processor credentials

Remember: This is a medical/wellness platform - maintain accurate functionality over rapid development.

## CRITICAL: Visual Verification Protocol

**MANDATORY: Every change must end with visual verification**

### Required Workflow:
1. Make changes
2. Run tests: `npx playwright test`
3. Start dev server: `cd app && npm run dev`
4. **SHOW USER THE BROWSER** - http://localhost:3001
5. **WAIT FOR USER APPROVAL** before considering task complete
6. **NEVER** assume success without visual confirmation

### Design System Enforcement:
- **ALWAYS** use design system classes from `globals.css`
- **NEVER** write custom Tailwind for styled components
- Use: `card-primary`, `btn-primary`, `heading-primary`, etc.
- **Prevents style violations and ensures consistency**

## Auth0 Integration Guide

### **Environment Variables Required**
```bash
# Auth0 Configuration (in .env.local)
AUTH0_SECRET=oaZ0uKqOOpIa0JgX+pyGEFMZOp61aiYDJA6fgTjZqyDNWWJ1sR5OvHoJKp9E0QWQP1UKE21feOqFu7PICnXuWg==
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://dev-4n4ucz3too5e3w5j.us.auth0.com
AUTH0_CLIENT_ID=YDXQaFLWq8e5FuW5GMRBJ4wceomdAdzt
AUTH0_CLIENT_SECRET=3sZkNiaeXNQC-rrHfQrYIxu6mev0WDM-_vF-HpZT0ICZZMkycFQeUK9KPb4Mu5sd
```

### **Key Files & Components**
- **API Route**: `/src/app/api/auth/[...auth0]/route.ts` - Handles all Auth0 endpoints
- **Provider**: `/src/components/Auth/Auth0Provider.tsx` - Wraps app with UserProvider
- **Login Component**: `/src/components/Auth/LoginButton.tsx` - Smart login/logout button
- **Protection**: `/src/components/Auth/ProtectedRoute.tsx` - Protects secured pages
- **User Sync**: `/src/lib/users/upsertFromAuth0.ts` - Syncs Auth0 users to Prisma DB

### **Usage Examples**
```tsx
// Protected page
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
export default function MyPage() {
  return (
    <ProtectedRoute>
      <MyPageContent />
    </ProtectedRoute>
  );
}

// Access user data
import { useUser } from '@auth0/nextjs-auth0/client';
const { user, error, isLoading } = useUser();
```

### **Auth0 Routes Available**
- `/api/auth/login` - Initiates login flow
- `/api/auth/logout` - Logs out user
- `/api/auth/callback` - OAuth callback handler
- `/api/auth/me` - Returns current user info

### **Current Status & Known Issues**

---
Automated Session Startup Process (WSL2)

  🚀 REQUIRED: Start Every Session With This

  1. Open Ubuntu Terminal
  2. Type: claude
  3. ⚡ AUTOMATIC VERIFICATION: check-setup or ./verify-setup.sh
### **What the Automated Check Verifies:**
The script automatically verifies all 8 components from the YouTube video:
- ✅ **WSL2** environment
- ✅ **Docker** with WSL2 integration + functionality test
- ✅ **Claude Code (in WSL)** installation  
- ✅ **Chromium dependencies** via Playwright
- ✅ **Playwright** installation and browser availability
- ✅ **Playwright MCP** server connection
- ✅ **GitHub integration** (CLI working)
- ✅ **Supabase CLI** for local database testing

### **Expected Output When All Working:**
```
🎉 ALL SYSTEMS OPERATIONAL - YouTube video setup complete!
🚀 Ready for self-healing code and automated testing
```

### **If Something Fails:**
The script will show exactly what needs fixing with troubleshooting guidance.

### **Quick Commands After Verification:**
- Start dev server: `cd app && npm run dev`
- Run tests: `npx playwright test`  
- MCP status: `claude mcp list`
---

## Platform Feature Specifications

### Mental Mastery Modules (Audio Training System)
- **Foundation Series**: 30 core modules covering appetite control, metabolic awakening, stress management
- **Integration Series**: Advanced modules for real-world application and habit formation
- **Mastery Series**: Final modules for peptide independence and long-term maintenance
- **Progress Tracking**: Completion monitoring with gamification rewards
- **Audio Streaming**: High-quality audio delivery with offline capability

### Breath Training Application  
- **Multi-Cycle Sessions**: 1-8 breathing cycles with customizable parameters
- **Paced Breathing**: Adjustable tempo with visual and audio guidance
- **Hold Tracking**: Exhale and inhale hold timing with progress analytics
- **Session Analytics**: Performance metrics, improvement tracking, and personal records
- **Mobile Optimized**: PWA with offline capability and haptic feedback

### Peptide Dosing and Tracking Application
- **Dose Scheduling**: Automated reminders with customizable timing
- **Progress Monitoring**: Weight, mood, energy levels, and side effect tracking
- **Dose Adjustment**: AI-powered recommendations based on progress data
- **Medical Integration**: IRB-compliant data sharing with healthcare providers
- **Safety Monitoring**: Alert systems for adverse reactions or missed doses

### Physical Workout Planner and Tracker
- **Custom Programs**: Personalized workout plans based on goals and experience
- **Exercise Library**: Comprehensive database with video demonstrations
- **Progress Analytics**: Strength gains, endurance metrics, body composition tracking
- **Adaptive Scheduling**: Smart adjustments based on recovery and performance
- **Integration**: Syncs with peptide tracking for optimal timing

### Food and Nutrition Planner and Tracker
- **Meal Planning**: Automated meal plans optimized for peptide effectiveness
- **Macro Tracking**: Protein, carbs, fats with peptide-specific recommendations
- **Food Database**: USDA integration with peptide-nutrition interaction data
- **Shopping Lists**: Auto-generated grocery lists from meal plans
- **Supplement Tracking**: Coordinated with peptide dosing for optimal results

### Peptide Wellness and Education
- **Interactive Modules**: Video content with progress tracking and quizzes
- **Research Library**: Latest studies on peptide therapy and metabolic health
- **FAQ System**: Comprehensive answers to common peptide questions
- **Community Forum**: Peer support with moderated expert guidance
- **Progress-Based Unlocking**: Advanced content unlocked through engagement

### Reward Tracker (Advanced Gamification)
- **Achievement Tiers**: Bronze, Silver, Gold, Platinum with escalating rewards
- **Daily Spinner**: Variable ratio rewards using psychological triggers
- **Success Deposits**: Loss aversion psychology with partner payout system
- **Streak Tracking**: Consistency rewards with multiplier bonuses
- **Social Recognition**: Leaderboards and community achievement sharing

### E-commerce Integration (Peptide Ordering)
- **Subscription Management**: Automated reordering with dose adjustments
- **Package Customization**: Tailored combinations based on progress and goals
- **Inventory Tracking**: Real-time availability with backorder management
- **Payment Processing**: Secure handling with insurance coordination
- **Shipping Integration**: Automated fulfillment with cold-chain logistics

## Common Development Commands

### Environment Management
```bash
# Start development server (from app directory)
cd app && npm run dev

# Build for production
cd app && npm run build

# Run development server with Turbopack
cd app && npm run dev --turbo

# Install dependencies
cd app && npm install
```

### Database Operations
```bash
# Push database schema changes
cd app && DATABASE_URL="file:./dev.db" npx prisma db push

# Generate Prisma client
cd app && npx prisma generate

# Reset database
cd app && DATABASE_URL="file:./dev.db" npx prisma db push --reset-database

# View database
cd app && npx prisma studio
```

### Testing
```bash
# Run Playwright tests (from app directory)
cd app && npx playwright test

# Run tests with browser visible
cd app && npx playwright test --headed

# Run tests in debug mode
cd app && npx playwright test --debug

# Generate test report
cd app && npx playwright show-report
```

## Architecture

### Next.js Stack
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **Database**: Prisma ORM with SQLite (development)
- **Authentication**: Auth0 with Google OAuth (implementation in progress)
- **Styling**: Tailwind CSS with custom components
- **Testing**: Playwright for end-to-end testing

### Key Application Structure

#### Core Components (`app/src/components/`)
- **Hero/**: Landing page components and sections
- **Auth/**: Authentication and user management components
- **Breath/**: Breath training application components
- **Portal/**: Secure client portal components
- **Gamification/**: Achievement and reward tracking

#### API Routes (`app/src/app/api/`)
- Authentication endpoints (Auth0 implementation in progress)
- Breath training session management
- User progress and gamification tracking
- Affiliate system integration

### Environment Configuration
- Development: Uses `.env.local` and SQLite database
- Production: Uses environment variables and PostgreSQL

### Access Points
- Website: http://localhost:3001 (or 3000)
- API endpoints: http://localhost:3001/api/*
- Database viewer: npx prisma studio

## Key Files and Locations

### Application Structure
- Main layout: `app/src/app/layout.tsx`
- Homepage: `app/src/app/page.tsx`
- Tailwind config: `app/tailwind.config.ts`
- Database schema: `app/prisma/schema.prisma`

### Development Workflow
1. Use `cd app && npm run dev` to start development server
2. Use Playwright tests to verify functionality
3. Use Prisma Studio to manage database
4. Use git for version control and backups

## Brand Colors & Styling Guidelines
- Primary Teal: #3FBFB5
- Secondary Green: #72C247  
- Text Gray: #6B7280
- Text Teal: #3FBFB5

### Correct Transparency Styling Pattern
Use this consistent pattern for all cards and containers:

**Primary Cards/Containers:**
```jsx
className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30"
```

**Secondary Cards:**
```jsx
className="bg-gradient-to-br from-[color]-600/20 to-[color]-700/30 backdrop-blur-sm rounded-xl p-4 border border-[color]-400/30 shadow-xl"
```

**Key Points:**
- Always use `/20` or `/30` transparency levels, never solid colors or high opacity like `/90`
- Always include `backdrop-blur-sm` for glass effect
- Use `border-[color]-400/30` for subtle borders
- Use `shadow-2xl` or `shadow-xl` for depth
- The `/order` page demonstrates the perfect reference implementation

**❌ Wrong (avoid these patterns):**
- `from-gray-800/90 to-gray-900/90` (too opaque, wrong colors)
- `bg-solid-color` without transparency
- Missing `backdrop-blur-sm`
- Using `/80` or `/90` opacity levels

**✅ Correct transparency approach:**
- Light transparency `/10`, `/20`, `/30` maximum
- Backdrop blur for glass effect
- Brand colors (primary/secondary) not gray
- Subtle borders with transparency

# 🚨 PERMANENT FEATURE DEVELOPMENT TODO LIST

## ✅ COMPLETED FEATURES (Recently Fixed)

### 👤 Profile Management Page - COMPLETED
- [x] **Pull REAL user data from Auth0** - Uses `user.name` and `user.email` from Auth0 ✅
- [x] **Leave fields BLANK if no data** - Uses `|| ""` fallback for empty values ✅
- [x] **Fix Sign Out button** - Works via Auth0 `/auth/logout` ✅
- [x] **Fix Save Changes button** - API endpoint functional ✅
- [x] **API endpoint exists** - `/api/profile/update` handles profile updates ✅
- [x] **SMS notification toggle removed** - Only shows Email, Push, and Marketing notifications (correct) ✅

### 🔐 Auth0 Authentication System - COMPLETED
- [x] **Auth0 v4 integration** - Full middleware-based authentication ✅
- [x] **Login/Logout buttons work** - Fixed URLs to `/auth/login` and `/auth/logout` ✅
- [x] **User session management** - Real user data displayed throughout app ✅
- [x] **Protected routes** - Portal redirects to login when unauthenticated ✅

### 🧬 Peptide Import Safety System - COMPLETED ✅
- [x] **Add validation before import** - Checks for duplicates and validates protocols ✅
- [x] **Create automatic backup** - One-click backup before any changes ✅
- [x] **Build rollback function** - Restore button appears when backup exists ✅
- [x] **Add preview mode** - Confirmation dialog shows what will be imported ✅
- [x] **Duplicate handling** - Allows same peptide with different protocols ✅
- [x] **Import from screenshots** - 11 new peptides from PEPTIDEHUNT images ✅

## ✅ COMPLETED: Complete Peptide Dosage Calculator

### ✅ Full Interactive Calculator Application - INTEGRATED WITH PEPTIDE TRACKER
- [x] **Calculator UI component** with:
  - Dose input slider (0.1-15mg with increment controls) ✅
  - Concentration selector dropdown (100-2000 mcg/ml) ✅
  - Volume selector (0.5-3.0ml) ✅
  - Custom input fields for non-standard values ✅
  - Toggle between mg and mcg units ✅
- [x] **Real-time calculation engine** showing:
  - Exact ml to draw (2 decimal precision) ✅
  - Visual syringe representation with fill level ✅
  - Insulin units conversion ✅
  - Step-by-step mixing instructions ✅
- [x] **Preset peptide profiles**:
  - Imports data from active protocols ✅
- [x] **Modal integration**: Calculator opens from "Calculate" button on peptide cards ✅
  - Quick-select buttons for popular protocols
  - Save custom presets per user
- [ ] **Include complete reconstitution guide**:
  - Visual mixing animations
  - BAC water calculator
  - Storage instructions
  - Safety warnings
- [ ] **Build unit converter widget** (mg ↔ mcg ↔ IU)
- [ ] **Add to peptide tracker page** as embedded tool

### 🏠 Portal Dashboard - COMPLETED
- [x] **Personalized welcome** - "Welcome back, {user?.name || 'Wellness Warrior'}" ✅
- [x] **Daily Check-in Section** - Prominent with subtitle and progress tracking ✅
- [x] **Current streak display** - Shows "{currentStreak} day streak" ✅
- [x] **Daily Task Checkboxes** - All 6 tasks with database persistence ✅
  - [x] Log Peptides → `/peptides` ✅
  - [x] Daily Journal → `/journal` ✅
  - [x] Log Workout → `/workout` ✅
  - [x] Log Meals → `/nutrition` ✅
  - [x] Complete Mental Mastery Module → `/modules` ✅
  - [x] Launch Breath Training → `/breath` ✅
- [x] **Database persistence** - Checkboxes save to DailyTask table via `/api/daily-tasks` ✅
- [x] **Secondary Actions** - Order Peptides link to `/store` ✅

## 🟡 USER REWARDS & GAMIFICATION SYSTEM (Using Existing Tables)

### 🏆 Using Existing GamificationPoint Table
- [ ] **Build points calculation engine** - Different points for different tasks
- [ ] **Create daily reset job** - Reset checkboxes at midnight
- [ ] **Points display component** - Shows total points with animation
- [ ] **Achievement badges display** - Showcase earned badges
- [ ] **Point notification toasts** - Celebrate earning points
- [ ] **Define point values** per task (e.g., peptide log = 25 points)
- [ ] **Create tier system** - Bronze (0-1000), Silver (1000-5000), Gold (5000-10000), Platinum (10000+)

## 🟡 DAILY JOURNAL & AFFIRMATIONS (NEW)

### 📔 Journal System
- [ ] **Create JournalEntry database table** - userId, entry, mood, date
- [ ] **Build journal entry page** at `/journal`
- [ ] **Add rich text editor** - Bold, italic, lists
- [ ] **Create entry templates** - Guided prompts for reflection
- [ ] **Build journal history view** - Browse and search past entries

### ✨ Affirmations System
- [ ] **Create affirmations table** - userId, affirmation, isActive
- [ ] **Build affirmation display** - Show on portal dashboard
- [ ] **Add custom affirmation creator** - Users create their own
- [ ] **Implement rotation system** - Different affirmation each day

## 💳 STRIPE PAYMENT INTEGRATION

### 🔒 E-commerce & Payment Processing
- [ ] **Set up Stripe account** and obtain API keys
- [ ] **Install Stripe SDK** in Next.js
- [ ] **Create checkout flow** - Select peptides → payment → confirmation
- [ ] **Build subscription management** - Monthly peptide deliveries
- [ ] **Implement payment method storage** - Save cards securely
- [ ] **Add invoice generation** - Email receipts

## 🤝 AFFILIATE SYSTEM

### 👥 Referral & Commission System
- [ ] **Research platforms** - Post Affiliate Pro vs ReferralCandy vs custom
- [ ] **Create affiliate dashboard** - Track referrals and commissions
- [ ] **Build referral link generator** - Unique links per affiliate
- [ ] **Implement commission calculation** - Percentage of sales
- [ ] **Create payout system** - Monthly affiliate payments

## 🏆 ACCOUNTABILITY DEPOSIT SYSTEM

### 💰 "Treasure Chest" Motivation System
- [ ] **Design deposit mechanism** - Users deposit money for motivation
- [ ] **Create goal tracking** - Link deposits to specific goals
- [ ] **Build release logic** - Release funds when goals achieved
- [ ] **Implement partner payouts** - Failed goals go to accountability partner

## 🗄️ DATABASE TABLES TO ADD

### 📋 Required New Tables

```prisma
model FoodEntry {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  name        String
  calories    Float
  protein     Float
  carbs       Float
  fats        Float
  mealType    String   // breakfast, lunch, dinner, snack
  loggedAt    DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  @@map("food_entries")
}

model WorkoutSession {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  exercises   Json     // Array of exercises with sets/reps/weight
  duration    Int      // in seconds
  programId   String?
  completedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  @@map("workout_sessions")
}

model DailyTask {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  date        DateTime
  taskName    String   // peptides, journal, workout, meals, module, breath
  completed   Boolean  @default(false)
  user        User     @relation(fields: [userId], references: [id])
  @@map("daily_tasks")
}

model JournalEntry {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  entry       String
  mood        String?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
  @@map("journal_entries")
}
```

### ✅ Existing Tables (Already Built)
- **BreathSession** - Tracks breath training progress
- **ModuleCompletion** - Tracks Mental Mastery module access  
- **GamificationPoint** - Points system for rewards
- **ClientProgress** - Generic progress tracking
- **User** - User data with Auth0 integration via `upsertUserFromAuth0`

## 🔧 TECHNICAL IMPLEMENTATION NOTES

### 📊 Current Reality
- **User data IS saved to MongoDB** when they login (via `upsertUserFromAuth0`)
- **BreathSession table already exists** for breath training
- **ModuleCompletion table already exists** for Mental Mastery tracking  
- **GamificationPoint table already exists** for points system
- **Profile page should use REAL MongoDB data** or leave BLANK
- **Portal checkboxes need DailyTask database** persistence per user
- **Streak calculation from DailyTask data** (no separate streak table needed)

### 🎯 API Endpoints to Build
- `/api/profile/update` - Handle profile updates
- `/api/daily-tasks/*` - Daily checkbox state management
- `/api/journal/*` - Daily journal and affirmations
- `/api/calculator/*` - Peptide dosage calculator
- `/api/payments/*` - Stripe integration endpoints
- `/api/affiliate/*` - Affiliate system integration

### 🏗️ Component Architecture
- Portal layout wrapper for authenticated users  
- Daily check-in dashboard components with real data
- Interactive peptide dosage calculator
- Points display with real-time updates
- Checkbox components with database persistence

## 📊 PRIORITY ORDER

### **CURRENT STATUS - UPDATED SEPTEMBER 2025:**

**✅ PHASE 1 - COMPLETED:**
1. ✅ **Profile Management** - Real Auth0 data, functional buttons, API endpoints
2. ✅ **Portal Dashboard** - Daily check-in with real data and database persistence  
3. ✅ **Complete Peptide Dosage Calculator** - Fully integrated modal calculator
4. ✅ **Auth0 Authentication System** - v4 middleware-based authentication working
5. ✅ **Database tables exist** - DailyTask, GamificationPoint, BreathSession, ModuleCompletion

**✅ RECENTLY COMPLETED (September 16, 2025):**
1. ✅ **Peptide import safety system** - COMPLETE with all features:
   - ✅ Validation before import with duplicate detection
   - ✅ Automatic backup before changes
   - ✅ One-click restore from backup
   - ✅ Preview mode showing what will be imported
   - ✅ Import from PEPTIDEHUNT screenshots
   - ✅ Allows duplicates with different protocols
   - ✅ Admin page at `/admin/peptides` fully functional

**✅ COMPLETED TODAY (September 16, 2025):**
1. ✅ **Peptide Import Safety System** - COMPLETE with all features:
   - ✅ Validation before import with duplicate detection
   - ✅ Automatic backup before changes
   - ✅ One-click restore from backup
   - ✅ Preview mode showing what will be imported
   - ✅ Import from PEPTIDEHUNT screenshots (11 new peptides)
   - ✅ Allows duplicates with different protocols
   - ✅ Admin page at `/admin/peptides` fully functional

2. ✅ **Enhanced Portal with Integrated Journal** - COMPLETE:
   - ✅ Redesigned portal matching Portalview.png exact layout
   - ✅ Left side: Task checkboxes in vertical list
   - ✅ Right side: 2x3 grid of quick access cards
   - ✅ Daily Journal moved below portal layout (not beside)
   - ✅ David Snyder affirmation format ("I am", "Because", "And that means")
   - ✅ Weight and mood tracking with dropdown options
   - ✅ "Why I'm Going to Be Successful Today" validation
   - ✅ Auto-population from completed tasks (peptides, workout, nutrition)
   - ✅ Database schema updated with weight/mood fields
   - ✅ API endpoints for journal entry persistence at `/api/journal/entry`

**🔴 REMAINING PRIORITIES (Phase 2):**
1. **Workout tracking** page - Build `/workout` (link exists, page needs implementation)
2. **Nutrition tracking** page - Build `/nutrition` (link exists, page needs implementation)

**🟡 SEPARATE GAMIFICATION TODO (Moved from Phase 2):**
1. **Enhanced Gamification System** - Points calculation engine, achievement badges, tier system

**🟢 PHASE 3 - FUTURE:**
1. **Stripe Payment Integration**
2. **Affiliate System** 
3. **Accountability Deposit System**

---

*This list is PERMANENT and should be accessible across all Claude Code sessions. Each item should be broken down into smaller tasks when implementation begins.*