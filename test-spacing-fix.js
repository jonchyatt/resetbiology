const { chromium } = require('playwright');

async function testSpacingFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    await page.screenshot({ 
      path: 'breath-spacing-fix-attempt.png', 
      fullPage: true 
    });
    
    console.log('✅ Spacing fix screenshot taken for review');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

testSpacingFix();