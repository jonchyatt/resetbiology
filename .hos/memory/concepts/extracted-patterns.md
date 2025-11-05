# Extracted Patterns - Reset Biology

**Extraction Date:** November 4, 2025
**Source:** Production codebase analysis

---

## Design Patterns

### Visual Theme System

#### Color Philosophy
**Primary Palette:**
- **Teal Gradient** (`#3FBFB5` to `#14b8a6`)
  - Usage: CTAs, interactive elements, brand identity
  - Conveys: Trust, medical professionalism, cellular vitality
  - Applied as: `text-primary-400`, `bg-primary-500`, `border-primary-400/30`

- **Green Gradient** (`#72C247` to `#22c55e`)
  - Usage: Secondary actions, success states, growth indicators
  - Conveys: Health, organic, natural optimization
  - Applied as: `text-secondary-400`, `bg-secondary-600/20`

**Dark Mode Foundation:**
- Base: `from-gray-900 to-gray-800` gradients
- Overlays: `rgba(0,0,0,0.7)` to `rgba(0,0,0,0.8)`
- Text: `text-white`, `text-gray-200` for hierarchy

#### Glassmorphism Architecture
```css
/* Standard Glass Card */
.card-primary {
  background: linear-gradient(to-br, primary-600/20, secondary-600/20);
  backdrop-filter: blur(sm);
  border: 1px solid primary-400/30;
  box-shadow: 2xl;
}
```

**Application Rules:**
1. Use `/20` or `/30` opacity for backgrounds
2. Always pair with `backdrop-blur-sm` or `backdrop-blur-md`
3. Add subtle border with `/30` opacity for depth
4. Layer shadows: `shadow-xl` or `shadow-2xl`

**Examples:**
- Modal overlays: `bg-black/50 backdrop-blur-sm`
- Form inputs: `bg-white/90 backdrop-blur-sm`
- Dashboard cards: `bg-gradient-to-br from-primary-600/20 to-secondary-600/20`

#### Typography Scale
```
Hero:        text-4xl md:text-5xl lg:text-6xl font-bold
Section:     text-2xl md:text-3xl font-semibold
Subsection:  text-xl md:text-2xl font-semibold
Body:        text-base md:text-lg
Small:       text-sm
Tiny:        text-xs
```

**Font Stack:**
- Primary: `'Inter'` (variable font with OpenType features)
- Features: `'cv11', 'ss01'` (stylistic alternates)
- Optical sizing: `'opsz' 32` (optimized for 32px)
- Fallback: `ui-sans-serif, system-ui, sans-serif`

**Weight Hierarchy:**
- `font-bold` (700) - Headlines, CTAs
- `font-semibold` (600) - Subheadings, buttons
- `font-medium` (500) - Labels, emphasized body
- `font-normal` (400) - Body text (implied default)

**Text Effects:**
- Shadows: `.text-shadow-lg` → `2px 2px 4px rgba(0,0,0,0.3)`
- Brand colors: `.text-brand-primary` → `text-primary-400`
- Gradients: `bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent`

#### Spacing System
**Consistent Rhythm:**
- Small gaps: `gap-2` (8px), `gap-3` (12px)
- Medium gaps: `gap-4` (16px), `gap-6` (24px)
- Large gaps: `gap-8` (32px), `gap-12` (48px)

**Padding Pattern:**
- Compact: `p-4` (16px) - Mobile cards
- Standard: `p-6` (24px) - Desktop cards
- Spacious: `p-8` (32px) - Hero sections

**Container Widths:**
- Max content: `max-w-7xl` (1280px)
- Centering: `mx-auto`
- Responsive padding: `px-4 sm:px-6 lg:px-8`

#### Animation Principles

**Custom Keyframes:**
```css
@keyframes fade-in {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```

**Usage Guidelines:**
- Page loads: `animate-fade-in` (0.8s ease-in-out)
- Modal entry: `animate-scale-in` (0.5s ease-out)
- Section reveals: `animate-slide-up` (0.6s ease-out)
- Attention grabbers: `animate-bounce-subtle` (2s infinite)

