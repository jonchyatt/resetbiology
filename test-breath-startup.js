const { test, expect } = require('@playwright/test');

test('Breathing App Initial Startup Analysis', async ({ page }) => {
  try {
    console.log('Testing breathing app initial startup...');
    
    // Navigate to breath training page
    await page.goto('http://localhost:3000/breath');
    await page.waitForLoadState('networkidle');
    
    console.log('✓ Breath page loaded');
    
    // Take screenshot of the initial state
    await page.screenshot({ 
      path: 'breath-startup-analysis.png', 
      fullPage: true 
    });
    
    console.log('✓ Screenshot taken: breath-startup-analysis.png');
    
    // Analyze what's visible on the initial page
    const title = await page.textContent('h2');
    console.log('Page Title:', title);
    
    // Check for main elements
    const elements = {
      startButton: await page.locator('button:has-text("Start Session")').isVisible(),
      settingsButton: await page.locator('button[title="Session Settings"]').isVisible(),
      breathOrb: await page.locator('.w-64.h-64.rounded-full').isVisible(),
      instructions: await page.locator('text=How It Works').isVisible(),
      backToPortal: await page.locator('text=Back to Portal').isVisible(),
    };
    
    console.log('\n🔍 VISUAL ELEMENTS ANALYSIS:');
    console.log('Start Session Button:', elements.startButton ? '✓ Visible' : '❌ Missing');
    console.log('Settings Button:', elements.settingsButton ? '✓ Visible' : '❌ Missing');
    console.log('Breath Orb:', elements.breathOrb ? '✓ Visible' : '❌ Missing');
    console.log('Instructions:', elements.instructions ? '✓ Visible' : '❌ Missing');
    console.log('Back to Portal Link:', elements.backToPortal ? '✓ Visible' : '❌ Missing');
    
    // Check for professional branding
    const logo = await page.locator('img[alt*="Reset Biology"]').first();
    const logoSrc = await logo.getAttribute('src');
    console.log('Logo Source:', logoSrc);
    
    // Check overall layout and styling
    const backgroundStyle = await page.locator('.breath-page').first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        background: styles.background || 'none',
        minHeight: styles.minHeight || 'auto'
      };
    });
    
    console.log('\n🎨 STYLING ANALYSIS:');
    console.log('Background:', backgroundStyle.background);
    console.log('Layout Height:', backgroundStyle.minHeight);
    
    // Check for any obvious issues
    const issues = [];
    
    if (!elements.startButton) issues.push('Missing start button');
    if (!elements.backToPortal) issues.push('No clear navigation back');
    if (!logoSrc.includes('reset-logo')) issues.push('Wrong logo being used');
    
    console.log('\n⚠️  POTENTIAL ISSUES:');
    if (issues.length > 0) {
      issues.forEach(issue => console.log('- ' + issue));
    } else {
      console.log('No obvious issues detected');
    }
    
    console.log('\n📊 PROFESSIONAL ASSESSMENT:');
    console.log('The breathing app initial page should have:');
    console.log('1. Clear branding with correct Reset Biology logo');
    console.log('2. Intuitive start button');
    console.log('3. Professional background/styling');
    console.log('4. Clear navigation options');
    console.log('5. Helpful instructions');
    
    console.log('\n🎯 Check the screenshot to see the actual appearance!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'breath-error.png', fullPage: true });
  }
});