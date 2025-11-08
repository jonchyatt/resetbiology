# ResetBiology.com - Code Patterns

## Component Organization

### Directory Structure
```
/src/components/
├── Admin/              # Admin panel components (ImageUpload, ProductEditForm, etc.)
├── Assessment/         # User health assessment (AssessmentForm, IRBHandoff)
├── Audio/              # Mental mastery modules (ModuleLibrary, AudioPlayer)
├── Auth/               # Authentication UI (LoginButton, SignInButton, ProtectedRoute, PermissionGate)
├── Breath/             # Breath training app (BreathTrainingApp, BreathOrb, Controls, PhaseTimer, SessionStats)
├── Conversion/         # Marketing conversion (TrustSignals, UrgencyBanner)
├── Gamification/       # Engagement system (AchievementTiers, DailySpinner, DepositTracker)
├── Hero/               # Landing page sections (HeroSection, MissionSection, SolutionSection, ComparisonSection, etc.)
├── Journal/            # User journaling (JournalHistory)
├── Navigation/         # Site navigation (Header, Footer, PortalHeader, PortalLayout, AdminHeader)
├── Notifications/      # PWA notifications (NotificationPreferences)
├── Nutrition/          # Nutrition tracking (NutritionTracker, FoodDatabase, FoodSearch, MealLogger, FoodQuickAdd, RecentFoods)
├── Payments/           # Stripe integration (DepositPayment)
├── Peptides/           # Peptide protocols (PeptideTracker, DosageCalculator)
├── Portal/             # User dashboard (Dashboard, EnhancedDashboard)
├── Workout/            # Workout tracking (WorkoutTracker, ExerciseLibrary, ProgramSelection, WorkoutSession, WorkoutQuickAdd, RecentWorkouts)
└── Providers.tsx       # Global context providers
```

### Naming Conventions
- **PascalCase** for all component files and component names
- **Feature-based directories** - each major feature has its own folder
- **Descriptive names** - components clearly state their purpose (e.g., `NotificationPreferences`, `FoodQuickAdd`)
- **Page components** - located in `/app` directory, named `page.tsx`
- **Route handlers** - API routes in `/app/api/**/*.ts`, named `route.ts`

### Component Patterns
- **Client Components:** Marked with `"use client"` directive (almost all interactive components)
- **Server Components:** Default in `/app` pages unless client interactivity needed
- **Prop Interfaces:** Defined inline or at top of file with TypeScript
- **Modular Exports:** Named exports for components, default exports for pages

## API Patterns

### Route Structure
```
/app/api/
├── admin/
│   ├── list-users/        # User management
│   ├── orders/            # Order management
│   └── stripe-sync/       # Stripe synchronization
├── affiliates/            # Affiliate program APIs
├── assessment/            # Health assessment submission
├── breath/
│   ├── export/            # Export breath session data
│   └── sessions/          # CRUD for breath sessions
├── checkout/              # Stripe checkout flow
├── daily-tasks/           # Daily task tracking
├── deposits/              # Success deposit system
├── foods/
│   ├── log/               # Log food entries
│   ├── recent/            # Get recent foods
│   ├── search/            # Search food database
│   └── upc/               # UPC barcode lookup
├── health/
│   └── db/                # Database health check
├── irb-handoff/           # IRB approval workflow
├── journal/
│   ├── entry/             # CRUD journal entries
│   ├── entry/[id]/        # Specific entry operations
│   └── history/           # Get journal history
├── modules/
│   └── complete/          # Mark module complete
├── notifications/
│   ├── preferences/       # Notification settings
│   ├── send/              # Send notifications (cron)
│   └── subscribe/         # PWA push subscription
├── nutrition/
│   ├── entries/           # CRUD nutrition entries
│   ├── entries/[id]/      # Specific entry operations
│   └── foods/             # Food database management
├── peptides/
│   ├── [slug]/            # Get peptide by slug
│   ├── doses/             # Log doses
│   ├── doses/[id]/        # Specific dose operations
│   └── protocols/         # User peptide protocols
├── products/
│   ├── by-slug/[slug]/    # Product lookup
│   ├── storefront/        # Public product listing
│   └── trackable/         # Get trackable peptides
├── profile/
│   └── update/            # Update user profile
├── quiz/
│   └── sync/              # Quiz response sync
├── stripe/
│   └── webhook/           # Stripe webhook handler
├── upload/
│   └── image/             # Image upload handler
├── user/
│   └── trial/             # Trial status management
├── workout/
│   ├── exercises/         # Exercise library CRUD
│   └── sessions/          # Workout session CRUD
│   └── sessions/[id]/     # Specific session operations
└── workouts/
    ├── log/               # Legacy workout logging
    ├── recent/            # Recent workouts
    └── search/            # Search workouts
```

