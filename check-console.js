const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Checking browser console for debug info...');
  
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    console.log(`🖥️  ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`❌ PAGE ERROR: ${err.message}`);
  });
  
  await page.goto('http://localhost:3001/order');
  await page.waitForTimeout(3000);
  
  // Check what's actually rendered
  const info = await page.evaluate(() => {
    return {
      productCards: document.querySelectorAll('.bg-white.rounded-xl.shadow-lg').length,
      headerText: document.querySelector('h1')?.textContent,
      totalCountText: document.body.innerText.match(/(\d+) products available/)?.[1],
      showingText: document.body.innerText.match(/Showing (\d+) of (\d+) products/),
    };
  });
  
  console.log('\n📊 Page Analysis:');
  console.log(`Header: ${info.headerText}`);
  console.log(`Product cards: ${info.productCards}`);
  console.log(`Total count in header: ${info.totalCountText}`);
  console.log(`Showing text: ${info.showingText ? info.showingText[0] : 'Not found'}`);
  
  await page.waitForTimeout(5000);
  await browser.close();
})();