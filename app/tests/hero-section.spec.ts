import { test, expect } from '@playwright/test';

test.describe('Hero Section Tests', () => {
  test('should display hero section with correct headline and branding', async ({ page }) => {
    await page.goto('/');
    
    // Check the main headline
    await expect(page.locator('h1')).toContainText('Is it crazy to want the safest, most effective peptide therapy');
    
    // Check for brand colors and name - be more specific
    await expect(page.locator('h4').filter({ hasText: '✅ Reset Biology' })).toBeVisible();
    
    // Take screenshot of hero section only (not full page to avoid size limit)
    await page.screenshot({ path: 'hero-section.png', clip: { x: 0, y: 0, width: 1200, height: 800 } });
  });

  test('should have working assessment button', async ({ page }) => {
    await page.goto('/');
    
    // Find and click the assessment button
    const assessmentButton = page.locator('a[href="/assessment"]');
    await expect(assessmentButton).toContainText('Take the 60-Second Reset Assessment');
    
    // Take small screenshot before clicking
    await page.screenshot({ path: 'before-assessment-click.png', clip: { x: 0, y: 0, width: 1200, height: 600 } });
    
    await assessmentButton.click();
    
    // Should navigate to assessment page
    await expect(page).toHaveURL('/assessment');
    
    // Take small screenshot of assessment page
    await page.screenshot({ path: 'assessment-page.png', clip: { x: 0, y: 0, width: 1200, height: 800 } });
  });

  test('should test /process page', async ({ page }) => {
    await page.goto('/process');
    
    // Take small screenshot of process page
    await page.screenshot({ path: 'process-page.png', clip: { x: 0, y: 0, width: 1200, height: 800 } });
    
    // Should load without errors
    await expect(page).toHaveURL('/process');
  });

  test('should check responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.screenshot({ path: 'mobile-view.png', clip: { x: 0, y: 0, width: 375, height: 600 } });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await page.screenshot({ path: 'tablet-view.png', clip: { x: 0, y: 0, width: 768, height: 600 } });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await page.screenshot({ path: 'desktop-view.png', clip: { x: 0, y: 0, width: 1200, height: 600 } });
  });

  test('should check for console errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });
    
    await page.goto('/');
    
    // Navigate through the app
    await page.click('a[href="/assessment"]');
    await page.waitForTimeout(1000);
    
    // Check if there are any console errors
    expect(consoleMessages.length).toBe(0);
    
    if (consoleMessages.length > 0) {
      console.log('Console errors found:', consoleMessages);
    }
  });
});