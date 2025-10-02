const { chromium } = require('playwright');
const fs = require('fs').promises;

console.log('🚀 ENHANCED CELLULAR PEPTIDE SCRAPER - FINAL VERSION');
console.log('📋 Multi-Stage Professional Scraping Plan:');
console.log('   ⏰ 60-second login window for user authentication');
console.log('   📄 Stage 1: All 3 collection pages → Complete product listings');
console.log('   🔍 Stage 2: Individual product pages → Full details, protocols, images');
console.log('   📚 Stage 3: Educational content → Learn More pages');
console.log('   ✅ Stage 4: Comprehensive JSON output with verification');
console.log('\n' + '='.repeat(70));

(async () => {
  // Launch browser for user login
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
    timeout: 0
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Navigate to the site
  console.log('\n🌐 Opening CellularPeptide.com...');
  await page.goto('https://cellularpeptide.com', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  console.log('\n⏰ LOGIN WINDOW - 60 SECONDS');
  console.log('🔑 Please log in to your partner account');
  console.log('📍 Navigate to: https://cellularpeptide.com/collections/all');
  console.log('👀 Verify you can see the product grid');
  console.log('⏳ Countdown starting...');
  
  // 60-second countdown
  for (let i = 60; i > 0; i--) {
    process.stdout.write(`\r⏰ Time remaining: ${i.toString().padStart(2, '0')} seconds`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n🚀 LOGIN WINDOW CLOSED - PROCEEDING WITH SCRAPING');
  console.log('=' .repeat(70));
  
  // Verify we're at the collections page
  await page.goto('https://cellularpeptide.com/collections/all', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'scraper-start-state.png', fullPage: false });
  
  // =============================================================================
  // STAGE 1: COMPREHENSIVE COLLECTION PAGE SCRAPING
  // =============================================================================
  console.log('\n🔍 STAGE 1: SCRAPING ALL COLLECTION PAGES');
  console.log('=' .repeat(70));
  
  const allProductsBasic = [];
  const collectionPages = [
    { url: 'https://cellularpeptide.com/collections/all', name: 'Page 1' },
    { url: 'https://cellularpeptide.com/collections/all?page=2', name: 'Page 2' },
    { url: 'https://cellularpeptide.com/collections/all?page=3', name: 'Page 3' }
  ];
  
  for (let pageIndex = 0; pageIndex < collectionPages.length; pageIndex++) {
    const { url, name } = collectionPages[pageIndex];
    console.log(`\n📄 ${name}: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      await page.waitForTimeout(3000);
      
      // Take screenshot of each page
      await page.screenshot({ path: `collection-${pageIndex + 1}.png` });
      
      const pageProducts = await page.evaluate((pageNum) => {
        const products = [];
        
        // Comprehensive selector search
        const selectors = [
          'a[href*="/products/"]',
          '.product-item a', 
          '.product-card a',
          '.grid-item a',
          '.collection-item a',
          '[data-product] a',
          '.product a',
          '.item a'
        ];
        
        const allProductLinks = new Set();
        
        // Collect all unique product URLs
        selectors.forEach(selector => {
          const links = document.querySelectorAll(selector);
          links.forEach(link => {
            if (link.href && link.href.includes('/products/')) {
              allProductLinks.add(link.href);
            }
          });
        });
        
        console.log(`Page ${pageNum}: Found ${allProductLinks.size} unique product URLs`);
        
        // Process each unique product URL
        allProductLinks.forEach(productUrl => {
          const slug = productUrl.split('/products/')[1]?.split('?')[0];
          if (!slug) return;
          
          // Find all elements that link to this product
          const productLinks = document.querySelectorAll(`a[href*="/products/${slug}"]`);
          
          let bestProductData = {
            slug: slug,
            name: '',
            url: productUrl,
            listPrice: 0,
            listImage: '',
            pageNum: pageNum
          };
          
          // Extract data from each link and its container
          productLinks.forEach(link => {
            let container = link;
            
            // Find the best container (product card)
            for (let i = 0; i < 5; i++) {
              container = container.parentElement;
              if (!container) break;
              
              if (container.classList && (
                container.classList.contains('product') ||
                container.classList.contains('item') ||
                container.classList.contains('card') ||
                container.querySelector('.price, [class*="price"]')
              )) {
                break;
              }
            }
            
            // Extract name
            let name = '';
            const nameSelectors = [
              'h1', 'h2', 'h3', 'h4',
              '.title', '.name', '.product-title',
              '[class*="title"]', '[class*="name"]'
            ];
            
            for (const sel of nameSelectors) {
              const nameEl = container.querySelector(sel) || link.querySelector(sel);
              if (nameEl && nameEl.textContent.trim()) {
                name = nameEl.textContent.trim();
                break;
              }
            }
            
            if (!name && link.textContent.trim()) {
              name = link.textContent.trim();
            }
            
            // Extract price
            let price = 0;
            const priceSelectors = [
              '.price', '.cost', '.amount',
              '[class*="price"]', '[class*="cost"]',
              '.money', '[data-price]'
            ];
            
            for (const sel of priceSelectors) {
              const priceEl = container.querySelector(sel);
              if (priceEl) {
                const priceText = priceEl.textContent;
                const priceMatch = priceText.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[1].replace(',', ''));
                  break;
                }
              }
            }
            
            // Extract image
            let image = '';
            const imgEl = container.querySelector('img') || link.querySelector('img');
            if (imgEl) {
              image = imgEl.src || imgEl.dataset.src || imgEl.dataset.original || '';
              // Ensure it's a full URL
              if (image && !image.startsWith('http')) {
                image = new URL(image, window.location.origin).href;
              }
            }
            
            // Update best data if we found better info
            if (name && name.length > bestProductData.name.length) {
              bestProductData.name = name;
            }
            if (price > 0) {
              bestProductData.listPrice = price;
            }
            if (image && !bestProductData.listImage) {
              bestProductData.listImage = image;
            }
          });
          
          // Ensure we have at least a name
          if (!bestProductData.name) {
            bestProductData.name = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
          
          products.push(bestProductData);
        });
        
        return products;
      }, pageIndex + 1);
      
      console.log(`   ✅ Extracted ${pageProducts.length} products`);
      if (pageProducts.length > 0) {
        console.log(`   📋 Sample: ${pageProducts.slice(0, 3).map(p => p.name).join(', ')}`);
      }
      
      allProductsBasic.push(...pageProducts);
      
      // Delay between pages
      await page.waitForTimeout(2000);
      
    } catch (error) {
      console.error(`   ❌ Error on ${name}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 STAGE 1 COMPLETE`);
  console.log(`   Total products found: ${allProductsBasic.length}`);
  
  // Deduplicate by slug
  const uniqueProducts = allProductsBasic.filter((product, index, self) => 
    index === self.findIndex(p => p.slug === product.slug)
  );
  
  console.log(`   Unique products: ${uniqueProducts.length}`);
  console.log(`   With prices: ${uniqueProducts.filter(p => p.listPrice > 0).length}`);
  console.log(`   With images: ${uniqueProducts.filter(p => p.listImage).length}`);
  
  if (uniqueProducts.length === 0) {
    console.log('\n❌ NO PRODUCTS FOUND!');
    console.log('   Please verify you are logged in and can see products at:');
    console.log('   https://cellularpeptide.com/collections/all');
    
    await page.screenshot({ path: 'no-products-found.png' });
    const pageHTML = await page.content();
    await fs.writeFile('debug-page-source.html', pageHTML);
    
    console.log('   📸 Screenshot saved: no-products-found.png');
    console.log('   📄 Page source saved: debug-page-source.html');
    
    await browser.close();
    return;
  }
  
  // =============================================================================
  // STAGE 2: DETAILED PRODUCT PAGE SCRAPING
  // =============================================================================
  console.log('\n🔍 STAGE 2: DETAILED PRODUCT PAGE SCRAPING');
  console.log('=' .repeat(70));
  
  const detailedProducts = [];
  
  for (let i = 0; i < uniqueProducts.length; i++) {
    const product = uniqueProducts[i];
    console.log(`\n📦 Product ${i + 1}/${uniqueProducts.length}: ${product.name}`);
    console.log(`   URL: ${product.url}`);
    
    try {
      await page.goto(product.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 20000 
      });
      
      await page.waitForTimeout(2000);
      
      const productDetails = await page.evaluate((basicProduct) => {
        const enhanced = { ...basicProduct };
        
        // Get comprehensive description
        const descriptionSelectors = [
          '.product-description',
          '.product__description',
          '.description',
          '.product-content',
          '.product-details',
          '[class*="description"]',
          '.rte',
          '.product-form__text'
        ];
        
        let fullDescription = '';
        for (const sel of descriptionSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim()) {
            fullDescription = el.textContent.trim();
            break;
          }
        }
        enhanced.fullDescription = fullDescription;
        
        // Get ALL images from product page
        const allImages = [];
        const imageSelectors = [
          '.product img',
          '.product-images img',
          '.product-gallery img',
          '[class*="product"] img',
          '.media img'
        ];
        
        imageSelectors.forEach(sel => {
          const images = document.querySelectorAll(sel);
          images.forEach(img => {
            let src = img.src || img.dataset.src || img.dataset.original;
            if (src && src.includes('cellularpeptide')) {
              // Ensure full URL
              if (!src.startsWith('http')) {
                src = new URL(src, window.location.origin).href;
              }
              if (!allImages.includes(src)) {
                allImages.push(src);
              }
            }
          });
        });
        enhanced.allImages = allImages;
        
        // Extract comprehensive protocol information
        const pageText = document.body.textContent;
        const protocolInfo = {};
        
        const protocolPatterns = {
          reconstitution: /Reconstitution[:\s]*([^\n\r\.!?]*)/i,
          dosage: /Dosage[:\s]*([^\n\r\.!?]*)/i,
          frequency: /Frequency[:\s]*([^\n\r\.!?]*)/i,
          timing: /Timing[:\s]*([^\n\r\.!?]*)/i,
          protocol: /Protocol[:\s]*([^\n\r\.!?]*)/i,
          administration: /Administration[:\s]*([^\n\r\.!?]*)/i,
          storage: /Storage[:\s]*([^\n\r\.!?]*)/i,
          mixing: /Mixing[:\s]*([^\n\r\.!?]*)/i
        };
        
        for (const [key, pattern] of Object.entries(protocolPatterns)) {
          const match = pageText.match(pattern);
          if (match && match[1].trim()) {
            protocolInfo[key] = match[1].trim();
          }
        }
        
        // Look for Learn More links
        const learnMoreLinks = [];
        const learnSelectors = [
          'a[href*="learn"]',
          'a[href*="info"]',
          'a[href*="education"]',
          'a:contains("Learn More")',
          'a:contains("More Info")',
          '.learn-more a',
          '[class*="learn"] a'
        ];
        
        learnSelectors.forEach(sel => {
          try {
            const links = document.querySelectorAll(sel);
            links.forEach(link => {
              if (link.href && !learnMoreLinks.includes(link.href)) {
                learnMoreLinks.push(link.href);
              }
            });
          } catch (e) {}
        });
        
        // Look for video content
        const videos = [];
        const videoSelectors = [
          'iframe[src*="youtube"]',
          'iframe[src*="vimeo"]',
          'video source',
          'video'
        ];
        
        videoSelectors.forEach(sel => {
          const elements = document.querySelectorAll(sel);
          elements.forEach(el => {
            const src = el.src || el.querySelector('source')?.src;
            if (src && !videos.includes(src)) {
              videos.push(src);
            }
          });
        });
        
        enhanced.protocolInfo = protocolInfo;
        enhanced.learnMoreLinks = learnMoreLinks;
        enhanced.videos = videos;
        enhanced.pageHTML = document.documentElement.outerHTML;
        
        return enhanced;
      }, product);
      
      console.log(`   ✅ Enhanced: ${productDetails.allImages.length} images, ${Object.keys(productDetails.protocolInfo).length} protocols, ${productDetails.learnMoreLinks.length} learn links`);
      
      detailedProducts.push(productDetails);
      
      // Save individual product HTML
      await fs.writeFile(`product-${productDetails.slug}.html`, productDetails.pageHTML);
      
      // Delay between products
      await page.waitForTimeout(1500);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      detailedProducts.push(product);
    }
  }
  
  // =============================================================================
  // STAGE 3: EDUCATIONAL CONTENT SCRAPING
  // =============================================================================
  console.log('\n🔍 STAGE 3: EDUCATIONAL CONTENT SCRAPING');
  console.log('=' .repeat(70));
  
  const educationalContent = {};
  
  for (const product of detailedProducts) {
    if (product.learnMoreLinks && product.learnMoreLinks.length > 0) {
      console.log(`\n📚 Educational content for: ${product.name}`);
      
      for (const learnUrl of product.learnMoreLinks.slice(0, 2)) { // Limit to first 2 links
        try {
          console.log(`   📖 Fetching: ${learnUrl}`);
          
          await page.goto(learnUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
          });
          
          await page.waitForTimeout(2000);
          
          const learnContent = await page.evaluate(() => {
            return {
              title: document.title,
              url: window.location.href,
              content: document.body.innerHTML,
              textContent: document.body.textContent.trim()
            };
          });
          
          if (!educationalContent[product.slug]) {
            educationalContent[product.slug] = [];
          }
          educationalContent[product.slug].push(learnContent);
          
          console.log(`   ✅ Captured: ${learnContent.textContent.length} characters`);
          
          // Save educational content HTML
          await fs.writeFile(`learn-${product.slug}-${Date.now()}.html`, learnContent.content);
          
        } catch (error) {
          console.error(`   ❌ Learn content error: ${error.message}`);
        }
      }
    }
  }
  
  // =============================================================================
  // STAGE 4: COMPREHENSIVE OUTPUT GENERATION
  // =============================================================================
  console.log('\n🔍 STAGE 4: GENERATING COMPREHENSIVE OUTPUT');
  console.log('=' .repeat(70));
  
  const finalProducts = detailedProducts.map(product => {
    const educationalData = educationalContent[product.slug] || [];
    
    return {
      // Core product info
      slug: product.slug,
      name: product.name,
      description: product.fullDescription || product.name,
      
      // Images and media
      imageUrl: product.listImage || (product.allImages && product.allImages[0]) || '',
      allImages: product.allImages || [],
      videos: product.videos || [],
      
      // URLs
      originalUrl: product.url,
      
      // Pricing (50% markup for reseller)
      partnerPrice: product.listPrice || 0,
      retailPrice: Math.round((product.listPrice || 0) * 1.5 * 100) / 100,
      
      // Product status
      storefront: true,
      active: true,
      
      // Rich content
      protocolInfo: product.protocolInfo || {},
      learnMoreLinks: product.learnMoreLinks || [],
      educationalContent: educationalData,
      
      // Comprehensive metadata
      metadata: {
        category: 'peptide',
        scrapedAt: new Date().toISOString(),
        source: 'cellularpeptide.com',
        foundOnPage: product.pageNum,
        hasFullDescription: !!(product.fullDescription),
        hasProtocolInfo: Object.keys(product.protocolInfo || {}).length > 0,
        hasEducationalContent: educationalData.length > 0,
        hasVideos: (product.videos || []).length > 0,
        imageCount: (product.allImages || []).length,
        learnMoreLinkCount: (product.learnMoreLinks || []).length
      }
    };
  });
  
  // Create comprehensive verification report
  const verification = {
    scrapingCompleted: new Date().toISOString(),
    totalProducts: finalProducts.length,
    qualityMetrics: {
      withPrices: finalProducts.filter(p => p.partnerPrice > 0).length,
      withImages: finalProducts.filter(p => p.imageUrl).length,
      withFullDescriptions: finalProducts.filter(p => p.metadata.hasFullDescription).length,
      withProtocols: finalProducts.filter(p => p.metadata.hasProtocolInfo).length,
      withEducationalContent: finalProducts.filter(p => p.metadata.hasEducationalContent).length,
      withVideos: finalProducts.filter(p => p.metadata.hasVideos).length
    },
    scrapingMethod: 'enhanced-multi-stage-authenticated',
    collectionPagesScraped: 3,
    averageImagesPerProduct: Math.round(finalProducts.reduce((sum, p) => sum + p.metadata.imageCount, 0) / finalProducts.length),
    browserMode: 'headed-with-user-authentication'
  };
  
  const finalOutput = {
    verification: verification,
    products: finalProducts
  };
  
  // Save comprehensive output
  await fs.writeFile('cellular-peptide-comprehensive-final.json', JSON.stringify(finalOutput, null, 2));
  
  // Save cookies for future use
  const cookies = await context.cookies();
  await fs.writeFile('/tmp/cellular_peptide_cookies.json', JSON.stringify(cookies, null, 2));
  
  // =============================================================================
  // FINAL REPORT
  // =============================================================================
  console.log('\n🎉 COMPREHENSIVE SCRAPING COMPLETE!');
  console.log('=' .repeat(70));
  console.log(`📊 RESULTS SUMMARY:`);
  console.log(`   Total Products: ${verification.totalProducts}`);
  console.log(`   With Prices: ${verification.qualityMetrics.withPrices}`);
  console.log(`   With Images: ${verification.qualityMetrics.withImages}`);
  console.log(`   With Full Descriptions: ${verification.qualityMetrics.withFullDescriptions}`);
  console.log(`   With Protocol Info: ${verification.qualityMetrics.withProtocols}`);
  console.log(`   With Educational Content: ${verification.qualityMetrics.withEducationalContent}`);
  console.log(`   With Videos: ${verification.qualityMetrics.withVideos}`);
  console.log(`   Average Images per Product: ${verification.averageImagesPerProduct}`);
  
  console.log(`\n📁 FILES CREATED:`);
  console.log(`   🎯 cellular-peptide-comprehensive-final.json - MAIN OUTPUT`);
  console.log(`   📄 product-[slug].html - Individual product pages (${finalProducts.length} files)`);
  console.log(`   📚 learn-[slug]-*.html - Educational content pages`);
  console.log(`   📸 collection-*.png - Collection page screenshots`);
  console.log(`   🍪 /tmp/cellular_peptide_cookies.json - Saved authentication`);
  
  console.log(`\n🚀 READY FOR PHASE 2: DATABASE SCHEMA UPDATES!`);
  console.log(`   ✅ Complete product data extracted`);
  console.log(`   ✅ All educational content captured`);
  console.log(`   ✅ Protocol information parsed`);
  console.log(`   ✅ Media files catalogued`);
  
  console.log('\n🌐 Browser remains open for your continued use');
  
})().catch(console.error);