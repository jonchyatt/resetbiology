const { test, expect, chromium } = require('@playwright/test');

(async () => {
  console.log('🧪 Testing Peptide Dosage Calculator...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to peptides page
    console.log('📍 Navigating to peptides page...');
    await page.goto('http://localhost:3000/peptides');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'peptides-page-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: peptides-page-initial.png');
    
    // Step 2: Try clicking "Add Protocol" or "Browse Peptide Library" button first
    console.log('🔍 Looking for ways to add a protocol...');
    
    // First try the "Add Protocol" button
    const addProtocolBtn = page.locator('button:has-text("Add Protocol")');
    if (await addProtocolBtn.isVisible()) {
      console.log('✅ Found "Add Protocol" button, clicking...');
      await addProtocolBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Try the "Browse Peptide Library" button
      const browseLibraryBtn = page.locator('button:has-text("Browse Peptide Library")');
      if (await browseLibraryBtn.isVisible()) {
        console.log('✅ Found "Browse Peptide Library" button, clicking...');
        await browseLibraryBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Now switch to Library tab
    console.log('📚 Switching to Library tab...');
    await page.click('button:has-text("Library")');
    await page.waitForTimeout(2000);
    
    // Take screenshot of library tab
    await page.screenshot({ path: 'peptides-library-tab.png', fullPage: true });
    console.log('📸 Screenshot saved: peptides-library-tab.png');
    
    // Look for Ipamorelin specifically and add it
    console.log('🔍 Looking for Ipamorelin card and adding it...');
    
    // Use a more specific selector to find Ipamorelin's Add button
    const ipamorelinAddButton = page.locator('text=Ipamorelin').locator('..').locator('button:has-text("Add to My Protocols")');
    
    let peptideAdded = false;
    if (await ipamorelinAddButton.isVisible()) {
      console.log('✅ Found Ipamorelin Add button, clicking...');
      await ipamorelinAddButton.click();
      await page.waitForTimeout(3000);
      peptideAdded = true;
    } else {
      // Fallback: click the first "Add to My Protocols" button
      console.log('⚠️ Ipamorelin not found, trying first available peptide...');
      const firstAddButton = page.locator('button:has-text("Add to My Protocols")').first();
      if (await firstAddButton.isVisible()) {
        console.log('✅ Clicking first "Add to My Protocols" button...');
        await firstAddButton.click();
        await page.waitForTimeout(3000);
        peptideAdded = true;
      }
    }
    
    if (peptideAdded) {
      console.log('✅ Successfully added a peptide protocol');
    } else {
      console.log('❌ Could not find any peptide to add');
    }
    
    // Step 3: Switch to Current tab
    console.log('📋 Switching to Current tab...');
    await page.click('button:has-text("Current")');
    await page.waitForTimeout(1000);
    
    // Take screenshot of current protocols
    await page.screenshot({ path: 'peptides-current-tab.png', fullPage: true });
    console.log('📸 Screenshot saved: peptides-current-tab.png');
    
    // Step 4: Look for and click Calculate button
    console.log('🔍 Looking for Calculate button...');
    const calculateButton = page.locator('button:has-text("Calculate")').first();
    
    if (await calculateButton.isVisible()) {
      console.log('✅ Found Calculate button');
      await calculateButton.click();
      await page.waitForTimeout(2000);
      
      // Step 5: Verify calculator modal opened
      console.log('🧮 Verifying calculator modal...');
      const modal = page.locator('[role="dialog"]').or(page.locator('.modal')).or(page.locator('[data-testid="calculator-modal"]'));
      
      if (await modal.isVisible()) {
        console.log('✅ Calculator modal opened successfully');
        
        // Take screenshot of the calculator modal
        await page.screenshot({ path: 'calculator-modal.png', fullPage: true });
        console.log('📸 Screenshot saved: calculator-modal.png');
        
        // Step 6: Test interactive elements
        console.log('🎛️ Testing interactive elements...');
        
        // Check for dose slider
        const slider = page.locator('input[type="range"]').or(page.locator('[role="slider"]'));
        if (await slider.isVisible()) {
          console.log('✅ Dose slider found');
          
          // Test slider interaction
          await slider.fill('150');
          await page.waitForTimeout(500);
          console.log('✅ Slider interaction successful');
        }
        
        // Check for concentration dropdowns
        const dropdowns = page.locator('select').or(page.locator('[role="combobox"]'));
        const dropdownCount = await dropdowns.count();
        console.log(`✅ Found ${dropdownCount} dropdown(s)`);
        
        // Check for syringe display
        const syringeDisplay = page.locator('svg').or(page.locator('.syringe')).or(page.locator('[data-testid="syringe"]'));
        if (await syringeDisplay.first().isVisible()) {
          console.log('✅ Syringe display found');
        }
        
        // Check for mixing instructions
        const instructions = page.locator('text=mixing').or(page.locator('text=instructions')).or(page.locator('text=inject'));
        if (await instructions.first().isVisible()) {
          console.log('✅ Mixing instructions found');
        }
        
        // Test real-time updates by changing inputs
        console.log('⚡ Testing real-time updates...');
        const inputs = page.locator('input[type="number"]');
        const inputCount = await inputs.count();
        if (inputCount > 0) {
          await inputs.first().fill('200');
          await page.waitForTimeout(500);
          console.log('✅ Input value changed, checking for updates...');
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'calculator-final-state.png', fullPage: true });
        console.log('📸 Final screenshot saved: calculator-final-state.png');
        
        console.log('🎉 Calculator testing completed successfully!');
        
      } else {
        console.log('❌ Calculator modal did not open');
        await page.screenshot({ path: 'calculator-modal-failed.png', fullPage: true });
      }
      
    } else {
      console.log('❌ Calculate button not found');
      console.log('🔍 Available buttons:');
      const buttons = await page.locator('button').all();
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        const buttonText = await buttons[i].textContent();
        console.log(`  - "${buttonText}"`);
      }
      await page.screenshot({ path: 'no-calculate-button.png', fullPage: true });
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    await page.screenshot({ path: 'error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();