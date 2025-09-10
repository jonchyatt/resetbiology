const { chromium } = require('playwright');

async function testBreathLayoutChanges() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to breath training page
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'breath-layout-after-centering-fix.png', 
      fullPage: true 
    });
    
    console.log('✅ Desktop screenshot taken');
    
    // Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'breath-layout-mobile-after-fix.png', 
      fullPage: true 
    });
    
    console.log('✅ Mobile screenshot taken');
    
    // Test tablet responsiveness
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'breath-layout-tablet-after-fix.png', 
      fullPage: true 
    });
    
    console.log('✅ Tablet screenshot taken');
    
    // Verify the layout elements are in correct positions
    await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
    await page.waitForTimeout(1000);
    
    // Check if keyboard shortcuts are in left column
    const keyboardShortcuts = await page.locator('kbd:has-text("Space")').first();
    const keyboardShortcutsBox = keyboardShortcuts.locator('xpath=ancestor::div[contains(@class, "rounded-xl")]').first();
    const keyboardShortcutsPosition = await keyboardShortcutsBox.boundingBox();
    
    // Check if Start Session is now in center column  
    const startSessionButton = await page.locator('button:has-text("Start Session")').first();
    const startSessionBox = startSessionButton.locator('xpath=ancestor::div[contains(@class, "rounded-xl")]').first();
    const startSessionPosition = await startSessionBox.boundingBox();
    
    console.log('📍 Keyboard shortcuts position:', keyboardShortcutsPosition?.x);
    console.log('📍 Start Session position:', startSessionPosition?.x);
    
    if (keyboardShortcutsPosition && startSessionPosition) {
      if (keyboardShortcutsPosition.x < startSessionPosition.x) {
        console.log('✅ Layout fixed: Keyboard shortcuts are now on the left, Start Session is in center');
      } else {
        console.log('❌ Layout issue: Positions may not be swapped correctly');
      }
    }
    
    // Check centering of left column content
    const leftColumn = await page.locator('.grid-cols-1.lg\\:grid-cols-3 > div').first();
    const leftColumnClasses = await leftColumn.getAttribute('class');
    
    if (leftColumnClasses?.includes('items-center')) {
      console.log('✅ Left column content is centered');
    } else {
      console.log('❌ Left column content may not be centered');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
  
  await browser.close();
}

testBreathLayoutChanges();