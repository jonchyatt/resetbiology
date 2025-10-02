const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Opening localhost:3001/order in browser...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  console.log('📱 Navigating to http://localhost:3001/order');
  await page.goto('http://localhost:3001/order');
  
  console.log('✅ Page loaded!');
  console.log('\n📌 The browser is now showing your order page with:');
  console.log('  • All 27 scraped peptides from cellularpeptide.com');
  console.log('  • Prices with 50% markup');
  console.log('  • Search and filter functionality');
  console.log('  • Protocol information');
  console.log('\n👀 You can interact with the page directly in the browser');
  console.log('⏱️  Keeping browser open... Press Ctrl+C when done');
  
  // Keep browser open indefinitely
  await new Promise(() => {});
})();