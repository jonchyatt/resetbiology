const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Homepage screenshot
    console.log('Taking screenshot of homepage...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: 'screenshot-homepage.png', 
      fullPage: true 
    });
    console.log('Homepage screenshot saved as screenshot-homepage.png');

    // Store page screenshot
    console.log('Taking screenshot of store page...');
    await page.goto('http://localhost:3005/store');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: 'screenshot-store.png', 
      fullPage: true 
    });
    console.log('Store page screenshot saved as screenshot-store.png');

    // Individual peptide page screenshot
    console.log('Taking screenshot of TB-500 peptide page...');
    await page.goto('http://localhost:3005/store/tb-500-5mg');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: 'screenshot-tb500.png', 
      fullPage: true 
    });
    console.log('TB-500 page screenshot saved as screenshot-tb500.png');

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();