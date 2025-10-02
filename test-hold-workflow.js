const { chromium } = require('playwright');

async function testHoldWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 800 });
  const page = await browser.newPage();
  
  console.log('🔄 TESTING HOLD WORKFLOW');
  console.log('========================');
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Start session and end it to get to session complete, then start fresh 
    await page.click('button:has-text("Start Session")');
    await page.waitForTimeout(1000);
    
    // End session to reset
    page.on('dialog', async dialog => await dialog.accept());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Start new session
    await page.click('button:has-text("New Session")');
    await page.waitForTimeout(1000);
    
    console.log('📊 Starting fresh session...');
    
    // Wait for some breathing, then check for manual exhale hold test
    console.log('🫁 Letting some breaths complete...');
    await page.waitForTimeout(8000); // Let 2-3 breaths happen
    
    const breathCount = await page.locator('.text-blue-700').textContent();
    console.log(`Current breaths: ${breathCount}`);
    
    // Check if exhale hold ready button exists (it shouldn't anymore with automatic transition)
    const exhaleReadyBtn = await page.locator('button:has-text("Start Exhale Hold")').isVisible();
    console.log(`Exhale hold ready button visible: ${exhaleReadyBtn}`);
    
    // If exhale ready exists, test the manual workflow
    if (exhaleReadyBtn) {
      console.log('\n🟡 Testing manual exhale hold workflow...');
      await page.click('button:has-text("Start Exhale Hold")');
      await page.waitForTimeout(1000);
      
      // Check if timer appears
      const timer = await page.locator('div.font-mono.text-6xl').isVisible();
      const timerValue = await page.locator('div.font-mono.text-6xl').textContent();
      console.log(`Timer visible in exhale hold: ${timer}, shows: ${timerValue}`);
      
      // Test spacebar advance to inhale hold
      console.log('🔄 Testing spacebar advance to inhale hold...');
      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);
      
      // Check what state we're in now
      const inhaleReady = await page.locator('button:has-text("Start Inhale Hold")').isVisible();
      const inhaleActive = await page.locator('text="INHALE HOLD"').isVisible();
      
      console.log(`Inhale ready button: ${inhaleReady}`);
      console.log(`Inhale hold active: ${inhaleActive}`);
      
      if (inhaleReady) {
        console.log('✅ Correctly transitioned to inhale ready');
        await page.keyboard.press('Space');
        await page.waitForTimeout(1000);
        const inhaleActiveAfter = await page.locator('text="INHALE HOLD"').isVisible();
        console.log(`Inhale hold active after space: ${inhaleActiveAfter}`);
      }
    }
    
    await page.screenshot({ path: 'hold-workflow-test.png', fullPage: true });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

testHoldWorkflow().catch(console.error);