### Common API Patterns

**1. Authentication Check:**
```typescript
import { getSession } from '@auth0/nextjs-auth0'

const session = await getSession()
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**2. User Lookup with Email Fallback:**
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

**3. Response Format:**
```typescript
// Success
return NextResponse.json({ success: true, data: result })

// Error
return NextResponse.json({ error: 'Error message' }, { status: 400 })
```

**4. Timezone-Safe Date Handling:**
```typescript
// Store both UTC timestamp AND local date string
const localDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD
const localTime = new Date().toLocaleTimeString('en-US', { hour12: false })

await prisma.model.create({
  data: {
    timestamp: new Date(),      // UTC timestamp
    localDate,                  // User's local date
    localTime                   // User's local time
  }
})
```

**5. Gamification Points Integration:**
```typescript
// Award points for activity
await prisma.gamificationPoint.create({
  data: {
    userId: user.id,
    pointType: 'workout_completion',
    amount: 50,
    activitySource: 'workout_tracker'
  }
})
```

## Styling Patterns

### Tailwind Usage

**Primary Colors:**
- `#3FBFB5` - Teal (primary) - referenced as `primary-*` utilities
- `#72C247` - Green (secondary) - referenced as `secondary-*` utilities
- Gray scale: `gray-800`, `gray-900` for dark theme

**Common Patterns:**
```typescript
// Card with gradient + transparency
className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300"

// Background overlay
style={{
  backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed'
}}

// Interactive button
className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"

// Transparency levels
/10  - Very subtle
/20  - Subtle
/30  - Moderate
/50  - Medium
```

**Responsive Design:**
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Grid layouts: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Component Styling Patterns:**
- Dark theme default with light text
- Gradient backgrounds with blur effects
- Border highlights with transparency
- Hover effects with shadow and transform
- Icon + text combinations with Lucide React icons

## State Management

**Local State (useState):**
- Used for component-specific UI state
- Form inputs, modals, toggles
- No global state management library (Redux/Zustand)

**Server State:**
- Fetched via API routes
- React hooks pattern: `useEffect` + `fetch`
- No React Query or SWR (manual cache management)

**Auth State:**
- Managed by Auth0 SDK
- `useUser()` hook from `@auth0/nextjs-auth0/client`
- Session-based, server-side validation

**Custom Events:**
- Window events for cross-component communication
- Example: `window.dispatchEvent(new CustomEvent('nutrition:log-success', { detail: {...} }))`
- Used in Portal for updating daily tasks from tracking components

## Database Patterns

### Prisma Usage

**Model Naming:**
- PascalCase for model names
- camelCase for field names
- snake_case for collection names via `@@map("table_name")`

**Common Relationships:**
```prisma
model User {
  id                String                   @id @default(auto()) @map("_id") @db.ObjectId
  // Relations
  breathSessions    BreathSession[]
  workoutSessions   WorkoutSession[]
  foodEntries       FoodEntry[]
}

model WorkoutSession {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  user      User     @relation(fields: [userId], references: [id])
}
```

**ObjectId Pattern:**
- All IDs use MongoDB ObjectId type
- `@id @default(auto()) @map("_id") @db.ObjectId`
- Foreign keys: `@db.ObjectId`

