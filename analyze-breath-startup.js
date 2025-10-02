const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Analyzing breathing app startup page...');
    
    await page.goto('http://localhost:3000/breath');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'breath-startup-analysis.png', 
      fullPage: true 
    });
    
    console.log('✓ Screenshot saved: breath-startup-analysis.png');
    
    // Get page title
    const title = await page.textContent('h2').catch(() => 'Not found');
    console.log('Page Title:', title);
    
    // Check key elements
    const startButton = await page.locator('button:has-text("Start Session")').isVisible().catch(() => false);
    const logo = await page.locator('img[alt*="Reset Biology"]').first().getAttribute('src').catch(() => 'Not found');
    const backLink = await page.locator('text=Back to Portal').isVisible().catch(() => false);
    
    console.log('\n🔍 ANALYSIS RESULTS:');
    console.log('Start Button Visible:', startButton ? '✅ YES' : '❌ NO');
    console.log('Logo Source:', logo);
    console.log('Back to Portal Link:', backLink ? '✅ YES' : '❌ NO');
    
    // Get some styling info
    const orbElement = await page.locator('.w-64.h-64.rounded-full').first();
    const orbVisible = await orbElement.isVisible().catch(() => false);
    console.log('Breath Orb Visible:', orbVisible ? '✅ YES' : '❌ NO');
    
    console.log('\n📊 PROFESSIONAL ASSESSMENT:');
    console.log('Check breath-startup-analysis.png to see the actual appearance!');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    await page.screenshot({ path: 'breath-error.png' });
  } finally {
    await browser.close();
  }
})();