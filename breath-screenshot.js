const { chromium } = require('playwright');

async function takeBreathScreenshot() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Taking screenshot of breath page...');
    await page.goto('http://localhost:3000/breath');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: 'breath-current-layout.png', 
      fullPage: true 
    });
    console.log('Breath page screenshot saved as breath-current-layout.png');

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ 
      path: 'breath-mobile-layout.png', 
      fullPage: true 
    });
    console.log('Mobile breath page screenshot saved as breath-mobile-layout.png');

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeBreathScreenshot();