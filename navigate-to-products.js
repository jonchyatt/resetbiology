const fs = require('fs');
const { chromium } = require('playwright');

async function navigateToProducts() {
  console.log('🚀 Starting navigation to products...');
  
  // Load saved cookies
  const cookies = JSON.parse(fs.readFileSync('/tmp/cellularpeptide_cookies.json', 'utf8'));
  console.log('🍪 Loaded authentication cookies');
  
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 1000,
    timeout: 60000
  });
  
  const context = await browser.newContext();
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  
  console.log('📱 Going to cellularpeptide.com...');
  await page.goto('https://cellularpeptide.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Check if we're logged in
  const pageContent = await page.content();
  const pageTitle = await page.title();
  console.log(`📄 Page title: ${pageTitle}`);
  
  // Look for login/logout to verify authentication status
  const isLoggedIn = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Log out') || text.includes('Logout') || text.includes('Account');
  });
  
  console.log(`🔐 Logged in status: ${isLoggedIn ? 'Yes' : 'No'}`);
  
  // Try to find and click "Order Peptides" link
  try {
    console.log('🔍 Looking for "Order Peptides" link...');
    
    // Try multiple approaches to find the link
    const orderLink = await page.locator('a:has-text("Order Peptides")').first();
    if (await orderLink.isVisible({ timeout: 5000 })) {
      console.log('✅ Found "Order Peptides" link, clicking...');
      await orderLink.click();
      await page.waitForTimeout(5000);
      
      console.log(`📄 New page: ${await page.title()}`);
      console.log(`🌐 Current URL: ${page.url()}`);
    } else {
      console.log('⚠️ "Order Peptides" link not found');
    }
  } catch (e) {
    console.log('⚠️ Could not click Order Peptides:', e.message);
  }
  
  // Check what we can see on the current page
  const currentPageInfo = await page.evaluate(() => {
    const links = [];
    const allLinks = document.querySelectorAll('a');
    
    for (const link of allLinks) {
      const href = link.href;
      const text = link.textContent.trim();
      if (text && href) {
        links.push({ text: text.substring(0, 50), href });
      }
    }
    
    // Look for product-like elements
    const productElements = document.querySelectorAll('[class*="product"], [class*="item"], [class*="peptide"]');
    
    return {
      linkCount: allLinks.length,
      sampleLinks: links.slice(0, 20),
      productElementsCount: productElements.length,
      bodyText: document.body.innerText.substring(0, 1000)
    };
  });
  
  console.log('\n📊 Page Analysis:');
  console.log(`Total links: ${currentPageInfo.linkCount}`);
  console.log(`Product-like elements: ${currentPageInfo.productElementsCount}`);
  console.log('\n🔗 Sample links:');
  currentPageInfo.sampleLinks.forEach((link, i) => {
    console.log(`${i+1}. ${link.text} -> ${link.href}`);
  });
  
  console.log('\n📝 Page content preview:');
  console.log(currentPageInfo.bodyText.substring(0, 500));
  
  console.log('\n💡 Browser is still open. You can manually navigate to find the products.');
  console.log('📌 When you find the products page, tell me what the URL is and I can update the scraping script.');
  
  // Keep browser open
  console.log('\n⏳ Keeping browser open... Press Ctrl+C to close.');
}

navigateToProducts().catch(console.error);