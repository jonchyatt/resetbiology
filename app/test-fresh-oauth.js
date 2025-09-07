const { test, expect } = require('@playwright/test');

test('Google OAuth Flow Test - Fresh Start', async ({ browser }) => {
  // Create a new context to avoid cookies from previous sessions
  const context = await browser.newContext({
    // Clear any existing data
    storageState: undefined
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Starting fresh OAuth test...');
    
    // Navigate to sign-in page
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Sign-in page loaded');
    
    // Check if Google sign-in button exists
    const googleButton = page.locator('button:has-text("Google")').or(
      page.locator('button:has-text("Sign in with Google")')
    ).or(
      page.locator('[data-provider="google"]')
    );
    
    await expect(googleButton).toBeVisible({ timeout: 5000 });
    console.log('✓ Google sign-in button found');
    
    // Take screenshot before clicking
    await page.screenshot({ path: 'oauth-test-before-click.png', fullPage: true });
    
    // Click Google sign-in - this should redirect to Google
    console.log('Clicking Google sign-in button...');
    await googleButton.click();
    
    // Wait for navigation to Google
    await page.waitForURL('https://accounts.google.com/**', { timeout: 10000 });
    console.log('✓ Redirected to Google OAuth');
    
    // Take screenshot of Google OAuth page
    await page.screenshot({ path: 'google-oauth-page.png', fullPage: true });
    
    console.log('Google OAuth redirect successful!');
    console.log('Current URL:', page.url());
    
    // The redirect is working - the manual OAuth completion needs to be done in browser
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. The OAuth redirect is working correctly');
    console.log('2. Open browser to: http://localhost:3000/auth/signin');
    console.log('3. Click "Sign in with Google" and complete OAuth manually');
    console.log('4. Clear browser cookies first (F12 > Application > Storage > Clear site data)');
    
  } catch (error) {
    console.error('❌ OAuth test failed:', error.message);
    await page.screenshot({ path: 'oauth-test-error.png', fullPage: true });
    throw error;
  } finally {
    await context.close();
  }
});