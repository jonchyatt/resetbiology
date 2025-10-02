const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing website on localhost:3000...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📡 Navigating to homepage...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    console.log('📸 Taking homepage screenshot...');
    await page.screenshot({ path: 'homepage-working.png', fullPage: true });
    
    console.log('🔍 Testing login button...');
    await page.click('text=Login');
    
    console.log('📸 Taking auth page screenshot...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'auth-working.png', fullPage: true });
    
    console.log('✅ SUCCESS! Website is working on localhost:3000');
    console.log('🖼️ Screenshots saved: homepage-working.png, auth-working.png');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await page.screenshot({ path: 'error-debug.png' });
  }
  
  console.log('🌐 Browser staying open for your testing...');
  // Keep browser open
  await new Promise(() => {});
})();