const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Launching browser for manual login...');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser window
    slowMo: 1000 // Slow down for easier interaction
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📱 Navigating to cellularpeptide.com...');
  await page.goto('https://cellularpeptide.com');
  
  console.log('⏳ Please log in manually with your partner credentials...');
  console.log('💡 When you\'re logged in and ready, press Enter in this terminal to continue...');
  
  // Wait for user input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', async (key) => {
    if (key === '\r' || key === '\n' || key.toString() === '\r\n') {
      console.log('✅ Starting scraping process...');
      
      // Continue with scraping after login
      console.log('🔍 Ready to scrape! Browser will stay open...');
      console.log('Press Ctrl+C to close when done.');
    }
    
    if (key.toString() === '\u0003') { // Ctrl+C
      await browser.close();
      process.exit();
    }
  });
  
})().catch(console.error);