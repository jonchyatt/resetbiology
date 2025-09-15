const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function takeComprehensiveScreenshots() {
  console.log('🚀 Starting comprehensive navigation test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`📋 Console ${msg.type()}: ${msg.text()}`);
  });
  
  // Enable error logging
  page.on('pageerror', error => {
    console.log(`❌ Page error: ${error.message}`);
  });
  
  const baseUrl = 'http://localhost:3002';
  const screenshotDir = './screenshots';
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  const pages = [
    { name: 'homepage', url: '', description: 'Homepage with navigation header' },
    { name: 'portal', url: '/portal', description: 'Client portal page' },
    { name: 'peptides', url: '/peptides', description: 'Peptides information page' },
    { name: 'nutrition', url: '/nutrition', description: 'Nutrition tracker page' },
    { name: 'workout', url: '/workout', description: 'Workout tracker page' },
    { name: 'admin', url: '/admin', description: 'Admin panel page' },
    { name: 'breath', url: '/breath', description: 'Breath training application' },
    { name: 'store', url: '/store', description: 'Peptide store/ordering page' },
    { name: 'profile', url: '/profile', description: 'User profile page' },
    { name: 'process', url: '/process', description: 'Process information page' }
  ];
  
  const results = [];
  
  for (const pageInfo of pages) {
    try {
      console.log(`\n📸 Testing: ${pageInfo.name} (${pageInfo.description})`);
      console.log(`🔗 URL: ${baseUrl}${pageInfo.url}`);
      
      await page.goto(`${baseUrl}${pageInfo.url}`, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      // Wait a moment for any animations or dynamic content
      await page.waitForTimeout(2000);
      
      // Check if page loaded successfully
      const title = await page.title();
      console.log(`📄 Page title: "${title}"`);
      
      // Check for navigation header
      const hasNavigation = await page.locator('nav, header, [data-testid="navigation"]').count() > 0;
      console.log(`🧭 Navigation present: ${hasNavigation ? '✅' : '❌'}`);
      
      // Check for main content
      const hasMainContent = await page.locator('main, [role="main"], .main-content').count() > 0;
      console.log(`📝 Main content present: ${hasMainContent ? '✅' : '❌'}`);
      
      // Take full-page screenshot
      const screenshotPath = path.join(screenshotDir, `${pageInfo.name}-navigation-test.png`);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        animations: 'disabled'
      });
      
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
      
      // Record results
      results.push({
        name: pageInfo.name,
        url: pageInfo.url,
        title: title,
        hasNavigation: hasNavigation,
        hasMainContent: hasMainContent,
        screenshotPath: screenshotPath,
        status: 'success'
      });
      
    } catch (error) {
      console.log(`❌ Error testing ${pageInfo.name}: ${error.message}`);
      results.push({
        name: pageInfo.name,
        url: pageInfo.url,
        error: error.message,
        status: 'error'
      });
    }
  }
  
  // Test navigation links on homepage
  try {
    console.log(`\n🔗 Testing navigation links on homepage...`);
    await page.goto(`${baseUrl}`, { waitUntil: 'networkidle' });
    
    // Look for navigation links
    const navLinks = await page.locator('nav a, header a, [data-testid="nav-link"]').all();
    console.log(`🔗 Found ${navLinks.length} navigation links`);
    
    for (let i = 0; i < Math.min(navLinks.length, 10); i++) {
      try {
        const linkText = await navLinks[i].textContent();
        const href = await navLinks[i].getAttribute('href');
        console.log(`   Link ${i + 1}: "${linkText}" -> ${href}`);
      } catch (e) {
        console.log(`   Link ${i + 1}: Could not read link details`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error testing navigation links: ${error.message}`);
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n📊 NAVIGATION TEST SUMMARY');
  console.log('=' * 50);
  
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`✅ ${result.name.toUpperCase()}: "${result.title}"`);
      console.log(`   Navigation: ${result.hasNavigation ? '✅' : '❌'} | Content: ${result.hasMainContent ? '✅' : '❌'}`);
      console.log(`   Screenshot: ${result.screenshotPath}`);
    } else {
      console.log(`❌ ${result.name.toUpperCase()}: ERROR - ${result.error}`);
    }
    console.log('');
  });
  
  console.log('🎯 All screenshots saved to ./screenshots/ directory');
  console.log('🔍 Check the screenshots to verify navigation header presence and functionality');
  
  return results;
}

// Run the test
takeComprehensiveScreenshots().catch(console.error);