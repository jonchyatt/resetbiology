---
name: test-generator
description: Generates comprehensive test suites following TDD principles
version: 1.0.0
triggers:
  - generate tests for
  - create test suite
  - write tests following TDD
  - generate unit tests
  - generate integration tests
---

# Test Generator Skill

## Purpose
Generates comprehensive test suites including unit tests, integration tests, and E2E tests for ResetBiology.com features.

## When to Use
- Before implementing new features (TDD)
- After implementing code without tests
- When adding test coverage
- During test-driven refactoring

## Test Types

### 1. Unit Tests
Test individual functions and business logic.

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals'
import { calculateNextDose } from '@/lib/peptides'

describe('Peptide Dose Calculation', () => {
  it('should calculate next dose based on frequency', () => {
    const result = calculateNextDose({
      frequency: 'twice_daily',
      lastDose: '2025-11-04 09:00:00'
    })

    expect(result.nextDose).toBe('2025-11-04 21:00:00')
  })

  it('should handle every-other-day frequency', () => {
    const result = calculateNextDose({
      frequency: 'every_other_day',
      lastDose: '2025-11-04 09:00:00'
    })

    expect(result.nextDose).toBe('2025-11-06 09:00:00')
  })

  it('should handle timezone correctly', () => {
    const result = calculateNextDose({
      frequency: 'daily',
      lastDose: '2025-11-04 23:30:00'
    })

    // Next dose should be next day, not same day
    expect(result.nextDose).toContain('2025-11-05')
  })
})
```

### 2. Integration Tests (API Routes)
Test API endpoints with authentication.

```typescript
import { describe, it, expect } from '@jest/globals'
import { POST } from '@/app/api/peptides/doses/route'

describe('POST /api/peptides/doses', () => {
  it('should require authentication', async () => {
    const req = new Request('http://localhost:3000/api/peptides/doses', {
      method: 'POST',
      body: JSON.stringify({ protocolId: 'test' })
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('should validate required fields', async () => {
    const req = createAuthenticatedRequest({
      method: 'POST',
      body: JSON.stringify({ localDate: '2025-11-04' })
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('protocolId')
  })

  it('should save dose and award points', async () => {
    const req = createAuthenticatedRequest({
      method: 'POST',
      body: JSON.stringify({
        protocolId: 'protocol-1',
        localDate: '2025-11-04',
        localTime: '09:30:00'
      })
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.localDate).toBe('2025-11-04')

    // Verify gamification points
    const points = await getGamificationPoints(testUser.id)
    expect(points.some(p => p.activitySource === 'peptide_dose')).toBe(true)
  })
})
```

### 3. E2E Tests (Playwright)
Test complete user workflows.

```typescript
import { test, expect } from '@playwright/test'

test.describe('Peptide Tracking Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('https://resetbiology.com')
    await page.click('text=Login')
    // Complete Auth0 login
    await page.waitForURL('**/portal')
  })

  test('complete peptide tracking flow', async ({ page }) => {
    // Navigate to peptides
    await page.goto('https://resetbiology.com/peptides')

    // Add protocol
    await page.click('button:has-text("Add Protocol")')
    await page.fill('input[name="peptideName"]', 'BPC-157')
    await page.fill('input[name="dosage"]', '250')
    await page.selectOption('select[name="unit"]', 'mcg')
    await page.click('button:has-text("Save Protocol")')

    // Verify protocol appears
    await expect(page.locator('text=BPC-157')).toBeVisible()

    // Log dose
    await page.click('button:has-text("Log Dose")')
    await page.fill('textarea[name="notes"]', 'Morning injection')
    await page.click('button:has-text("Complete Dose")')

    // Verify success
    await expect(page.locator('text=Dose logged successfully')).toBeVisible()

    // Verify points awarded
    const pointsDisplay = page.locator('text=/\\d+ pts/')
    await expect(pointsDisplay).toBeVisible()
  })
})
```

## Test Template Generation

### For New Feature
Given feature specification, generate:

1. **Unit tests** for business logic functions
2. **Integration tests** for API routes
3. **E2E tests** for user workflows
4. **Edge case tests** for boundary conditions

### Test Structure
```
tests/
  unit/
    [feature]/
      - calculations.test.ts
      - validations.test.ts
      - utils.test.ts
  integration/
    api/
      [feature]/
        - route.test.ts
  e2e/
    [feature]/
      - workflow.spec.ts
      - edge-cases.spec.ts
```

## ResetBiology-Specific Test Patterns

### 1. Timezone Testing
```typescript
test('handles timezone correctly', async () => {
  // Test with different timezones
  const dose = await saveDose({
    userId: 'test-user',
    protocolId: 'protocol-1',
    localDate: '2025-11-04',
    localTime: '23:59:00'
  })

  // Should save as local time, not UTC
  expect(dose.localTime).toBe('23:59:00')
  expect(dose.localDate).toBe('2025-11-04')
})
```

### 2. Auth0 Email Fallback
```typescript
test('finds user by email when auth0Sub changes', async () => {
  const user = await findUser({
    auth0Sub: 'new-auth0-id',
    email: 'user@example.com'
  })

  expect(user).toBeDefined()
  expect(user.email).toBe('user@example.com')
})
```

### 3. Gamification Integration
```typescript
test('awards points for action', async () => {
  await completeWorkout({ userId: 'test-user' })

  const points = await getPoints('test-user')
  expect(points.total).toBeGreaterThan(0)
  expect(points.recent[0].activitySource).toBe('workout_completed')
})
```

## Edge Cases to Test

### Common ResetBiology Edge Cases
- [ ] Action at exactly midnight (which day?)
- [ ] User in different timezone than usual
- [ ] Concurrent actions (race conditions)
- [ ] Missing optional fields
- [ ] Invalid date/time formats
- [ ] Duplicate prevention
- [ ] Auth0 session expiration
- [ ] Empty or null values
- [ ] Very large values (overflow)
- [ ] Special characters in text fields

## Success Criteria
- 80% code coverage minimum
- All critical paths tested
- Edge cases covered
- Tests follow TDD principles
- Tests are maintainable
- Fast execution (< 5 min total)

## Output
Generate test files with:
- Test suite structure
- Unit tests
- Integration tests
- E2E tests
- Edge case tests
- Mock/stub utilities
- Test data fixtures
