const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching Chromium browser...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  console.log('📱 Opening cellularpeptide.com...');
  await page.goto('https://cellularpeptide.com', { waitUntil: 'networkidle' });
  
  console.log('✅ Browser is open! Please log in manually.');
  console.log('🔐 Use your partner credentials to log in.');
  console.log('📋 Once logged in, come back to the terminal and tell Claude you are ready.');
  
  // Keep the browser open indefinitely
  console.log('🌐 Browser will stay open until you close it manually or press Ctrl+C here.');
  
  // Keep the process alive
  setInterval(() => {
    // Check if page is still alive
    if (page.isClosed()) {
      console.log('Browser closed by user.');
      process.exit(0);
    }
  }, 5000);
  
})().catch((error) => {
  console.error('❌ Error launching browser:', error);
  process.exit(1);
});