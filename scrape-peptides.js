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
  
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  const allPeptides = [];
  
  for (let i = 0; i < COLLECTION_URLS.length; i++) {
    const url = COLLECTION_URLS[i];
    console.log(`\n📄 Scraping page ${i + 1}/${COLLECTION_URLS.length}: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Get all product links on this page
    const productLinks = await page.evaluate(() => {
      const links = [];
      // Look for product cards/links - common selectors
      const selectors = [
        'a[href*="/products/"]',
        '.product-item a',
        '.product-card a',
        '.grid-item a'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const href = el.href;
          if (href && href.includes('/products/') && !links.includes(href)) {
            links.push(href);
          }
        }
      }
      
      return links;
    });
    
    console.log(`   Found ${productLinks.length} products on this page`);
    
    // Scrape each product
    for (let j = 0; j < productLinks.length; j++) {
      const productUrl = productLinks[j];
      console.log(`   📦 Product ${j + 1}/${productLinks.length}: ${productUrl}`);
      
      try {
        await page.goto(productUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // Extract basic product info
        const productData = await page.evaluate(() => {
          const getName = () => {
            const selectors = ['h1', '.product-title', '.product-name', '[data-product-title]'];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return null;
          };
          
          const getPrice = () => {
            const selectors = ['.price', '.product-price', '[data-price]', '.money'];
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
            const selectors = ['.product-description', '.description', '.product-content'];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return null;
          };
          
          const getImageUrl = () => {
            const selectors = ['.product-image img', '.featured-image img', '.main-image img'];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.src) return el.src;
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
        
        console.log(`     📝 ${productData.name} - $${productData.originalPrice}`);
        
        // Look for and click Protocol Instructions
        let protocolInstructions = null;
        try {
          const protocolButton = await page.locator('text=Protocol Instructions').first();
          if (await protocolButton.isVisible({ timeout: 3000 })) {
            await protocolButton.click();
            await page.waitForTimeout(1000);
            
            // Extract protocol text
            protocolInstructions = await page.evaluate(() => {
              // Look for protocol content
              const selectors = ['.protocol-content', '.modal-content', '.popup-content', '.instructions'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim()) {
                  return el.textContent.trim();
                }
              }
              return null;
            });
            
            console.log('     📋 Protocol instructions extracted');
          }
        } catch (e) {
          console.log('     ⚠️  Protocol instructions not found');
        }
        
        // Look for and click Learn More button
        let educationalContent = null;
        try {
          const learnMoreButton = await page.locator('text=Learn More').first();
          if (await learnMoreButton.isVisible({ timeout: 3000 })) {
            await learnMoreButton.click();
            await page.waitForTimeout(1000);
            
            // Extract educational content
            educationalContent = await page.evaluate(() => {
              // Look for educational content
              const selectors = ['.education-content', '.learn-more-content', '.modal-content', '.popup-content'];
              for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent.trim()) {
                  return el.textContent.trim();
                }
              }
              return null;
            });
            
            console.log('     📚 Educational content extracted');
          }
        } catch (e) {
          console.log('     ⚠️  Learn More content not found');
        }
        
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
          protocolInstructions: protocolInstructions,
          educationalContent: educationalContent,
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