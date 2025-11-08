# ResetBiology.com - Technology Stack

## Frontend

### Framework
- **Next.js:** 15.5.2 (App Router architecture)
- **React:** 19.1.0 (latest)
- **TypeScript:** 5.x

### Build Tools
- **Turbopack:** Development mode (via `--turbopack` flag)
- **Webpack:** Production builds
- **Next.js Build System:** Standalone output mode

### Styling
- **Tailwind CSS:** 4.x
- **PostCSS:** Latest (@tailwindcss/postcss)
- **Custom Design System:**
  - Primary: `#3FBFB5` (teal)
  - Secondary: `#72C247` (green)
  - Dark theme with gray-800/900 backgrounds
  - Transparency effects with backdrop-blur
  - Mobile-first responsive design

### UI Libraries & Icons
- **Lucide React:** 0.542.0 (icon library)
- **Framer Motion:** 12.23.12 (animations)
- **@tailwindcss/forms:** 0.5.10 (form styling)
- **@tailwindcss/typography:** 0.5.16 (rich text)

### Client-Side Storage
- **Dexie:** 4.2.0 (IndexedDB wrapper for breath session caching)
- **LocalStorage:** Used for client-side data persistence

## Backend

### Runtime
- **Node.js** via Next.js server
- **Standalone deployment** mode for Vercel

### API Architecture
- **Next.js API Routes:** 45+ endpoints
- **RESTful design** (no GraphQL)
- **Route Handlers:** App Router `/app/api/**/route.ts` pattern

### Authentication
- **Auth0:** v4.10.0 (`@auth0/nextjs-auth0`)
- **OAuth Provider:** Google
- **Session Management:** Server-side session validation
- **Domain:** dev-4n4ucz3too5e3w5j.us.auth0.com
- **Auto User Creation:** Callback handler auto-provisions users on first login
- **Email Fallback:** User lookup supports Auth0 ID changes via email matching

### Payment Processing
- **Stripe:** 18.5.0
- **Checkout Integration:** Stripe Checkout sessions
- **Webhook Handling:** `/api/stripe/webhook` for payment events
- **Product Sync:** Admin Stripe sync functionality

### Email Service
- **Resend:** 6.4.0 (transactional emails)
- Integration for notifications and alerts

## Database

### Production Database
- **MongoDB Atlas** (cloud-hosted)
- **Connection:** Via connection string in DATABASE_URL
- **Cluster:** cluster0.weld7bm.mongodb.net

### ORM
- **Prisma:** 6.15.0 (both client and CLI)
- **@prisma/client:** 6.15.0
- **Schema:** 30+ models with complex relationships
- **ObjectId Mapping:** All IDs use MongoDB ObjectId type
- **Migration Strategy:** `prisma db push` (no formal migrations)

### Local Development
- **SQLite3:** 5.1.7 (alternative for local dev)
- **Prisma Generate:** Auto-runs on `npm install` via postinstall script

### Key Database Models
```
User (Auth0 integration)
├── BreathSession (breath training data)
├── WorkoutSession (exercise tracking)
├── FoodEntry / FoodLog (nutrition tracking)
├── JournalEntry (daily journal)
├── GamificationPoint (points system)
├── DailyTask (task completion tracking)
├── user_peptide_protocols (peptide protocols)
│   └── peptide_doses (dose logging)
├── NotificationPreference (push notification settings)
├── PushSubscription (PWA push subscriptions)
└── ScheduledNotification (dose reminders)

Peptide (peptide catalog)
Product (e-commerce products)
├── Price (product pricing)
├── ProductPage (rich content)
└── InventoryTransaction (stock tracking)

Order (Stripe orders)
Assessment (health assessments)
```

## Deployment

### Primary Platform
- **Vercel**
- **Automatic Deployments:** Git push triggers build
- **Environment:** Production + Staging
- **Build Command:** `prisma generate && next build`
- **Output:** Standalone mode
- **Domain:** resetbiology.com

### Backup Platform
- **Cloudflare Pages** (via OpenNext)
- **@opennextjs/cloudflare:** 1.8.0
- **Workers Compatibility:** nodejs_compat flag
- **Build:** `npx @opennextjs/cloudflare build`
- **Preview:** Wrangler Pages

