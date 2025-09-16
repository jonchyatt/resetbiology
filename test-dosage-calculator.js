const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to peptides page...');
    await page.goto('http://localhost:3000/peptides');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Taking initial screenshot...');
    await page.screenshot({ path: 'peptide-tracker-initial.png', fullPage: true });

    // Add a peptide protocol first
    console.log('Adding a peptide protocol...');
    await page.click('text=Library');
    await page.waitForTimeout(1000);
    
    // Click "Add to My Protocols" for BPC-157 (first button)
    await page.click('button:has-text("Add to My Protocols")');
    await page.waitForTimeout(1000);
    
    // Go back to current protocols
    await page.click('text=Current');
    await page.waitForTimeout(2000);

    console.log('Taking screenshot with protocol added...');
    await page.screenshot({ path: 'peptide-tracker-with-protocol.png', fullPage: true });

    // Click the Calculator button
    console.log('Opening dosage calculator...');
    await page.click('button:has-text("Calculate")');
    await page.waitForTimeout(3000);

    console.log('Taking calculator screenshot...');
    await page.screenshot({ path: 'dosage-calculator-modal.png', fullPage: true });

    // Test some calculator interactions
    console.log('Testing calculator interactions...');
    
    // Try changing dose value
    await page.fill('input[placeholder*="dose"]', '1.0');
    await page.waitForTimeout(1000);
    
    // Try changing concentration  
    await page.fill('input[placeholder*="concentration"]', '1000');
    await page.waitForTimeout(1000);

    console.log('Taking calculator with values screenshot...');
    await page.screenshot({ path: 'dosage-calculator-with-values.png', fullPage: true });

    console.log('✅ Calculator testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    await page.screenshot({ path: 'calculator-error.png' });
  } finally {
    await browser.close();
  }
})();