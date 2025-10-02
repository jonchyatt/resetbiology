const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to nutrition page...');
    await page.goto('http://localhost:3000/nutrition', { waitUntil: 'networkidle' });
    
    // Wait a moment for the page to fully load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'nutrition-test.png', fullPage: true });
    console.log('Screenshot saved as nutrition-test.png');
    
    // Check if there's an authentication redirect or login form
    const url = page.url();
    console.log('Current URL:', url);
    
    // Check for common auth elements
    const loginButton = await page.locator('text=/login|sign in|authenticate/i').first();
    const loginForm = await page.locator('form').first();
    
    if (await loginButton.isVisible().catch(() => false)) {
      console.log('Login button found - authentication required');
    } else if (await loginForm.isVisible().catch(() => false)) {
      console.log('Login form found - authentication required');
    } else {
      console.log('No obvious authentication elements found');
    }
    
    // Check for nutrition-specific content
    const nutritionContent = await page.locator('text=/nutrition|food|calories|macro|meal/i').first();
    if (await nutritionContent.isVisible().catch(() => false)) {
      console.log('Nutrition-related content found on page');
    } else {
      console.log('No nutrition-specific content found');
    }
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
  } catch (error) {
    console.error('Error accessing nutrition page:', error.message);
    
    // Try to take screenshot even if there was an error
    try {
      await page.screenshot({ path: 'nutrition-test-error.png', fullPage: true });
      console.log('Error screenshot saved as nutrition-test-error.png');
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }
  }
  
  await browser.close();
})();