const { chromium } = require('playwright');

async function testSpacebarWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 800 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Override settings for quick test
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('🎯 Testing spacebar workflow...');
    await page.click('button:has-text("Start Session")');
    
    // Wait for exhale hold to appear
    console.log('⏳ Waiting for exhale hold...');
    await page.waitForSelector('button:has-text("Start Inhale Hold")', { timeout: 5000 });
    
    const timerValue1 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`✅ In exhale hold - timer shows: ${timerValue1}`);
    
    // Test spacebar advance
    console.log('🔄 Pressing spacebar to advance...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    const buttonAfterSpace = await page.locator('button[class*="bg-"]').first().textContent();
    const timerValue2 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`After spacebar - Button: "${buttonAfterSpace}", Timer: ${timerValue2}`);
    
    // Check if we're in inhale ready or active
    const inhaleReadyBtn = await page.locator('button:has-text("Start Inhale Hold")').isVisible();
    const inhaleActiveText = await page.locator('text="INHALE HOLD"').isVisible();
    
    console.log(`Inhale ready button: ${inhaleReadyBtn}`);
    console.log(`Inhale active text: ${inhaleActiveText}`);
    
    if (inhaleReadyBtn) {
      console.log('✅ Correctly in inhale ready state');
      console.log('🔄 Pressing spacebar again to start inhale hold...');
      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);
      
      const inhaleActiveAfter = await page.locator('text="INHALE HOLD"').isVisible();
      const timerValue3 = await page.locator('div.font-mono.text-6xl').textContent();
      console.log(`After second spacebar - Inhale active: ${inhaleActiveAfter}, Timer: ${timerValue3}`);
    } else {
      console.log('❌ Skipped to wrong state');
    }
    
    await page.screenshot({ path: 'spacebar-workflow-result.png' });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testSpacebarWorkflow().catch(console.error);