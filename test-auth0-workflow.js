const { chromium } = require('playwright');

async function testAuth0Workflow() {
  console.log('🚀 Starting Auth0 workflow test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for better visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Navigate to homepage
    console.log('📍 Step 1: Navigating to homepage...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of homepage
    await page.screenshot({ 
      path: 'homepage-auth0-test.png', 
      fullPage: true 
    });
    console.log('✅ Homepage screenshot saved');
    
    // 2. Look for and click login button
    console.log('📍 Step 2: Looking for Login button...');
    
    // Try different possible selectors for login button
    const loginSelectors = [
      'button:has-text("Login")',
      'a:has-text("Login")', 
      'button:has-text("Sign In")',
      'a:has-text("Sign In")',
      '[data-testid="login-button"]',
      '.login-button'
    ];
    
    let loginButton = null;
    for (const selector of loginSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        loginButton = element;
        console.log(`✅ Found login button with selector: ${selector}`);
        break;
      }
    }
    
    if (!loginButton) {
      console.log('❌ No login button found, checking page content...');
      const bodyText = await page.textContent('body');
      console.log('Page contains:', bodyText.substring(0, 500));
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: 'homepage-no-login-debug.png', 
        fullPage: true 
      });
      
      return;
    }
    
    // 3. Click login button
    console.log('📍 Step 3: Clicking login button...');
    await loginButton.click();
    
    // Wait for navigation or Auth0 page
    await page.waitForTimeout(3000);
    
    // Take screenshot after login click
    await page.screenshot({ 
      path: 'after-login-click.png', 
      fullPage: true 
    });
    console.log('✅ Screenshot after login click saved');
    
    // Check if we're on Auth0 login page
    const currentUrl = page.url();
    console.log('Current URL after login click:', currentUrl);
    
    if (currentUrl.includes('auth0.com') || currentUrl.includes('/api/auth/login')) {
      console.log('✅ Successfully navigated to Auth0 login flow');
      
      // Take screenshot of Auth0 page
      await page.screenshot({ 
        path: 'auth0-login-page.png', 
        fullPage: true 
      });
      console.log('✅ Auth0 login page screenshot saved');
      
    } else {
      console.log('❓ Unexpected navigation, current URL:', currentUrl);
    }
    
    // 4. Test portal page (should redirect to login if not authenticated)
    console.log('📍 Step 4: Testing portal page...');
    await page.goto('http://localhost:3000/portal');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'portal-page-test.png', 
      fullPage: true 
    });
    console.log('✅ Portal page screenshot saved');
    
    const portalUrl = page.url();
    console.log('Portal page URL:', portalUrl);
    
    if (portalUrl.includes('auth0.com') || portalUrl.includes('/api/auth/login')) {
      console.log('✅ Portal page correctly redirects to authentication');
    } else if (portalUrl.includes('/portal')) {
      console.log('❓ Portal page accessible without authentication - check ProtectedRoute');
    }
    
    console.log('🎉 Auth0 workflow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during Auth0 test:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'auth0-test-error.png', 
      fullPage: true 
    });
  }
  
  // Keep browser open for manual inspection
  console.log('🔍 Browser will remain open for manual inspection...');
  console.log('Press Ctrl+C to close when done.');
  
  // Wait indefinitely
  await new Promise(() => {});
}

// Run the test
testAuth0Workflow().catch(console.error);