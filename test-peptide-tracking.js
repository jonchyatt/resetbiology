const { chromium } = require('playwright');

async function testPeptideTracking() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('🧪 Testing Peptide Tracking System...');

    // Test 1: Direct peptide route
    console.log('📍 Testing /peptides route...');
    try {
      await page.goto('http://localhost:3000/peptides', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Take screenshot of peptide page (if it exists)
      await page.screenshot({ 
        path: 'peptide-test.png', 
        fullPage: true 
      });
      
      const title = await page.title();
      const url = page.url();
      console.log(`✅ Peptide page loaded: ${title} (${url})`);
      
      // Check for peptide-related content
      const peptideContent = await page.locator('body').textContent();
      if (peptideContent.toLowerCase().includes('peptide')) {
        console.log('✅ Found peptide-related content on /peptides page');
      } else {
        console.log('⚠️  No peptide-specific content found on /peptides page');
      }
    } catch (error) {
      console.log(`❌ /peptides route failed: ${error.message}`);
      
      // Take screenshot of error page
      await page.screenshot({ 
        path: 'peptide-test.png', 
        fullPage: true 
      });
    }

    // Test 2: Check portal for peptide tracking links
    console.log('📍 Testing portal for peptide tracking...');
    try {
      await page.goto('http://localhost:3000/portal', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Look for peptide-related links or buttons
      const peptideLinks = await page.locator('a, button').filter({ hasText: /peptide/i }).all();
      const trackingLinks = await page.locator('a, button').filter({ hasText: /track/i }).all();
      const dosingLinks = await page.locator('a, button').filter({ hasText: /dos/i }).all();
      
      console.log(`Found ${peptideLinks.length} peptide-related links`);
      console.log(`Found ${trackingLinks.length} tracking-related links`);
      console.log(`Found ${dosingLinks.length} dosing-related links`);
      
      // Take screenshot of portal
      await page.screenshot({ 
        path: 'portal-peptide-check.png', 
        fullPage: true 
      });
      
      // Check for any peptide tracking cards or sections
      const portalContent = await page.locator('body').textContent();
      const hasPeptideTracking = portalContent.toLowerCase().includes('peptide') && 
                                 (portalContent.toLowerCase().includes('track') || 
                                  portalContent.toLowerCase().includes('dos'));
      
      if (hasPeptideTracking) {
        console.log('✅ Found peptide tracking references in portal');
      } else {
        console.log('⚠️  No peptide tracking found in portal content');
      }
      
    } catch (error) {
      console.log(`❌ Portal peptide check failed: ${error.message}`);
    }

    // Test 3: Check navigation for peptide-related routes
    console.log('📍 Checking navigation for peptide routes...');
    try {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      // Look for navigation links that might lead to peptide tracking
      const navLinks = await page.locator('nav a, header a').all();
      const peptideNavLinks = [];
      
      for (const link of navLinks) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        if (text && (text.toLowerCase().includes('peptide') || 
                    text.toLowerCase().includes('track') ||
                    text.toLowerCase().includes('dos'))) {
          peptideNavLinks.push({ text: text.trim(), href });
        }
      }
      
      console.log('Navigation links related to peptide tracking:');
      peptideNavLinks.forEach(link => {
        console.log(`  - "${link.text}" -> ${link.href}`);
      });
      
      if (peptideNavLinks.length === 0) {
        console.log('⚠️  No peptide tracking links found in main navigation');
      }
      
    } catch (error) {
      console.log(`❌ Navigation check failed: ${error.message}`);
    }

    // Test 4: Search for potential peptide tracking routes
    console.log('📍 Testing potential peptide tracking routes...');
    const potentialRoutes = [
      '/peptide-tracker',
      '/peptide-tracking', 
      '/peptides/tracker',
      '/peptides/dosing',
      '/dosing',
      '/tracking',
      '/peptide-doses',
      '/peptide-log'
    ];
    
    for (const route of potentialRoutes) {
      try {
        await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const title = await page.title();
        const content = await page.locator('body').textContent();
        
        if (!title.includes('404') && !content.includes('404') && !content.includes('Page not found')) {
          console.log(`✅ Found potential peptide route: ${route} - "${title}"`);
          
          // Take screenshot if we find a working route
          await page.screenshot({ 
            path: `peptide-route-${route.replace(/\//g, '-')}.png`, 
            fullPage: true 
          });
        } else {
          console.log(`❌ Route not found: ${route}`);
        }
      } catch (error) {
        console.log(`❌ Route ${route} failed: ${error.message}`);
      }
    }

    console.log('🎯 Peptide tracking system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testPeptideTracking().catch(console.error);