const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

(async () => {
  console.log('🔍 Connecting to existing browser session...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Navigate to the collections page
  console.log('📱 Navigating to collections page...');
  await page.goto('https://cellularpeptide.com/collections/all', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  // Save cookies for future use
  const cookies = await context.cookies();
  await fs.writeFile(
    '/tmp/cellularpeptide_cookies_fresh.json',
    JSON.stringify(cookies, null, 2)
  );
  console.log(`✅ Saved ${cookies.length} cookies to /tmp/cellularpeptide_cookies_fresh.json`);
  
  const peptides = [];
  let pageNum = 1;
  let hasNextPage = true;
  
  while (hasNextPage) {
    console.log(`\n📄 Scraping page ${pageNum}...`);
    
    // Wait for products to load
    await page.waitForSelector('.product-card', { timeout: 10000 }).catch(() => null);
    
    // Extract product data
    const pageProducts = await page.evaluate(() => {
      const products = [];
      document.querySelectorAll('.product-card, .grid-product, .product-item, [class*="product"]').forEach(card => {
        try {
          // Try multiple selectors for title
          const titleEl = card.querySelector('h3, h2, .product-title, .product-name, [class*="title"], a[href*="/products/"]');
          const title = titleEl?.textContent?.trim() || 
                       card.querySelector('a')?.textContent?.trim() ||
                       'Unknown';
          
          // Try multiple selectors for price
          const priceEl = card.querySelector('.price, .product-price, [class*="price"], .money');
          let price = priceEl?.textContent?.trim() || '0';
          
          // Extract URL
          const link = card.querySelector('a[href*="/products/"]')?.href || 
                      card.querySelector('a')?.href || '';
          
          // Extract image
          const img = card.querySelector('img')?.src || '';
          
          // Clean up price
          price = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
          
          if (title && title !== 'Unknown') {
            products.push({
              name: title,
              partnerPrice: price,
              retailPrice: Math.round(price * 1.5 * 100) / 100, // 50% markup
              url: link,
              imageUrl: img,
              slug: title.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
            });
          }
        } catch (e) {
          console.error('Error parsing product:', e);
        }
      });
      return products;
    });
    
    console.log(`Found ${pageProducts.length} products on page ${pageNum}`);
    peptides.push(...pageProducts);
    
    // Check for next page
    const nextButton = await page.$('a[href*="?page="], .next, [aria-label="Next"], a:has-text("Next"), a:has-text("→")');
    
    if (nextButton && pageNum < 5) { // Limit to 5 pages for safety
      await nextButton.click();
      await page.waitForTimeout(2000); // Wait for page to load
      pageNum++;
    } else {
      hasNextPage = false;
    }
  }
  
  // Save the scraped data
  const outputPath = path.join(process.cwd(), 'scraped-peptides.json');
  await fs.writeFile(outputPath, JSON.stringify(peptides, null, 2));
  
  console.log(`\n✅ Scraped ${peptides.length} total peptides`);
  console.log(`📁 Data saved to: ${outputPath}`);
  
  // Show first few items as preview
  console.log('\n📋 Preview of scraped data:');
  peptides.slice(0, 3).forEach(p => {
    console.log(`- ${p.name}: Partner $${p.partnerPrice} → Retail $${p.retailPrice}`);
  });
  
  await browser.close();
})();