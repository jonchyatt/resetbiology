const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🚀 Starting Playwright scraper...');
  
  // Launch browser in headful mode
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Load cookies if they exist
  try {
    const cookies = JSON.parse(await fs.readFile('/tmp/cellularpeptide_cookies_fresh.json', 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Loaded saved cookies');
  } catch (e) {
    console.log('⚠️  No cookies found, proceeding without');
  }
  
  const allPeptides = [];
  
  // Process all 3 pages
  const pageUrls = [
    'https://cellularpeptide.com/collections/all',
    'https://cellularpeptide.com/collections/all?page=2',
    'https://cellularpeptide.com/collections/all?page=3'
  ];
  
  for (const collectionUrl of pageUrls) {
    console.log(`\n📄 Loading page: ${collectionUrl}`);
    await page.goto(collectionUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Get all product links on this page
    const productLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach(a => {
        if (a.href && a.href.includes('/products/')) {
          if (!links.includes(a.href)) {
            links.push(a.href);
          }
        }
      });
      return links;
    });
    
    console.log(`Found ${productLinks.length} products on this page`);
    
    // Visit each product page
    for (let i = 0; i < productLinks.length; i++) {
      const productUrl = productLinks[i];
      const slug = productUrl.split('/').pop();
      
      console.log(`\n  [${i+1}/${productLinks.length}] Processing: ${slug}`);
      
      try {
        await page.goto(productUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Extract all product data
        const productData = await page.evaluate(() => {
          const data = {};
          
          // Get title
          data.name = document.querySelector('h1, .product-title, .product__title')?.textContent?.trim() || '';
          
          // Get price
          const priceEl = document.querySelector('.price, .product-price, .price__regular, .product__price');
          const priceText = priceEl?.textContent || document.body.textContent;
          const priceMatch = priceText.match(/\$(\d+\.?\d*)/);
          data.partnerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
          
          // Get main image
          data.imageUrl = document.querySelector('img.product__media, img.product-image, .product__image img, img[alt*="product"]')?.src || '';
          
          // Get description
          data.description = document.querySelector('.product-description, .product__description, .description')?.textContent?.trim() || '';
          
          // Extract protocol instructions from page text
          const bodyText = document.body.innerText || document.body.textContent || '';
          
          // Protocol parsing
          const protocol = {};
          
          // Reconstitution
          const reconMatch = bodyText.match(/Reconstitution[:\s]*([^\n]*(?:\n(?!Protocol|Dosage|Timing)[^\n]*)*)/i);
          if (reconMatch) protocol.reconstitution = reconMatch[1].trim().replace(/\s+/g, ' ');
          
          // Protocol Length  
          const lengthMatch = bodyText.match(/Protocol Length[:\s]*([^\n]*)/i);
          if (lengthMatch) protocol.protocolLength = lengthMatch[1].trim();
          
          // Dosage
          const dosageMatch = bodyText.match(/Dosage[:\s]*([^\n]*(?:\n(?!Protocol|Reconstitution|Timing)[^\n]*)*)/i);
          if (dosageMatch) protocol.dosage = dosageMatch[1].trim().replace(/\s+/g, ' ');
          
          // Timing
          const timingMatch = bodyText.match(/Timing[:\s]*([^\n]*(?:\n(?!Protocol|Reconstitution|Dosage)[^\n]*)*)/i);
          if (timingMatch) protocol.timing = timingMatch[1].trim().replace(/\s+/g, ' ');
          
          data.protocolInstructions = protocol;
          
          // Look for educational content sections
          const educationMatch = bodyText.match(/(?:Learn More|Education|About|What is|Benefits)[\s:]*([^\n]{50,})/i);
          data.educationalContent = educationMatch ? educationMatch[1].trim() : '';
          
          return data;
        });
        
        // Try to click "Learn More" button if it exists
        try {
          const learnMoreButton = await page.locator('button:has-text("Learn More"), a:has-text("Learn More"), [class*="learn"]:has-text("More")').first();
          if (await learnMoreButton.isVisible({ timeout: 2000 })) {
            console.log('    Clicking Learn More button...');
            await learnMoreButton.click();
            await page.waitForTimeout(2000);
            
            // Get expanded content
            const expandedContent = await page.evaluate(() => {
              // Look for modal or expanded content
              const modal = document.querySelector('.modal, .popup, .overlay, .expanded-content');
              if (modal) return modal.innerText;
              
              // Or just get the full page text if it expanded inline
              return document.body.innerText;
            });
            
            if (expandedContent && expandedContent.length > productData.educationalContent.length) {
              productData.educationalContent = expandedContent.substring(0, 2000); // Limit size
            }
          }
        } catch (e) {
          // No Learn More button, that's ok
        }
        
        // Try to click "More Protocol Information" if it exists
        try {
          const moreProtocolButton = await page.locator('text="More Protocol Information"').first();
          if (await moreProtocolButton.isVisible({ timeout: 2000 })) {
            console.log('    Clicking More Protocol Information...');
            await moreProtocolButton.click();
            await page.waitForTimeout(2000);
            
            // Re-extract protocol data after expansion
            const expandedProtocol = await page.evaluate(() => {
              const bodyText = document.body.innerText || '';
              const protocol = {};
              
              const reconMatch = bodyText.match(/Reconstitution[:\s]*([^\n]*(?:\n(?!Protocol|Dosage|Timing)[^\n]*)*)/i);
              if (reconMatch) protocol.reconstitution = reconMatch[1].trim().replace(/\s+/g, ' ');
              
              const lengthMatch = bodyText.match(/Protocol Length[:\s]*([^\n]*)/i);
              if (lengthMatch) protocol.protocolLength = lengthMatch[1].trim();
              
              const dosageMatch = bodyText.match(/Dosage[:\s]*([^\n]*(?:\n(?!Protocol|Reconstitution|Timing)[^\n]*)*)/i);
              if (dosageMatch) protocol.dosage = dosageMatch[1].trim().replace(/\s+/g, ' ');
              
              const timingMatch = bodyText.match(/Timing[:\s]*([^\n]*(?:\n(?!Protocol|Reconstitution|Dosage)[^\n]*)*)/i);
              if (timingMatch) protocol.timing = timingMatch[1].trim().replace(/\s+/g, ' ');
              
              return protocol;
            });
            
            // Update protocol if we got more info
            if (Object.keys(expandedProtocol).length > Object.keys(productData.protocolInstructions).length) {
              productData.protocolInstructions = expandedProtocol;
            }
          }
        } catch (e) {
          // No More Protocol button, that's ok
        }
        
        // Create final peptide object
        const peptide = {
          slug: slug,
          name: productData.name,
          description: productData.description,
          imageUrl: productData.imageUrl,
          url: productUrl,
          partnerPrice: productData.partnerPrice,
          retailPrice: Math.round(productData.partnerPrice * 1.5 * 100) / 100,
          storefront: true,
          active: true,
          metadata: {
            category: 'peptide',
            vialSize: productData.name.match(/(\d+\s*mg|\d+\s*mcg)/i)?.[1] || '',
            protocolInstructions: productData.protocolInstructions,
            educationalContent: productData.educationalContent
          }
        };
        
        allPeptides.push(peptide);
        console.log(`    ✅ Scraped: ${productData.name} - $${productData.partnerPrice}`);
        
        // Show if we got protocol data
        if (Object.keys(productData.protocolInstructions).length > 0) {
          console.log(`    📋 Protocol: ${Object.keys(productData.protocolInstructions).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
      }
      
      // Small delay between products
      await page.waitForTimeout(1500);
    }
  }
  
  // Save all data
  const filename = 'cellularpeptide-complete-data.json';
  await fs.writeFile(filename, JSON.stringify(allPeptides, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 SCRAPING COMPLETE!');
  console.log('='.repeat(50));
  console.log(`📊 Total peptides scraped: ${allPeptides.length}`);
  console.log(`💰 Products with prices: ${allPeptides.filter(p => p.partnerPrice > 0).length}`);
  console.log(`📋 Products with protocols: ${allPeptides.filter(p => Object.keys(p.metadata.protocolInstructions).length > 0).length}`);
  console.log(`📚 Products with education: ${allPeptides.filter(p => p.metadata.educationalContent).length}`);
  console.log(`📁 Data saved to: ${filename}`);
  
  // Show sample
  console.log('\n📦 Sample products:');
  allPeptides.slice(0, 3).forEach(p => {
    console.log(`\n  ${p.name}`);
    console.log(`  Price: $${p.partnerPrice} → $${p.retailPrice}`);
    if (p.metadata.protocolInstructions.dosage) {
      console.log(`  Dosage: ${p.metadata.protocolInstructions.dosage}`);
    }
  });
  
  await browser.close();
})();