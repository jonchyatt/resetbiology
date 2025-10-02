const { chromium } = require('playwright');

async function testBreathFunctionality() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    console.log('🧪 Testing breath training functionality after layout changes...');
    
    // Test that Start Session button works
    const startButton = await page.locator('button:has-text("Start Session")');
    await startButton.click();
    
    console.log('✅ Start Session button clicked');
    
    // Wait for session to start
    await page.waitForTimeout(2000);
    
    // Check if session is active by looking for pause button
    const pauseButton = await page.locator('button:has-text("Pause")');
    const isPauseVisible = await pauseButton.isVisible();
    
    if (isPauseVisible) {
      console.log('✅ Session started successfully - Pause button is visible');
    } else {
      console.log('❌ Session may not have started - Pause button not found');
    }
    
    // Test keyboard shortcuts still work
    await page.keyboard.press('KeyP'); // Pause
    await page.waitForTimeout(1000);
    
    const resumeButton = await page.locator('button:has-text("Resume")');
    const isResumeVisible = await resumeButton.isVisible();
    
    if (isResumeVisible) {
      console.log('✅ Keyboard shortcut (P) works - session paused');
    } else {
      console.log('❌ Keyboard shortcut may not work');
    }
    
    // Test Space key advancement
    await page.keyboard.press('Space'); // Resume
    await page.waitForTimeout(1000);
    
    const isPauseVisibleAgain = await pauseButton.isVisible();
    if (isPauseVisibleAgain) {
      console.log('✅ Space key works - session resumed');
    }
    
    // Test settings functionality 
    const settingsButton = await page.locator('button[title*="Settings"], button:has-text("⚙")').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      console.log('✅ Settings button accessible and working');
    }
    
    // End session for cleanup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Handle confirmation dialog if it appears
    page.on('dialog', async (dialog) => {
      console.log('Dialog appeared:', dialog.message());
      await dialog.accept();
    });
    
    await page.screenshot({ 
      path: 'breath-functionality-test-result.png', 
      fullPage: true 
    });
    
    console.log('✅ Functionality test completed');
    
  } catch (error) {
    console.error('❌ Error during functionality test:', error);
  }
  
  await browser.close();
}

testBreathFunctionality();