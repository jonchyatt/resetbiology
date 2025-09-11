const { chromium } = require('playwright');

async function testHorizontalButtons() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
    
    // Start a session to see the horizontal buttons
    const startButton = await page.locator('button:has-text("Start Session")');
    await startButton.click();
    
    // Wait for session to start and buttons to appear
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'breath-horizontal-buttons-verification.png', 
      fullPage: true 
    });
    
    console.log('✅ Horizontal button layout screenshot taken');
    
    // Check if pause and end session buttons are on same line
    const pauseButton = await page.locator('button:has-text("Pause")');
    const endButton = await page.locator('button:has-text("End Session")');
    
    const pauseBox = await pauseButton.boundingBox();
    const endBox = await endButton.boundingBox();
    
    if (pauseBox && endBox) {
      const heightDifference = Math.abs(pauseBox.y - endBox.y);
      if (heightDifference < 10) {
        console.log('✅ Pause and End Session buttons are on the same horizontal line');
      } else {
        console.log('❌ Buttons may not be properly aligned horizontally');
      }
      console.log(`📍 Pause button Y: ${pauseBox.y}, End button Y: ${endBox.y}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

testHorizontalButtons();