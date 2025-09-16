const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // First try port 3001 since that's what the dev server is using
    console.log('Navigating to portal page on port 3001...');
    await page.goto('http://localhost:3001/portal', { waitUntil: 'networkidle' });
    
    // Check if we're redirected to login
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/api/auth/login') || currentUrl.includes('auth0')) {
      console.log('Redirected to login, this means auth is working but we need to be logged in');
      
      // Let's try to see if there's a way to access portal content or check the homepage for navigation
      console.log('Checking homepage for portal navigation...');
      await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    }
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'portal-navigation-test.png', 
      fullPage: true 
    });
    
    // Get page title and check for navigation elements
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for navigation links or cards related to nutrition and workout trackers
    const navigationElements = await page.$$eval('a, button, [role="button"]', elements => 
      elements.map(el => ({
        text: el.textContent?.trim(),
        href: el.href || el.getAttribute('href'),
        className: el.className,
        tagName: el.tagName
      })).filter(el => 
        el.text && (
          el.text.toLowerCase().includes('nutrition') ||
          el.text.toLowerCase().includes('workout') ||
          el.text.toLowerCase().includes('fitness') ||
          el.text.toLowerCase().includes('exercise') ||
          el.text.toLowerCase().includes('meal') ||
          el.text.toLowerCase().includes('food') ||
          el.text.toLowerCase().includes('diet')
        )
      )
    );
    
    console.log('Navigation elements found related to nutrition/workout:');
    console.log(JSON.stringify(navigationElements, null, 2));
    
    // Also look for any cards or sections that might contain these features
    const cards = await page.$$eval('[class*="card"], .card, [class*="section"], .section', elements =>
      elements.map(el => ({
        text: el.textContent?.trim().substring(0, 200),
        className: el.className
      })).filter(el => 
        el.text && (
          el.text.toLowerCase().includes('nutrition') ||
          el.text.toLowerCase().includes('workout') ||
          el.text.toLowerCase().includes('fitness') ||
          el.text.toLowerCase().includes('exercise') ||
          el.text.toLowerCase().includes('meal') ||
          el.text.toLowerCase().includes('food')
        )
      )
    );
    
    console.log('Card sections found related to nutrition/workout:');
    console.log(JSON.stringify(cards, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Try the alternative port
    console.log('Trying alternative port 3001...');
    await page.goto('http://localhost:3001/portal', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'portal-navigation-test.png', 
      fullPage: true 
    });
    
    const title = await page.title();
    console.log('Page title on port 3001:', title);
  }
  
  await browser.close();
  console.log('Screenshot saved as portal-navigation-test.png');
})();