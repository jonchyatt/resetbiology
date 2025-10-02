const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching browser for manual login...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('📱 Opening cellularpeptide.com...');
  console.log('⏳ Please login manually when the page loads');
  console.log('🔐 The browser will stay open for you to complete login');
  console.log('⌨️  Press Ctrl+C when you are done to close the browser\n');
  
  try {
    await page.goto('https://cellularpeptide.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('✅ Page loaded! Please login now.');
    console.log('📝 After logging in, we can save your cookies for automation.');
    
    // Keep browser open indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.log('Keeping browser open despite any errors...');
    // Still keep browser open
    await new Promise(() => {});
  }
})();