---
name: auth0-session-debugger
description: Debugs Auth0 authentication issues, session tokens, and user provisioning
category: reset-biology
tags: [auth0, authentication, debugging]
version: 1.0.0
---

# Auth0 Session Debugger

## Purpose
Debugs Auth0 authentication issues, validates session tokens, troubleshoots user provisioning, and ensures proper session handling in the Reset Biology platform.

## When to Use
- When users can't log in or get "Unauthorized" errors
- When investigating "User not found" issues
- When debugging session persistence problems
- When Auth0 ID changes cause data access issues
- Before making any Auth0 configuration changes

## Validation Checklist

### 1. Auth0 Configuration
- [ ] Verify environment variables are set correctly
- [ ] Check Auth0 domain matches dashboard
- [ ] Validate client ID and secret
- [ ] Ensure callback URL is whitelisted
- [ ] Confirm Auth0 SDK version (must be v4.10.0+)

### 2. Session Validation
- [ ] Check session cookie exists
- [ ] Verify token is not expired
- [ ] Validate user.sub matches database
- [ ] Ensure email is present in session
- [ ] Confirm session refreshes properly

### 3. User Provisioning
- [ ] Verify callback route creates users
- [ ] Check user lookup logic (auth0Sub OR email)
- [ ] Ensure Auth0 ID is updated when changed
- [ ] Validate new user creation flow
- [ ] Confirm user profile data sync

### 4. API Route Protection
- [ ] Check middleware applies to protected routes
- [ ] Verify getSession() is called correctly
- [ ] Ensure user lookup handles Auth0 ID changes
- [ ] Validate 401 responses for unauthorized
- [ ] Confirm proper error messages

## Critical Auth0 Setup (WORKING - DON'T CHANGE)

### Environment Variables:
```bash
AUTH0_SECRET=oaZ0uKqOOpIa0JgX+pyGEFMZOp61aiYDJA6fgTjZqyDNWWJ1sR5OvHoJKp9E0QWQP1UKE21feOqFu7PICnXuWg==
AUTH0_BASE_URL=http://localhost:3000  # or https://resetbiology.com
AUTH0_ISSUER_BASE_URL=https://dev-4n4ucz3too5e3w5j.us.auth0.com
AUTH0_CLIENT_ID=YDXQaFLWq8e5FuW5GMRBJ4wceomdAdzt
AUTH0_CLIENT_SECRET=3sZkNiaeXNQC-rrHfQrYIxu6mev0WDM-_vF-HpZT0ICZZMkycFQeUK9KPb4Mu5sd
```

### Auth0 SDK Version:
```json
"@auth0/nextjs-auth0": "^4.10.0"
```

**⚠️ DO NOT DOWNGRADE TO v3 - IT WILL BREAK EVERYTHING**

## Implementation Steps

### Step 1: Debug Session Token
```typescript
// Add to any protected route for debugging
import { getSession } from '@auth0/nextjs-auth0'

export async function GET(req: Request) {
  const session = await getSession()

  console.log('=== AUTH DEBUG ===')
  console.log('Session exists:', !!session)
  console.log('User:', session?.user)
  console.log('Sub:', session?.user?.sub)
  console.log('Email:', session?.user?.email)
  console.log('=================')

  if (!session?.user) {
    return NextResponse.json({
      error: 'No session found',
      hint: 'User needs to log in'
    }, { status: 401 })
  }

  // Continue with route logic...
}
```

### Step 2: Validate User Lookup Logic
```typescript
// Standard user lookup (handles Auth0 ID changes)
const findUserByAuth = async (auth0Sub: string, email: string) => {
  // Try Auth0 ID first
  let user = await prisma.user.findFirst({
    where: { auth0Sub }
  })

  console.log('Lookup by auth0Sub:', user ? 'Found' : 'Not found')

  // Fall back to email if Auth0 ID not found
  if (!user && email) {
    user = await prisma.user.findFirst({
      where: { email }
    })

    console.log('Lookup by email:', user ? 'Found' : 'Not found')

    // Update Auth0 ID if user found by email
    if (user) {
      console.log('Updating Auth0 ID for user:', user.id)
      await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub }
      })
    }
  }

  return user
}
```

### Step 3: Check Auth0 Callback Handler
```typescript
// Verify auto-user-creation in callback
// File: /app/auth/callback/route.ts

import { handleCallback, getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export const GET = handleCallback({
  async afterCallback(req, session) {
    console.log('=== AUTH CALLBACK ===')
    console.log('Auth0 Sub:', session.user.sub)
    console.log('Email:', session.user.email)

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { auth0Sub: session.user.sub },
          { email: session.user.email }
        ]
      }
    })

    if (!user) {
      // Create new user
      console.log('Creating new user...')
      user = await prisma.user.create({
        data: {
          auth0Sub: session.user.sub,
          email: session.user.email,
          name: session.user.name || 'User',
          profilePicture: session.user.picture
        }
      })
      console.log('New user created:', user.id)
    } else if (user.auth0Sub !== session.user.sub) {
      // Update Auth0 ID if changed
      console.log('Updating Auth0 ID...')
      await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: session.user.sub }
      })
    }

    console.log('=====================')
    return session
  }
})
```

