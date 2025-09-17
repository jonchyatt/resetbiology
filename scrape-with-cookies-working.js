const fs = require('fs');
const { chromium } = require('playwright');

async function scrapePeptides() {
  console.log('🚀 Starting peptide scraping with cookies...');
  
  // Load saved cookies
  let cookies = [];
  try {
    cookies = JSON.parse(fs.readFileSync('/tmp/cellularpeptide_cookies.json', 'utf8'));
    console.log(`🍪 Loaded ${cookies.length} authentication cookies`);
  } catch (e) {
    console.log('⚠️  No saved cookies found, will need manual login');
  }
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 500
  });
  
  const context = await browser.newContext();
  
  // Add cookies if we have them
  if (cookies.length > 0) {
    await context.addCookies(cookies);
    console.log('✅ Cookies added to browser context');
  }
  
  const page = await context.newPage();
  
  console.log('📱 Navigating to cellularpeptide.com...');
  await page.goto('https://cellularpeptide.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check login status
  const pageText = await page.evaluate(() => document.body.innerText);
  const isLoggedIn = pageText.includes('Log out') || pageText.includes('Logout');
  
  if (!isLoggedIn) {
    console.log('🔐 Not logged in. Please log in manually in the browser window.');
    console.log('⏳ Waiting 60 seconds for manual login...');
    
    // Give user time to log in
    await page.waitForTimeout(60000);
    
    // Save new cookies after login
    const newCookies = await context.cookies();
    fs.writeFileSync('/tmp/cellularpeptide_cookies_new.json', JSON.stringify(newCookies, null, 2));
    console.log('💾 New cookies saved!');
  } else {
    console.log('✅ Already logged in!');
  }
  
  // Navigate to products
  console.log('\n📍 Navigating to products page...');
  await page.goto('https://cellularpeptide.com/collections/all', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check what we can see
  const productInfo = await page.evaluate(() => {
    const products = [];
    
    // Look for product links
    const productLinks = document.querySelectorAll('a[href*="/products/"]');
    for (const link of productLinks) {
      const href = link.href;
      const text = link.textContent?.trim() || '';
      if (href && !products.some(p => p.url === href)) {
        products.push({ 
          url: href, 
          name: text,
          element: link.className
        });
      }
    }
    
    // Also check for any price elements
    const prices = document.querySelectorAll('[class*="price"], [class*="cost"], .money');
    
    return {
      productCount: products.length,
      products: products.slice(0, 10), // First 10
      priceElementsFound: prices.length,
      pageTitle: document.title,
      isLoggedIn: document.body.innerText.includes('Log out')
    };
  });
  
  console.log('\n📊 Page Analysis:');
  console.log(`Page: ${productInfo.pageTitle}`);
  console.log(`Logged in: ${productInfo.isLoggedIn ? 'Yes' : 'No'}`);
  console.log(`Products found: ${productInfo.productCount}`);
  console.log(`Price elements: ${productInfo.priceElementsFound}`);
  
  if (productInfo.products.length > 0) {
    console.log('\n📦 Sample products:');
    productInfo.products.forEach((p, i) => {
      console.log(`${i+1}. ${p.name || 'No name'} -> ${p.url}`);
    });
    
    console.log('\n🎯 Ready to scrape! Would you like to:');
    console.log('1. Continue with automated scraping');
    console.log('2. Manually navigate and extract data');
    console.log('\nBrowser will stay open. Press Ctrl+C when done.');
  } else {
    console.log('\n⚠️  No products found. You may need to:');
    console.log('1. Log in if not already logged in');
    console.log('2. Navigate to the correct products page manually');
    console.log('\nBrowser will stay open for manual navigation.');
  }
  
  // Keep browser open
  await new Promise(() => {}); // Infinite wait
}

scrapePeptides().catch(console.error);