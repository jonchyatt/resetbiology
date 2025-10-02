const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to peptides page...');
    await page.goto('http://localhost:3001/peptides', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Looking for Add Protocol button...');
    // Try different selectors for the Add Protocol button
    const addButton = await page.locator('button:has-text("Add Protocol"), button:has-text("Add"), [data-testid="add-protocol"]').first();
    if (await addButton.isVisible()) {
      console.log('Clicking Add Protocol button...');
      await addButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('Looking for Calculate button...');
    // Look for calculate button
    const calculateButton = await page.locator('button:has-text("Calculate"), button:has-text("Dosage Calculator"), [data-testid="calculate-button"]').first();
    if (await calculateButton.isVisible()) {
      console.log('Clicking Calculate button...');
      await calculateButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('Looking for dosage calculator modal...');
    // Wait for modal to be visible
    const modal = await page.locator('[role="dialog"], .modal, [data-testid="dosage-calculator-modal"]').first();
    if (await modal.isVisible()) {
      console.log('Modal is visible, interacting with sliders...');
      
      // Try to interact with sliders to show they're working
      const sliders = await page.locator('input[type="range"], .slider').all();
      if (sliders.length > 0) {
        console.log(`Found ${sliders.length} sliders, adjusting them...`);
        for (let i = 0; i < Math.min(sliders.length, 3); i++) {
          try {
            await sliders[i].fill('75');
            await page.waitForTimeout(500);
          } catch (e) {
            console.log(`Could not adjust slider ${i}`);
          }
        }
      }

      // Wait for calculations to update
      await page.waitForTimeout(1000);
    }

    console.log('Taking final screenshot...');
    await page.screenshot({ 
      path: 'final-dosage-calculator-working.png',
      fullPage: false
    });
    console.log('Screenshot saved as final-dosage-calculator-working.png');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
    
    // Take a screenshot of current state for debugging
    await page.screenshot({ 
      path: 'final-dosage-calculator-debug.png',
      fullPage: false
    });
    console.log('Debug screenshot saved as final-dosage-calculator-debug.png');
  }

  await browser.close();
})();