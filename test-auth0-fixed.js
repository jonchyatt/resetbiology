const { chromium } = require('playwright');

async function testAuth0Fixed() {
  console.log('🔧 Testing Auth0 with correct port configuration...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // Test homepage on correct port
    console.log('📍 Step 1: Testing homepage on port 3002...');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'homepage-port-3002-fixed.png', 
      fullPage: true 
    });
    console.log('✅ Homepage screenshot saved');
    
    // Click login button
    console.log('📍 Step 2: Clicking login button...');
    const loginButton = page.locator('a:has-text("Login")');
    
    if (await loginButton.isVisible()) {
      console.log('✅ Login button found');
      await loginButton.click();
      
      // Wait for Auth0 redirect
      await page.waitForTimeout(5000);
      
      const currentUrl = page.url();
      console.log('Current URL after login click:', currentUrl);
      
      // Take screenshot of Auth0 page
      await page.screenshot({ 
        path: 'auth0-login-fixed.png', 
        fullPage: true 
      });
      console.log('✅ Auth0 page screenshot saved');
      
      if (currentUrl.includes('auth0.com')) {
        console.log('✅ Successfully redirected to Auth0');
        
        // Check for login form
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        
        if (await emailInput.isVisible() && await passwordInput.isVisible()) {
          console.log('✅ Auth0 login form is working correctly');
        } else {
          console.log('❓ Auth0 page loaded but login form not visible');
        }
      } else {
        console.log('❌ Did not redirect to Auth0, URL:', currentUrl);
      }
    } else {
      console.log('❌ Login button not found');
    }
    
    // Test portal protection
    console.log('📍 Step 3: Testing portal protection...');
    await page.goto('http://localhost:3002/portal');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'portal-protection-test.png', 
      fullPage: true 
    });
    
    const portalUrl = page.url();
    console.log('Portal URL:', portalUrl);
    
    if (portalUrl.includes('auth0.com')) {
      console.log('✅ Portal correctly protected - redirects to Auth0');
    } else if (portalUrl.includes('/portal')) {
      console.log('❓ Portal accessible without authentication');
    }
    
    console.log('🎉 Auth0 test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'auth0-test-error-fixed.png', fullPage: true });
  }
  
  console.log('🔍 Browser staying open for inspection...');
  await new Promise(() => {});
}

testAuth0Fixed().catch(console.error);