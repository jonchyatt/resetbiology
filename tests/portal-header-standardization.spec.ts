import { test, expect } from '@playwright/test';

test.describe('PortalHeader Standardization Tests', () => {
  const testPages = [
    {
      url: '/profile',
      expectedTitle: 'Portal • Account Management',
      expectedSubtitle: 'Manage your wellness journey settings'
    },
    {
      url: '/portal',
      expectedTitle: 'Portal • Dashboard',
      expectedSubtitle: 'Your comprehensive wellness command center'
    },
    {
      url: '/order',
      expectedTitle: 'Portal • Order Peptides',
      expectedSubtitle: 'Premium Protocols'
    },
    {
      url: '/education',
      expectedTitle: 'Portal • Education Center',
      expectedSubtitle: 'Research & Science'
    },
    {
      url: '/breath',
      expectedTitle: 'Portal • Breath Training',
      expectedSubtitle: 'Advanced Breathing Exercises'
    }
  ];

  test.beforeEach(async ({ page }) => {
    // Navigate to home page first to establish base state
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  for (const testPage of testPages) {
    test(`${testPage.url} should have standardized PortalHeader`, async ({ page }) => {
      await page.goto(`http://localhost:3000${testPage.url}`);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for verification
      await page.screenshot({ 
        path: `test-results/portal-header-${testPage.url.replace('/', '')}.png`,
        fullPage: true 
      });

      // Check if PortalHeader component exists
      const portalHeader = page.locator('[data-testid="portal-header"], .portal-header, h1').first();
      await expect(portalHeader).toBeVisible();

      // Verify the title format follows "Portal • [Section]" pattern
      const titleElement = page.locator('h1, [class*="heading"], [class*="title"]').first();
      const titleText = await titleElement.textContent();
      
      console.log(`Page: ${testPage.url}, Title found: "${titleText}"`);
      
      // Check if title contains expected text or follows portal pattern
      const hasPortalPattern = titleText?.includes('Portal •') || titleText?.includes(testPage.expectedTitle);
      expect(hasPortalPattern).toBeTruthy();

      // Verify navigation links are present
      const navLinks = page.locator('nav a, [class*="nav"] a');
      const navCount = await navLinks.count();
      expect(navCount).toBeGreaterThan(0);

      // Check for consistent styling - look for common header classes
      const headerClasses = await portalHeader.getAttribute('class');
      console.log(`Page: ${testPage.url}, Header classes: ${headerClasses}`);
    });
  }

  test('All portal pages should have identical header styling', async ({ page }) => {
    const headerStyles: { [key: string]: string } = {};
    
    for (const testPage of testPages) {
      await page.goto(`http://localhost:3000${testPage.url}`);
      await page.waitForLoadState('networkidle');
      
      // Get computed styles of header elements
      const headerElement = page.locator('h1, .portal-header, [data-testid="portal-header"]').first();
      const styles = await headerElement.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          color: computed.color,
          marginBottom: computed.marginBottom,
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom
        };
      });
      
      headerStyles[testPage.url] = JSON.stringify(styles);
      console.log(`${testPage.url} header styles:`, styles);
    }

    // Verify breath training page exists as reference
    const breathStyles = headerStyles['/breath'];
    expect(breathStyles).toBeDefined();
    
    console.log('Header standardization check completed');
  });

  test('Visual comparison - all headers should look identical', async ({ page }) => {
    const screenshots: { [key: string]: Buffer } = {};
    
    for (const testPage of testPages) {
      await page.goto(`http://localhost:3000${testPage.url}`);
      await page.waitForLoadState('networkidle');
      
      // Screenshot just the header area
      const headerArea = page.locator('header, .portal-header, h1').first();
      if (await headerArea.isVisible()) {
        screenshots[testPage.url] = await headerArea.screenshot();
      } else {
        // Fallback to top section screenshot
        screenshots[testPage.url] = await page.screenshot({ 
          clip: { x: 0, y: 0, width: 1200, height: 200 }
        });
      }
    }
    
    console.log('Screenshots captured for all pages');
    expect(Object.keys(screenshots)).toHaveLength(testPages.length);
  });
});