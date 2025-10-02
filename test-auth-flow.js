const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Testing authentication flow...');
    await page.goto('http://localhost:3000/nutrition', { waitUntil: 'networkidle' });
    
    // Check if already authenticated by looking for user-specific content
    const loginButton = await page.locator('text="Login"').first();
    
    if (await loginButton.isVisible()) {
      console.log('User not authenticated - testing login flow');
      
      // Click the login button
      await loginButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot of login process
      await page.screenshot({ path: 'auth-login-flow.png', fullPage: true });
      console.log('Login flow screenshot saved as auth-login-flow.png');
      
      // Check current URL to see if redirected to Auth0
      const currentUrl = page.url();
      console.log('After clicking login, current URL:', currentUrl);
      
      if (currentUrl.includes('auth0.com')) {
        console.log('✅ Successfully redirected to Auth0 login');
        
        // Look for login form elements
        const emailInput = await page.locator('input[type="email"], input[name="username"], input[name="email"]').first();
        const passwordInput = await page.locator('input[type="password"], input[name="password"]').first();
        
        if (await emailInput.isVisible().catch(() => false)) {
          console.log('✅ Email input field found');
        }
        if (await passwordInput.isVisible().catch(() => false)) {
          console.log('✅ Password input field found');
        }
        
        // Check for social login options
        const googleLogin = await page.locator('text=/google|continue with google/i').first();
        if (await googleLogin.isVisible().catch(() => false)) {
          console.log('✅ Google login option available');
        }
        
      } else if (currentUrl.includes('/api/auth/login')) {
        console.log('✅ Redirected to Auth0 API endpoint');
      } else {
        console.log('⚠️ Unexpected redirect URL:', currentUrl);
      }
      
    } else {
      console.log('User appears to be already authenticated');
      
      // Look for logout or profile options
      const profileButton = await page.locator('text=/profile|logout|account/i').first();
      if (await profileButton.isVisible().catch(() => false)) {
        console.log('✅ User profile/logout options available');
      }
    }
    
    // Test if nutrition tracker functionality works without authentication
    console.log('Testing nutrition tracker functionality...');
    
    // Go back to nutrition page if we were redirected
    if (!page.url().includes('/nutrition')) {
      await page.goto('http://localhost:3000/nutrition', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
    
    // Test adding food functionality
    const addFoodButton = await page.locator('text="Add Food"').first();
    if (await addFoodButton.isVisible().catch(() => false)) {
      console.log('✅ Add Food button found');
      
      // Try clicking it
      await addFoodButton.click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ path: 'nutrition-add-food.png', fullPage: true });
      console.log('Add food screenshot saved as nutrition-add-food.png');
    }
    
    // Test tab navigation
    const tabs = ['Today', 'History', 'Meal Plans'];
    for (const tab of tabs) {
      const tabButton = await page.locator(`text="${tab}"`).first();
      if (await tabButton.isVisible().catch(() => false)) {
        console.log(`✅ ${tab} tab found and clickable`);
      }
    }
    
  } catch (error) {
    console.error('Error testing authentication flow:', error.message);
    
    try {
      await page.screenshot({ path: 'auth-test-error.png', fullPage: true });
      console.log('Error screenshot saved as auth-test-error.png');
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }
  }
  
  await browser.close();
})();