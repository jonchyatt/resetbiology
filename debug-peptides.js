const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Debugging peptide display issue...');
  
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('🖥️  Browser:', msg.text()));
  page.on('pageerror', err => console.log('❌ Error:', err.message));
  
  await page.goto('http://localhost:3001/order');
  
  // Check what data is actually loaded
  const debugInfo = await page.evaluate(() => {
    console.log('Checking peptide data...');
    
    // Try to access the imported data
    const results = {
      totalElements: document.querySelectorAll('*').length,
      productCards: document.querySelectorAll('.bg-white.rounded-xl.shadow-lg').length,
      addToCartButtons: document.querySelectorAll('button:has-text("Add to Cart")').length,
      errorMessages: [],
      consoleErrors: []
    };
    
    // Check if data is available in window
    if (window.peptideData) {
      results.windowData = window.peptideData.length;
    }
    
    // Check for error divs
    const errorDivs = document.querySelectorAll('[class*="error"], .text-red');
    results.errorElements = errorDivs.length;
    
    // Get actual displayed content
    results.displayedText = document.body.innerText.substring(0, 500);
    
    return results;
  });
  
  console.log('\n📊 Debug Results:');
  console.log('='.repeat(40));
  console.log(`Product cards found: ${debugInfo.productCards}`);
  console.log(`Add to Cart buttons: ${debugInfo.addToCartButtons}`);
  console.log(`Error elements: ${debugInfo.errorElements}`);
  console.log(`Total DOM elements: ${debugInfo.totalElements}`);
  
  console.log('\n📝 Page content preview:');
  console.log(debugInfo.displayedText);
  
  // Check the network requests
  console.log('\n🌐 Checking if there are any console errors...');
  
  await page.waitForTimeout(3000);
  await browser.close();
})();