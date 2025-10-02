import { test, expect } from '@playwright/test';

test.describe('Manual Hover Verification', () => {
  test('Verify Order Page hover effects in action', async ({ page }) => {
    await page.goto('http://localhost:3001/order');
    await page.waitForLoadState('networkidle');
    
    console.log('=== ORDER PAGE HOVER ANALYSIS ===');
    
    // Take initial screenshot
    await page.screenshot({ path: 'manual-order-initial.png', fullPage: true });
    
    // Test package cards - these should have hover:scale-105 and shadow effects
    const packageCards = page.locator('.bg-gradient-to-br.from-primary-600\\/20.to-secondary-600\\/20').filter({ hasText: 'Order Now' });
    const packageCount = await packageCards.count();
    console.log(`Found ${packageCount} package cards with expected styling`);
    
    // Test Foundation Protocol card
    if (packageCount > 0) {
      await packageCards.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-foundation-hover.png', fullPage: true });
      console.log('Hovered over Foundation Protocol card');
    }
    
    // Test Complete Optimization card (should be the popular one)
    if (packageCount > 1) {
      await packageCards.nth(1).hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-optimization-hover.png', fullPage: true });
      console.log('Hovered over Complete Optimization card');
    }
    
    // Test individual peptide cards - should have hover:shadow-primary-400/20
    const individualCards = page.locator('.bg-gradient-to-br.from-primary-600\\/20.to-secondary-600\\/20').filter({ hasText: 'BPC-157' });
    const individualCount = await individualCards.count();
    console.log(`Found ${individualCount} individual peptide cards`);
    
    if (individualCount > 0) {
      await individualCards.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-individual-hover.png', fullPage: true });
      console.log('Hovered over individual peptide card');
    }
    
    // Check for order buttons with hover:scale-105
    const orderButtons = page.locator('button').filter({ hasText: 'Order Now' });
    const buttonCount = await orderButtons.count();
    console.log(`Found ${buttonCount} order buttons`);
    
    if (buttonCount > 0) {
      await orderButtons.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-button-hover.png', fullPage: true });
      console.log('Hovered over order button');
    }
  });

  test('Verify Homepage hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    console.log('=== HOMEPAGE HOVER ANALYSIS ===');
    
    await page.screenshot({ path: 'manual-homepage-initial.png', fullPage: true });
    
    // Look for portal teaser cards that should have hover:scale-105
    const portalCards = page.locator('.hover\\:scale-105');
    const portalCount = await portalCards.count();
    console.log(`Found ${portalCount} elements with hover:scale-105 on homepage`);
    
    if (portalCount > 0) {
      await portalCards.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-homepage-card-hover.png', fullPage: true });
      console.log('Hovered over homepage card with scale effect');
    }
    
    // Test main CTA button
    const ctaButton = page.locator('a[href="/assessment"]').first();
    if (await ctaButton.count() > 0) {
      await ctaButton.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-homepage-cta-hover.png', fullPage: true });
      console.log('Hovered over main CTA button');
    }
  });

  test('Verify Breath Training page hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001/breath-training');
    await page.waitForLoadState('networkidle');
    
    console.log('=== BREATH TRAINING HOVER ANALYSIS ===');
    
    await page.screenshot({ path: 'manual-breath-initial.png', fullPage: true });
    
    // Look for session stat cards
    const statCards = page.locator('.bg-gradient-to-br').filter({ hasText: 'Sessions' }).first();
    if (await statCards.count() > 0) {
      await statCards.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-breath-stats-hover.png', fullPage: true });
      console.log('Hovered over breath training stat card');
    }
    
    // Test start session button
    const startButton = page.locator('button').filter({ hasText: 'Start' }).first();
    if (await startButton.count() > 0) {
      await startButton.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'manual-breath-start-hover.png', fullPage: true });
      console.log('Hovered over start session button');
    }
  });

  test('Generate hover effects report', async ({ page }) => {
    // This test will generate a final analysis
    console.log('=== HOVER EFFECTS ANALYSIS COMPLETE ===');
    console.log('Screenshots generated for manual verification:');
    console.log('- manual-order-initial.png - Order page before hover');
    console.log('- manual-foundation-hover.png - Foundation protocol card hover');
    console.log('- manual-optimization-hover.png - Complete optimization card hover');
    console.log('- manual-individual-hover.png - Individual peptide card hover');
    console.log('- manual-button-hover.png - Order button hover');
    console.log('- manual-homepage-initial.png - Homepage before hover');
    console.log('- manual-homepage-card-hover.png - Homepage card hover');
    console.log('- manual-homepage-cta-hover.png - Main CTA button hover');
    console.log('- manual-breath-initial.png - Breath training page');
    console.log('- manual-breath-stats-hover.png - Breath training stats hover');
    console.log('- manual-breath-start-hover.png - Start button hover');
  });
});