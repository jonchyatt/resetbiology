const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting Google Authentication Test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Homepage loads with sign-in button
    console.log('1️⃣ Testing homepage...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of homepage
    await page.screenshot({ path: 'auth-test-homepage.png' });
    console.log('✅ Homepage loaded - screenshot saved as auth-test-homepage.png');
    
    // Check if sign-in button exists
    const signInButton = await page.locator('text=Sign in with Google').first();
    if (await signInButton.isVisible()) {
      console.log('✅ Google sign-in button found in header');
    } else {
      console.log('❌ Google sign-in button not found');
    }

    // Test 2: Sign-in page
    console.log('\n2️⃣ Testing sign-in page...');
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'auth-test-signin-page.png' });
    console.log('✅ Sign-in page loaded - screenshot saved as auth-test-signin-page.png');

    // Test 3: Protected portal (should redirect to sign-in)
    console.log('\n3️⃣ Testing portal access (should be protected)...');
    await page.goto('http://localhost:3000/portal');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'auth-test-portal-protected.png' });
    
    // Check if we're on sign-in or see protection message
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/signin') || await page.locator('text=Access Required').isVisible()) {
      console.log('✅ Portal is properly protected - requires authentication');
    } else {
      console.log('❌ Portal access issue - check protection logic');
    }

    // Test 4: Profile page (should also be protected)
    console.log('\n4️⃣ Testing profile page protection...');
    await page.goto('http://localhost:3000/auth/profile');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'auth-test-profile-protected.png' });
    
    if (page.url().includes('/auth/signin') || await page.locator('text=Access Required').isVisible()) {
      console.log('✅ Profile page is properly protected');
    } else {
      console.log('❌ Profile page access issue');
    }

    // Test 5: Try clicking Google sign-in button (will need real credentials)
    console.log('\n5️⃣ Testing Google OAuth flow...');
    await page.goto('http://localhost:3000/auth/signin');
    
    const googleButton = await page.locator('text=Sign in with Google');
    if (await googleButton.isVisible()) {
      console.log('✅ Google OAuth button found');
      console.log('⚠️  Note: To complete OAuth test, you need to:');
      console.log('   1. Set up Google OAuth credentials in Google Cloud Console');
      console.log('   2. Update .env.local with your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
      console.log('   3. Then click the button to test the full flow');
      
      // Don't actually click unless we have real credentials
      console.log('\n📝 Current environment check:');
      console.log('   - NEXTAUTH_URL should be: http://localhost:3000');
      console.log('   - GOOGLE_CLIENT_ID should be: your-actual-client-id.googleusercontent.com');
      console.log('   - GOOGLE_CLIENT_SECRET should be: your-actual-secret');
      console.log('   - DATABASE_URL should be: valid PostgreSQL connection string');
      
    } else {
      console.log('❌ Google OAuth button not found');
    }

    console.log('\n🎉 Authentication system structure test completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Follow GOOGLE_OAUTH_SETUP.md to get Google credentials');
    console.log('   2. Update .env.local with real credentials');
    console.log('   3. Set up PostgreSQL database');
    console.log('   4. Run: npx prisma db push');
    console.log('   5. Test full OAuth flow by clicking sign-in button');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();