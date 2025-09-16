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

    console.log('Clicking on Library tab to ensure we see the protocols...');
    const libraryTab = await page.locator('button:has-text("Library")').first();
    if (await libraryTab.isVisible()) {
      await libraryTab.click();
      await page.waitForTimeout(1000);
    }

    console.log('Looking for "Add to My Protocols" button...');
    const addProtocolButton = await page.locator('button:has-text("Add to My Protocols")').first();
    if (await addProtocolButton.isVisible()) {
      console.log('Clicking "Add to My Protocols" button...');
      await addProtocolButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('Looking for dosage calculator modal...');
    // Wait for modal to appear and be visible
    const modal = await page.locator('[role="dialog"], .modal, [data-testid="dosage-calculator-modal"], div:has-text("Dosage Calculator")').first();
    await page.waitForTimeout(3000);

    if (await modal.isVisible()) {
      console.log('Modal found! Looking for sliders to interact with...');
      
      // Try to find and interact with sliders
      const sliders = await page.locator('input[type="range"], .slider-input').all();
      console.log(`Found ${sliders.length} sliders`);
      
      for (let i = 0; i < Math.min(sliders.length, 3); i++) {
        try {
          await sliders[i].fill('75');
          await page.waitForTimeout(300);
          console.log(`Adjusted slider ${i}`);
        } catch (e) {
          console.log(`Could not adjust slider ${i}: ${e.message}`);
        }
      }

      // Wait for calculations to update
      await page.waitForTimeout(2000);
    } else {
      console.log('Modal not visible, taking screenshot of current state...');
    }

    console.log('Taking final screenshot...');
    await page.screenshot({ 
      path: 'final-dosage-calculator-modal.png',
      fullPage: false
    });
    console.log('Screenshot saved as final-dosage-calculator-modal.png');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
    
    // Take a screenshot of current state for debugging
    await page.screenshot({ 
      path: 'calculator-modal-debug.png',
      fullPage: false
    });
    console.log('Debug screenshot saved');
  }

  await browser.close();
})();