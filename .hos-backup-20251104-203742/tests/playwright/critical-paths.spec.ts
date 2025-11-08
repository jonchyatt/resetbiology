import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {

  test('Auth0 Sign Up Flow', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Click login/signup button
    await page.click('[data-testid="login-button"]');

    // Should redirect to Auth0
    await expect(page).toHaveURL(/auth0\.com/);

    // Note: Full Auth0 testing requires test account setup
  });

  test('Peptide Protocol Selection and Tracking', async ({ page }) => {
    // Assuming user is logged in
    await page.goto('/peptides');

    // Should see peptide list
    await expect(page.locator('h1')).toContainText(/peptide/i);

    // Select a peptide
    await page.click('[data-testid="peptide-card"]:first-child');

    // Should see protocol details
    await expect(page).toHaveURL(/\/peptides\//);

    // Check for calculator
    await expect(page.locator('[data-testid="dosage-calculator"]')).toBeVisible();
  });

  test('Nutrition Logging Flow', async ({ page }) => {
    await page.goto('/nutrition');

    // Should see nutrition tracker
    await expect(page.locator('h1')).toContainText(/nutrition/i);

    // Check for food entry form
    await expect(page.locator('[data-testid="food-entry-form"]')).toBeVisible();
  });

  test('Workout Tracking Flow', async ({ page }) => {
    await page.goto('/workout');

    // Should see workout tracker
    await expect(page.locator('h1')).toContainText(/workout/i);

    // Check for workout log
    await expect(page.locator('[data-testid="workout-log"]')).toBeVisible();
  });

  test('Breath Training Session', async ({ page }) => {
    await page.goto('/breath');

    // Should see breath training
    await expect(page.locator('h1')).toContainText(/breath/i);

    // Check for training interface
    await expect(page.locator('[data-testid="breath-interface"]')).toBeVisible();
  });

  test('Store Browse and Checkout Flow', async ({ page }) => {
    await page.goto('/store');

    // Should see store products
    await expect(page.locator('h1')).toContainText(/store/i);

    // Check for products
    const products = page.locator('[data-testid="product-card"]');
    await expect(products).toHaveCount({ minimum: 1 });

    // Click first product
    await products.first().click();

    // Should see product details
    await expect(page).toHaveURL(/\/store\//);

    // Check for add to cart button
    await expect(page.locator('[data-testid="add-to-cart"]')).toBeVisible();
  });
});
