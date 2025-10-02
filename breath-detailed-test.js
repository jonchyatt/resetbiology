const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to localhost:3001/breath...');
    await page.goto('http://localhost:3001/breath');
    await page.waitForTimeout(2000);
    
    // Test the settings panel
    console.log('Testing settings panel...');
    const settingsButton = await page.$('button:has-text("Settings"), [data-testid="settings"]');
    if (settingsButton) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'breath-settings.png', fullPage: true });
    }
    
    // Check for pace settings
    const paceOptions = await page.$$('select option, button:has-text("Slow"), button:has-text("Medium"), button:has-text("Fast")');
    console.log(`Found ${paceOptions.length} pace-related options`);
    
    // Test keyboard controls
    console.log('Testing keyboard controls...');
    await page.keyboard.press('Space');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'breath-after-space.png', fullPage: true });
    
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'breath-after-p.png', fullPage: true });
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Test breath count interaction
    const breathCountElement = await page.$('[data-testid="breath-count"], .breath-count');
    if (breathCountElement) {
      const breathCountText = await breathCountElement.textContent();
      console.log('Breath count:', breathCountText);
    }
    
    // Test cycle information
    const cycleElement = await page.$('[data-testid="cycle"], .cycle');
    if (cycleElement) {
      const cycleText = await cycleElement.textContent();
      console.log('Cycle info:', cycleText);
    }
    
    // Look for any animations or visual feedback
    const orb = await page.$('.orb, [data-testid="breathing-orb"]');
    if (orb) {
      const orbStyles = await orb.evaluate(el => getComputedStyle(el).transform);
      console.log('Orb transform:', orbStyles);
    }
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Error in detailed testing:', error);
  }
  
  await browser.close();
})();