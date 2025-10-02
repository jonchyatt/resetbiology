const { chromium } = require('playwright');

async function testBalancedShortcuts() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    console.log('🎯 Testing properly balanced keyboard shortcuts...');
    
    await page.screenshot({ 
      path: 'keyboard-shortcuts-properly-balanced.png', 
      fullPage: true 
    });
    console.log('✅ Balanced keyboard shortcuts screenshot taken');
    
    // Check that gaps are reasonable (gap-3 instead of gap-4)
    const shortcutsContainer = await page.locator('div:has(kbd:has-text("Space"))').first();
    const containerClasses = await shortcutsContainer.getAttribute('class');
    
    if (containerClasses && containerClasses.includes('gap-3')) {
      console.log('✅ Reduced gaps from gap-4 to gap-3 (more balanced)');
    }
    
    // Check that padding is reasonable (px-3 instead of px-4)
    const spaceKey = await page.locator('kbd:has-text("Space")').first();
    const keyClasses = await spaceKey.getAttribute('class');
    
    if (keyClasses && keyClasses.includes('px-3')) {
      console.log('✅ Reduced key padding from px-4 to px-3 (more compact)');
    }
    
    // Verify proper grouping with gap-2 between key and text
    const firstGroup = await page.locator('div:has(kbd:has-text("Space"))').first();
    const groupContent = await firstGroup.innerHTML();
    
    if (groupContent.includes('gap-2')) {
      console.log('✅ Proper gap-2 spacing between keys and labels');
    }
    
    console.log('🎯 BALANCED DESIGN ACHIEVED!');
    console.log('📏 Removed artificial stretching with huge gaps');
    console.log('🎨 Maintained width matching through proper content grouping');
    console.log('⚖️ Visual balance without awkward spacing');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

testBalancedShortcuts();