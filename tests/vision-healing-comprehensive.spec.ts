import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports/screenshots';

test.describe('Vision Healing - Comprehensive Testing', () => {
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

      const elements = document.querySelectorAll('*');
      elements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const textColor = styles.color;
        const borderColor = styles.borderColor;
        const className = el.className?.toString() || '';

        // Check for brand color presence
        if (bgColor.includes(brandColors.primary) || bgColor.includes(brandColors.secondary) ||
            textColor.includes(brandColors.primary) || textColor.includes(brandColors.secondary) ||
            borderColor.includes(brandColors.primary) || borderColor.includes(brandColors.secondary)) {
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
      console.log('\n🎨 DESIGN SYSTEM VIOLATIONS (Vision Healing):');
      designIssues.forEach(issue => console.log(`  ${issue}`));
    }

    expect(designIssues.length, `Design violations found: ${designIssues.join(', ')}`).toBe(0);
  });

  // Desktop Visual & Functional Test
  test('Desktop: Full interaction flow with screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial state screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-01-desktop-initial.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Initial state (desktop)');

    // 2. Check for essential UI elements
    const essentialElements = await page.evaluate(() => {
      const checks = {
        hasHeader: !!document.querySelector('h1, h2'),
        hasSnellenTrainer: !!document.querySelector('*[class*="snellen"], *[class*="Snellen"]') ||
                          !!Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Snellen')),
        hasWaveSelection: !!document.querySelector('button') &&
                         !!Array.from(document.querySelectorAll('button')).some(btn =>
                           btn.textContent?.toLowerCase().includes('wave') ||
                           btn.textContent?.toLowerCase().includes('primer') ||
                           btn.textContent?.toLowerCase().includes('integration') ||
                           btn.textContent?.toLowerCase().includes('resilience')),
        hasExerciseContent: !!document.querySelector('*[class*="exercise"], *[class*="Exercise"]') ||
                           !!Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('exercise')),
      };
      return checks;
    });

    console.log('Essential UI elements:', essentialElements);
    expect(essentialElements.hasHeader, 'Missing main header').toBe(true);

    // 3. Test Snellen trainer mode toggle
    const nearFarButtons = await page.locator('button').filter({ hasText: /near|far/i }).all();
    if (nearFarButtons.length > 0) {
      console.log(`Found ${nearFarButtons.length} near/far mode buttons`);

      // Click near mode
      await nearFarButtons[0].click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${REPORT_DIR}/vision-02-desktop-snellen-near.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Snellen trainer (near mode)');

      // Click far mode if available
      if (nearFarButtons.length > 1) {
        await nearFarButtons[1].click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${REPORT_DIR}/vision-03-desktop-snellen-far.png`,
          fullPage: true
        });
        console.log('✓ Screenshot: Snellen trainer (far mode)');
      }
    }

    // 4. Test wave selection
    const waveButtons = await page.locator('button').filter({
      hasText: /primer|integration|resilience|speed/i
    }).all();

    if (waveButtons.length > 0) {
      console.log(`Found ${waveButtons.length} wave buttons`);

      // Click first wave
      await waveButtons[0].click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/vision-04-desktop-wave1.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Wave 1 selected');

      // Click second wave if available
      if (waveButtons.length > 1) {
        await waveButtons[1].click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: `${REPORT_DIR}/vision-05-desktop-wave2.png`,
          fullPage: true
        });
        console.log('✓ Screenshot: Wave 2 selected');
      }

      // Click third wave if available
      if (waveButtons.length > 2) {
        await waveButtons[2].click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: `${REPORT_DIR}/vision-06-desktop-wave3.png`,
          fullPage: true
        });
        console.log('✓ Screenshot: Wave 3 selected');
      }
    }

    // 5. Test exercise category filters
    const filterButtons = await page.locator('button').filter({
      hasText: /all|downshift|mechanics|peripheral|speed|integration/i
    }).all();

    if (filterButtons.length > 0) {
      console.log(`Found ${filterButtons.length} category filter buttons`);

      // Click a filter
      if (filterButtons.length > 1) {
        await filterButtons[1].click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: `${REPORT_DIR}/vision-07-desktop-filtered.png`,
          fullPage: true
        });
        console.log('✓ Screenshot: Exercise category filter applied');
      }
    }

    // 6. Test session coach interaction
    const nextCheckpointButton = page.locator('button').filter({ hasText: /next.*checkpoint|checkpoint/i }).first();
    if (await nextCheckpointButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextCheckpointButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${REPORT_DIR}/vision-08-desktop-checkpoint.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Session coach next checkpoint');
    }

    // 7. Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${REPORT_DIR}/vision-09-desktop-scrolled.png`,
      fullPage: true
    });
    console.log('✓ Screenshot: Full page scrolled');
  });

  // Mobile Visual & Functional Test
  test('Mobile: Full interaction flow with screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/vision-healing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Initial mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-10-mobile-initial.png`,
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

    // 3. Test wave selection on mobile
    const waveButtons = await page.locator('button').filter({
      hasText: /primer|integration|resilience|speed/i
    }).all();

    if (waveButtons.length > 0) {
      await waveButtons[0].click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `${REPORT_DIR}/vision-11-mobile-wave.png`,
        fullPage: true
      });
      console.log('✓ Screenshot: Wave selected (mobile)');
    }

    // 4. Full page mobile screenshot
    await page.screenshot({
      path: `${REPORT_DIR}/vision-12-mobile-fullpage.png`,
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
      path: `${REPORT_DIR}/vision-13-tablet.png`,
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
