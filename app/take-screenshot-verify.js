const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  // Listen for page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  try {
    console.log('Navigating to http://localhost:3001...');
    
    // Navigate to the site with increased timeout
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/homepage-verification.png', 
      fullPage: true 
    });
    
    console.log('\n=== PAGE TITLE ===');
    console.log(await page.title());
    
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
      if (msg.location && msg.location.url) {
        console.log(`  Location: ${msg.location.url}:${msg.location.lineNumber}`);
      }
    });
    
    console.log('\n=== PAGE ERRORS ===');
    if (pageErrors.length === 0) {
      console.log('No page errors detected! ✅');
    } else {
      pageErrors.forEach(error => {
        console.log(`ERROR: ${error.message}`);
        if (error.stack) {
          console.log(`Stack: ${error.stack}`);
        }
      });
    }
    
    // Check for auth-related errors specifically
    const authErrors = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('auth') || 
      msg.text.toLowerCase().includes('nextauth') ||
      msg.text.toLowerCase().includes('oauth') ||
      msg.text.toLowerCase().includes('google')
    );
    
    console.log('\n=== AUTH-RELATED MESSAGES ===');
    if (authErrors.length === 0) {
      console.log('No authentication-related console messages detected! ✅');
    } else {
      authErrors.forEach(msg => {
        console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
      });
    }
    
    // Get basic page info
    const bodyText = await page.textContent('body');
    const hasNavbar = await page.locator('nav, header').count() > 0;
    const hasHeroSection = bodyText.includes('Reset Biology') || bodyText.includes('Peptide');
    
    console.log('\n=== PAGE STRUCTURE VERIFICATION ===');
    console.log(`Navigation/Header present: ${hasNavbar ? '✅' : '❌'}`);
    console.log(`Hero/Main content present: ${hasHeroSection ? '✅' : '❌'}`);
    console.log(`Page loads successfully: ✅`);
    
    console.log('\n=== SCREENSHOT SAVED ===');
    console.log('Screenshot saved to: /home/jonch/reset-biology-website/homepage-verification.png');
    
  } catch (error) {
    console.error('Error taking screenshot:', error.message);
  }
  
  await browser.close();
})();