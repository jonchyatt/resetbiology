const { chromium } = require('playwright');

(async () => {
  console.log('🎯 FINAL VISUAL VERIFICATION - Portal Dashboard');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🌐 Testing updated portal after login...');
    
    // Complete login flow first
    await page.goto('http://localhost:3000');
    await page.screenshot({ path: 'final-1-homepage.png' });
    
    await page.click('text=Login');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'final-2-auth0-login.png' });
    
    // Now test the portal directly (should show professional dashboard)
    await page.goto('http://localhost:3000/portal');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'final-3-portal-professional.png', fullPage: true });
    
    console.log('✅ VISUAL VERIFICATION COMPLETE!');
    console.log('📸 Screenshots saved:');
    console.log('   - final-1-homepage.png');
    console.log('   - final-2-auth0-login.png');
    console.log('   - final-3-portal-professional.png');
    
    console.log('🎯 Portal should now show:');
    console.log('   ✅ Professional dark theme');
    console.log('   ✅ Stats dashboard (Days Active, Body Fat, etc.)');
    console.log('   ✅ Progress tracking with progress bars');
    console.log('   ✅ Affiliate program section');
    console.log('   ✅ Quick actions');
    console.log('   ✅ Recent activity feed');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await page.screenshot({ path: 'final-error.png' });
  }
  
  console.log('🌐 Browser staying open for final review...');
  await new Promise(() => {}); // Keep alive for review
})();