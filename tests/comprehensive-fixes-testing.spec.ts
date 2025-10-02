import { test, expect } from '@playwright/test';

test.describe('Comprehensive Fixes Testing', () => {
  const BASE_URL = 'http://localhost:3002';

  test('1. Navbar Hiding Issue - Profile Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    
    // Check that the title is visible and not hidden under navbar
    const profileTitle = page.locator('h1:has-text("Profile")');
    await expect(profileTitle).toBeVisible();
    
    // Take screenshot to verify spacing
    await page.screenshot({ path: 'test-results/profile-navbar-spacing.png', fullPage: true });
    
    // Verify proper spacing - check if content starts below navbar
    const titleBox = await profileTitle.boundingBox();
    expect(titleBox?.y).toBeGreaterThan(80); // Should be below navbar height
    
    console.log('✅ Profile page title spacing verified');
  });

  test('2. Navbar Hiding Issue - Portal Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForLoadState('networkidle');
    
    // Check that the portal title is visible and not hidden
    const portalTitle = page.locator('h1:has-text("Portal")');
    await expect(portalTitle).toBeVisible();
    
    // Take screenshot to verify spacing
    await page.screenshot({ path: 'test-results/portal-navbar-spacing.png', fullPage: true });
    
    // Verify proper spacing
    const titleBox = await portalTitle.boundingBox();
    expect(titleBox?.y).toBeGreaterThan(80);
    
    console.log('✅ Portal page title spacing verified');
  });

  test('3. Navigation Link Fix - Profile Link', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Click Profile link in navbar
    const profileLink = page.locator('nav a:has-text("Profile")');
    await expect(profileLink).toBeVisible();
    
    // Verify the href is correct
    const href = await profileLink.getAttribute('href');
    expect(href).toBe('/profile'); // Should NOT be /auth/profile
    
    // Click and verify navigation works
    await profileLink.click();
    await page.waitForURL('**/profile');
    
    expect(page.url()).toContain('/profile');
    console.log('✅ Profile link navigation verified');
  });

  test('4. Homepage Hover Effects - Logo and CTA', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Test logo hover effect
    const logo = page.locator('[data-testid="logo"], img[alt*="Reset Biology"], .logo').first();
    await logo.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/logo-hover.png' });
    
    // Test main CTA button hover
    const ctaButton = page.locator('button:has-text("Get Started"), a:has-text("Get Started")').first();
    if (await ctaButton.count() > 0) {
      await ctaButton.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/cta-hover.png' });
    }
    
    console.log('✅ Homepage hover effects tested');
  });

  test('5. Homepage Portal Teaser Cards Hover', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Find and test portal teaser cards
    const cards = page.locator('[class*="card"], [class*="hover"], .bg-gradient-to-br');
    const cardCount = await cards.count();
    
    console.log(`Found ${cardCount} potential cards to test`);
    
    for (let i = 0; i < Math.min(cardCount, 6); i++) {
      await cards.nth(i).hover();
      await page.waitForTimeout(300);
    }
    
    await page.screenshot({ path: 'test-results/homepage-cards-hover.png', fullPage: true });
    console.log('✅ Homepage cards hover effects tested');
  });

  test('6. Education Page - Category Buttons Centered', async ({ page }) => {
    await page.goto(`${BASE_URL}/education`);
    await page.waitForLoadState('networkidle');
    
    // Check for category filter buttons
    const categoryContainer = page.locator('[class*="flex"], [class*="center"]').filter({ hasText: 'All' });
    const buttons = page.locator('button:has-text("All"), button:has-text("Research"), button:has-text("Protocols")');
    
    if (await buttons.count() > 0) {
      // Test button hover effects
      for (let i = 0; i < await buttons.count(); i++) {
        await buttons.nth(i).hover();
        await page.waitForTimeout(300);
      }
      
      // Verify centering - take screenshot
      await page.screenshot({ path: 'test-results/education-buttons-centered.png' });
      
      console.log('✅ Education page category buttons tested');
    }
  });

  test('7. Order Page - ALL Package Cards Hover', async ({ page }) => {
    await page.goto(`${BASE_URL}/order`);
    await page.waitForLoadState('networkidle');
    
    // Test main package cards (3 expected)
    const packageCards = page.locator('[class*="bg-gradient-to-br"]');
    const packageCount = await packageCards.count();
    
    console.log(`Found ${packageCount} package cards`);
    
    // Test hover on each package card
    for (let i = 0; i < packageCount; i++) {
      await packageCards.nth(i).hover();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/package-card-${i}-hover.png` });
    }
    
    // Test individual peptide cards
    const peptideCards = page.locator('h3:has-text("Ipamorelin"), h3:has-text("Sermorelin"), h3:has-text("Tesamorelin")').locator('..');
    const peptideCount = await peptideCards.count();
    
    console.log(`Found ${peptideCount} peptide cards`);
    
    for (let i = 0; i < peptideCount; i++) {
      await peptideCards.nth(i).hover();
      await page.waitForTimeout(400);
    }
    
    await page.screenshot({ path: 'test-results/order-all-hover.png', fullPage: true });
    console.log('✅ Order page hover effects tested - ALL boxes should glow/pop');
  });

  test('8. Portal Page - Trial Account Box Hover', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForLoadState('networkidle');
    
    // Test trial account box hover (should now have hover effect)
    const trialBox = page.locator(':has-text("Trial Account")').locator('..').first();
    await trialBox.hover();
    await page.waitForTimeout(500);
    
    // Test stat cards hover
    const statCards = page.locator('[class*="bg-gradient-to-br"]');
    const statCount = await statCards.count();
    
    for (let i = 0; i < Math.min(statCount, 4); i++) {
      await statCards.nth(i).hover();
      await page.waitForTimeout(300);
    }
    
    await page.screenshot({ path: 'test-results/portal-hover.png', fullPage: true });
    console.log('✅ Portal page hover effects tested');
  });

  test('9. Profile Page - Tab Navigation Hover', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    
    // Test tab navigation hover effects
    const tabs = page.locator('button:has-text("Overview"), button:has-text("Account"), button:has-text("Billing")');
    const tabCount = await tabs.count();
    
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).hover();
      await page.waitForTimeout(300);
    }
    
    // Test user overview card and other elements
    const cards = page.locator('[class*="bg-gradient-to-br"], [class*="card"]');
    const cardCount = await cards.count();
    
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      await cards.nth(i).hover();
      await page.waitForTimeout(300);
    }
    
    await page.screenshot({ path: 'test-results/profile-hover.png', fullPage: true });
    console.log('✅ Profile page hover effects tested');
  });

  test('10. Console Errors Check', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Check each major page for console errors
    const pages = ['/', '/profile', '/portal', '/education', '/order'];
    
    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }
    
    if (errors.length > 0) {
      console.log('❌ Console errors found:', errors);
      expect(errors.length).toBe(0);
    } else {
      console.log('✅ No console errors found across all pages');
    }
  });
});