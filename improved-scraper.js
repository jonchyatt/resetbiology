const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🚀 Improved peptide scraper starting...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    timeout: 0
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Load cookies if available
  try {
    const cookies = JSON.parse(await fs.readFile('/tmp/cellularpeptide_cookies_fresh.json', 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Cookies loaded');
  } catch (e) {}
  
  const allPeptides = [];
  
  // First, collect all product URLs
  const allProductUrls = [];
  
  const pageUrls = [
    'https://cellularpeptide.com/collections/all',
    'https://cellularpeptide.com/collections/all?page=2', 
    'https://cellularpeptide.com/collections/all?page=3'
  ];
  
  for (const collectionUrl of pageUrls) {
    console.log(`\n📄 Loading: ${collectionUrl.split('?')[0]} ${collectionUrl.includes('page=') ? '(Page ' + collectionUrl.match(/page=(\d)/)?.[1] + ')' : '(Page 1)'}`);
    
    await page.goto(collectionUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(5000);
    
    const pageProducts = await page.evaluate(() => {
      const products = [];
      
      // Try multiple selectors for product cards
      const productCards = document.querySelectorAll('.grid-product, .product-item, .product-card, [class*="product-grid"] > *, .collection-grid > *');
      
      productCards.forEach(card => {
        // Find the product link
        const link = card.querySelector('a[href*="/products/"]');
        if (!link) return;
        
        const url = link.href;
        
        // Get product name from the card (not from the product page)
        let name = '';
        // Try various selectors for the product name
        const nameEl = card.querySelector('.grid-product__title, .product-title, .product-name, h3, h2, .title');
        if (nameEl) {
          name = nameEl.textContent.trim();
        } else if (link.textContent) {
          name = link.textContent.trim();
        }
        
        // Get price from the card
        let price = 0;
        const priceEl = card.querySelector('.price, .product-price, .money, [class*="price"]');
        if (priceEl) {
          const priceMatch = priceEl.textContent.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            price = parseFloat(priceMatch[1]);
          }
        }
        
        // Get image from the card
        let image = '';
        const imgEl = card.querySelector('img');
        if (imgEl) {
          image = imgEl.src;
        }
        
        if (url && name) {
          products.push({
            url: url,
            name: name,
            listPrice: price,
            listImage: image
          });
        }
      });
      
      return products;
    });
    
    console.log(`  Found ${pageProducts.length} products`);
    allProductUrls.push(...pageProducts);
  }
  
  // Remove duplicates
  const uniqueProducts = [];
  const seenUrls = new Set();
  for (const product of allProductUrls) {
    if (!seenUrls.has(product.url)) {
      seenUrls.add(product.url);
      uniqueProducts.push(product);
    }
  }
  
  console.log(`\n📊 Total unique products to scrape: ${uniqueProducts.length}`);
  
  // Now visit each product page for detailed information
  for (let i = 0; i < uniqueProducts.length; i++) {
    const product = uniqueProducts[i];
    const slug = product.url.split('/').pop();
    
    console.log(`\n[${i+1}/${uniqueProducts.length}] ${product.name || slug}`);
    
    try {
      await page.goto(product.url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await page.waitForTimeout(3000);
      
      // Extract detailed product information
      const detailedData = await page.evaluate(() => {
        const data = {};
        
        // Get the product name from the product page
        data.name = document.querySelector('h1.product__title, h1.product-title, h1, .product__info h1')?.textContent?.trim() || '';
        
        // Get price
        const priceEl = document.querySelector('.price__regular, .price-item--regular, .product__price, .price');
        if (priceEl) {
          const priceMatch = priceEl.textContent.match(/\$(\d+(?:\.\d{2})?)/);
          data.price = priceMatch ? parseFloat(priceMatch[1]) : 0;
        } else {
          // Try to find price anywhere in the page
          const bodyText = document.body.textContent;
          const priceMatch = bodyText.match(/\$(\d+(?:\.\d{2})?)/);
          data.price = priceMatch ? parseFloat(priceMatch[1]) : 0;
        }
        
        // Get main product image
        data.imageUrl = document.querySelector('.product__media img, .product-image img, img.feature-image, img[alt*="product"], img[alt*="peptide"]')?.src || '';
        
        // Get description
        data.description = document.querySelector('.product__description, .product-description, .description, [class*="description"]')?.textContent?.trim() || '';
        
        // Get the full page text for protocol extraction
        data.pageText = document.body.innerText || document.body.textContent || '';
        
        return data;
      });
      
      // Parse protocol instructions from page text
      const protocol = {};
      const pageText = detailedData.pageText || '';
      
      // Reconstitution
      const reconMatch = pageText.match(/Reconstitution[:\s]*([^\n]+(?:\n(?!Protocol|Dosage|Timing)[^\n]+)*)/i);
      if (reconMatch) {
        protocol.reconstitution = reconMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
      }
      
      // Protocol Length
      const lengthMatch = pageText.match(/Protocol Length[:\s]*([^\n]+)/i);
      if (lengthMatch) {
        protocol.protocolLength = lengthMatch[1].trim();
      }
      
      // Dosage
      const dosageMatch = pageText.match(/Dosage[:\s]*([^\n]+(?:\n(?!Protocol|Reconstitution|Timing)[^\n]+)*)/i);
      if (dosageMatch) {
        protocol.dosage = dosageMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
      }
      
      // Timing
      const timingMatch = pageText.match(/Timing[:\s]*([^\n]+(?:\n(?!Protocol|Reconstitution|Dosage)[^\n]+)*)/i);
      if (timingMatch) {
        protocol.timing = timingMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
      }
      
      // Try to click "Learn More" button if it exists
      let educationalContent = '';
      try {
        const learnMoreBtn = await page.locator('button:has-text("Learn More"), a:has-text("Learn More")').first();
        if (await learnMoreBtn.isVisible({ timeout: 2000 })) {
          console.log('  📚 Clicking Learn More...');
          await learnMoreBtn.click();
          await page.waitForTimeout(2000);
          
          // Get expanded content
          const expandedText = await page.evaluate(() => document.body.innerText);
          if (expandedText && expandedText.length > pageText.length) {
            const newContent = expandedText.substring(pageText.length);
            educationalContent = newContent.substring(0, 1000);
          }
        }
      } catch (e) {}
      
      // Try to click "More Protocol Information" if it exists
      try {
        const moreProtocolBtn = await page.locator('button:has-text("More Protocol Information"), a:has-text("More Protocol Information")').first();
        if (await moreProtocolBtn.isVisible({ timeout: 2000 })) {
          console.log('  📋 Clicking More Protocol Information...');
          await moreProtocolBtn.click();
          await page.waitForTimeout(2000);
          
          // Re-extract protocol after expansion
          const expandedText = await page.evaluate(() => document.body.innerText);
          
          // Re-parse protocol with expanded content
          const newReconMatch = expandedText.match(/Reconstitution[:\s]*([^\n]+(?:\n(?!Protocol|Dosage|Timing)[^\n]+)*)/i);
          if (newReconMatch && newReconMatch[1].length > (protocol.reconstitution || '').length) {
            protocol.reconstitution = newReconMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
          }
          
          const newDosageMatch = expandedText.match(/Dosage[:\s]*([^\n]+(?:\n(?!Protocol|Reconstitution|Timing)[^\n]+)*)/i);
          if (newDosageMatch && newDosageMatch[1].length > (protocol.dosage || '').length) {
            protocol.dosage = newDosageMatch[1].trim().replace(/\s+/g, ' ').substring(0, 200);
          }
        }
      } catch (e) {}
      
      // Use the name from the product listing if the page name is empty
      const finalName = detailedData.name || product.name || slug;
      
      // Extract vial size from name
      const vialSizeMatch = finalName.match(/(\d+\s*mg|\d+\s*mcg)/i);
      
      // Create the final peptide object
      const peptide = {
        slug: slug,
        name: finalName,
        description: detailedData.description || `${finalName} - Premium quality peptide`,
        imageUrl: detailedData.imageUrl || product.listImage || '',
        url: product.url,
        partnerPrice: detailedData.price || product.listPrice || 0,
        retailPrice: Math.round((detailedData.price || product.listPrice || 0) * 1.5 * 100) / 100,
        storefront: true,
        active: true,
        metadata: {
          category: 'peptide',
          vialSize: vialSizeMatch ? vialSizeMatch[1] : '',
          protocolInstructions: protocol,
          educationalContent: educationalContent
        }
      };
      
      allPeptides.push(peptide);
      
      console.log(`  ✅ ${finalName}: $${peptide.partnerPrice} → $${peptide.retailPrice}`);
      if (Object.keys(protocol).length > 0) {
        console.log(`  📋 Protocol: ${Object.keys(protocol).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      
      // Still save basic info even if detailed scraping fails
      const fallbackPeptide = {
        slug: slug,
        name: product.name || slug,
        description: `${product.name || slug} - Premium quality peptide`,
        imageUrl: product.listImage || '',
        url: product.url,
        partnerPrice: product.listPrice || 0,
        retailPrice: Math.round((product.listPrice || 0) * 1.5 * 100) / 100,
        storefront: true,
        active: true,
        metadata: {
          category: 'peptide',
          vialSize: '',
          protocolInstructions: {},
          educationalContent: ''
        }
      };
      allPeptides.push(fallbackPeptide);
    }
    
    // Small delay between products
    await page.waitForTimeout(1500);
  }
  
  // Save the complete data
  await fs.writeFile('cellularpeptide-final-data.json', JSON.stringify(allPeptides, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 SCRAPING COMPLETE!');
  console.log('='.repeat(60));
  console.log(`📊 Total peptides: ${allPeptides.length}`);
  console.log(`💰 With prices: ${allPeptides.filter(p => p.partnerPrice > 0).length}`);
  console.log(`📋 With protocols: ${allPeptides.filter(p => Object.keys(p.metadata.protocolInstructions).length > 0).length}`);
  console.log(`📚 With education: ${allPeptides.filter(p => p.metadata.educationalContent).length}`);
  console.log(`📁 Saved to: cellularpeptide-final-data.json`);
  
  // Show sample data
  console.log('\n📦 Sample products with protocols:');
  const withProtocols = allPeptides.filter(p => Object.keys(p.metadata.protocolInstructions).length > 0);
  withProtocols.slice(0, 3).forEach(p => {
    console.log(`\n${p.name} ($${p.partnerPrice} → $${p.retailPrice})`);
    if (p.metadata.protocolInstructions.dosage) {
      console.log(`  Dosage: ${p.metadata.protocolInstructions.dosage.substring(0, 100)}`);
    }
    if (p.metadata.protocolInstructions.timing) {
      console.log(`  Timing: ${p.metadata.protocolInstructions.timing.substring(0, 100)}`);
    }
  });
  
  await browser.close();
})();