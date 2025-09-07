const { chromium } = require('playwright');

async function completeAssessmentSignup() {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  
  try {
    console.log('🚀 Starting client signup process...');
    
    // Step 1: Go to assessment
    await page.goto('http://localhost:3001/assessment', { waitUntil: 'networkidle' });
    console.log('✅ Loaded assessment page');
    
    // Step 2: Complete assessment questions
    for (let q = 1; q <= 10; q++) {
      console.log(`📝 Answering question ${q}/10...`);
      
      // Wait for question to load
      await page.waitForSelector('button[class*="bg-gray-50"]', { timeout: 5000 });
      
      // Click first answer option
      const firstOption = await page.locator('button[class*="bg-gray-50"]').first();
      await firstOption.click();
      
      // Wait for next question or completion
      await page.waitForTimeout(1000);
      
      // Check if we've reached the end
      const nextButton = await page.locator('button:has-text("Next")').isVisible();
      const submitButton = await page.locator('button:has-text("Submit")').isVisible();
      
      if (!nextButton && !submitButton && q < 10) {
        console.log('⏭️ Auto-progressed to next question');
      }
    }
    
    console.log('✅ Assessment completed!');
    
    // Step 3: Check for results/signup completion
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Step 4: Try to access portal
    console.log('🔐 Trying to access client portal...');
    await page.goto('http://localhost:3001/portal', { waitUntil: 'networkidle' });
    
    await page.waitForTimeout(2000);
    const portalContent = await page.locator('body').textContent();
    
    if (portalContent.includes('Dashboard') || portalContent.includes('Welcome')) {
      console.log('✅ Successfully accessed client portal!');
    } else {
      console.log('ℹ️ Portal access may require additional authentication');
    }
    
    await page.screenshot({ path: '/home/jonch/client-signup-result.png' });
    console.log('📸 Screenshot saved to: /home/jonch/client-signup-result.png');
    
  } catch (error) {
    console.error('❌ Error during signup:', error.message);
    await page.screenshot({ path: '/home/jonch/signup-error.png' });
  }
  
  console.log('\n🎯 SIGNUP PROCESS COMPLETE');
  console.log('To test Google Drive export:');
  console.log('1. Use the breath training app: http://localhost:3001/breath'); 
  console.log('2. Complete a session');
  console.log('3. Click "Export to Google Drive" button');
  console.log('4. Follow setup instructions for OAuth credentials');
  
  await browser.close();
}

completeAssessmentSignup().catch(console.error);