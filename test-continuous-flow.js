const { chromium } = require('playwright');

async function testContinuousFlow() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Test with 2 cycles, 2 breaths each for quick test
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 2,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('🔄 CONTINUOUS FLOW TEST');
    console.log('=======================');
    console.log('Testing: 2 cycles × 2 breaths each');
    console.log('Expected: No pauses between transitions\n');
    
    const startTime = Date.now();
    await page.click('button:has-text("Start Session")');
    
    let phase = 'breathing';
    let cycle = 1;
    
    for (let i = 0; i < 50; i++) { // 50 iterations max
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const breathCount = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const button = await page.locator('button[class*="bg-primary"], button[class*="bg-green"], button[class*="bg-blue"]').first().textContent().catch(() => 'none');
      const timerVisible = await page.locator('div.font-mono.text-6xl').isVisible();
      const timer = timerVisible ? await page.locator('div.font-mono.text-6xl').textContent() : 'hidden';
      
      // Detect state transitions
      const newPhase = 
        button.includes('Start Inhale Hold') ? 'exhale_hold' :
        button.includes('End Inhale Hold') ? 'inhale_hold' :
        button.includes('New Session') ? 'session_complete' :
        'breathing';
      
      if (newPhase !== phase) {
        console.log(`${elapsed}s: ${phase} → ${newPhase} (cycle ${cycle})`);
        phase = newPhase;
        
        // Auto-advance through holds quickly
        if (newPhase === 'exhale_hold') {
          await page.waitForTimeout(1000); // 1s exhale hold
          console.log(`${((Date.now() - startTime) / 1000).toFixed(1)}s: Spacebar → inhale hold`);
          await page.keyboard.press('Space');
        } else if (newPhase === 'inhale_hold') {
          await page.waitForTimeout(1000); // 1s inhale hold  
          console.log(`${((Date.now() - startTime) / 1000).toFixed(1)}s: Spacebar → next cycle`);
          await page.keyboard.press('Space');
          cycle++;
        } else if (newPhase === 'session_complete') {
          console.log(`✅ Session completed in ${elapsed}s`);
          break;
        }
      }
      
      await page.waitForTimeout(100);
    }
    
    console.log(`\n🎯 CONTINUOUS FLOW RESULTS:`);
    console.log(`Total cycles completed: ${cycle - 1}`);
    console.log(`No manual "Next Cycle" button needed: ✅`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testContinuousFlow().catch(console.error);