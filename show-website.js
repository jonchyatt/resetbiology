const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('🌐 Navigating to website...');
  await page.goto('http://localhost:3003');
  
  console.log('📸 Taking homepage screenshot...');
  await page.screenshot({ path: 'homepage-current.png', fullPage: true });
  
  console.log('🔍 Testing login button...');
  await page.click('text=Login');
  
  console.log('📸 Taking Auth0 login page screenshot...');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'auth0-login-current.png', fullPage: true });
  
  console.log('✅ Website is working! Check homepage-current.png and auth0-login-current.png');
  console.log('🌐 Browser will stay open for you to interact with the site');
  
  // Keep browser open for user interaction
  console.log('Press Ctrl+C when done testing...');
  await new Promise(() => {}); // Keep alive
})();