**Transition Standards:**
```css
/* Color changes */
transition-colors duration-200

/* All properties */
transition-all duration-300

/* Shadows */
transition-shadow duration-300

/* Transforms */
transition-transform duration-500
```

#### Interactive State Patterns

**Hover States:**
```tsx
// Buttons
bg-primary-400 hover:bg-primary-500

// Links
text-gray-400 hover:text-primary-400

// Cards
shadow-md hover:shadow-xl

// Icons
transform hover:scale-110
```

**Focus States:**
```tsx
focus:ring-2 focus:ring-primary-400 focus:border-transparent
```

**Active/Selected States:**
```tsx
// Tabs
border-b-2 border-primary-400 text-primary-400

// Checkboxes
bg-primary-400 text-white

// Cards
bg-primary-600/30 border-primary-400
```

**Disabled States:**
```tsx
opacity-50 cursor-not-allowed
```

#### Icon System (Lucide React)

**Size Standards:**
- Small: `w-3 h-3` (12px) - Inline with small text
- Default: `w-4 h-4` (16px) - Body text
- Medium: `w-5 h-5` (20px) - Buttons, labels
- Large: `w-6 h-6` (24px) - Section headers
- XL: `w-8 h-8` (32px) - Hero elements

**Common Icons:**
- `Trophy` - Points, achievements
- `Calendar` - Streaks, scheduling
- `Syringe` - Peptides
- `Dumbbell` - Workouts
- `Apple` - Nutrition
- `Wind` - Breath training
- `BookOpen` - Journal
- `Brain` - Mental Mastery
- `Bell` - Notifications
- `Clock` - Timing
- `TrendingUp` - Progress
- `ChevronRight` - Navigation

**Color Application:**
```tsx
// Brand colored
text-primary-400, text-secondary-400

// Contextual
text-white, text-gray-400, text-gray-200

// States
text-green-400 (success), text-red-400 (error), text-yellow-400 (warning)
```

---

## Code Patterns

### API Route Architecture

#### Standard Route Structure
```typescript
// app/api/[feature]/[action]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user (with email fallback)
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

  // 3. Query database
  const data = await prisma.someModel.findMany({
    where: { userId: user.id }
  })

  // 4. Return success
  return NextResponse.json({ success: true, data })
}
```

#### Response Formats
```typescript
// Success
{ success: true, data: any }

// Success with metadata
{ success: true, data: any, total: number, page: number }

// Error
{ error: string, details?: any }

// Error with status code
{ error: 'Not found' }, { status: 404 }
```

#### Common HTTP Methods
- `GET` - Fetch data (list or single)
- `POST` - Create new record or complex query
- `PATCH` - Update existing record
- `DELETE` - Remove record

#### Query Parameter Patterns
```typescript
// Date filtering
GET /api/peptides/doses?date=2025-11-04

// Pagination
GET /api/nutrition/entries?limit=20&offset=0

// Search
GET /api/foods/search?q=chicken

// Filtering
GET /api/products/trackable?category=peptides
```

### Component Patterns

#### Client Component Structure
```typescript
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Icon1, Icon2 } from "lucide-react"

interface Props {
  // Typed props
}

export function ComponentName({ prop1, prop2 }: Props) {
  // 1. State declarations
  const [data, setData] = useState<Type[]>([])
  const [loading, setLoading] = useState(false)

  // 2. Data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/...')
        const result = await response.json()
        setData(result.data)
      } catch (error) {
        console.error('Failed to fetch:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, []) // Dependencies

  // 3. Computed values
  const derivedValue = useMemo(() => {
    return data.filter(/* logic */)
  }, [data])

  // 4. Event handlers
  const handleAction = useCallback(async () => {
    // Logic
  }, [/* deps */])

  // 5. Render
  return (
    <div className="container-classes">
      {/* JSX */}
    </div>
  )
}
```

