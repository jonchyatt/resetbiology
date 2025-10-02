const { chromium } = require('playwright');

async function takeCurrentSpacingScreenshot() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    await page.screenshot({ 
      path: 'breath-current-spacing-issues.png', 
      fullPage: true 
    });
    
    console.log('✅ Current spacing screenshot taken');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

takeCurrentSpacingScreenshot();