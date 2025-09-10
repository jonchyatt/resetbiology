const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport size for consistent screenshots
  await page.setViewportSize({ width: 1280, height: 720 });
  
  try {
    console.log('Navigating to breath training page...');
    await page.goto('http://localhost:3001/breath', { 
      waitUntil: 'networkidle', 
      timeout: 10000 
    });
    
    // Wait a moment for any animations or loading
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/breath-app-screenshot.png',
      fullPage: true
    });
    
    console.log('Screenshot saved to: /home/jonch/reset-biology-website/breath-app-screenshot.png');
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
  } finally {
    await browser.close();
  }
})();