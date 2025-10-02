const { chromium } = require('playwright');

async function debugHoldWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Override settings for ultra-fast testing
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2, // Just 2 breaths
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 } // 0.5-second pace
      }));
    });
    
    console.log('🔍 Starting debug session...');
    await page.click('button:has-text("Start Session")');
    
    // Monitor state changes closely
    for (let i = 0; i < 20; i++) {
      const breathText = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const buttonText = await page.locator('button[class*="bg-"]').first().textContent().catch(() => 'none');
      const timerVisible = await page.locator('div.font-mono.text-6xl').isVisible();
      const timerText = timerVisible ? await page.locator('div.font-mono.text-6xl').textContent() : 'hidden';
      
      console.log(`Step ${i}: Breaths=${breathText}, Button="${buttonText}", Timer=${timerText}`);
      
      // Check for exhale hold button
      if (buttonText.includes('Start Exhale Hold') || buttonText.includes('Exhale Hold')) {
        console.log('🎯 Found exhale hold state!');
        await page.screenshot({ path: 'exhale-hold-state.png' });
        break;
      }
      
      await page.waitForTimeout(600);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-state.png' });
  }
  
  await browser.close();
}

debugHoldWorkflow().catch(console.error);