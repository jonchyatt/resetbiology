const { chromium } = require('playwright');

async function testQuickWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('breath') || msg.text().includes('hold') || msg.text().includes('timer')) {
      console.log(`BROWSER: ${msg.text()}`);
    }
  });
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Override settings to force quick testing
    console.log('🧪 Overriding settings for rapid testing...');
    await page.evaluate(() => {
      // Hack the React component state for testing
      const root = document.querySelector('[class*="min-h-screen"]');
      if (root && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // Use localStorage to override settings
        localStorage.setItem('breath-test-override', JSON.stringify({
          cyclesTarget: 1,
          breathsPerCycle: 3, // Only 3 breaths for testing
          pace: { label: 'Fast', inhaleMs: 1000, exhaleMs: 1000 } // 1-second pace
        }));
      }
    });
    
    console.log('🚀 Starting session with quick test settings...');
    await page.click('button:has-text("Start Session")');
    
    // Monitor the workflow
    console.log('\n⏱️ Monitoring complete workflow...');
    
    let phase = 'breathing';
    let lastBreathCount = 0;
    
    for (let i = 0; i < 30; i++) { // 30 seconds max
      const breathCount = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const currentBreaths = parseInt(breathCount) || 0;
      
      // Check what state we're in
      const timerVisible = await page.locator('div.font-mono.text-6xl').isVisible();
      const timerValue = timerVisible ? await page.locator('div.font-mono.text-6xl').textContent() : 'hidden';
      
      // Check button states to determine phase
      const exhaleHoldBtn = await page.locator('button:has-text("Start Inhale Hold")').isVisible();
      const inhaleReadyBtn = await page.locator('button:has-text("Start Inhale Hold")').isVisible();
      const inhaleActiveText = await page.locator('text="INHALE HOLD"').isVisible();
      
      if (currentBreaths !== lastBreathCount) {
        console.log(`   Breath ${currentBreaths} completed`);
        lastBreathCount = currentBreaths;
      }
      
      if (exhaleHoldBtn && phase !== 'exhale_hold') {
        console.log(`✅ Auto-transitioned to exhale hold (timer: ${timerValue})`);
        phase = 'exhale_hold';
        
        // Test spacebar advance after 2 seconds
        await page.waitForTimeout(2000);
        console.log('   Testing spacebar advance to inhale ready...');
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);
      } else if (inhaleReadyBtn && !inhaleActiveText && phase !== 'inhale_ready') {
        console.log(`✅ Transitioned to inhale ready (timer: ${timerValue})`);
        phase = 'inhale_ready';
        
        await page.waitForTimeout(1000);
        console.log('   Testing spacebar to start inhale hold...');
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);
      } else if (inhaleActiveText && phase !== 'inhale_active') {
        console.log(`✅ Started inhale hold (timer: ${timerValue})`);
        phase = 'inhale_active';
        
        await page.waitForTimeout(3000); // Hold for 3 seconds
        console.log('   Testing spacebar to end inhale hold...');
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);
        
        break; // Test complete
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Check final result
    const cycleComplete = await page.locator('button:has-text("Next Cycle")').isVisible();
    const sessionComplete = await page.locator('button:has-text("New Session")').isVisible();
    
    console.log(`\n🎯 RESULTS:`);
    console.log(`Cycle completed: ${cycleComplete}`);
    console.log(`Session completed: ${sessionComplete}`);
    
    await page.screenshot({ path: 'workflow-test-result.png', fullPage: true });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testQuickWorkflow().catch(console.error);