#### Modal Pattern
```typescript
// Parent component state
const [showModal, setShowModal] = useState(false)
const [selectedItem, setSelectedItem] = useState<Item | null>(null)

// Trigger
<button onClick={() => {
  setSelectedItem(item)
  setShowModal(true)
}}>
  Open Modal
</button>

// Modal rendering
{showModal && selectedItem && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
      {/* Modal content */}
      <button onClick={() => {
        setShowModal(false)
        setSelectedItem(null)
      }}>
        Close
      </button>
    </div>
  </div>
)}
```

#### Form Handling Pattern
```typescript
const [formData, setFormData] = useState({
  field1: '',
  field2: '',
})

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    if (response.ok) {
      // Success
      setFormData({ field1: '', field2: '' }) // Reset
    }
  } catch (error) {
    console.error('Submit failed:', error)
  }
}

return (
  <form onSubmit={handleSubmit}>
    <input
      value={formData.field1}
      onChange={(e) => setFormData({ ...formData, field1: e.target.value })}
    />
    <button type="submit">Submit</button>
  </form>
)
```

### Database Access Patterns

#### User Lookup with Email Fallback
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
**Why:** Auth0 IDs can change during migrations, email is more stable.

#### Relation Loading
```typescript
const user = await prisma.user.findFirst({
  where: { id: userId },
  include: {
    currentProtocols: true,
    gamificationPoints: true,
    breathSessions: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
})
```

#### Create with Auto-Generated ID
```typescript
const newEntry = await prisma.foodEntry.create({
  data: {
    userId: user.id,
    name: 'Chicken Breast',
    calories: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    mealType: 'lunch',
    // MongoDB auto-generates `id` field
  }
})
```

#### Update with Upsert
```typescript
const preference = await prisma.notificationPreference.upsert({
  where: {
    userId_protocolId: {
      userId: user.id,
      protocolId: protocolId
    }
  },
  create: {
    userId: user.id,
    protocolId,
    pushEnabled: true,
    emailEnabled: false,
    reminderMinutes: 15
  },
  update: {
    pushEnabled: true,
    reminderMinutes: 15
  }
})
```

#### Timezone-Safe Date Queries
```typescript
// Store local date as string
const localDate = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

const doses = await prisma.peptide_doses.findMany({
  where: {
    protocolId: protocol.id,
    localDate: localDate // Direct string match
  }
})
```

**Never do this:**
```typescript
// DON'T: UTC conversion breaks user timezones
const utcDate = new Date().toISOString().split('T')[0]
```

#### Aggregation Pattern
```typescript
const totalPoints = await prisma.gamificationPoint.aggregate({
  where: { userId: user.id },
  _sum: { amount: true }
})

console.log(totalPoints._sum.amount)
```

### State Management Patterns

#### Local State (Simple)
```typescript
const [count, setCount] = useState(0)
const increment = () => setCount(count + 1)
```

#### Derived State (Computed)
```typescript
const [items, setItems] = useState<Item[]>([])

const completedItems = useMemo(() => {
  return items.filter(item => item.completed)
}, [items])

const completionRate = useMemo(() => {
  return items.length > 0 ? (completedItems.length / items.length) * 100 : 0
}, [items, completedItems])
```

#### Callback Memoization
```typescript
const handleDelete = useCallback(async (id: string) => {
  await fetch(`/api/items/${id}`, { method: 'DELETE' })
  setItems(items.filter(item => item.id !== id))
}, [items])
```

#### Ref for Non-Reactive Values
```typescript
const animationFrameRef = useRef<number | null>(null)
const bootstrapped = useRef(false)

useEffect(() => {
  if (bootstrapped.current) return
  bootstrapped.current = true
  // Run once logic
}, [])
```

---

## UI/UX Patterns

### Progressive Disclosure

**Level 1: Dashboard**
- Overview of all features
- Quick stats (points, streaks)
- CTA links to detail pages

**Level 2: Feature Page**
- Full interface for specific feature
- List view or calendar view
- "Add" button to create new

**Level 3: Detail Modal**
- Full form or detail view
- Nested modals for sub-actions (e.g., calculator)
- Edit/delete actions

**Example Flow:**
```
Portal Dashboard → Peptide Tracker → Add Protocol Modal → Dosage Calculator Modal
```

