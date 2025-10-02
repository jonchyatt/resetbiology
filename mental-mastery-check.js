const { chromium } = require('playwright');

(async () => {
  console.log('Starting Mental Mastery modules system test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // Test 1: Check /modules route
    console.log('Testing /modules route...');
    try {
      await page.goto('http://localhost:3001/modules', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'mental-mastery-modules-page.png', fullPage: true });
      
      const title = await page.title();
      console.log(`Modules page title: ${title}`);
      
      const content = await page.textContent('body');
      const hasModulesContent = content?.toLowerCase().includes('mental') || 
                               content?.toLowerCase().includes('mastery') ||
                               content?.toLowerCase().includes('modules');
      console.log(`Has modules content: ${hasModulesContent}`);
      
    } catch (error) {
      console.log(`/modules route error: ${error.message}`);
      await page.screenshot({ path: 'mental-mastery-modules-error.png' });
    }

    // Test 2: Check /audio route
    console.log('Testing /audio route...');
    try {
      await page.goto('http://localhost:3001/audio', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'mental-mastery-audio-page.png', fullPage: true });
      
      const title = await page.title();
      console.log(`Audio page title: ${title}`);
      
      const content = await page.textContent('body');
      const hasAudioContent = content?.toLowerCase().includes('audio') || 
                             content?.toLowerCase().includes('mental') ||
                             content?.toLowerCase().includes('training');
      console.log(`Has audio content: ${hasAudioContent}`);
      
    } catch (error) {
      console.log(`/audio route error: ${error.message}`);
      await page.screenshot({ path: 'mental-mastery-audio-error.png' });
    }

    // Test 3: Check portal for Mental Mastery access
    console.log('Testing portal for Mental Mastery access...');
    try {
      await page.goto('http://localhost:3001/portal', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'mental-mastery-portal-page.png', fullPage: true });
      
      const title = await page.title();
      console.log(`Portal page title: ${title}`);
      
      const content = await page.textContent('body');
      const hasMentalMasteryAccess = content?.toLowerCase().includes('mental mastery') || 
                                    content?.toLowerCase().includes('audio') ||
                                    content?.toLowerCase().includes('modules');
      console.log(`Portal has Mental Mastery access: ${hasMentalMasteryAccess}`);
      
    } catch (error) {
      console.log(`Portal route error: ${error.message}`);
      await page.screenshot({ path: 'mental-mastery-portal-error.png' });
    }

    // Test 4: Check homepage for Mental Mastery mentions
    console.log('Testing homepage for Mental Mastery mentions...');
    try {
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'mental-mastery-homepage.png', fullPage: true });
      
      const content = await page.textContent('body');
      const hasMentalMasteryMentions = content?.toLowerCase().includes('mental mastery');
      console.log(`Homepage mentions Mental Mastery: ${hasMentalMasteryMentions}`);
      
    } catch (error) {
      console.log(`Homepage error: ${error.message}`);
      await page.screenshot({ path: 'mental-mastery-homepage-error.png' });
    }

    console.log('Mental Mastery system testing complete!');
    
  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await browser.close();
  }
})();