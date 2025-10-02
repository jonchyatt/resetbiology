const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to localhost:3001/breath...');
    await page.goto('http://localhost:3001/breath');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'breath-training-test.png', fullPage: true });
    console.log('Screenshot saved as breath-training-test.png');
    
    // Look for breath training controls
    const controls = await page.$$('button, input, select');
    console.log(`Found ${controls.length} interactive elements`);
    
    // Try to find start button or similar
    const startButton = await page.$('button:has-text("Start"), button:has-text("Begin"), button:has-text("Play")');
    if (startButton) {
      console.log('Found start button, clicking...');
      await startButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'breath-training-active.png', fullPage: true });
    }
    
    // Check for any breath cycle controls
    const cycleControls = await page.$$('[data-testid*="cycle"], [class*="cycle"], [id*="cycle"]');
    console.log(`Found ${cycleControls.length} cycle-related elements`);
    
    // Check for timer or progress elements
    const timerElements = await page.$$('[data-testid*="timer"], [class*="timer"], [id*="timer"]');
    console.log(`Found ${timerElements.length} timer-related elements`);
    
    // Log any console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Error testing breath training:', error);
    await page.screenshot({ path: 'breath-training-error.png', fullPage: true });
  }
  
  await browser.close();
})();