### Empty State Pattern
```tsx
{items.length === 0 ? (
  <div className="text-center py-12">
    <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <p className="text-gray-400 mb-4">No items logged yet</p>
    <button className="btn-primary" onClick={handleAdd}>
      Add Your First Item
    </button>
  </div>
) : (
  <div className="space-y-4">
    {items.map(item => <ItemCard key={item.id} item={item} />)}
  </div>
)}
```

### Loading State Pattern
```tsx
{loading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-400 border-t-transparent"></div>
  </div>
) : (
  <div>{/* Content */}</div>
)}
```

### Tab Navigation Pattern
```tsx
const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1')

<div className="flex gap-4 border-b border-gray-600 mb-6">
  <button
    onClick={() => setActiveTab('tab1')}
    className={`pb-2 font-semibold ${
      activeTab === 'tab1'
        ? 'text-primary-400 border-b-2 border-primary-400'
        : 'text-gray-400 hover:text-primary-400'
    }`}
  >
    Tab 1
  </button>
  <button
    onClick={() => setActiveTab('tab2')}
    className={`pb-2 font-semibold ${
      activeTab === 'tab2'
        ? 'text-primary-400 border-b-2 border-primary-400'
        : 'text-gray-400 hover:text-primary-400'
    }`}
  >
    Tab 2
  </button>
</div>

{activeTab === 'tab1' ? <Tab1Content /> : <Tab2Content />}
```

### List Item Pattern
```tsx
<div className="space-y-3">
  {items.map(item => (
    <div key={item.id} className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700/70 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary-400" />
          <div>
            <h3 className="font-semibold text-white">{item.name}</h3>
            <p className="text-sm text-gray-400">{item.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleEdit(item)}>Edit</button>
          <button onClick={() => handleDelete(item.id)}>Delete</button>
        </div>
      </div>
    </div>
  ))}
</div>
```

### Calendar Grid Pattern
```tsx
const daysInMonth = getDaysInMonth(currentMonth)

<div className="grid grid-cols-7 gap-2">
  {/* Day labels */}
  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
    <div key={day} className="text-center text-sm text-gray-400 font-semibold">
      {day}
    </div>
  ))}

  {/* Date cells */}
  {daysInMonth.map(date => {
    const hasActivity = activities.some(a => a.date === date)

    return (
      <button
        key={date}
        onClick={() => handleDateClick(date)}
        className={`
          aspect-square rounded-lg text-sm
          ${hasActivity ? 'bg-primary-400 text-white' : 'bg-gray-700/50 text-gray-400'}
          hover:ring-2 hover:ring-primary-400
        `}
      >
        {date.getDate()}
      </button>
    )
  })}
</div>
```

### Quick Add Pattern
```tsx
const [quickAddValue, setQuickAddValue] = useState('')

<div className="flex gap-2">
  <input
    type="text"
    value={quickAddValue}
    onChange={(e) => setQuickAddValue(e.target.value)}
    placeholder="Quick add..."
    className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg"
  />
  <button
    onClick={async () => {
      await handleAdd(quickAddValue)
      setQuickAddValue('')
    }}
    className="btn-primary"
  >
    Add
  </button>
</div>
```

### Gamification Display Pattern
```tsx
<div className="flex items-center gap-8">
  <div className="flex items-center gap-2">
    <Trophy className="w-5 h-5 text-primary-400" />
    <span className="font-medium">{totalPoints.toLocaleString()} points</span>
  </div>
  <div className="flex items-center gap-2">
    <Calendar className="w-5 h-5 text-secondary-400" />
    <span className="font-medium">{currentStreak} day streak</span>
  </div>
</div>
```

---

## Architecture Patterns

### Feature Module Structure
```
src/components/[Feature]/
├── [Feature]Tracker.tsx      # Main UI component
├── [Feature]Library.tsx      # Browse/select interface
├── [Feature]Calculator.tsx   # Tools/utilities
├── [Feature]QuickAdd.tsx     # Simplified entry
└── Recent[Feature]s.tsx      # History view

app/api/[feature]/
├── route.ts                  # List endpoint (GET /api/feature)
├── [id]/route.ts             # Detail endpoint (GET/PATCH/DELETE /api/feature/[id])
└── [action]/route.ts         # Action endpoint (POST /api/feature/search)
```

