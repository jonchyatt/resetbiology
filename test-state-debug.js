const { chromium } = require('playwright');

async function debugState() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  // Log all console messages from the page
  page.on('console', msg => {
    console.log(`PAGE: ${msg.text()}`);
  });
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Add debug logs to the page
    await page.addInitScript(() => {
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        originalConsoleLog(...args);
        // Log to both page and test console
      };
    });
    
    // Override settings
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
      console.log('Test override set:', localStorage.getItem('breath-test-override'));
    });
    
    // Reload to apply settings
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('🔍 Starting with test settings...');
    await page.click('button:has-text("Start Session")');
    
    // Monitor for 10 seconds
    for (let i = 0; i < 20; i++) {
      const breathText = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const allButtons = await page.locator('button').allTextContents();
      const timerVisible = await page.locator('div.font-mono.text-6xl').isVisible();
      
      console.log(`Step ${i}: Breaths=${breathText}, Buttons=${allButtons.join(' | ')}, Timer=${timerVisible}`);
      
      // If we see exhale hold button, great!
      if (allButtons.some(btn => btn.includes('Exhale Hold'))) {
        console.log('🎯 Found exhale hold button!');
        break;
      }
      
      await page.waitForTimeout(500);
    }
    
    await page.screenshot({ path: 'final-debug-state.png' });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

debugState().catch(console.error);