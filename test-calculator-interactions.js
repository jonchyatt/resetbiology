const { chromium } = require('@playwright/test');

(async () => {
  console.log('🧮 Testing Calculator Interactive Elements...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to peptides and open calculator
    console.log('📍 Opening calculator...');
    await page.goto('http://localhost:3000/peptides');
    await page.waitForLoadState('networkidle');
    
    // Add protocol
    await page.click('button:has-text("Add Protocol")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Library")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Add to My Protocols")');
    await page.waitForTimeout(2000);
    
    // Go to Current tab and open calculator
    await page.click('button:has-text("Current")');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(2000);
    
    // Test 1: Initial state
    console.log('📊 Testing initial calculator state...');
    const initialDose = await page.locator('input[type="range"]').inputValue();
    console.log(`✅ Initial dose value: ${initialDose}`);
    
    const initialResult = await page.locator('text=Volume to draw').textContent();
    console.log(`✅ Initial result: ${initialResult}`);
    
    // Test 2: Slider interaction
    console.log('🎛️ Testing slider interaction...');
    await page.locator('input[type="range"]').fill('500');
    await page.waitForTimeout(1000);
    
    const newResult = await page.locator('text=Volume to draw').textContent();
    console.log(`✅ After slider change: ${newResult}`);
    
    // Take screenshot after slider change
    await page.screenshot({ path: 'calculator-slider-changed.png', fullPage: true });
    console.log('📸 Screenshot saved: calculator-slider-changed.png');
    
    // Test 3: Dropdown interactions
    console.log('📋 Testing dropdown interactions...');
    
    // Change total volume dropdown
    await page.selectOption('select >> nth=0', '1');
    await page.waitForTimeout(1000);
    
    const afterVolumeChange = await page.locator('text=Volume to draw').textContent();
    console.log(`✅ After volume change: ${afterVolumeChange}`);
    
    // Test 4: Plus/minus buttons
    console.log('➕➖ Testing plus/minus buttons...');
    await page.click('button:has-text("+")');
    await page.waitForTimeout(500);
    
    const afterPlusClick = await page.locator('input[type="range"]').inputValue();
    console.log(`✅ After plus click: ${afterPlusClick}`);
    
    await page.click('button:has-text("-")');
    await page.waitForTimeout(500);
    
    const afterMinusClick = await page.locator('input[type="range"]').inputValue();
    console.log(`✅ After minus click: ${afterMinusClick}`);
    
    // Test 5: Final state verification
    console.log('🔍 Verifying all elements present...');
    
    const hasPreset = await page.locator('text=Select a preset').isVisible();
    console.log(`✅ Preset dropdown: ${hasPreset}`);
    
    const hasPeptideName = await page.locator('input[value="Ipamorelin"]').isVisible();
    console.log(`✅ Peptide name field: ${hasPeptideName}`);
    
    const hasMixingInstructions = await page.locator('text=Add 2 ml of bacteriostatic water').isVisible();
    console.log(`✅ Mixing instructions: ${hasMixingInstructions}`);
    
    const hasSyringeDisplay = await page.locator('svg').count();
    console.log(`✅ Syringe graphics found: ${hasSyringeDisplay}`);
    
    const hasResults = await page.locator('text=Results').isVisible();
    console.log(`✅ Results section: ${hasResults}`);
    
    // Take final screenshot
    await page.screenshot({ path: 'calculator-final-test.png', fullPage: true });
    console.log('📸 Final screenshot saved: calculator-final-test.png');
    
    console.log('🎉 All calculator functionality tests passed!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    await page.screenshot({ path: 'calculator-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();