**Timezone-Safe Fields:**
```prisma
model WorkoutSession {
  completedAt DateTime @default(now())  // UTC timestamp
  localDate   String?                   // YYYY-MM-DD in user's timezone
  localTime   String?                   // HH:MM:SS in user's timezone
}
```

**JSON Fields:**
- Used for flexible data: `exercises Json`, `settings Json`
- Stores arrays and objects without schema enforcement

### Query Patterns

**User Lookup:**
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

**Include Relations:**
```typescript
const protocols = await prisma.user_peptide_protocols.findMany({
  where: { userId: user.id },
  include: {
    peptides: true  // Join peptide data
  }
})
```

**Date Range Queries:**
```typescript
const entries = await prisma.foodEntry.findMany({
  where: {
    userId: user.id,
    localDate: dateKey  // Query by local date string, not UTC timestamp
  },
  orderBy: { loggedAt: 'desc' }
})
```

## File Organization

**Feature-Based Structure:**
- Each major feature has dedicated directory
- Components, types, and utilities co-located when feature-specific
- Shared utilities in `/src/lib/`

**Shared Libraries (`/src/lib/`):**
- `breathStorage.ts` - Local storage for breath sessions
- `domainCheck.ts` - Domain validation utilities
- `email.ts` - Email sending (Resend integration)
- `getUserFromSession.ts` - Auth0 session → user lookup helper
- `google-drive.ts` - Google Drive integration (stub)
- `inventory.ts` - Inventory management utilities
- `permissions.ts` - Permission checking
- `prisma.ts` - Prisma client singleton
- `scheduleNotifications.ts` - Notification scheduling
- `userUtils.ts` - User-related utilities

**Legacy Code:**
- `/src/legacy_app/` - Old code preserved but not used
- Some duplicate routes in legacy folder

## Error Handling Patterns

**API Error Responses:**
```typescript
try {
  // Operation
  return NextResponse.json({ success: true, data })
} catch (error) {
  console.error('Error description:', error)
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Unknown error'
  }, { status: 500 })
}
```

**Client-Side Error Handling:**
```typescript
try {
  const response = await fetch('/api/endpoint', { ... })
  const data = await response.json()

  if (!response.ok || !data.success) {
    alert(`Error: ${data.error}`)
    return
  }

  // Success handling
} catch (error) {
  console.error('Failed:', error)
  alert('Failed to complete operation')
}
```

**Validation:**
- TypeScript for compile-time type checking
- Runtime validation minimal (mostly handled by Prisma)
- Auth check on every protected API route

## Observations

**Strengths:**
1. **Consistent Structure:** Feature-based organization makes navigation intuitive
2. **TypeScript Throughout:** Strong typing reduces bugs
3. **Auth0 Integration:** Robust authentication with email fallback for user lookup
4. **Timezone Awareness:** Properly handles local dates for tracking features
5. **Modular Components:** Each component has single, clear responsibility
6. **Gamification Integration:** Points system integrated throughout tracking features

**Areas for Improvement:**
1. **No Global State Management:** Manual prop drilling and fetch in multiple components
2. **Duplicate API Routes:** Some overlap between legacy and current routes
3. **Console.log Debugging:** 282 console statements across 56 files (remove in production)
4. **Error Boundaries:** No React error boundaries for graceful error handling
5. **Loading States:** Inconsistent loading state management across components
6. **Data Fetching:** No caching layer (React Query would help)
7. **Test Coverage:** Minimal tests despite Playwright installed

**Best Practices Followed:**
- Server-side session validation
- Timezone-safe date storage
- Feature-based code organization
- TypeScript for type safety
- Responsive mobile-first design
- Accessible color contrast (mostly)
- RESTful API design

**Unique Patterns:**
- Custom event system for cross-component communication
- Dual storage (UTC timestamp + local date string)
- Auto-journal population from activity completion
- PWA notification integration for dose reminders
- Gamification points awarded from multiple activity sources
