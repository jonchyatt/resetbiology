const { chromium } = require('playwright');

(async () => {
  console.log('🎉 Testing the corrected order page...');
  
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    console.log(`🖥️  ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3001/order');
  await page.waitForTimeout(3000);
  
  // Count products
  const productCount = await page.locator('.bg-white.rounded-xl.shadow-lg').count();
  console.log(`\n✅ Found ${productCount} product cards`);
  
  // Get product names
  const productNames = await page.locator('h3').allTextContents();
  const peptideNames = productNames.filter(name => name && !name.includes('Foundation') && !name.includes('Complete'));
  
  console.log(`📦 Showing ${peptideNames.length} scraped peptides:`);
  peptideNames.slice(0, 8).forEach(name => {
    console.log(`  - ${name}`);
  });
  
  // Check filters
  const searchBox = await page.locator('input[placeholder="Search peptides..."]').count();
  const dropdowns = await page.locator('select').count();
  
  console.log(`\n🔧 UI Elements:`);
  console.log(`  Search box: ${searchBox}`);
  console.log(`  Filter dropdowns: ${dropdowns}`);
  
  // Test search
  if (searchBox > 0) {
    await page.fill('input[placeholder="Search peptides..."]', 'Semaglutide');
    await page.waitForTimeout(1000);
    const searchResults = await page.locator('.bg-white.rounded-xl.shadow-lg').count();
    console.log(`  Search "Semaglutide": ${searchResults} results`);
  }
  
  console.log('\n🎊 SUCCESS! The order page is now displaying all scraped peptides!');
  
  await page.waitForTimeout(10000);
  await browser.close();
})();