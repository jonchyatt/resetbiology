---
name: code-generator
description: Generates production-ready code following ResetBiology patterns
version: 1.0.0
triggers:
  - generate code for
  - implement the feature
  - create API route for
  - build component for
  - write code following patterns
---

# Code Generator Skill

## Purpose
Generates production-ready code following established ResetBiology.com patterns, conventions, and best practices.

## When to Use
- Implementing new features from specs
- Creating API routes
- Building React components
- Adding database models
- Writing utility functions

## Code Generation Patterns

### 1. API Route Generation

#### Template
```typescript
// /app/api/[feature]/[action]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  // 1. Validate session
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user with email fallback (MANDATORY PATTERN)
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

  // 3. Parse and validate request
  try {
    const data = await req.json()

    // Validate required fields
    if (!data.requiredField) {
      return NextResponse.json({ error: 'Missing required field' }, { status: 400 })
    }

    // 4. Perform operation
    const result = await prisma.model.create({
      data: {
        userId: user.id,
        ...data
      }
    })

    // 5. Award gamification points (if applicable)
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/gamification/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointType: 'action_completed',
        amount: 50,
        activitySource: 'feature_name'
      })
    })

    // 6. Return success response
    return NextResponse.json({ success: true, data: result })

  } catch (error) {
    console.error('Operation failed:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
```

### 2. React Component Generation

#### Tracker Component Template
```typescript
// /src/components/[Feature]/[Feature]Tracker.tsx
'use client'
import { useState, useEffect } from 'react'
import { Calendar, Plus, Check } from 'lucide-react'

interface DataItem {
  id: string
  name: string
  localDate: string
  localTime: string
}

export default function FeatureTracker() {
  const [items, setItems] = useState<DataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/feature/data')
      const json = await res.json()
      if (json.success) {
        setItems(json.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(data: any) {
    try {
      const res = await fetch('/api/feature/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const json = await res.json()
      if (json.success) {
        setItems([...items, json.data])
        setShowAddModal(false)
      }
    } catch (error) {
      console.error('Failed to add:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Feature Tracker</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New</span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
          >
            <div>
              <h3 className="text-white font-semibold">{item.name}</h3>
              <p className="text-gray-400 text-sm">
                {item.localDate} at {item.localTime}
              </p>
            </div>
            <Check className="w-5 h-5 text-primary-400" />
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Add New Item</h3>
            {/* Form content */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAdd({})}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 3. Database Model Generation

#### Prisma Schema Template
```prisma
model FeatureName {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  name        String
  description String?
  localDate   String   // YYYY-MM-DD format
  localTime   String   // HH:MM:SS format
  data        Json?    // Feature-specific data
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, localDate])
  @@index([userId, active])
  @@map("feature_name")
}

// Add to User model:
model User {
  // ... existing fields
  featureNames    FeatureName[]
}
```

### 4. Utility Function Generation

#### Date/Time Utilities
```typescript
// /lib/datetime.ts

/**
 * Get current local date in YYYY-MM-DD format
 */
export function getCurrentLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get current local time in HH:MM:SS format
 */
export function getCurrentLocalTime(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Convert Date object to local date string
 */
export function dateToLocalKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse local date string to Date object
 */
export function localKeyToDate(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}
```

## Code Generation Rules

### MUST FOLLOW
1. **User Lookup Pattern**: Always use OR with auth0Sub and email
2. **Timezone Safety**: Store localDate and localTime strings, never UTC
3. **API Response Format**: `{ success, data, error }`
4. **Error Handling**: Wrap operations in try-catch
5. **Design System**: Use established Tailwind classes
6. **Gamification**: Award points for user actions
7. **TypeScript**: Full type safety, no `any` except Json
8. **Client Components**: Mark with `'use client'` when needed

### MUST AVOID
1. **UTC Conversion**: Never use toISOString() for user dates
2. **Hard-coded URLs**: Use environment variables
3. **Magic Numbers**: Extract to constants
4. **Arbitrary Colors**: Use design system colors only
5. **Missing Error Handling**: Always catch errors
6. **Breaking Changes**: Don't modify working Auth0 setup
7. **Multiple Prisma Instances**: Use singleton pattern

## Generation Process

### 1. Receive Spec from Architect
- Feature requirements
- API structure
- Database schema
- Component hierarchy

### 2. Generate Database Schema
- Create Prisma model
- Add relations
- Add indexes
- Map collection name

### 3. Generate API Routes
- Session validation
- User lookup
- Request validation
- Operation logic
- Gamification integration
- Error handling
- Response format

### 4. Generate React Components
- State management
- Data fetching
- Loading states
- Error states
- Empty states
- Design system compliance
- Responsive design

### 5. Generate Tests (using test-generator skill)
- Unit tests
- Integration tests
- E2E tests

## Feature-Specific Templates

### Tracking Feature
Complete template includes:
- API routes (GET, POST, PATCH, DELETE)
- Tracker component
- Library component
- History view component
- Database model
- Gamification integration

### Tool/Calculator Feature
Complete template includes:
- Calculator component
- API route for saving results
- Database model for history
- Share functionality

### Dashboard Widget
Complete template includes:
- Widget component
- Data fetching hook
- API route
- Loading skeleton

## Success Criteria
- Code compiles without errors
- Follows all established patterns
- Includes error handling
- Uses design system
- Gamification integrated
- TypeScript types complete
- Ready for testing

## Output Artifacts
- API route files
- Component files
- Database schema updates
- Utility functions
- Type definitions
- Implementation notes
