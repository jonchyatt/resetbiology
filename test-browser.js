const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Testing browser launch...');
  
  try {
    // Try headless first
    console.log('1️⃣ Trying headless mode...');
    const headlessBrowser = await chromium.launch({ headless: true });
    const page = await headlessBrowser.newPage();
    await page.goto('https://google.com');
    console.log('✅ Headless mode works!');
    await headlessBrowser.close();
    
    // Now try headful
    console.log('\n2️⃣ Trying headed mode with DISPLAY=:0...');
    const headedBrowser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched in headed mode!');
    
    const headedPage = await headedBrowser.newPage();
    await headedPage.goto('https://cellularpeptide.com');
    console.log('✅ Navigated to cellularpeptide.com');
    
    console.log('\n🎉 SUCCESS! Browser is working.');
    console.log('📌 The browser window should be visible now.');
    console.log('⏳ Keeping browser open for 30 seconds...');
    
    await new Promise(resolve => setTimeout(resolve, 30000));
    await headedBrowser.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Make sure you have an X server running (like VcXsrv on Windows)');
    console.error('2. Check DISPLAY variable: echo $DISPLAY');
    console.error('3. Try: export DISPLAY=:0');
  }
})();