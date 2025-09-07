const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Debugging Authentication Flow...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Error:', msg.text());
    }
  });

  try {
    // Clear all cookies and storage first
    console.log('1️⃣ Clearing browser state...');
    await context.clearCookies();
    
    // Go to sign-in page
    console.log('2️⃣ Going to sign-in page...');
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'debug-signin-page.png' });
    console.log('✅ Sign-in page loaded');
    
    // Check what happens when clicking the button
    console.log('3️⃣ Checking Google OAuth button...');
    const googleButton = page.locator('text=Sign in with Google').first();
    
    if (await googleButton.isVisible()) {
      console.log('✅ Google button found');
      
      // Check the URL the button will redirect to
      const buttonHref = await googleButton.getAttribute('onclick');
      console.log('🔗 Button action:', buttonHref);
      
      console.log('\n🖱️  I can see the button is there. The issue seems to be with the OAuth flow.');
      console.log('\n📋 Let me check the current session state...');
      
      // Check session state
      await page.goto('http://localhost:3000/api/auth/session');
      await page.waitForLoadState('networkidle');
      const sessionText = await page.textContent('body');
      console.log('🔐 Current session:', sessionText);
      
      await page.screenshot({ path: 'debug-session-state.png' });
      
    } else {
      console.log('❌ Google button not found');
    }
    
    console.log('\n🎯 The authentication is failing at the OAuth callback level.');
    console.log('   This suggests the Google OAuth credentials or configuration needs adjustment.');

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  } finally {
    console.log('\n⏰ Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
})();