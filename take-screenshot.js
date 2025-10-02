const { chromium } = require('playwright');

async function takeSessionCompleteScreenshot() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3001/breath', { waitUntil: 'networkidle' });
    
    // Quick session to get to complete screen
    await page.evaluate(() => {
      localStorage.setItem('breath-test-override', JSON.stringify({
        cyclesTarget: 1,
        breathsPerCycle: 2,
        pace: { label: 'Test', inhaleMs: 500, exhaleMs: 500 }
      }));
    });
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    await page.click('button:has-text("Start Session")');
    
    // Fast-forward through session
    await page.waitForSelector('button:has-text("Start Inhale Hold")');
    await page.keyboard.press('Space'); // Start inhale
    await page.waitForTimeout(1000);
    await page.keyboard.press('Space'); // End cycle
    
    // Wait for session complete
    await page.waitForSelector('button:has-text("New Session")');
    
    await page.screenshot({ 
      path: '/home/jonch/session-complete-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved to: /home/jonch/session-complete-screenshot.png');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  await browser.close();
}

takeSessionCompleteScreenshot();