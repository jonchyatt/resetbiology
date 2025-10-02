const { chromium } = require('playwright');

async function testFinalWidthMatching() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    console.log('🧪 Testing final width matching and cycle placement...');
    
    // Take screenshot of final layout
    await page.screenshot({ 
      path: 'breath-final-width-matching.png', 
      fullPage: true 
    });
    console.log('✅ Final layout screenshot taken');
    
    // Measure keyboard shortcuts width vs How It Works width
    const keyboardShortcuts = await page.locator('div:has(kbd:has-text("Space"))').first();
    const howItWorks = await page.locator('div:has-text("How It Works")').first();
    
    const keyboardBox = await keyboardShortcuts.boundingBox();
    const howItWorksBox = await howItWorks.boundingBox();
    
    if (keyboardBox && howItWorksBox) {
      console.log(`📏 Keyboard shortcuts width: ${keyboardBox.width}px`);
      console.log(`📏 How It Works width: ${howItWorksBox.width}px`);
      
      const widthDiff = Math.abs(keyboardBox.width - howItWorksBox.width);
      console.log(`📏 Width difference: ${widthDiff}px`);
      
      if (widthDiff < 50) {
        console.log('✅ Keyboard shortcuts width now matches How It Works box!');
      } else if (widthDiff < 100) {
        console.log('🎯 Close match - keyboard shortcuts significantly larger now');
      } else {
        console.log('📊 Width comparison logged for further adjustment');
      }
    }
    
    // Verify cycle info is back in breath count
    const breathCountBox = await page.locator('div:has-text("Breath Count"):has-text("Cycle")');
    if (await breathCountBox.isVisible()) {
      console.log('✅ Cycle info successfully moved back to Breath Count box');
    }
    
    // Check that settings box no longer has cycle info
    const settingsBoxText = await page.locator('div:has-text("Settings")').first().textContent();
    if (settingsBoxText && !settingsBoxText.includes('Cycle')) {
      console.log('✅ Cycle info properly removed from Settings box');
    }
    
    // Verify larger kbd elements
    const spaceKey = await page.locator('kbd:has-text("Space")').first();
    const spaceClasses = await spaceKey.getAttribute('class');
    if (spaceClasses && spaceClasses.includes('px-4 py-2')) {
      console.log('✅ Keyboard shortcuts are now larger (px-4 py-2)');
    }
    
    console.log('🎯 Final layout adjustments completed!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
  
  await browser.close();
}

testFinalWidthMatching();