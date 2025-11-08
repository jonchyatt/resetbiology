import { test, expect } from '@playwright/test';

const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  authRequired: '4000002500003155',
};

test.describe('Stripe Checkout Integration', () => {

  test('Product Selection to Checkout', async ({ page }) => {
    await page.goto('/store');

    // Select product
    await page.click('[data-testid="product-card"]:first-child');

    // Add to cart
    await page.click('[data-testid="add-to-cart"]');

    // Go to checkout
    await page.goto('/order');

    // Should see checkout form
    await expect(page.locator('[data-testid="checkout-form"]')).toBeVisible();
  });

  test('Stripe Payment Form Loads', async ({ page }) => {
    await page.goto('/order');

    // Wait for Stripe iframe to load
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]');

    // Check Stripe elements are present
    await expect(stripeFrame.locator('[placeholder="Card number"]')).toBeVisible({
      timeout: 10000
    });
  });

  test('Test Successful Payment Flow', async ({ page }) => {
    // Note: This requires setting up test mode Stripe
    await page.goto('/order');

    // Fill in test card
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]');
    await stripeFrame.locator('[placeholder="Card number"]').fill(STRIPE_TEST_CARDS.success);
    await stripeFrame.locator('[placeholder="MM / YY"]').fill('12/34');
    await stripeFrame.locator('[placeholder="CVC"]').fill('123');
    await stripeFrame.locator('[placeholder="ZIP"]').fill('12345');

    // Submit payment
    await page.click('[data-testid="submit-payment"]');

    // Should redirect to success page
    await expect(page).toHaveURL(/\/success|\/confirmation/, { timeout: 15000 });
  });

  test('Test Declined Card Handling', async ({ page }) => {
    await page.goto('/order');

    // Fill in declined card
    const stripeFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]');
    await stripeFrame.locator('[placeholder="Card number"]').fill(STRIPE_TEST_CARDS.decline);

    // Submit
    await page.click('[data-testid="submit-payment"]');

    // Should show error
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
  });
});