### Data Flow Pattern
```
1. User Action (click, submit)
   ↓
2. Event Handler (handleSave, handleDelete)
   ↓
3. API Call (fetch POST/PATCH/DELETE)
   ↓
4. Route Handler (app/api/*/route.ts)
   ↓
5. Database Operation (Prisma query)
   ↓
6. Response (JSON)
   ↓
7. State Update (setState)
   ↓
8. UI Re-render (React)
```

### Authentication Flow
```
1. User clicks "Login"
   ↓
2. Redirect to Auth0 (/api/auth/login)
   ↓
3. Google OAuth consent
   ↓
4. Callback (/auth/callback)
   ↓
5. Check if user exists (by auth0Sub or email)
   ↓
6. Create user if new
   ↓
7. Set session cookie
   ↓
8. Redirect to /portal (or returnTo param)
```

### Session Management
```typescript
// Server-side (API routes)
const session = await getSession()
session?.user.sub    // Auth0 user ID
session?.user.email  // User email

// Client-side (components)
const { user, isLoading } = useUser()
user?.name           // Display name
user?.picture        // Avatar URL
```

### Error Handling Strategy
```typescript
try {
  const response = await fetch('/api/endpoint')

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Operation failed')
  }

  // Success path
  return data.data

} catch (error) {
  console.error('Operation failed:', error)
  // Show user-facing error (future: toast notification)
  // Graceful degradation
}
```

### Deployment Flow
```
1. Git commit (local)
   ↓
2. Git push to master
   ↓
3. Vercel webhook triggers
   ↓
4. npx tsx scripts/verify-auth-env.ts (prebuild)
   ↓
5. prisma generate (postinstall)
   ↓
6. next build
   ↓
7. Deploy to production
   ↓
8. Test with ChromeMCP
```

---

## Testing Patterns

### E2E Testing with Playwright
```typescript
// tests/example.spec.ts
import { test, expect } from '@playwright/test'

test('user can log peptide dose', async ({ page }) => {
  await page.goto('https://resetbiology.com/portal')

  // Login flow (uses Auth0)
  await page.click('text=Login')
  // ... OAuth steps

  // Navigate to peptides
  await page.click('text=Peptide Tracker')

  // Log dose
  await page.click('[data-testid="log-dose-btn"]')
  await page.fill('[data-testid="dose-notes"]', 'Morning dose')
  await page.click('text=Save')

  // Verify
  await expect(page.locator('text=Morning dose')).toBeVisible()
})
```

### Manual Testing Checklist
**New Feature Verification:**
1. Test on localhost first
2. Deploy to production
3. Test on production with ChromeMCP
4. Test mobile responsive
5. Test with Auth0 login
6. Test database persistence
7. Check console for errors
8. Verify gamification points awarded

**Regression Testing:**
1. Login flow still works
2. Existing features not broken
3. Database queries return data
4. No TypeScript errors in build
5. No 500 errors in API routes

---

## Naming Conventions

### File Naming
- **Components:** PascalCase - `PeptideTracker.tsx`
- **API Routes:** lowercase - `route.ts`, `[id].ts`
- **Utils:** camelCase - `dateHelpers.ts`
- **Types:** PascalCase - `UserProtocol.ts`

### Variable Naming
- **State:** camelCase - `currentProtocols`, `showModal`
- **Constants:** UPPER_SNAKE_CASE - `MAX_RETRIES`
- **Functions:** camelCase - `handleSubmit`, `fetchData`
- **Components:** PascalCase - `DosageCalculator`

### Database Naming
- **Models:** PascalCase - `User`, `PeptideDose`
- **Fields:** camelCase - `userId`, `createdAt`
- **Table names:** snake_case - `peptide_doses`, `notification_preferences`

### CSS Class Naming
- **Utility:** `btn-primary`, `card-hover`
- **Component:** `peptide-tracker`, `dose-modal`
- **State:** `is-active`, `has-error`

---

**End of Pattern Extraction**
