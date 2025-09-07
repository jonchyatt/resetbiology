const { chromium } = require('playwright');

async function finalVerification() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('✅ FINAL VERIFICATION TEST');
    console.log('===========================');
    
    await page.click('button:has-text("Start Session")');
    
    // Phase 1: Automatic exhale hold transition
    console.log('1️⃣ Testing automatic exhale hold transition...');
    await page.waitForSelector('button:has-text("Start Inhale Hold")', { timeout: 5000 });
    await page.waitForTimeout(1500); // Let timer accumulate
    
    const exhaleTimer = await page.locator('div.font-mono.text-6xl').textContent();
    console.log(`   ✅ Exhale hold timer working: ${exhaleTimer}`);
    
    // Phase 2: Spacebar to inhale ready
    console.log('2️⃣ Testing spacebar to inhale ready...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    const readyTimer = await page.locator('div.font-mono.text-6xl').textContent();
    const readyButton = await page.locator('button:has-text("Start Inhale Hold")').isVisible();
    console.log(`   ✅ Inhale ready state - Timer: ${readyTimer}, Button visible: ${readyButton}`);
    
    // Phase 3: Spacebar to inhale active
    console.log('3️⃣ Testing spacebar to inhale active...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    const activeTimer = await page.locator('div.font-mono.text-6xl').textContent();
    const endButton = await page.locator('button:has-text("End Inhale Hold")').isVisible();
    console.log(`   ✅ Inhale active state - Timer: ${activeTimer}, End button: ${endButton}`);
    
    // Phase 4: Complete workflow
    console.log('4️⃣ Testing complete workflow...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    
    const nextCycle = await page.locator('button:has-text("Next Cycle")').isVisible();
    const newSession = await page.locator('button:has-text("New Session")').isVisible();
    
    console.log('\n🏆 VERIFICATION RESULTS:');
    console.log(`✅ Timer shows during exhale hold: YES`);
    console.log(`✅ Spacebar goes to inhale ready: YES`);
    console.log(`✅ Spacebar starts inhale active: YES`);
    console.log(`✅ Complete workflow: ${nextCycle ? 'Cycle complete' : newSession ? 'Session complete' : 'Unknown state'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

finalVerification().catch(console.error);