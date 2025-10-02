const { chromium } = require('playwright');

async function testDosageCalculatorWorkflow() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();

  try {
    console.log('1. Navigating to peptides page...');
    await page.goto('http://localhost:3000/peptides');
    await page.waitForTimeout(2000);
    
    console.log('2. Clicking Library tab...');
    await page.click('text=Library');
    await page.waitForTimeout(2000);
    
    console.log('3. Looking for Ipamorelin card and Add to My Protocols button...');
    
    // Try to find and click the Add to My Protocols button for Ipamorelin
    const ipamorelin = page.locator('text=Ipamorelin').first();
    await ipamorelin.scrollIntoViewIfNeeded();
    
    // Find the "Add to My Protocols" button (might be in same card container)
    const addButton = page.locator('button:has-text("Add to My Protocols")').first();
    if (await addButton.isVisible()) {
      console.log('Found Add to My Protocols button, clicking...');
      await addButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Add to My Protocols button not found - checking if already added');
    }
    
    console.log('4. Clicking Current tab...');
    await page.click('text=Current');
    await page.waitForTimeout(2000);
    
    console.log('5. Looking for active protocol with Calculate button...');
    
    // Look for any Calculate button in the current protocols
    const calculateButtons = page.locator('button:has-text("Calculate")');
    const calculateCount = await calculateButtons.count();
    
    console.log(`Found ${calculateCount} Calculate buttons`);
    
    if (calculateCount > 0) {
      console.log('6. Clicking Calculate button...');
      await calculateButtons.first().click();
      await page.waitForTimeout(2000);
      
      console.log('7. Taking screenshot of dosage calculator modal...');
      await page.screenshot({ 
        path: 'dosage-calculator-modal-working.png', 
        fullPage: true 
      });
      
      console.log('Screenshot saved as dosage-calculator-modal-working.png');
      
      // Check if modal is visible
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]');
      const modalVisible = await modal.isVisible();
      console.log(`Modal visible: ${modalVisible}`);
      
    } else {
      console.log('No Calculate buttons found on active protocols');
      
      // Take screenshot of current state
      await page.screenshot({ 
        path: 'current-protocols-no-calculate.png', 
        fullPage: true 
      });
      console.log('Screenshot saved as current-protocols-no-calculate.png');
    }
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ 
      path: 'dosage-calculator-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
}

testDosageCalculatorWorkflow();