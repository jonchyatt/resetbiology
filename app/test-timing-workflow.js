const { chromium } = require('playwright');

async function testTimingWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Override settings for testing
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('⏱️ TIMING WORKFLOW TEST');
    console.log('=======================');
    
    await page.click('button:has-text("Start Session")');
    
    // Wait for exhale hold and let it accumulate time
    console.log('📍 Waiting for exhale hold...');
    await page.waitForSelector('button:has-text("Start Inhale Hold")', { timeout: 5000 });
    
    console.log('⏳ Letting exhale hold accumulate time (3 seconds)...');
    await page.waitForTimeout(3000);
    
    const timer1 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Exhale hold timer after 3s: ${timer1}`);
    
    // Advance to inhale ready
    console.log('📍 Advancing to inhale ready...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const timer2 = await page.locator('div.font-mono.text-6xl').textContent();
    const phaseText = await page.locator('span[class*="text-xl"]').textContent();
    console.log(`Inhale ready - Timer: ${timer2}, Phase: "${phaseText}"`);
    
    // Start inhale hold
    console.log('📍 Starting inhale hold...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const timer3 = await page.locator('div.font-mono.text-6xl').textContent();
    const inhaleText = await page.locator('span[class*="text-xl"]').textContent();
    console.log(`Inhale hold started - Timer: ${timer3}, Phase: "${inhaleText}"`);
    
    // Let inhale hold run for 2 seconds
    await page.waitForTimeout(2000);
    const timer4 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Inhale hold after 2s: ${timer4}`);
    
    await page.screenshot({ path: 'timing-test-result.png' });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testTimingWorkflow().catch(console.error);