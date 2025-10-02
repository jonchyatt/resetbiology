const { chromium } = require('playwright');

async function takePortalScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:3002/portal', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit more for any dynamic content to load
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: './portal-fixed-numbers.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved as portal-fixed-numbers.png');
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
  } finally {
    await browser.close();
  }
}

takePortalScreenshot();