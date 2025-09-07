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
- **Authentication**: NextAuth.js with Google OAuth
- **Deployment**: Containerized for consistent environments

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
- Maintain security best practices for medical/health data

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
- **NextAuth sessions**: `const session = sessionData as any`
- **Permissions casting**: `permissions: data.permissions as any as UserPermissions`
- **SessionData properties**: Use `endedAt/startedAt` not `endAt/startAt`, `settings.cyclesTarget` not `targetCycles`
- **NextAuth callbacks**: Add `({ param1, param2 }: any)` to all callback parameters
- **Test interfaces**: Cloudflare enforces stricter interface requirements than local builds - always provide ALL required properties even if marked optional locally
- **Session strategy**: Use `strategy: "jwt" as const`

### 4. Deployment-specific considerations:
- **Cloudflare Pages is stricter** than local development
- **ESLint is disabled during builds** (`eslint: { ignoreDuringBuilds: true }`)
- **Test comprehensive builds locally**: `npx next build --no-lint` before pushing

### 5. Signs you need this protocol:
- Getting repeated "Failed to compile" errors from Cloudflare
- TypeScript errors appearing one-by-one in deployment logs
- Build passing locally but failing in production

**Remember**: 30 minutes of proactive TypeScript checking saves 3+ hours of reactive deployment debugging.

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

Remember: This is a medical/wellness platform - prioritize security, privacy, and accurate functionality over rapid development.

---
## Automated Session Startup Process (WSL2)

### **🚀 REQUIRED: Start Every Session With This**
1. **Open Ubuntu Terminal**
2. **Type**: `up` (alias that runs: cd claude-kimi && docker compose up -d)
3. **Type**: `claude` 
4. **⚡ AUTOMATIC VERIFICATION**: `check-setup` or `./verify-setup.sh`

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
- **Authentication**: NextAuth.js with Google OAuth
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
- Authentication endpoints with NextAuth.js
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