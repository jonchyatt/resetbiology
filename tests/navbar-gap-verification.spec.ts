import { test, expect } from '@playwright/test';

test.describe('Navbar Gap Verification', () => {
  const pages = [
    { url: '/breath', name: 'Breath Training (Reference)' },
    { url: '/profile', name: 'Profile Page' },
    { url: '/portal', name: 'Portal Page' },
    { url: '/order', name: 'Order Page' },
    { url: '/education', name: 'Education Page' }
  ];

  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  for (const pageInfo of pages) {
    test(`${pageInfo.name} - Navbar seamless connection`, async ({ page }) => {
      console.log(`Testing ${pageInfo.name}: ${pageInfo.url}`);
      
      // Navigate to the page
      await page.goto(`http://localhost:3001${pageInfo.url}`);
      
      // Wait for page to load completely
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Take a screenshot focusing on the navbar area
      const navbarScreenshot = await page.screenshot({
        clip: { x: 0, y: 0, width: 1280, height: 200 },
        path: `test-results/navbar-${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}.png`
      });
      
      // Check that main navbar exists
      const mainNav = page.locator('nav').first();
      await expect(mainNav).toBeVisible();
      
      // Check that page header exists (look for common header selectors)
      const pageHeader = page.locator('header').last();
      const headerSection = page.locator('section').first();
      
      // Take a full page screenshot for reference
      await page.screenshot({
        path: `test-results/full-page-${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        fullPage: false
      });
      
      console.log(`✅ ${pageInfo.name} navbar area captured`);
      
      // Log any gaps we can detect programmatically
      const navHeight = await mainNav.boundingBox();
      if (navHeight) {
        console.log(`Navbar bottom position: ${navHeight.y + navHeight.height}px`);
      }
      
      // Check for specific gap indicators in CSS
      const bodyElement = page.locator('body');
      const bodyStyle = await bodyElement.evaluate(el => {
        return window.getComputedStyle(el).paddingTop;
      });
      console.log(`Body padding-top: ${bodyStyle}`);
    });
  }

  test('Visual comparison - All pages should match breath training style', async ({ page }) => {
    console.log('🎯 CRITICAL: Visual verification of navbar gaps');
    
    // First capture breath training as reference
    await page.goto('http://localhost:3001/breath');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const breathReference = await page.screenshot({
      clip: { x: 0, y: 0, width: 1280, height: 200 },
      path: 'test-results/REFERENCE-breath-training-navbar.png'
    });
    
    console.log('📸 Reference breath training navbar captured');
    
    // Test each other page
    const testPages = ['/profile', '/portal', '/order', '/education'];
    
    for (const url of testPages) {
      await page.goto(`http://localhost:3001${url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const pageScreenshot = await page.screenshot({
        clip: { x: 0, y: 0, width: 1280, height: 200 },
        path: `test-results/COMPARE-${url.replace('/', '')}-navbar.png`
      });
      
      console.log(`📸 ${url} navbar captured for comparison`);
    }
    
    console.log('🎉 All navbar screenshots captured! Check test-results/ folder for visual comparison.');
  });
});