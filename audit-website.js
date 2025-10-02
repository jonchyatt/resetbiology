const { chromium } = require('playwright');

async function auditWebsite() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Taking screenshots of current website state...');
  
  try {
    // Homepage
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'audit-homepage.png', fullPage: true });
    console.log('✓ Homepage screenshot taken');
    
    // Assessment page
    await page.goto('http://localhost:3001/assessment', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'audit-assessment.png', fullPage: true });
    console.log('✓ Assessment screenshot taken');
    
    // Portal page
    await page.goto('http://localhost:3001/portal', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'audit-portal.png', fullPage: true });
    console.log('✓ Portal screenshot taken');
    
    // Process page
    await page.goto('http://localhost:3001/process', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'audit-process.png', fullPage: true });
    console.log('✓ Process screenshot taken');
    
    // Check for console errors on homepage
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    // Wait a bit to collect any console errors
    await page.waitForTimeout(2000);
    
    if (consoleMessages.length > 0) {
      console.log('❌ Console errors found:');
      consoleMessages.forEach(msg => console.log(`  - ${msg}`));
    } else {
      console.log('✓ No console errors detected');
    }
    
  } catch (error) {
    console.error('Error during audit:', error.message);
  }
  
  await browser.close();
}

auditWebsite().catch(console.error);