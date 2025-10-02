const { chromium, devices } = require('playwright');

async function testMobileResponsiveness() {
  console.log('🚀 Testing actual available pages for mobile responsiveness...');
  
  const browser = await chromium.launch({ headless: false });
  
  // iPhone 13 configuration
  const iPhone = devices['iPhone 13'];
  
  try {
    // Test 1: Mobile Nutrition Tracker (actual page)
    console.log('📱 Testing nutrition page on mobile...');
    const context1 = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 }
    });
    
    const page1 = await context1.newPage();
    await page1.goto('http://localhost:3001/nutrition');
    await page1.waitForLoadState('networkidle', { timeout: 10000 });
    await page1.screenshot({ 
      path: 'mobile-nutrition.png',
      fullPage: true
    });
    console.log('✅ Mobile nutrition page screenshot saved');
    
    await context1.close();
    
    // Test 2: Mobile Workout Tracker (actual page)
    console.log('💪 Testing workout page on mobile...');
    const context2 = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 }
    });
    
    const page2 = await context2.newPage();
    await page2.goto('http://localhost:3001/workout');
    await page2.waitForLoadState('networkidle', { timeout: 10000 });
    await page2.screenshot({ 
      path: 'mobile-workout.png',
      fullPage: true
    });
    console.log('✅ Mobile workout page screenshot saved');
    
    await context2.close();
    
    // Test 3: Mobile Breath Training (already working)
    console.log('🫁 Testing breath training on mobile...');
    const context3 = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 }
    });
    
    const page3 = await context3.newPage();
    await page3.goto('http://localhost:3001/breath');
    await page3.waitForLoadState('networkidle', { timeout: 10000 });
    await page3.screenshot({ 
      path: 'mobile-breath.png',
      fullPage: true
    });
    console.log('✅ Mobile breath training screenshot saved');
    
    await context3.close();
    
    // Test 4: Mobile Portal Overview
    console.log('🏠 Testing portal page on mobile...');
    const context4 = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 }
    });
    
    const page4 = await context4.newPage();
    await page4.goto('http://localhost:3001/portal');
    await page4.waitForLoadState('networkidle', { timeout: 10000 });
    await page4.screenshot({ 
      path: 'mobile-portal.png',
      fullPage: true
    });
    console.log('✅ Mobile portal screenshot saved');
    
    await context4.close();
    
    console.log('🎉 All mobile screenshots completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during mobile testing:', error.message);
  } finally {
    await browser.close();
  }
}

testMobileResponsiveness();