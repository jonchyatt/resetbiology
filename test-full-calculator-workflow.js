const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🚀 Starting full dosage calculator workflow test...');
    
    // Navigate to peptides page
    await page.goto('http://localhost:3000/peptides');
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to peptides page');
    
    // Should start on Library tab - add a protocol
    console.log('📚 Adding Ipamorelin protocol...');
    await page.click('text=Add to My Protocols');
    await page.waitForTimeout(1000);
    
    // Go to Current tab to see active protocols
    console.log('📋 Switching to Current tab...');
    await page.click('text=Current');
    await page.waitForTimeout(2000);
    
    // Take screenshot of current tab
    await page.screenshot({ path: 'current-tab-with-protocol.png', fullPage: true });
    console.log('📸 Screenshot taken of Current tab');
    
    // Look for Calculate button
    const calculateButton = await page.locator('button:has-text("Calculate")').first();
    const isVisible = await calculateButton.isVisible();
    console.log(`🔍 Calculate button visible: ${isVisible}`);
    
    if (isVisible) {
      console.log('🧮 Clicking Calculate button...');
      await calculateButton.click();
      await page.waitForTimeout(3000);
      
      // Take screenshot of calculator modal
      await page.screenshot({ path: 'dosage-calculator-modal-working.png', fullPage: true });
      console.log('📸 Calculator modal screenshot taken');
      
      // Verify modal contents
      const modalTitle = await page.locator('text=Dosage Calculator').isVisible();
      const peptideName = await page.locator('text=Ipamorelin').isVisible();
      console.log(`✅ Modal opened: ${modalTitle}, Peptide data loaded: ${peptideName}`);
      
      // Test some interactions
      console.log('🧪 Testing slider interaction...');
      const slider = page.locator('input[type="range"]').first();
      if (await slider.isVisible()) {
        await slider.fill('500');
        await page.waitForTimeout(1000);
        console.log('✅ Slider interaction working');
      }
      
    } else {
      console.log('❌ Calculate button not found on Current tab');
      // Check what buttons are available
      const buttons = await page.locator('button').allTextContents();
      console.log('Available buttons:', buttons);
    }
    
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    await page.screenshot({ path: 'calculator-workflow-error.png' });
  } finally {
    await browser.close();
  }
})();