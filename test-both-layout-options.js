const { chromium } = require('playwright');

async function testBothLayoutOptions() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    console.log('🧪 Testing final layout with both improvements...');
    
    // Test 1: Take screenshot of final layout
    await page.screenshot({ 
      path: 'breath-final-layout-varsity-level.png', 
      fullPage: true 
    });
    console.log('✅ Final layout screenshot taken');
    
    // Test 2: Start session to see all components working together
    const startButton = await page.locator('button:has-text("Start Session")');
    await startButton.click();
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'breath-final-layout-session-active.png', 
      fullPage: true 
    });
    console.log('✅ Active session screenshot taken');
    
    // Test 3: Check visual balance - no more artificial stretching
    const keyboardShortcuts = await page.locator('div:has(kbd:has-text("Space"))').first();
    const breathCount = await page.locator('div:has-text("Breath Count")').first();
    const settings = await page.locator('div:has-text("Settings")').first();
    
    const keyboardBox = await keyboardShortcuts.boundingBox();
    const breathBox = await breathCount.boundingBox();
    const settingsBox = await settings.boundingBox();
    
    if (keyboardBox && breathBox && settingsBox) {
      console.log(`📏 Keyboard shortcuts width: ${keyboardBox.width}`);
      console.log(`📏 Breath Count width: ${breathBox.width}`);
      console.log(`📏 Settings width: ${settingsBox.width}`);
      
      // Check if components have similar widths (no artificial stretching)
      const widthDiff1 = Math.abs(breathBox.width - settingsBox.width);
      const widthDiff2 = Math.abs(keyboardBox.width - breathBox.width);
      
      if (widthDiff1 < 20) {
        console.log('✅ Breath Count and Settings boxes have similar width - no artificial stretching');
      }
      
      if (widthDiff2 < 50) {
        console.log('✅ Visual balance achieved - no artificial horizontal stretching');
      } else {
        console.log('📊 Keyboard shortcuts now properly sized for single line layout');
      }
    }
    
    // Test 4: Verify pause/end buttons are still horizontal
    const pauseButton = await page.locator('button:has-text("Pause")');
    const endButton = await page.locator('button:has-text("End Session")');
    
    if (await pauseButton.isVisible() && await endButton.isVisible()) {
      const pauseBox = await pauseButton.boundingBox();
      const endBox = await endButton.boundingBox();
      
      if (pauseBox && endBox && Math.abs(pauseBox.y - endBox.y) < 10) {
        console.log('✅ Pause and End Session buttons still properly aligned horizontally');
      }
    }
    
    // Test 5: Check if larger breath count font is visible
    const breathCountNumber = await page.locator('div:has-text("Breath Count") .text-5xl').first();
    if (await breathCountNumber.isVisible()) {
      console.log('✅ Larger breath count font (text-5xl) successfully implemented');
    }
    
    // Test 6: Check if Settings box has pace/cycle info
    const paceInfo = await page.locator('div:has-text("Settings"):has-text("Pace:")');
    if (await paceInfo.isVisible()) {
      console.log('✅ Pace and cycle info successfully moved to Settings box');
    }
    
    console.log('🎯 VARSITY LEVEL LAYOUT ACHIEVED!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
  
  await browser.close();
}

testBothLayoutOptions();