const { chromium } = require('playwright');

async function testCompleteWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 600 });
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
    
    console.log('🚀 COMPLETE WORKFLOW TEST');
    console.log('========================');
    
    await page.click('button:has-text("Start Session")');
    
    // Phase 1: Wait for exhale hold
    console.log('📍 Phase 1: Waiting for exhale hold...');
    await page.waitForSelector('button:has-text("Start Inhale Hold")', { timeout: 5000 });
    const timer1 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`✅ Exhale hold active - Timer: ${timer1}`);
    
    // Phase 2: Advance to inhale ready
    console.log('📍 Phase 2: Advancing to inhale ready...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const timer2 = await page.locator('div.font-mono.text-6xl').textContent();
    const button2 = await page.locator('button[class*="bg-green"]').textContent();
    console.log(`✅ Inhale ready state - Timer: ${timer2}, Button: "${button2}"`);
    
    // Phase 3: Start inhale hold
    console.log('📍 Phase 3: Starting inhale hold...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const timer3 = await page.locator('div.font-mono.text-6xl').textContent();
    const inhaleActive = await page.locator('text="INHALE HOLD"').isVisible();
    const button3 = await page.locator('button[class*="bg-"]').first().textContent();
    console.log(`✅ Inhale hold active - Timer: ${timer3}, Active: ${inhaleActive}, Button: "${button3}"`);
    
    // Phase 4: End inhale hold
    console.log('📍 Phase 4: Ending inhale hold...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const cycleComplete = await page.locator('button:has-text("Next Cycle")').isVisible();
    const sessionComplete = await page.locator('button:has-text("New Session")').isVisible();
    
    console.log(`\n🎯 FINAL RESULTS:`);
    console.log(`Cycle complete: ${cycleComplete}`);
    console.log(`Session complete: ${sessionComplete}`);
    
    await page.screenshot({ path: 'complete-workflow-result.png' });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-workflow.png' });
  }
  
  await browser.close();
}

testCompleteWorkflow().catch(console.error);