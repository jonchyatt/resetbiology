const { chromium } = require('playwright');

async function testTimerFix() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Quick test settings
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 1000, exhaleMs: 1000 } // 1s each = 2s per breath
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('⏱️ TIMER FIX VERIFICATION');
    console.log('=========================');
    console.log('Expected: Timer HIDDEN during breathing');
    console.log('Expected: Timer 0s→up during exhale hold');
    console.log('Expected: Timer 0s→up during inhale hold\n');
    
    await page.click('button:has-text("Start Session")');
    
    // Phase 1: Check breathing (should be no timer)
    console.log('📍 Phase 1: Breathing phase...');
    await page.waitForTimeout(1000);
    const breathingTimer = await page.locator('div.font-mono.text-6xl').isVisible();
    console.log(`Timer during breathing: ${breathingTimer ? 'VISIBLE (❌ BUG)' : 'HIDDEN (✅ CORRECT)'}`);
    
    // Phase 2: Wait for exhale hold
    console.log('📍 Phase 2: Waiting for exhale hold...');
    await page.waitForSelector('button:has-text("Start Inhale Hold")', { timeout: 10000 });
    
    const exhaleTimer1 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Exhale hold timer at start: ${exhaleTimer1}`);
    
    await page.waitForTimeout(2000);
    const exhaleTimer2 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Exhale hold timer after 2s: ${exhaleTimer2}`);
    
    // Phase 3: Advance to inhale hold
    console.log('📍 Phase 3: Advancing to inhale hold...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    
    const inhaleTimer1 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Inhale hold timer at start: ${inhaleTimer1}`);
    
    await page.waitForTimeout(2000);
    const inhaleTimer2 = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`Inhale hold timer after 2s: ${inhaleTimer2}`);
    
    console.log('\n🎯 ANALYSIS:');
    console.log(`Exhale timer started fresh: ${exhaleTimer1 === '0s' ? '✅' : '❌'}`);
    console.log(`Exhale timer counted up: ${parseInt(exhaleTimer2) > parseInt(exhaleTimer1) ? '✅' : '❌'}`);
    console.log(`Inhale timer started fresh: ${inhaleTimer1 === '0s' ? '✅' : '❌'}`);
    console.log(`Inhale timer counted up: ${parseInt(inhaleTimer2) > parseInt(inhaleTimer1) ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testTimerFix().catch(console.error);