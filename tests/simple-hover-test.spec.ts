import { test, expect } from '@playwright/test';

test.describe('Simple Hover Effects Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('Order Page Hover Effects', async ({ page }) => {
    await page.goto('http://localhost:3001/order');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot
    await page.screenshot({ path: 'order-page-full.png', fullPage: true });
    
    // Look for cards with hover classes
    const hoverElements = page.locator('[class*="hover:scale-"], [class*="hover:shadow-"]');
    const count = await hoverElements.count();
    console.log(`Found ${count} elements with hover effects on order page`);
    
    // Test first few elements
    if (count > 0) {
      await hoverElements.first().hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'order-hover-1.png', fullPage: true });
      
      if (count > 1) {
        await hoverElements.nth(1).hover();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'order-hover-2.png', fullPage: true });
      }
      
      if (count > 2) {
        await hoverElements.nth(2).hover();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'order-hover-3.png', fullPage: true });
      }
    }
  });

  test('Portal Page Hover Effects', async ({ page }) => {
    await page.goto('http://localhost:3001/portal');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'portal-page-full.png', fullPage: true });
    
    const hoverElements = page.locator('[class*="hover:scale-"], [class*="hover:shadow-"]');
    const count = await hoverElements.count();
    console.log(`Found ${count} elements with hover effects on portal page`);
    
    if (count > 0) {
      await hoverElements.first().hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'portal-hover-1.png', fullPage: true });
      
      if (count > 1) {
        await hoverElements.nth(1).hover();
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'portal-hover-2.png', fullPage: true });
      }
    }
  });

  test('Education Page Hover Effects', async ({ page }) => {
    await page.goto('http://localhost:3001/education');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'education-page-full.png', fullPage: true });
    
    const hoverElements = page.locator('[class*="hover:scale-"], [class*="hover:shadow-"]');
    const count = await hoverElements.count();
    console.log(`Found ${count} elements with hover effects on education page`);
    
    if (count > 0) {
      await hoverElements.first().hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'education-hover-1.png', fullPage: true });
    }
  });

  test('Profile Page Hover Effects', async ({ page }) => {
    await page.goto('http://localhost:3001/profile');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'profile-page-full.png', fullPage: true });
    
    const hoverElements = page.locator('[class*="hover:scale-"], [class*="hover:shadow-"], button[class*="hover:"]');
    const count = await hoverElements.count();
    console.log(`Found ${count} elements with hover effects on profile page`);
    
    if (count > 0) {
      await hoverElements.first().hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'profile-hover-1.png', fullPage: true });
    }
  });
});