const { chromium } = require('playwright');

async function testTimerPattern() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Quick 2-cycle test
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 2,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    console.log('⏱️ TIMER PATTERN TEST');
    console.log('=====================');
    console.log('Expected pattern:');
    console.log('1. Breathing: NO timer');
    console.log('2. Exhale hold: Exhale timer 0→up');
    console.log('3. Inhale hold: Inhale timer 0→up');
    console.log('4. Next cycle: Back to breathing, NO timer\n');
    
    await page.click('button:has-text("Start Session")');
    
    const states = [];
    
    for (let i = 0; i < 40; i++) {
      const breathCount = await page.locator('.text-blue-700').first().textContent().catch(() => '0');
      const button = await page.locator('button[class*="bg-"]').first().textContent().catch(() => 'none');
      const timerVisible = await page.locator('div.font-mono.text-6xl').isVisible();
      const timer = timerVisible ? await page.locator('div.font-mono.text-6xl').textContent() : 'HIDDEN';
      const phase = await page.locator('span[class*="text-xl"]').textContent().catch(() => 'none');
      
      const currentState = {
        step: i,
        breaths: breathCount,
        button: button.replace(/\s+/g, ' ').trim(),
        timer,
        phase: phase.toUpperCase()
      };
      
      // Log state changes
      const lastState = states[states.length - 1];
      if (!lastState || 
          lastState.breaths !== currentState.breaths || 
          lastState.button !== currentState.button ||
          lastState.timer !== currentState.timer) {
        
        console.log(`Step ${i}: Breaths=${currentState.breaths} | Button="${currentState.button}" | Timer=${currentState.timer} | Phase="${currentState.phase}"`);
        states.push(currentState);
        
        // Auto-advance holds after 1.5s
        if (currentState.button === 'Start Inhale Hold') {
          console.log('   🔄 Auto-advancing to inhale hold...');
          await page.waitForTimeout(1500);
          await page.keyboard.press('Space');
        } else if (currentState.button === 'End Inhale Hold (Exhale)') {
          console.log('   🔄 Auto-ending inhale hold...');
          await page.waitForTimeout(1500);
          await page.keyboard.press('Space');
        } else if (currentState.button === 'New Session') {
          console.log('   ✅ Session complete!');
          break;
        }
      }
      
      await page.waitForTimeout(100);
    }
    
    console.log(`\n🎯 TIMER PATTERN ANALYSIS:`);
    console.log('Expected: Breathing→HIDDEN, ExhaleHold→0s+, InhaleHold→0s+');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testTimerPattern().catch(console.error);