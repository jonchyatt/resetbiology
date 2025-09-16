const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting workout page test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Navigate to workout page
    console.log('📍 Navigating to http://localhost:3000/workout');
    const response = await page.goto('http://localhost:3000/workout', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log(`📊 Response status: ${response.status()}`);
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check if page loaded successfully
    const title = await page.title();
    console.log(`📖 Page title: ${title}`);
    
    // Check for key workout elements
    const workoutElements = await page.evaluate(() => {
      const elements = [];
      
      // Look for workout-specific elements
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean);
      const forms = Array.from(document.querySelectorAll('form')).length;
      const inputs = Array.from(document.querySelectorAll('input')).length;
      
      return {
        headings: headings.slice(0, 5), // First 5 headings
        buttons: buttons.slice(0, 5),   // First 5 buttons
        forms,
        inputs,
        bodyText: document.body.textContent?.substring(0, 200) + '...'
      };
    });
    
    console.log('🏋️ Workout page elements found:');
    console.log('Headings:', workoutElements.headings);
    console.log('Buttons:', workoutElements.buttons);
    console.log('Forms:', workoutElements.forms);
    console.log('Inputs:', workoutElements.inputs);
    console.log('Page content preview:', workoutElements.bodyText);
    
    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ 
      path: '/home/jonch/reset-biology-website/workout-test.png',
      fullPage: true 
    });
    
    console.log('✅ Screenshot saved as workout-test.png');
    
    // Check for any JavaScript errors
    const errors = await page.evaluate(() => {
      return window.errorLog || [];
    });
    
    if (errors.length > 0) {
      console.log('⚠️ JavaScript errors found:', errors);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    
    // Still try to take a screenshot of the error state
    try {
      await page.screenshot({ 
        path: '/home/jonch/reset-biology-website/workout-test-error.png',
        fullPage: true 
      });
      console.log('📸 Error state screenshot saved as workout-test-error.png');
    } catch (screenshotError) {
      console.error('Failed to take error screenshot:', screenshotError.message);
    }
  } finally {
    await browser.close();
    console.log('🏁 Test completed');
  }
})();