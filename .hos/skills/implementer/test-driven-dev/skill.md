---
name: test-driven-dev
description: Implements features using strict TDD methodology (Red-Green-Refactor)
version: 1.0.0
triggers:
  - implement using TDD
  - follow TDD for
  - use test-driven development
  - write tests first
---

# Test-Driven Development Skill

## Purpose
Implements features using strict Test-Driven Development (TDD) methodology for ResetBiology.com, ensuring high code quality and test coverage.

## When to Use
- Implementing new features
- Adding complex business logic
- Refactoring existing code
- Fixing bugs (write failing test first)

## TDD Cycle: Red-Green-Refactor

### 🔴 RED: Write Failing Test First
Write a test that defines desired behavior. Test must fail.

### 🟢 GREEN: Write Minimal Code to Pass
Write simplest code to make test pass. Don't optimize yet.

### 🔵 REFACTOR: Improve While Keeping Tests Green
Clean up code while maintaining all passing tests.

## TDD Process

### Step 1: Write Failing Test (RED)

#### Example: Peptide Dose Logging
```typescript
// tests/unit/peptides/dose-logging.test.ts
import { describe, it, expect } from '@jest/globals'
import { saveDose } from '@/lib/peptides'

describe('saveDose', () => {
  it('should save dose with local date and time', async () => {
    const dose = await saveDose({
      userId: 'test-user',
      protocolId: 'test-protocol',
      localDate: '2025-11-04',
      localTime: '09:30:00'
    })

    expect(dose.localDate).toBe('2025-11-04')
    expect(dose.localTime).toBe('09:30:00')
    expect(dose.completed).toBe(true)
  })
})
```

