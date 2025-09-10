const { chromium } = require('playwright');

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log('Taking screenshot of homepage...');
    // Screenshot 1: Homepage
    await page.goto('http://localhost:3004');
    await page.waitForTimeout(3000); // Wait for page to load
    await page.screenshot({ path: 'screenshot-homepage.png', fullPage: true });
    console.log('✓ Homepage screenshot saved as screenshot-homepage.png');
    
    console.log('Taking screenshot of store page...');
    // Screenshot 2: Store page
    await page.goto('http://localhost:3004/store');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-store.png', fullPage: true });
    console.log('✓ Store page screenshot saved as screenshot-store.png');
    
    console.log('Taking screenshot of individual peptide page...');
    // Screenshot 3: Individual peptide page
    await page.goto('http://localhost:3004/store/tb-500-5mg');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-tb500-page.png', fullPage: true });
    console.log('✓ TB-500 page screenshot saved as screenshot-tb500-page.png');
    
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots();