import { test, expect, devices } from '@playwright/test';

// Configure mobile viewport for all tests in this file
test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Experience', () => {

  test('Mobile Navigation Menu', async ({ page }) => {
    await page.goto('/');

    // Check for mobile menu button
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Click to open
    await page.click('[data-testid="mobile-menu-button"]');

    // Should see navigation
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });

  test('Touch Interactions - Peptide Calculator', async ({ page }) => {
    await page.goto('/peptides');

    // Should work with touch
    const calculator = page.locator('[data-testid="dosage-calculator"]');
    await expect(calculator).toBeVisible();

    // Tap input fields
    await calculator.locator('input').first().tap();

    // Should focus
    await expect(calculator.locator('input').first()).toBeFocused();
  });

  test('Mobile Form Inputs', async ({ page }) => {
    await page.goto('/assessment');

    // Check form is usable on mobile
    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    // Check touch targets are adequate size
    const buttons = form.locator('button');
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Mobile Scrolling Performance', async ({ page }) => {
    await page.goto('/portal');

    // Should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });
});
