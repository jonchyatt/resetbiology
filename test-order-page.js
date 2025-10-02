const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing order page...');
  
  const browser = await chromium.launch({
    headless: false
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📱 Loading http://localhost:3001/order...');
  await page.goto('http://localhost:3001/order', { waitUntil: 'networkidle' });
  
  // Take screenshot
  await page.screenshot({ path: 'order-page.png' });
  console.log('📸 Screenshot saved as order-page.png');
  
  // Count products
  const productCount = await page.locator('button:has-text("Add to Cart")').count();
  console.log(`✅ Found ${productCount} products on the page`);
  
  // Get first few product names
  const productNames = await page.locator('h3').allTextContents();
  console.log('\n📦 Sample products:');
  productNames.slice(0, 5).forEach(name => {
    if (name) console.log(`  - ${name}`);
  });
  
  // Check filters
  const hasFilters = await page.locator('select').count();
  console.log(`\n🔧 Found ${hasFilters} filter dropdowns`);
  
  // Keep browser open for viewing
  console.log('\n👀 Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();