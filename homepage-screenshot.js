const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to homepage
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    // Wait a bit for any animations or dynamic content
    await page.waitForTimeout(2000);
    
    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'homepage-recovery-check.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved as homepage-recovery-check.png');
    
    // Get page title for verification
    const title = await page.title();
    console.log('Page title:', title);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();