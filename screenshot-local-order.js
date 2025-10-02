const { chromium } = require('playwright');

async function screenshotLocalOrder() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to local order page...');
    await page.goto('http://localhost:3002/order', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Take full page screenshot
    console.log('Taking full page screenshot...');
    await page.screenshot({ 
      path: 'local-order-page-full.png', 
      fullPage: true 
    });

    // Take viewport screenshot
    console.log('Taking viewport screenshot...');
    await page.screenshot({ 
      path: 'local-order-page-viewport.png' 
    });

    console.log('Local order page screenshots saved successfully!');
    
  } catch (error) {
    console.error('Error taking local screenshots:', error);
  } finally {
    await browser.close();
  }
}

screenshotLocalOrder().catch(console.error);