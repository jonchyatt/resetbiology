const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport for consistent screenshots
  await page.setViewportSize({ width: 1200, height: 800 });
  
  try {
    // Screenshot of /order page
    console.log('Taking screenshot of /order page...');
    await page.goto('http://localhost:3001/order');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'order-page-screenshot.png', fullPage: true });
    
    // Screenshot of /breath page
    console.log('Taking screenshot of /breath page...');
    await page.goto('http://localhost:3001/breath');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'breath-page-screenshot.png', fullPage: true });
    
    // Screenshot of /admin page
    console.log('Taking screenshot of /admin page...');
    await page.goto('http://localhost:3001/admin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'admin-page-screenshot.png', fullPage: true });
    
    console.log('All screenshots taken successfully!');
    
  } catch (error) {
    console.error('Error taking screenshots:', error);
  }
  
  await browser.close();
})();
