import { test, expect } from '@playwright/test';

test.describe('Portal Page - Self-Healing Visual Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to portal page
    await page.goto('/portal');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('Portal page should have correct dark theme styling', async ({ page }) => {
    // Check that the page has the correct dark background
    const mainContainer = page.locator('div').first();
    await expect(mainContainer).toHaveCSS('background-image', /linear-gradient/);
    
    // Verify welcome header uses proper transparency styling
    const welcomeHeader = page.locator('text=Welcome to Reset Biology Portal').locator('..');
    await expect(welcomeHeader).toHaveClass(/bg-gradient-to-br/);
    await expect(welcomeHeader).toHaveClass(/from-primary-600\/20/);
    await expect(welcomeHeader).toHaveClass(/backdrop-blur-sm/);
    
    // Verify all stat cards have proper transparency styling
    const statCards = page.locator('[class*="bg-gradient-to-br"][class*="from-primary-600/20"]');
    const cardCount = await statCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(6); // 4 stat cards + 2 action cards
    
    // Verify text colors are correct for dark theme
    await expect(page.locator('text=Welcome to Reset Biology Portal')).toHaveCSS('color', /rgb\(255, 255, 255\)/);
    await expect(page.locator('text=Total Points')).toHaveCSS('color', /rgb\(209, 213, 219\)/);
  });

  test('Portal navigation header should be present and functional', async ({ page }) => {
    // Check portal header exists
    const portalHeader = page.locator('text=Portal • Dashboard').locator('..');
    await expect(portalHeader).toBeVisible();
    
    // Check navigation links are present
    await expect(page.locator('a:has-text("Breath Training")')).toBeVisible();
    await expect(page.locator('a:has-text("Peptides")')).toBeVisible();
    await expect(page.locator('a:has-text("Nutrition")')).toBeVisible();
    
    // Verify logo is present with proper styling
    const logo = page.locator('img[alt="Reset Biology"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveClass(/rounded-lg/);
  });

  test('Quick action buttons should be links to correct pages', async ({ page }) => {
    // Verify breath training link
    const breathLink = page.locator('a[href="/breath"]:has-text("Start Breath Training")');
    await expect(breathLink).toBeVisible();
    await expect(breathLink).toHaveClass(/hover:bg-primary-600\/30/);
    
    // Verify peptides link (renamed from "View Progress")
    const peptidesLink = page.locator('a[href="/peptides"]:has-text("View Progress")');
    await expect(peptidesLink).toBeVisible();
    
    // Verify nutrition link (renamed from "Schedule Session")  
    const nutritionLink = page.locator('a[href="/nutrition"]:has-text("Nutrition Tracking")');
    await expect(nutritionLink).toBeVisible();
  });

  test('No console errors should be present', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Reload page to catch any console errors
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Failed to load resource') &&
      !error.includes('favicon.ico') &&
      !error.includes('next-auth') &&
      !error.includes('NextAuth') &&
      !error.includes('auth0') &&
      !error.includes('AuthError')
    );
    
    expect(criticalErrors).toEqual([]);
  });

  test('Page should be responsive on mobile', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify main content is still visible
    await expect(page.locator('text=Welcome to Reset Biology Portal')).toBeVisible();
    
    // Verify stats grid adjusts to mobile (should stack vertically)
    const statsGrid = page.locator('[class*="grid-cols-1"][class*="md:grid-cols-2"]');
    await expect(statsGrid).toBeVisible();
    
    // Verify navigation doesn't overflow
    const navigation = page.locator('[class*="flex"][class*="items-center"][class*="gap-4"]');
    await expect(navigation).toBeVisible();
  });

  test('Self-healing: Fix styling violations automatically', async ({ page }) => {
    // This test checks for common styling violations and reports them
    // for automated fixing
    
    const violations: string[] = [];
    
    // Check for any solid white backgrounds (should be transparent)
    const solidBackgrounds = page.locator('[class*="bg-white"]:not([class*="bg-white/"])');
    const solidCount = await solidBackgrounds.count();
    if (solidCount > 0) {
      violations.push(`Found ${solidCount} solid white backgrounds - should use transparency`);
    }
    
    // Check for gray text on dark background (should be white/light)
    const grayText = page.locator('[class*="text-gray-900"],[class*="text-gray-600"]');
    const grayTextCount = await grayText.count();
    if (grayTextCount > 0) {
      violations.push(`Found ${grayTextCount} dark text elements - should be light for dark theme`);
    }
    
    // Check for missing backdrop-blur on cards
    const cardsWithoutBlur = page.locator('[class*="bg-gradient-to-br"]:not([class*="backdrop-blur"])');
    const blurCount = await cardsWithoutBlur.count();
    if (blurCount > 0) {
      violations.push(`Found ${blurCount} gradient cards missing backdrop-blur`);
    }
    
    // If violations found, log them for automated fixing
    if (violations.length > 0) {
      console.log('🔧 STYLING VIOLATIONS DETECTED:');
      violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation}`);
      });
      
      // For self-healing, we could automatically fix these issues
      // For now, we fail the test to alert about issues
      throw new Error(`Styling violations detected: ${violations.join(', ')}`);
    }
  });
});