**Run test**: Should FAIL (function doesn't exist yet)
```bash
npm test -- dose-logging.test.ts
# Expected: FAIL - saveDose is not defined
```

### Step 2: Write Minimal Code (GREEN)

#### Implement Just Enough
```typescript
// lib/peptides.ts
import prisma from './prisma'

interface DoseInput {
  userId: string
  protocolId: string
  localDate: string
  localTime: string
}

export async function saveDose(data: DoseInput) {
  return await prisma.peptideDose.create({
    data: {
      userId: data.userId,
      protocolId: data.protocolId,
      localDate: data.localDate,
      localTime: data.localTime,
      completed: true
    }
  })
}
```

**Run test**: Should PASS
```bash
npm test -- dose-logging.test.ts
# Expected: PASS ✅
```

### Step 3: Add More Tests (RED)

#### Test Edge Cases
```typescript
describe('saveDose', () => {
  // ... existing test

  it('should handle optional notes field', async () => {
    const dose = await saveDose({
      userId: 'test-user',
      protocolId: 'test-protocol',
      localDate: '2025-11-04',
      localTime: '09:30:00',
      notes: 'Morning dose'
    })

    expect(dose.notes).toBe('Morning dose')
  })

  it('should reject invalid date format', async () => {
    await expect(
      saveDose({
        userId: 'test-user',
        protocolId: 'test-protocol',
        localDate: 'invalid-date',
        localTime: '09:30:00'
      })
    ).rejects.toThrow('Invalid date format')
  })

  it('should prevent duplicate doses', async () => {
    await saveDose({
      userId: 'test-user',
      protocolId: 'test-protocol',
      localDate: '2025-11-04',
      localTime: '09:30:00'
    })

    await expect(
      saveDose({
        userId: 'test-user',
        protocolId: 'test-protocol',
        localDate: '2025-11-04',
        localTime: '09:30:00'
      })
    ).rejects.toThrow('Dose already logged')
  })
})
```

**Run tests**: Should FAIL (features not implemented)

### Step 4: Implement Features (GREEN)

#### Add Validation and Logic
```typescript
// lib/peptides.ts
interface DoseInput {
  userId: string
  protocolId: string
  localDate: string
  localTime: string
  notes?: string
}

export async function saveDose(data: DoseInput) {
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.localDate)) {
    throw new Error('Invalid date format')
  }

  // Check for duplicate
  const existing = await prisma.peptideDose.findFirst({
    where: {
      userId: data.userId,
      protocolId: data.protocolId,
      localDate: data.localDate,
      localTime: data.localTime
    }
  })

  if (existing) {
    throw new Error('Dose already logged')
  }

  // Create dose
  return await prisma.peptideDose.create({
    data: {
      userId: data.userId,
      protocolId: data.protocolId,
      localDate: data.localDate,
      localTime: data.localTime,
      notes: data.notes || null,
      completed: true
    }
  })
}
```

**Run tests**: Should PASS
```bash
npm test -- dose-logging.test.ts
# Expected: All tests PASS ✅
```

### Step 5: Refactor (REFACTOR)

#### Improve Code Quality
```typescript
// lib/peptides.ts
import prisma from './prisma'
import { validateLocalDate } from './datetime'

interface DoseInput {
  userId: string
  protocolId: string
  localDate: string
  localTime: string
  notes?: string
}

export async function saveDose(data: DoseInput) {
  // Validate date format (extracted to utility)
  if (!validateLocalDate(data.localDate)) {
    throw new Error('Invalid date format')
  }

  // Check for duplicate (extracted to function)
  const isDuplicate = await checkDuplicateDose(data)
  if (isDuplicate) {
    throw new Error('Dose already logged')
  }

  // Create dose
  return await createDoseRecord(data)
}

async function checkDuplicateDose(data: DoseInput): Promise<boolean> {
  const existing = await prisma.peptideDose.findFirst({
    where: {
      userId: data.userId,
      protocolId: data.protocolId,
      localDate: data.localDate,
      localTime: data.localTime
    }
  })
  return !!existing
}

async function createDoseRecord(data: DoseInput) {
  return await prisma.peptideDose.create({
    data: {
      userId: data.userId,
      protocolId: data.protocolId,
      localDate: data.localDate,
      localTime: data.localTime,
      notes: data.notes || null,
      completed: true
    }
  })
}
```

**Run tests**: Should STILL PASS (no behavior change)

## TDD Best Practices

### 1. Write Tests Before Code
❌ Don't write code first
✅ Write test first, then code

### 2. One Test at a Time
❌ Don't write all tests upfront
✅ Write one test, make it pass, repeat

### 3. Minimal Implementation
❌ Don't over-engineer
✅ Write simplest code to pass

### 4. Refactor in Green
❌ Don't refactor when tests fail
✅ Refactor only when all tests pass

### 5. Test Behavior, Not Implementation
❌ Don't test internal details
✅ Test public interface and behavior

## TDD for Different Code Types

### API Route TDD
```typescript
// 1. RED: Write failing test
describe('POST /api/peptides/doses', () => {
  it('should save dose and return 200', async () => {
    const res = await POST(createMockRequest({
      protocolId: 'test',
      localDate: '2025-11-04',
      localTime: '09:30:00'
    }))
    expect(res.status).toBe(200)
  })
})

// 2. GREEN: Implement route
export async function POST(req: NextRequest) {
  // Minimal implementation
  return NextResponse.json({ success: true }, { status: 200 })
}

// 3. REFACTOR: Add full logic while keeping test green
```

### React Component TDD
```typescript
// 1. RED: Write failing test
describe('PeptideTracker', () => {
  it('should display protocols list', async () => {
    render(<PeptideTracker />)
    expect(await screen.findByText('BPC-157')).toBeInTheDocument()
  })
})

// 2. GREEN: Implement component
export default function PeptideTracker() {
  return <div>BPC-157</div>
}

// 3. REFACTOR: Add data fetching, state, etc.
```

### Business Logic TDD
```typescript
// 1. RED: Write failing test
describe('calculateNextDose', () => {
  it('should add 12 hours for twice daily', () => {
    const next = calculateNextDose('2025-11-04 09:00:00', 'twice_daily')
    expect(next).toBe('2025-11-04 21:00:00')
  })
})

// 2. GREEN: Implement function
export function calculateNextDose(lastDose: string, frequency: string) {
  return '2025-11-04 21:00:00' // Hardcoded to pass
}

// 3. REFACTOR: Add real calculation logic
```

## TDD for Bug Fixes

### Process for Bugs
1. Write test that reproduces bug (should fail)
2. Fix bug (test should pass)
3. Add more tests for related cases
4. Refactor if needed

### Example: Timezone Bug
```typescript
// 1. RED: Test that reproduces bug
it('should not convert to UTC', async () => {
  const dose = await saveDose({
    userId: 'test-user',
    protocolId: 'test-protocol',
    localDate: '2025-11-04',
    localTime: '23:59:00'
  })

  // Bug: Was converting to UTC and showing wrong date
  expect(dose.localDate).toBe('2025-11-04') // FAILS
  expect(dose.localTime).toBe('23:59:00')   // FAILS
})

// 2. GREEN: Fix bug
// Remove toISOString() calls, store local strings

// 3. Test passes ✅
```

## Success Criteria
- All tests pass before committing
- Code coverage > 80%
- Tests written before implementation
- Each commit has passing tests
- Refactoring doesn't break tests
- Tests are fast (< 1s per test)

## TDD Workflow Summary

```
1. Write failing test (RED)
   ↓
2. Run test (should fail)
   ↓
3. Write minimal code (GREEN)
   ↓
4. Run test (should pass)
   ↓
5. Refactor (REFACTOR)
   ↓
6. Run tests (should still pass)
   ↓
7. Repeat for next feature
```

## Common TDD Mistakes

### ❌ Don't
- Write all tests first
- Write code before tests
- Skip refactor step
- Test implementation details
- Write slow tests

### ✅ Do
- One test at a time
- Test before code
- Refactor regularly
- Test behavior
- Keep tests fast

## Integration with Other Skills
- Use **test-generator** to create test templates
- Use **edge-case-finder** to identify test scenarios
- Use **code-generator** after tests are written