### Step 4: Validate Middleware Protection
```typescript
// Check middleware.ts configuration
import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge'

export default withMiddlewareAuthRequired()

export const config = {
  matcher: [
    '/portal/:path*',
    '/peptides/:path*',
    '/workout/:path*',
    '/nutrition/:path*',
    '/api/:path*'
  ]
}
```

## Common Issues & Fixes

### Issue: "User not found" after login
**Cause:** Auth0 ID changed, user lookup only checked auth0Sub

**Check:**
```typescript
// Check if user exists by email
const user = await prisma.user.findFirst({
  where: { email: 'user@example.com' }
})
console.log('User auth0Sub:', user?.auth0Sub)
console.log('Session sub:', session.user.sub)
```

**Fix:**
- Already fixed in callback handler (auto-updates Auth0 ID)
- APIs now use OR lookup: `{ OR: [{ auth0Sub }, { email }] }`

### Issue: Session not persisting
**Cause:** Missing AUTH0_SECRET or cookie issues

**Check:**
```bash
# Verify environment variable is set
echo $AUTH0_SECRET
```

**Fix:**
```bash
# Generate new secret if needed
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Issue: Callback redirect fails
**Cause:** Callback URL not whitelisted in Auth0 dashboard

**Check:**
1. Go to Auth0 Dashboard → Applications
2. Check "Allowed Callback URLs"
3. Should include: `http://localhost:3000/auth/callback` and `https://resetbiology.com/auth/callback`

**Fix:**
Add missing URLs to Auth0 dashboard

### Issue: Login works but data doesn't load
**Cause:** User created but protocols/data missing

**Check:**
```typescript
// Verify user was created
const user = await prisma.user.findFirst({
  where: { email: session.user.email },
  include: {
    peptideProtocols: true,
    workoutSessions: true
  }
})

console.log('User:', user)
console.log('Protocols:', user?.peptideProtocols?.length)
```

**Fix:**
- User should be auto-created on first login (via callback)
- Data loads from empty state (user can add protocols)

## Testing Scenarios

### Test 1: New User First Login
```typescript
// Expected flow:
// 1. User clicks "Login" → redirects to Auth0
// 2. User authenticates with Google
// 3. Auth0 redirects to /auth/callback
// 4. Callback checks if user exists → NOT FOUND
// 5. Callback creates new user
// 6. Redirect to /portal
// 7. Portal loads with empty data (user can start adding)

// Verify:
const user = await prisma.user.findFirst({
  where: { email: 'newuser@example.com' }
})
assert(user !== null)
assert(user.auth0Sub === session.user.sub)
```

### Test 2: Existing User Login (Auth0 ID Changed)
```typescript
// Scenario: User exists with old Auth0 ID
// 1. User logs in
// 2. Session has new auth0Sub
// 3. Callback finds user by email
// 4. Callback updates auth0Sub
// 5. User can access their data

// Verify:
const user = await prisma.user.findFirst({
  where: { email: 'existing@example.com' }
})
assert(user.auth0Sub === session.user.sub) // Updated
```

### Test 3: API Route Protection
```typescript
// Test protected endpoint
const res = await fetch('/api/peptides/protocols', {
  headers: {
    Cookie: sessionCookie // Valid session
  }
})

// Expected: 200 OK with user's protocols
assert(res.status === 200)

// Test without session
const res2 = await fetch('/api/peptides/protocols')
// Expected: 401 Unauthorized
assert(res2.status === 401)
```

## Integration with Existing Code

### Where this skill applies:
- `/app/auth/callback/route.ts` - User creation/linking
- `/middleware.ts` - Route protection
- All `/app/api/*` routes - Session validation
- `/app/portal/page.tsx` - Protected page

### Standard API route pattern:
```typescript
import { getSession } from '@auth0/nextjs-auth0'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  // 1. Check session
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Find user (handles Auth0 ID changes)
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

  // 3. Return user's data
  const data = await prisma.someModel.findMany({
    where: { userId: user.id }
  })

  return NextResponse.json(data)
}
```

## Success Criteria
- [ ] All users can log in successfully
- [ ] New users are auto-created on first login
- [ ] Existing users with changed Auth0 IDs can access their data
- [ ] Protected routes require authentication
- [ ] Session persists across page refreshes
- [ ] Error messages are clear and helpful

## Related Skills
- `peptide-protocol-validator` - Depends on correct user authentication
- `gamification-calculator` - Points tied to authenticated user
- `checkout-flow-tester` - Purchase requires authentication

## Notes
- Auth0 SDK version: v4.10.0+ (DO NOT DOWNGRADE)
- Session secret must be 32+ characters
- Callback URL must be whitelisted in Auth0 dashboard
- User lookup MUST use OR logic: auth0Sub OR email
- Auto-link users when Auth0 ID changes
- Never expose Auth0 secrets in client-side code
