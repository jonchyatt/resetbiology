# User Journey Validator

## Purpose
Tests critical user flows end-to-end to ensure core functionality works.

## Journeys Tested
1. **New User Signup** (Homepage → Auth0 → Portal)
2. **Portal Login** (Auth0 → Dashboard)
3. **Peptide Protocol Creation** (Portal → Peptides → Add Protocol → Save)
4. **Dose Logging** (Peptides → Log Dose → Verify)
5. **Workout Tracking** (Portal → Workout → Log Session)
6. **Nutrition Entry** (Portal → Nutrition → Add Food)
7. **Checkout Flow** (Order → Cart → Stripe)

## When to Use
- Before production deployments
- After authentication changes
- When modifying core features
- Weekly regression testing

## How It Works
1. Simulates real user interactions
2. Uses Auth0 test account credentials
3. Validates data persistence
4. Checks error handling
5. Verifies navigation flows

## Implementation

```typescript
// tests/user-journeys.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {

  test('Journey 1: New user can access portal after login', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Reset Biology');

    // Click login
    await page.click('text=Login');

    // Auth0 login page
    await page.waitForURL(/auth0\.com/);
    await page.fill('input[name="username"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    // Should redirect to portal
    await page.waitForURL('/portal', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('Journey 2: User can create peptide protocol', async ({ page }) => {
    // Login first
    await page.goto('/api/auth/login?returnTo=/peptides');
    await page.waitForURL('/peptides');

    // Add protocol
    await page.click('text=Add Protocol');
    await page.selectOption('select[name="peptide"]', { label: 'BPC-157' });
    await page.fill('input[name="dosage"]', '250');
    await page.selectOption('select[name="frequency"]', 'twice-daily');
    await page.fill('input[name="time1"]', '09:00');
    await page.fill('input[name="time2"]', '21:00');
    await page.click('text=Save Protocol');

    // Verify saved
    await expect(page.locator('text=BPC-157')).toBeVisible();
    await expect(page.locator('text=250 mcg')).toBeVisible();
  });

  test('Journey 3: User can log workout session', async ({ page }) => {
    await page.goto('/api/auth/login?returnTo=/workout');
    await page.waitForURL('/workout');

    // Add exercise
    await page.click('text=Add Exercise');
    await page.selectOption('select[name="exercise"]', { label: 'Push-ups' });
    await page.fill('input[name="sets"]', '3');
    await page.fill('input[name="reps"]', '15');
    await page.click('text=Add');

    // Complete workout
    await page.click('text=Complete Workout');

    // Verify points awarded
    await expect(page.locator('text=+50 points')).toBeVisible({ timeout: 5000 });
  });

  test('Journey 4: User can log nutrition', async ({ page }) => {
    await page.goto('/api/auth/login?returnTo=/nutrition');
    await page.waitForURL('/nutrition');

    // Add food
    await page.click('text=Add Food');
    await page.fill('input[name="search"]', 'chicken');
    await page.click('text=Chicken Breast');
    await page.fill('input[name="serving"]', '100');
    await page.selectOption('select[name="meal"]', 'lunch');
    await page.click('text=Log Food');

    // Verify logged
    await expect(page.locator('text=Chicken Breast')).toBeVisible();
  });

  test('Journey 5: Checkout flow works', async ({ page }) => {
    await page.goto('/order');

    // Add to cart
    await page.click('text=BPC-157');
    await page.click('text=Add to Cart');

    // Proceed to checkout
    await page.click('text=Checkout');

    // Should reach Stripe
    await expect(page.url()).toContain('stripe.com');
  });
});
```

## Success Criteria
- All journeys complete without errors
- Data persists to database
- Navigation flows correctly
- Points awarded properly
- Error messages display when needed

## Output
HTML report with video recordings of each journey
