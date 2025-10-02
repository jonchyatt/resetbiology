const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testAuth0Login() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Testing Auth0 Login Functionality...\n');
    
    // Navigate to homepage
    console.log('1. Navigating to homepage...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot of homepage
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/auth0-homepage.png',
      fullPage: true 
    });
    console.log('✓ Homepage loaded and screenshot taken');
    
    // Check for login button in navigation
    console.log('\n2. Looking for Login button in navigation...');
    const loginButton = await page.locator('text=Login').first();
    
    if (await loginButton.isVisible()) {
      console.log('✓ Login button found in navigation');
      
      // Take screenshot before clicking
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/auth0-before-login-click.png',
        fullPage: true 
      });
      
      // Click the login button
      console.log('\n3. Clicking Login button...');
      await loginButton.click();
      await page.waitForTimeout(3000);
      
      // Check what happened after clicking
      const currentUrl = page.url();
      console.log(`Current URL after login click: ${currentUrl}`);
      
      // Take screenshot after clicking
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/auth0-after-login-click.png',
        fullPage: true 
      });
      
      // Check for different possible outcomes
      if (currentUrl.includes('auth0.com')) {
        console.log('✅ SUCCESS: Redirected to Auth0 login page!');
        
        // Take screenshot of Auth0 page
        await page.screenshot({ 
          path: '/home/jonch/reset-biology-website/screenshots/auth0-login-page.png',
          fullPage: true 
        });
        
      } else if (currentUrl.includes('localhost:3002')) {
        // Check if we're on a 404 page
        const pageContent = await page.textContent('body');
        if (pageContent.includes('404') || pageContent.includes('Not Found')) {
          console.log('❌ ERROR: Login redirected to 404 page');
          console.log('This indicates the /api/auth/login route is not working');
        } else {
          console.log('ℹ️  Stayed on localhost - checking page content...');
          console.log('Page title:', await page.title());
        }
      } else {
        console.log(`ℹ️  Redirected to unexpected URL: ${currentUrl}`);
      }
      
    } else {
      console.log('❌ Login button not found in navigation');
    }
    
    // Test the API endpoint directly
    console.log('\n4. Testing /api/auth/login endpoint directly...');
    try {
      await page.goto('http://localhost:3002/api/auth/login', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const apiUrl = page.url();
      console.log(`API endpoint result URL: ${apiUrl}`);
      
      // Take screenshot of API endpoint result
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/screenshots/auth0-api-endpoint-test.png',
        fullPage: true 
      });
      
      if (apiUrl.includes('auth0.com')) {
        console.log('✅ SUCCESS: /api/auth/login redirects to Auth0!');
      } else {
        const pageContent = await page.textContent('body');
        if (pageContent.includes('404') || pageContent.includes('Not Found')) {
          console.log('❌ ERROR: /api/auth/login returns 404');
        } else {
          console.log('ℹ️  /api/auth/login returned unexpected content');
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR testing API endpoint: ${error.message}`);
    }
    
    // Check console logs for errors
    console.log('\n5. Checking browser console for errors...');
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });
    
    console.log('\n📋 Test Summary:');
    console.log('- Homepage loading: ✓');
    console.log('- Auth0 configuration: Testing complete');
    console.log('- Screenshots saved to screenshots/ directory');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take screenshot of error state
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/screenshots/auth0-error-state.png',
      fullPage: true 
    });
  }
  
  await browser.close();
}

// Create screenshots directory if it doesn't exist
const screenshotsDir = '/home/jonch/reset-biology-website/screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

testAuth0Login().catch(console.error);