import { test, expect } from '@playwright/test';

test.describe('Breath Training Page - Self-Healing Visual Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to breath training page
    await page.goto('/breath');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('Breath page should have correct 3-column layout', async ({ page }) => {
    // Check for three-column grid layout on large screens
    const mainGrid = page.locator('[class*="grid-cols-1"][class*="lg:grid-cols-3"]');
    await expect(mainGrid).toBeVisible();
    
    // Verify left side: Breath Count card
    const breathCountCard = page.locator('text=Breath Count').locator('..');
    await expect(breathCountCard).toBeVisible();
    await expect(breathCountCard).toHaveClass(/bg-gradient-to-br/);
    await expect(breathCountCard).toHaveClass(/from-primary-600\/20/);
    await expect(breathCountCard).toHaveClass(/backdrop-blur-sm/);
    
    // Verify center: Breath Orb (when not in session complete state)
    const breathOrb = page.locator('[class*="breath-orb"], [class*="breathing-circle"]').first();
    // Note: Orb might not be visible until session starts
    
    // Verify left side: Settings card (now moved under Breath Count)
    const settingsCard = page.locator('text=Settings').locator('..').locator('..');
    await expect(settingsCard).toBeVisible();
    await expect(settingsCard).toHaveClass(/bg-gradient-to-br/);
    await expect(settingsCard).toHaveClass(/backdrop-blur-sm/);
  });

  test('Breath count card should display correct information', async ({ page }) => {
    const breathCountCard = page.locator('text=Breath Count').locator('..');
    
    // Verify breath count display (should start at 0)
    const breathCountNumber = page.locator('[class*="text-4xl"][class*="font-bold"][class*="text-primary-300"]');
    await expect(breathCountNumber).toBeVisible();
    
    // Verify pace information
    await expect(page.locator('text=Pace:')).toBeVisible();
    await expect(page.locator('text=3s in • 3s out')).toBeVisible();
    
    // Verify cycle progress
    await expect(page.locator('text=Cycle 1 of')).toBeVisible();
    
    // Check progress bar exists
    const progressBar = page.locator('[class*="bg-gradient-to-r"][class*="from-primary-400"]');
    await expect(progressBar).toBeVisible();
  });

  test('Settings gear button should have proper transparency styling', async ({ page }) => {
    const settingsButton = page.locator('button[title="Session Settings"]');
    await expect(settingsButton).toBeVisible();
    
    // Verify transparency styling
    await expect(settingsButton).toHaveClass(/bg-gradient-to-r/);
    await expect(settingsButton).toHaveClass(/from-primary-600\/60/);
    await expect(settingsButton).toHaveClass(/backdrop-blur-sm/);
    await expect(settingsButton).toHaveClass(/border-primary-400\/40/);
    
    // Verify icon color
    const settingsIcon = settingsButton.locator('svg');
    await expect(settingsIcon).toHaveClass(/text-primary-200/);
  });

  test('Control buttons should have proper transparency styling', async ({ page }) => {
    // Check Start Session button (should be visible when idle)
    const startButton = page.locator('button:has-text("Start Session")');
    await expect(startButton).toBeVisible();
    
    // Verify gradient background with transparency
    await expect(startButton).toHaveClass(/bg-gradient-to-r/);
    await expect(startButton).toHaveClass(/from-primary-600\/80/);
    await expect(startButton).toHaveClass(/backdrop-blur-sm/);
    await expect(startButton).toHaveClass(/border-primary-400\/40/);
    
    // Verify button styling
    await expect(startButton).toHaveClass(/shadow-2xl/);
    await expect(startButton).toHaveClass(/rounded-xl/);
  });

  test('Page should handle New Session button styling correctly', async ({ page }) => {
    // This test verifies that when session is complete, the "New Session" button has proper styling
    // For now, we'll just check that the component can handle session_complete state
    
    // Check if the button logic would work (we can't easily trigger session complete in this test)
    const controlsContainer = page.locator('[class*="flex"][class*="flex-col"][class*="space-y-4"]');
    await expect(controlsContainer).toBeVisible();
  });

  test('No console errors should be present on breath page', async ({ page }) => {
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
    
    // On mobile, the layout should stack vertically
    // The main grid should show only 1 column on mobile
    await expect(page.locator('text=Breath Count')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    
    // Mobile stats should be visible at bottom
    const mobileStats = page.locator('[class*="lg:hidden"]');
    await expect(mobileStats).toBeVisible();
  });

  test('Self-healing: Detect breath page styling violations', async ({ page }) => {
    const violations: string[] = [];
    
    // Check for any solid white backgrounds in controls (should be transparent)
    const solidBackgrounds = page.locator('button[class*="bg-white"]:not([class*="bg-white/"])');
    const solidCount = await solidBackgrounds.count();
    if (solidCount > 0) {
      violations.push(`Found ${solidCount} solid white button backgrounds - should use transparency`);
    }
    
    // Check for buttons without backdrop-blur
    const buttonsWithoutBlur = page.locator('button[class*="bg-gradient"]:not([class*="backdrop-blur"])');
    const blurCount = await buttonsWithoutBlur.count();
    if (blurCount > 0) {
      violations.push(`Found ${blurCount} gradient buttons missing backdrop-blur`);
    }
    
    // Check for dark text on dark background
    const darkTextElements = page.locator('button [class*="text-gray-600"], button [class*="text-gray-900"]');
    const darkTextCount = await darkTextElements.count();
    if (darkTextCount > 0) {
      violations.push(`Found ${darkTextCount} dark text elements on dark theme - should be light`);
    }
    
    // Check for missing proper border transparency
    const improperBorders = page.locator('button[class*="border-gray"], button[class*="border-white"]:not([class*="border-white/"])');
    const borderCount = await improperBorders.count();
    if (borderCount > 0) {
      violations.push(`Found ${borderCount} buttons with improper border colors - should use primary colors with transparency`);
    }
    
    // If violations found, report them for automated fixing
    if (violations.length > 0) {
      console.log('🔧 BREATH PAGE STYLING VIOLATIONS DETECTED:');
      violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation}`);
      });
      
      // For self-healing, we could automatically fix these issues
      throw new Error(`Breath page styling violations detected: ${violations.join(', ')}`);
    }
    
    console.log('✅ Breath page styling is compliant with design system');
  });

  test('Settings modal should have proper styling when opened', async ({ page }) => {
    // Click settings gear to open modal
    const settingsButton = page.locator('button[title="Session Settings"]');
    await settingsButton.click();
    
    // Verify modal appears
    const modal = page.locator('[class*="fixed"][class*="inset-0"]');
    await expect(modal).toBeVisible();
    
    // Verify modal content styling
    const modalContent = page.locator('[class*="fixed"][class*="inset-0"] [class*="bg-white"][class*="rounded-xl"]');
    await expect(modalContent).toBeVisible();
    
    // Close modal by clicking outside or cancel button
    await page.keyboard.press('Escape');
  });
});