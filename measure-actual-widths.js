const { chromium } = require('playwright');

async function measureActualWidths() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    console.log('📏 Measuring actual component widths...');
    
    // Measure keyboard shortcuts
    const keyboardShortcuts = await page.locator('div:has(kbd:has-text("Space"))').first();
    const keyboardBox = await keyboardShortcuts.boundingBox();
    
    // Measure How It Works
    const howItWorks = await page.locator('div:has-text("How It Works")').first();
    const howItWorksBox = await howItWorks.boundingBox();
    
    if (keyboardBox && howItWorksBox) {
      console.log(`📏 Keyboard shortcuts width: ${keyboardBox.width}px`);
      console.log(`📏 How It Works width: ${howItWorksBox.width}px`);
      console.log(`📏 Difference: ${Math.abs(keyboardBox.width - howItWorksBox.width)}px`);
      
      // Check if they're in the same grid column (should have same width constraints)
      console.log(`📍 Keyboard shortcuts X: ${keyboardBox.x}px`);
      console.log(`📍 How It Works X: ${howItWorksBox.x}px`);
      
      // The issue: they're in different grid columns so they can have different widths
      // Keyboard shortcuts is in left column, How It Works is in right column
      if (Math.abs(keyboardBox.x - howItWorksBox.x) > 100) {
        console.log('🔍 ISSUE FOUND: Components are in different grid columns!');
        console.log('💡 Grid layout allows different widths per column');
        console.log('🎯 Need to match width through content sizing, not container width');
      }
    }
    
    // Take screenshot to see the awkward gaps
    await page.screenshot({ 
      path: 'keyboard-shortcuts-awkward-gaps.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot taken showing the awkward gaps');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

measureActualWidths();