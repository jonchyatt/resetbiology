const fs = require('fs');
const { chromium } = require('playwright');

const COLLECTION_URLS = [
  'https://cellularpeptide.com/collections/all',
  'https://cellularpeptide.com/collections/all?page=2',
  'https://cellularpeptide.com/collections/all?page=3',
  'https://cellularpeptide.com/collections/single-vials',
  'https://cellularpeptide.com/collections/single-vials?page=2'
];

async function scrapePeptides() {
  console.log('🚀 Starting peptide scraping process...');
  
  // Load saved cookies
  const cookies = JSON.parse(fs.readFileSync('/tmp/cellularpeptide_cookies.json', 'utf8'));
  console.log('🍪 Loaded authentication cookies');
  
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 800,
    timeout: 60000
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  
  const allPeptides = [];
  
  for (let i = 0; i < COLLECTION_URLS.length; i++) {
    const url = COLLECTION_URLS[i];
    console.log(`\n📄 Scraping page ${i + 1}/${COLLECTION_URLS.length}: ${url}`);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('   ✅ Page loaded, waiting for content...');
      await page.waitForTimeout(3000);
      
      // Debug: Check what's on the page
      const pageTitle = await page.title();
      console.log(`   📄 Page title: ${pageTitle}`);
      
      // Try multiple selectors to find product links
      const productLinks = await page.evaluate(() => {
        const links = [];
        
        // More comprehensive selectors for product links
        const selectors = [
          'a[href*="/products/"]',
          '.product-item a',
          '.product-card a',
          '.grid-item a',
          '.product a',
          '.item a',
          '[data-product-url]',
          '.product-link'
        ];
        
        console.log('Looking for product links...');
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          
          for (const el of elements) {
            let href = el.href || el.getAttribute('href') || el.getAttribute('data-product-url');
            if (href) {
              // Convert relative URLs to absolute
              if (href.startsWith('/')) {
                href = 'https://cellularpeptide.com' + href;
              }
              if (href.includes('/products/') && !links.includes(href)) {
                links.push(href);
              }
            }
          }
        }
        
        // Also check for any links in the page
        const allLinks = document.querySelectorAll('a');
        console.log(`Total links on page: ${allLinks.length}`);
        
        return {
          productLinks: links,
          totalLinks: allLinks.length,
          pageText: document.body.innerText.substring(0, 500) // First 500 chars for debugging
        };
      });
      
      console.log(`   🔍 Found ${productLinks.productLinks.length} product links`);
      console.log(`   📊 Total links on page: ${productLinks.totalLinks}`);
      
      if (productLinks.productLinks.length === 0) {
        console.log('   ⚠️  No product links found. Page content preview:');
        console.log('   📝', productLinks.pageText.substring(0, 200));
        
        // Try to find any products by looking at page structure
        const pageStructure = await page.evaluate(() => {
          const structure = [];
          const elements = document.querySelectorAll('*[class*="product"], *[class*="item"], *[class*="card"]');
          for (let i = 0; i < Math.min(5, elements.length); i++) {
            structure.push({
              tag: elements[i].tagName,
              class: elements[i].className,
              text: elements[i].innerText.substring(0, 100)
            });
          }
          return structure;
        });
        console.log('   🏗️  Page structure sample:', JSON.stringify(pageStructure, null, 2));
        continue;
      }
      
      // Scrape each product
      for (let j = 0; j < Math.min(5, productLinks.productLinks.length); j++) { // Limit to 5 for testing
        const productUrl = productLinks.productLinks[j];
        console.log(`   📦 Product ${j + 1}/${productLinks.productLinks.length}: ${productUrl}`);
        
        try {
          await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
          
          // Extract basic product info
          const productData = await page.evaluate(() => {
            const getName = () => {
              const selectors = ['h1', '.product-title', '.product-name', '[data-product-title]', '.title'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return document.title; // Fallback to page title
            };
            
            const getPrice = () => {
              const selectors = ['.price', '.product-price', '[data-price]', '.money', '.cost'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                  const text = el.textContent.trim();
                  const match = text.match(/\\$([0-9,]+(?:\\.[0-9]{2})?)/);
                  if (match) return parseFloat(match[1].replace(',', ''));
                }
              }
              return null;
            };
            
            const getDescription = () => {
              const selectors = ['.product-description', '.description', '.product-content', '.content'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return null;
            };
            
            const getImageUrl = () => {
              const selectors = ['.product-image img', '.featured-image img', '.main-image img', 'img'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.src && !el.src.includes('placeholder')) return el.src;
              }
              return null;
            };
            
            return {
              name: getName(),
              originalPrice: getPrice(),
              description: getDescription(),
              imageUrl: getImageUrl(),
              url: window.location.href
            };
          });
          
          if (!productData.name) {
            console.log('     ⚠️  Could not extract product name, skipping...');
            continue;
          }
          
          console.log(`     📝 ${productData.name} - $${productData.originalPrice || 'Price not found'}`);
          
          // Calculate retail price (50% markup)
          const retailPrice = productData.originalPrice ? Math.round(productData.originalPrice * 1.5 * 100) / 100 : null;
          
          // Extract vial size from name
          const vialSize = productData.name.match(/([0-9]+(?:\\.[0-9]+)?\\s*mg)/i)?.[1] || null;
          
          // Create peptide object
          const peptide = {
            slug: productData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
            name: productData.name,
            description: productData.description,
            imageUrl: productData.imageUrl,
            originalPrice: productData.originalPrice,
            retailPrice: retailPrice,
            vialSize: vialSize,
            sourceUrl: productData.url,
            category: 'peptide',
            storefront: true,
            active: true
          };
          
          allPeptides.push(peptide);
          console.log(`     ✅ Added: ${peptide.name} ($${peptide.originalPrice} → $${peptide.retailPrice})`);
          
        } catch (error) {
          console.log(`     ❌ Error scraping ${productUrl}:`, error.message);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error loading page ${url}:`, error.message);
    }
  }
  
  // Save results
  const outputFile = '/tmp/scraped_peptides.json';
  fs.writeFileSync(outputFile, JSON.stringify(allPeptides, null, 2));
  
  console.log(`\n🎉 Scraping complete!`);
  console.log(`📊 Total peptides scraped: ${allPeptides.length}`);
  console.log(`💾 Data saved to: ${outputFile}`);
  
  // Show summary
  console.log('\n📋 Summary:');
  allPeptides.forEach((peptide, index) => {
    console.log(`${index + 1}. ${peptide.name} - $${peptide.originalPrice} → $${peptide.retailPrice}`);
  });
  
  await browser.close();
  console.log('\n✅ Browser closed. Review the JSON file before importing to database.');
}

// Start scraping
scrapePeptides().catch(console.error);