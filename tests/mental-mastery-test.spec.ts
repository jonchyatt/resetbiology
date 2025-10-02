import { test, expect } from '@playwright/test';

test.describe('Mental Mastery Modules System', () => {
  test('Test Mental Mastery routes and take screenshots', async ({ page }) => {
    // Set a larger viewport for better screenshots
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('Testing Mental Mastery modules system...');

    // Test 1: Check /modules route
    console.log('Testing /modules route...');
    try {
      await page.goto('http://localhost:3001/modules');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Take screenshot of modules page
      await page.screenshot({ 
        path: 'mental-mastery-modules-page.png', 
        fullPage: true 
      });
      
      // Check if page loaded successfully
      const title = await page.title();
      console.log(`Modules page title: ${title}`);
      
      // Look for Mental Mastery content
      const content = await page.textContent('body');
      const hasModulesContent = content?.toLowerCase().includes('mental') || 
                               content?.toLowerCase().includes('mastery') ||
                               content?.toLowerCase().includes('modules');
      console.log(`Has modules content: ${hasModulesContent}`);
      
    } catch (error) {
      console.log(`/modules route error: ${error}`);
      await page.screenshot({ path: 'mental-mastery-modules-error.png' });
    }

    // Test 2: Check /audio route
    console.log('Testing /audio route...');
    try {
      await page.goto('http://localhost:3001/audio');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Take screenshot of audio page
      await page.screenshot({ 
        path: 'mental-mastery-audio-page.png', 
        fullPage: true 
      });
      
      const title = await page.title();
      console.log(`Audio page title: ${title}`);
      
      // Look for audio content
      const content = await page.textContent('body');
      const hasAudioContent = content?.toLowerCase().includes('audio') || 
                             content?.toLowerCase().includes('mental') ||
                             content?.toLowerCase().includes('training');
      console.log(`Has audio content: ${hasAudioContent}`);
      
    } catch (error) {
      console.log(`/audio route error: ${error}`);
      await page.screenshot({ path: 'mental-mastery-audio-error.png' });
    }

    // Test 3: Check portal for Mental Mastery access
    console.log('Testing portal for Mental Mastery access...');
    try {
      await page.goto('http://localhost:3001/portal');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Take screenshot of portal page
      await page.screenshot({ 
        path: 'mental-mastery-portal-page.png', 
        fullPage: true 
      });
      
      const title = await page.title();
      console.log(`Portal page title: ${title}`);
      
      // Look for Mental Mastery access in portal
      const content = await page.textContent('body');
      const hasMentalMasteryAccess = content?.toLowerCase().includes('mental mastery') || 
                                    content?.toLowerCase().includes('audio') ||
                                    content?.toLowerCase().includes('modules');
      console.log(`Portal has Mental Mastery access: ${hasMentalMasteryAccess}`);
      
      // Look for any Mental Mastery related links or buttons
      const mentalLinks = await page.locator('*:has-text("Mental"), *:has-text("Mastery"), *:has-text("Audio")').count();
      console.log(`Mental Mastery related elements found: ${mentalLinks}`);
      
    } catch (error) {
      console.log(`Portal route error: ${error}`);
      await page.screenshot({ path: 'mental-mastery-portal-error.png' });
    }

    // Test 4: Check homepage for Mental Mastery mentions
    console.log('Testing homepage for Mental Mastery mentions...');
    try {
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      // Take screenshot of homepage
      await page.screenshot({ 
        path: 'mental-mastery-homepage.png', 
        fullPage: true 
      });
      
      const content = await page.textContent('body');
      const hasMentalMasteryMentions = content?.toLowerCase().includes('mental mastery');
      console.log(`Homepage mentions Mental Mastery: ${hasMentalMasteryMentions}`);
      
    } catch (error) {
      console.log(`Homepage error: ${error}`);
      await page.screenshot({ path: 'mental-mastery-homepage-error.png' });
    }

    // Create a composite screenshot combining all findings
    console.log('Mental Mastery system testing complete');
  });
});