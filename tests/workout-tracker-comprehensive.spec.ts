import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports/screenshots';

test.describe('Workout Tracker - Comprehensive Testing', () => {
  test.setTimeout(120000);

  // Design System Compliance Test
  test('should comply with Reset Biology design system', async ({ page }) => {
    await page.goto(`${BASE_URL}/workout`);
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
      let missingGlow = 0;
      let missingHoverEffects = 0;
      let wrongOpacities = 0;
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

        // Check for missing shadow-glow effects
        const boxShadow = styles.boxShadow;
        if (className.includes('rounded') && className.includes('border') &&
            !boxShadow.includes('191') && !boxShadow.includes('194')) {
          missingGlow++;
        }

        // Check for missing hover effects on cards
        if (className.includes('rounded-2xl') && !className.includes('hover:')) {
          missingHoverEffects++;
        }

        // Check for wrong opacity values (should be /10, /15, /20 max)
        if (bgColor.includes('rgba') && (
          bgColor.includes('0.4') || bgColor.includes('0.5') ||
          bgColor.includes('0.6') || bgColor.includes('0.7')
        )) {
          wrongOpacities++;
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
      if (!backgroundGradientPresent) {
        issues.push('❌ Background gradient effect missing (should have radial-gradient with brand colors)');
      }
      if (missingGlow > 5) { // Allow some elements without glow
        issues.push(`❌ ${missingGlow} cards missing shadow-glow effects (shadow-primary-500/20 or shadow-secondary-500/20)`);
      }
      if (missingHoverEffects > 5) { // Allow some elements without hover
        issues.push(`❌ ${missingHoverEffects} cards missing hover effects (hover:scale-105 or hover:shadow-*)`);
      }
      if (wrongOpacities > 0) {
        issues.push(`❌ ${wrongOpacities} elements with opacity > 0.3 (should use /10, /15, or /20)`);
      }

      return issues;
    });

    if (designIssues.length > 0) {
      console.log('\n🎨 DESIGN SYSTEM VIOLATIONS (Workout Tracker):');
      designIssues.forEach(issue => console.log(`  ${issue}`));
    }

    expect(designIssues.length, `Design violations found: ${designIssues.join(', ')}`).toBe(0);
  });

  // Desktop Visual & Functional Test
  test('Desktop: Full interaction flow with screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/workout`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial state screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/workout-01-desktop-initial.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Initial state (desktop)');

    // 2. Check for essential UI elements
    const essentialElements = await page.evaluate(() => {
      const checks = {
        hasHeader: !!document.querySelector('h1, h2'),
        hasProtocolSection: !!document.querySelector('*[class*="protocol"], *[class*="Protocol"]'),
        hasSessionLog: !!document.querySelector('*[class*="session"], *[class*="Session"]'),
        hasReadiness: !!document.querySelector('*[class*="readiness"], *[class*="Readiness"]'),
        hasHistoryOrRecent: !!document.querySelector('*[class*="history"], *[class*="recent"], *[class*="History"], *[class*="Recent"]')
      };
      return checks;
    });

    console.log('Essential UI elements:', essentialElements);
    expect(essentialElements.hasHeader, 'Missing main header').toBe(true);

    // 3. Test protocol interaction (if protocol library exists)
    const protocolLibraryButton = page.locator('button').filter({ hasText: /protocol library/i }).first();
    if (await protocolLibraryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await protocolLibraryButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/workout-02-desktop-protocol-library.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Protocol library opened');

      // Close modal if visible
      const closeButton = page.locator('button').filter({ hasText: /close|×/i }).first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // 4. Test session logging (if log button exists)
    const logSessionButton = page.locator('button').filter({ hasText: /log.*session|quick.*log/i }).first();
    if (await logSessionButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logSessionButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/workout-03-desktop-log-session.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Log session modal');

      // Close modal
      const closeButton = page.locator('button').filter({ hasText: /close|cancel|×/i }).first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // 5. Test readiness check-in (if available)
    const checkinButton = page.locator('button').filter({ hasText: /check.?in|readiness/i }).first();
    if (await checkinButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkinButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/workout-04-desktop-checkin.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Readiness check-in modal');

      // Close modal
      const closeButton = page.locator('button').filter({ hasText: /close|cancel|×/i }).first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // 6. Scroll to bottom to capture full interface
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${REPORT_DIR}/workout-05-desktop-scrolled.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Full page scrolled');
  });

  // Mobile Visual & Functional Test
  test('Mobile: Full interaction flow with screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/workout`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/workout-06-mobile-initial.png`,
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

    // 3. Test button interactions on mobile
    const protocolLibraryButton = page.locator('button').filter({ hasText: /protocol library/i }).first();
    if (await protocolLibraryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await protocolLibraryButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/workout-07-mobile-protocol-library.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Protocol library (mobile)');

      // Close modal
      const closeButton = page.locator('button').filter({ hasText: /close|×/i }).first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // 4. Full page mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/workout-08-mobile-fullpage.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Full page (mobile)');
  });

  // Tablet viewport test
  test('Tablet: Visual verification', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/workout`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${REPORT_DIR}/workout-09-tablet.png`,
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

    await page.goto(`${BASE_URL}/workout`);
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

    await page.goto(`${BASE_URL}/workout`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Page load time: ${loadTime}ms`);

    expect(loadTime, `Page took ${loadTime}ms to load (should be < 5000ms)`).toBeLessThan(5000);
  });
});
