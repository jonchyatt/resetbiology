import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports/screenshots';

test.describe('Vision Training System - Comprehensive Testing', () => {
  test.setTimeout(120000);

  // Design System Compliance Test
  test('should comply with Reset Biology design system', async ({ page }) => {
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const designIssues = await page.evaluate(() => {
      const issues: string[] = [];
      const brandColors = {
        primary: '63, 191, 181',   // #3FBFB5
        secondary: '114, 194, 71'  // #72C247
      };

      let brandColorFound = false;
      let grayViolations = 0;
      let transparencyViolations = 0;
      let missingBackdrop = 0;
      let backgroundGradientPresent = false;

      const elements = document.querySelectorAll('*');
      elements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const className = el.className?.toString() || '';

        // Check for brand color presence
        if (bgColor.includes(brandColors.primary) || bgColor.includes(brandColors.secondary)) {
          brandColorFound = true;
        }

        // Check for forbidden gray backgrounds on cards
        if (className.includes('bg-') && (
          bgColor.includes('rgb(31, 41, 55)') || // gray-800
          bgColor.includes('rgb(17, 24, 39)')    // gray-900
        )) {
          grayViolations++;
        }

        // Check for high opacity violations (should be /20 or /30 max)
        if (className.includes('bg-') && (
          bgColor.includes('0.8') || bgColor.includes('0.9') || bgColor.includes('0.7')
        )) {
          transparencyViolations++;
        }

        // Check for missing backdrop-blur on transparent gradient cards
        if (className.includes('bg-gradient') && !className.includes('backdrop-blur')) {
          missingBackdrop++;
        }

        // Check for background gradient
        const backgroundImage = styles.backgroundImage;
        if (backgroundImage && backgroundImage.includes('radial-gradient') &&
            (backgroundImage.includes('191') || backgroundImage.includes('194'))) {
          backgroundGradientPresent = true;
        }
      });

      if (!brandColorFound) {
        issues.push('❌ No brand colors (#3FBFB5 or #72C247) found on page');
      }
      if (grayViolations > 0) {
        issues.push(`❌ ${grayViolations} elements using gray instead of brand colors`);
      }
      if (transparencyViolations > 0) {
        issues.push(`❌ ${transparencyViolations} elements with opacity > 0.3 (should be /20 or /30)`);
      }
      if (missingBackdrop > 0) {
        issues.push(`❌ ${missingBackdrop} gradient cards missing backdrop-blur-sm`);
      }

      return issues;
    });

    if (designIssues.length > 0) {
      console.log('\n🎨 DESIGN SYSTEM VIOLATIONS (Vision Training):');
      designIssues.forEach(issue => console.log(`  ${issue}`));
    }

    expect(designIssues.length, `Design violations found: ${designIssues.join(', ')}`).toBe(0);
  });

  // Desktop: Full interaction flow
  test('Desktop: Tab navigation and training flow', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial state screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-01-desktop-initial.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Initial state (desktop)');

    // 2. Check for tab navigation
    const dynamicTrainingTab = page.locator('button').filter({ hasText: /dynamic training/i }).first();
    const exercisesTab = page.locator('button').filter({ hasText: /exercise library/i }).first();
    const progressTab = page.locator('button').filter({ hasText: /progress.*stats/i }).first();

    expect(await dynamicTrainingTab.isVisible()).toBe(true);
    expect(await exercisesTab.isVisible()).toBe(true);
    expect(await progressTab.isVisible()).toBe(true);

    // 3. Test Dynamic Training tab
    await dynamicTrainingTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-02-desktop-training-tab.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Dynamic Training tab');

    // 4. Check for training mode selectors
    const nearVisionButton = page.locator('button').filter({ hasText: /near vision/i }).first();
    const farVisionButton = page.locator('button').filter({ hasText: /far vision/i }).first();
    const lettersButton = page.locator('button').filter({ hasText: /^letters$/i }).first();

    if (await nearVisionButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await nearVisionButton.isVisible()).toBe(true);
      expect(await farVisionButton.isVisible()).toBe(true);
      expect(await lettersButton.isVisible()).toBe(true);
    }

    // 5. Check for Start button
    const startButton = page.locator('button').filter({ hasText: /start/i }).first();
    if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.screenshot({
        path: `${REPORT_DIR}/vision-training-03-desktop-ready-to-start.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Ready to start training');
    }

    // 6. Test Progress tab
    await progressTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-04-desktop-progress-tab.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Progress tab');

    // 7. Test Exercise Library tab
    await exercisesTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-05-desktop-exercises-tab.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Exercise Library tab');

    // 8. Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-06-desktop-scrolled.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Full page scrolled');
  });

  // Mobile: Tab navigation test
  test('Mobile: Tab navigation and responsive design', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-07-mobile-initial.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Initial state (mobile)');

    // 2. Check responsive design compliance
    const responsiveIssues = await page.evaluate(() => {
      const issues: string[] = [];

      // Check horizontal overflow
      if (document.body.scrollWidth > window.innerWidth) {
        issues.push(`❌ Horizontal overflow: ${document.body.scrollWidth}px > ${window.innerWidth}px`);
      }

      // Check for elements extending beyond viewport
      const elements = document.querySelectorAll('*');
      let overflowingElements = 0;
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 10) { // 10px tolerance
          overflowingElements++;
        }
      });

      if (overflowingElements > 0) {
        issues.push(`❌ ${overflowingElements} elements extending beyond viewport`);
      }

      // Check text readability (font size)
      let smallTextElements = 0;
      elements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const fontSize = parseFloat(styles.fontSize);
        if (fontSize > 0 && fontSize < 12 && el.textContent?.trim()) {
          smallTextElements++;
        }
      });

      if (smallTextElements > 5) {
        issues.push(`❌ ${smallTextElements} text elements < 12px (too small for mobile)`);
      }

      return issues;
    });

    if (responsiveIssues.length > 0) {
      console.log('\n📱 MOBILE RESPONSIVE ISSUES:');
      responsiveIssues.forEach(issue => console.log(`  ${issue}`));
    }

    expect(responsiveIssues.length, `Mobile responsive issues: ${responsiveIssues.join(', ')}`).toBe(0);

    // 3. Test tab navigation on mobile
    const progressTab = page.locator('button').filter({ hasText: /progress.*stats/i }).first();
    if (await progressTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await progressTab.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/vision-training-08-mobile-progress.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Progress tab (mobile)');
    }

    // 4. Full page mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-09-mobile-fullpage.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Full page (mobile)');
  });

  // Tablet viewport test
  test('Tablet: Visual verification', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-training-10-tablet.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Tablet view');

    // Check no horizontal overflow on tablet
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasOverflow, 'Tablet view has horizontal overflow').toBe(false);
  });

  // Console error check
  test('Should have no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      console.log('\n❌ CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach(error => console.log(`  ${error}`));
    }

    expect(consoleErrors.length, `Console errors found: ${consoleErrors.join(', ')}`).toBe(0);
  });

  // Performance check
  test('Should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Page load time: ${loadTime}ms`);

    expect(loadTime, `Page took ${loadTime}ms to load (should be < 5000ms)`).toBeLessThan(5000);
  });
});
