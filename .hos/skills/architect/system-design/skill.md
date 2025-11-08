---
name: system-design
description: Architect agent skill for designing system architecture and making technical decisions
version: 1.0.0
triggers:
  - design the system architecture
  - plan the database schema
  - architect this feature
  - make architectural decision
  - design the API structure
---

# System Design Skill

## Purpose
Provides structured approach for architect agent to design system architecture, database schemas, and make technical decisions for ResetBiology.com platform.

## When to Use
- Adding new database models
- Creating new feature areas
- Designing API endpoint structures
- Planning component hierarchies
- Making technology choices
- Defining integration patterns

## Design Process

### 1. Requirements Analysis
- What is the feature/system requirement?
- Who are the users/stakeholders?
- What are the success criteria?
- What are the constraints?

### 2. Architecture Decision Record (ADR)
Create an ADR for significant decisions:

```markdown
# ADR-XXX: [Decision Title]

**Status**: Proposed | Accepted | Deprecated

**Context**: What is the situation requiring a decision?

**Decision**: What architecture pattern/technology will we use?

**Consequences**: What are the trade-offs?

**Alternatives Considered**: What other options were explored?
```

### 3. Database Schema Design
Follow ResetBiology patterns:

```prisma
model FeatureName {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  localDate   String   // YYYY-MM-DD (timezone-safe)
  localTime   String   // HH:MM:SS (timezone-safe)
  data        Json     // Feature-specific data
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, localDate])
  @@map("feature_name")
}
```

### 4. API Route Design
Follow established patterns:

```
/app/api/[feature]/
  - route.ts           (GET list, POST create)
  - [id]/route.ts      (GET/PATCH/DELETE single)
  - [action]/route.ts  (POST specific operations)
```

### 5. Component Architecture
```
/src/components/[Feature]/
  - [Feature]Tracker.tsx   (main UI)
  - [Feature]Library.tsx   (browse/search)
  - [Feature]Calculator.tsx (tools)
```

## Critical Patterns

### User Lookup Pattern (Mandatory)
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

### Timezone-Safe Date Handling (Mandatory)
```typescript
// Store as strings, not UTC
const localDate = '2025-11-04'
const localTime = '09:30:00'
```

### API Response Format (Mandatory)
```typescript
return NextResponse.json({
  success: boolean,
  data: any,
  error?: string
})
```

## Design Constraints

### Must Follow
1. MongoDB ObjectId for all primary keys
2. Next.js 15 App Router structure
3. Auth0 v4.10.0 (NEVER downgrade)
4. Prisma ORM for database access
5. Vercel deployment as primary target

### Must Avoid
1. UTC date conversion for user-facing dates
2. Changing working Auth0 setup without justification
3. Complex solutions when simple ones exist
4. Multiple Prisma instances
5. Breaking API response format

## Gamification Integration

Every user action feature must:
1. Award points via `/api/gamification/points`
2. Update streak tracking
3. Trigger achievement checks

```typescript
// After successful action
await fetch('/api/gamification/points', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pointType: 'feature_action',
    amount: 50,
    activitySource: 'feature_tracker'
  })
})
```

## Success Criteria
- Architecture is documented in ADR
- Database schema follows patterns
- API routes follow conventions
- Component structure is clear
- Gamification is integrated
- Timezone handling is correct
- Implementation spec is ready for implementer agent

## Output Artifacts
- ADR document
- Database schema (Prisma)
- API route structure
- Component hierarchy diagram
- Integration requirements
- Implementation checklist
