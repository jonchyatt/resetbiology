const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to breath training page
  await page.goto('http://localhost:3003/breath');
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  // Click the settings button
  const settingsButton = await page.waitForSelector('button[title="Session Settings"]', { timeout: 5000 });
  await settingsButton.click();
  
  // Wait to see the modal
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ path: 'breath-settings-modal.png', fullPage: true });
  
  console.log('Screenshot saved as breath-settings-modal.png');
  console.log('Check if the modal is properly centered on screen');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(30000);
  
  await browser.close();
})();