### Environment Variables
```bash
# Auth0
AUTH0_SECRET
AUTH0_BASE_URL
AUTH0_ISSUER_BASE_URL
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET

# Database
DATABASE_URL (MongoDB Atlas connection string)

# Stripe
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

# Notifications (PWA)
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
CRON_SECRET

# Email
RESEND_API_KEY

# Google (for Drive integration - partial)
NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

## Testing

### E2E Testing
- **Playwright:** 1.56.0
- **@playwright/test:** 1.55.0
- **Test Files:**
  - `.hos/tests/playwright/mobile.spec.ts` (mobile responsiveness - stubs)
  - `.hos/tests/playwright/critical-paths.spec.ts` (user flows - stubs)
  - `.hos/tests/playwright/checkout.spec.ts` (e-commerce - stubs)
- **Status:** Framework installed, minimal test implementation
- **Configs:** Multiple config files (hover, portal, main)

### Unit Testing
- **None currently implemented**
- **No Jest, Vitest, or React Testing Library**

### Type Checking
- **TypeScript:** Compile-time type safety
- **ESLint:** 9.x with Next.js config
- **Build Checks:** `npx tsc --noEmit`

### Manual Testing
- **Chrome DevTools MCP:** Preferred for production testing
- **Screenshots:** `C:\Users\jonch\Pictures\Screenshots\`

## Development Tools

### Code Quality
- **ESLint:** 9.x (`eslint.config.mjs`)
- **ESLint Config Next:** 15.5.2
- **@eslint/eslintrc:** 3.x
- **TypeScript Strict Mode:** Enabled
- **Build Time Linting:** Disabled (`ignoreDuringBuilds: true`)

### TypeScript Tooling
- **ts-node:** 10.9.2 (for scripts)
- **tsx:** 4.20.6 (TypeScript execution)
- **Type Definitions:**
  - `@types/node`
  - `@types/react` (v19)
  - `@types/react-dom` (v19)
  - `@types/web-push` (3.6.4)
  - `@types/google.accounts` (0.0.17)
  - `@types/node-cron` (3.0.11)
  - `@types/uuid` (10.0.0)

### Build Scripts
```json
{
  "dev": "next dev --turbopack",
  "dev:test": "next dev",
  "prebuild": "npx tsx scripts/verify-auth-env.ts",
  "build": "next build",
  "vercel-build": "prisma generate && next build",
  "postinstall": "prisma generate",
  "build:worker": "npx @opennextjs/cloudflare build",
  "build:full": "npm run build && npm run build:worker",
  "start": "next start",
  "preview": "wrangler pages dev .worker-next --compatibility-flags=nodejs_compat"
}
```

### Version Control
- **Git:** Repository at `C:\Users\jonch\reset-biology-website`
- **Platform:** GitHub (assumed)
- **Git Hooks:** Sample hooks in `.git/hooks/`

## External Services

### Google Services
- **Google APIs:** 159.0.0 (googleapis package)
- **Google Drive Integration:** Partially implemented (`src/lib/google-drive.ts`)
  - Stub functions for folder creation
  - Google Sheets export for breath sessions
  - OAuth initialization helper
  - **Status:** Incomplete implementation

### Notifications
- **Web Push:** 3.6.7 (push notifications)
- **Service Worker:** `/public/service-worker.js`
- **PWA Manifest:** `/public/manifest.json`
- **VAPID Keys:** For authenticated push
- **Cron Job:** Vercel cron for sending scheduled notifications

### Utilities
- **nanoid:** 5.1.5 (unique ID generation)
- **uuid:** 11.1.0 (UUID generation)

## Progressive Web App (PWA)

### PWA Features
- **Service Worker:** Registered at `/service-worker.js`
- **Web Manifest:** `/manifest.json` with app metadata
- **Installable:** Home screen install prompt
- **Push Notifications:** Dose reminder system
- **Offline Support:** Basic caching via service worker

### Notification System
- **Push Subscriptions:** Stored in database
- **Notification Preferences:** Per-protocol settings
- **Scheduled Notifications:** Cron-based delivery
- **Fallback:** Email notifications via Resend

## Performance Optimizations

### Current Setup
- **Turbopack:** Faster dev builds
- **Standalone Output:** Optimized production builds
- **Image Optimization:** Next.js Image component (remote patterns for i.imgur.com)
- **No Source Maps:** Disabled in production (`productionBrowserSourceMaps: false`)
- **Build Cache:** Disabled in production for consistency

### Areas for Improvement
- No bundle analysis configured
- No lazy loading strategy documented
- No CDN for static assets (beyond Vercel edge)
- No service worker caching strategy for API calls
- Limited code splitting beyond Next.js defaults

## Browser Support
- **Target:** Modern browsers (ES2020+)
- **Mobile:** iOS Safari, Chrome Android
- **Desktop:** Chrome, Firefox, Safari, Edge
- **PWA Support:** Chrome, Edge, Safari (limited)

## Development Environment

### Platform
- **OS:** Windows 11
- **Working Directory:** `C:\Users\jonch\reset-biology-website`
- **Migration Note:** Moved from WSL2 (September 2025) due to Docker conflicts
- **IDE:** VS Code (assumed)
- **Shell:** Git Bash / PowerShell

### Local Development
- **Dev Server:** `npm run dev` (Turbopack)
- **Port:** 3000 (default)
- **Hot Reload:** Fast Refresh enabled
- **Database:** MongoDB Atlas (shared) or SQLite (local)

## Key Dependencies Summary

```json
{
  "next": "15.5.2",
  "react": "19.1.0",
  "typescript": "5.x",
  "prisma": "6.15.0",
  "@auth0/nextjs-auth0": "4.10.0",
  "stripe": "18.5.0",
  "tailwindcss": "4.x",
  "playwright": "1.56.0",
  "framer-motion": "12.23.12",
  "lucide-react": "0.542.0",
  "resend": "6.4.0",
  "web-push": "3.6.7",
  "dexie": "4.2.0",
  "googleapis": "159.0.0"
}
```

## Technology Decisions & Rationale

### Why Next.js 15 App Router?
- Server components for better performance
- Simplified routing with file-based system
- Built-in API routes
- Excellent TypeScript support
- Vercel deployment optimization
- React 19 compatibility

### Why MongoDB + Prisma?
- Flexible schema for rapid iteration
- Prisma provides type-safe queries
- MongoDB Atlas scalability
- ObjectId support for distributed IDs
- JSON field support for flexible data structures

### Why Auth0?
- Robust authentication out of the box
- Google OAuth integration
- Session management
- Security best practices
- No need to build auth from scratch

### Why Tailwind CSS 4?
- Utility-first rapid development
- Excellent dark theme support
- Responsive design utilities
- Small production bundle
- Great TypeScript integration

### Why Playwright?
- Cross-browser testing
- Modern async API
- Great TypeScript support
- Visual regression potential
- **Status:** Not yet fully utilized

## Missing/Planned Integrations

Based on CLAUDE.md TODO list:

1. **Google Drive Full Integration:**
   - OAuth flow completion
   - Automated folder creation per user
   - Data sync mechanism
   - Currently: Stub functions only

2. **Trial/Upgrade Flows:**
   - Stripe subscription management
   - Trial period tracking
   - Payment plan selection
   - Currently: Basic structure, incomplete logic

3. **Comprehensive Testing:**
   - E2E test suite with Playwright
   - Visual regression tests
   - API endpoint tests
   - Currently: Framework ready, tests minimal

4. **Affiliate System Enhancement:**
   - Advanced tracking
   - Commission calculations
   - Payout automation
   - Currently: Basic tracking only

5. **Data Export/Backup:**
   - User data export functionality
   - Automated backups
   - GDPR compliance tools
   - Currently: Manual exports only

## Security Considerations

### Implemented
- Server-side session validation on all protected routes
- Auth0 secure authentication
- Stripe webhook signature verification
- Environment variables for secrets
- HTTPS only (via Vercel)
- Content Security Policy (basic)

### Needs Attention
- Rate limiting on API endpoints
- Input sanitization (relies on Prisma)
- CSRF protection (Next.js defaults)
- API key rotation strategy
- Regular dependency updates

## Monitoring & Analytics

### Current State
- **Error Tracking:** Console.error (282 instances)
- **Analytics:** None configured
- **Performance Monitoring:** None configured
- **Uptime Monitoring:** None configured

### Recommended
- Error tracking: Sentry or similar
- Analytics: PostHog or Plausible
- Performance: Vercel Analytics
- Logs: Vercel Logs or CloudWatch
