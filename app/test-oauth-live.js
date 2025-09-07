const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Testing Live Google OAuth Integration...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down actions so you can see what's happening
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Navigate to sign-in page
    console.log('1️⃣ Navigating to sign-in page...');
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'oauth-test-before-click.png' });
    console.log('✅ Sign-in page loaded - screenshot saved');

    // Test 2: Check if Google button is clickable
    const googleButton = page.locator('text=Sign in with Google');
    if (await googleButton.isVisible()) {
      console.log('✅ Google OAuth button found and visible');
      console.log('🎯 Ready for you to click! The button should now work with Google.');
      
      // Don't auto-click - let the user do it manually
      console.log('\n🖱️  MANUAL TEST TIME:');
      console.log('   1. Click the "Sign in with Google" button');
      console.log('   2. Complete Google OAuth flow');
      console.log('   3. You should be redirected to the portal');
      console.log('   4. Check your account in the Profile page');
      
      // Keep browser open for manual testing
      console.log('\n⏳ Browser will stay open for 5 minutes for manual testing...');
      await page.waitForTimeout(300000); // 5 minutes
      
    } else {
      console.log('❌ Google OAuth button not found');
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed. Try the OAuth flow manually!');
  }
})();