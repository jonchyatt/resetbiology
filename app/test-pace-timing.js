const { chromium } = require('playwright');

async function testPaceTiming() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Set 1-second pace (1000ms each phase)
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 5, // 5 breaths to measure
        pace: { label: 'Test', inhaleMs: 1000, exhaleMs: 1000 } // 1 second each
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('⏱️ PACE TIMING TEST');
    console.log('===================');
    console.log('Settings: 1000ms inhale, 1000ms exhale (2s per breath)');
    console.log('Expected time for 5 breaths: 10 seconds');
    console.log('');
    
    const startTime = Date.now();
    await page.click('button:has-text("Start Session")');
    
    let lastBreathCount = 0;
    let breathTimestamps = [];
    
    // Monitor breath progression
    for (let i = 0; i < 60; i++) { // 60 seconds max
      const breathText = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const currentBreaths = parseInt(breathText) || 0;
      const elapsed = (Date.now() - startTime) / 1000;
      
      if (currentBreaths !== lastBreathCount) {
        breathTimestamps.push({ breath: currentBreaths, time: elapsed });
        console.log(`Breath ${currentBreaths} completed at ${elapsed.toFixed(1)}s`);
        lastBreathCount = currentBreaths;
        
        if (currentBreaths >= 5) {
          console.log(`\n📊 TIMING ANALYSIS:`);
          console.log(`Total time for 5 breaths: ${elapsed.toFixed(1)}s`);
          console.log(`Average per breath: ${(elapsed / 5).toFixed(1)}s`);
          console.log(`Expected: 2.0s per breath`);
          console.log(`Accuracy: ${(2.0 / (elapsed / 5) * 100).toFixed(1)}%`);
          break;
        }
      }
      
      await page.waitForTimeout(100);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testPaceTiming().catch(console.error);