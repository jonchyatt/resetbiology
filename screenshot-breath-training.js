const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the breath training page
    await page.goto('http://localhost:3004/breath');
    
    // Wait for the page to fully load
    await page.waitForTimeout(3000);
    
    // Take a full page screenshot
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/app/breath-training-spacing.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved to breath-training-spacing.png');
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
})();