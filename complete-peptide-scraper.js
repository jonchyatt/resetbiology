const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🚀 Starting COMPLETE peptide data extraction...');
  
  // Connect to existing browser or create new one
  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
  } catch (e) {
    console.log('Using existing browser...');
  }
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  const allPeptides = [];
  
  // Pages to scrape
  const pages = [
    'https://cellularpeptide.com/collections/all',
    'https://cellularpeptide.com/collections/all?page=2&phcursor=eyJhbGciOiJIUzI1NiJ9.eyJzayI6InByb2R1Y3RfdGl0bGUiLCJzdiI6IkpvaW50ICYgV291bmQgSGVhbGluZyBQcm90b2NvbCBQYWNrYWdlIiwiZCI6ImYiLCJ1aWQiOjgyMDMzNTQ4NjU5NzMsImwiOjE2LCJvIjowLCJyIjoiQ1AiLCJ2IjoxLCJwIjoyfQ.mqelBGbrq4eUuJy_vxz3-1g0_nITGLCy_Q7XwL98hvg',
    'https://cellularpeptide.com/collections/all?page=3&phcursor=eyJhbGciOiJIUzI1NiJ9.eyJzayI6InByb2R1Y3RfdGl0bGUiLCJzdiI6IlNlbWF4IDMwbWcgLSBTaW5nbGUgVmlhbCIsImQiOiJmIiwidWlkIjo5MTgwNzE1ODc2NjYxLCJsIjoxNiwibyI6MCwiciI6IkNQIiwidiI6MSwicCI6M30.GP3kFnRXXr6TqL4hHQBIhMsPb_iG3ZblBA1aSMqb9zs'
  ];
  
  for (const pageUrl of pages) {
    console.log(`\n📄 Processing page: ${pageUrl.split('?')[0]}...`);
    
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Get all product links on this page
    const productLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href*="/products/"]').forEach(link => {
        const href = link.href;
        if (!links.includes(href)) {
          links.push(href);
        }
      });
      return links;
    });
    
    console.log(`Found ${productLinks.length} product links on this page`);
    
    // Process each product
    for (let i = 0; i < productLinks.length; i++) {
      const productUrl = productLinks[i];
      const productName = productUrl.split('/').pop();
      
      console.log(`\n  📦 [${i+1}/${productLinks.length}] Processing: ${productName}`);
      
      try {
        await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Extract basic product info
        const basicInfo = await page.evaluate(() => {
          const data = {};
          
          // Name
          data.name = document.querySelector('h1, .product-title, [class*="title"]')?.textContent?.trim() || '';
          
          // Price
          const priceEl = document.querySelector('.price, .product-price, [class*="price"], .money');
          const priceMatch = priceEl?.textContent?.match(/\$(\d+\.?\d*)/);
          data.partnerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
          data.retailPrice = data.partnerPrice ? Math.round(data.partnerPrice * 1.5 * 100) / 100 : 0;
          
          // Image
          data.imageUrl = document.querySelector('.product-image img, .product-photo img, [class*="product"] img')?.src || '';
          
          // Basic description
          data.description = document.querySelector('.product-description, [class*="description"], .product-details')?.textContent?.trim() || '';
          
          return data;
        });
        
        // Look for Protocol Instructions section
        console.log('    🔍 Looking for Protocol Instructions...');
        let protocolInstructions = {};
        
        try {
          // Look for protocol section
          const protocolSection = await page.locator('text="Protocol Instructions"').first();
          if (await protocolSection.isVisible({ timeout: 5000 })) {
            
            // Extract protocol data
            protocolInstructions = await page.evaluate(() => {
              const protocol = {};
              
              // Find reconstitution info
              const reconText = document.body.textContent;
              const reconMatch = reconText.match(/Reconstitution:(.*?)(?=Protocol Length:|Dosage:|Timing:|$)/s);
              if (reconMatch) {
                protocol.reconstitution = reconMatch[1].trim();
              }
              
              // Find protocol length
              const lengthMatch = reconText.match(/Protocol Length:(.*?)(?=Reconstitution:|Dosage:|Timing:|$)/s);
              if (lengthMatch) {
                protocol.protocolLength = lengthMatch[1].trim();
              }
              
              // Find dosage
              const dosageMatch = reconText.match(/Dosage:(.*?)(?=Reconstitution:|Protocol Length:|Timing:|$)/s);
              if (dosageMatch) {
                protocol.dosage = dosageMatch[1].trim();
              }
              
              // Find timing
              const timingMatch = reconText.match(/Timing:(.*?)(?=Reconstitution:|Protocol Length:|Dosage:|$)/s);
              if (timingMatch) {
                protocol.timing = timingMatch[1].trim();
              }
              
              return protocol;
            });
            
            console.log('    ✅ Found protocol instructions');
          }
        } catch (e) {
          console.log('    ⚠️  No protocol instructions found');
        }
        
        // Look for "More Protocol Information" button
        console.log('    🔍 Looking for More Protocol Information...');
        try {
          const moreProtocolBtn = page.locator('text="More Protocol Information"').first();
          if (await moreProtocolBtn.isVisible({ timeout: 5000 })) {
            await moreProtocolBtn.click();
            await page.waitForTimeout(2000);
            console.log('    ✅ Clicked More Protocol Information');
          }
        } catch (e) {
          console.log('    ⚠️  No More Protocol Information button found');
        }
        
        // Look for "Learn More" button and educational content
        console.log('    🔍 Looking for Learn More button...');
        let educationalContent = '';
        
        try {
          const learnMoreBtn = page.locator('text="Learn More"').first();
          if (await learnMoreBtn.isVisible({ timeout: 5000 })) {
            await learnMoreBtn.click();
            await page.waitForTimeout(3000);
            
            // Extract educational content after clicking
            educationalContent = await page.evaluate(() => {
              // Look for expanded content, modal, or new section
              const content = document.querySelector('.educational-content, .learn-more-content, .expanded-content, .modal-content, .popup-content');
              return content ? content.textContent.trim() : document.body.textContent.match(/Learn More(.*?)(?=Protocol|$)/s)?.[1]?.trim() || '';
            });
            
            console.log('    ✅ Extracted educational content');
          }
        } catch (e) {
          console.log('    ⚠️  No Learn More button found');
        }
        
        // Compile final product data
        const peptide = {
          slug: productName,
          name: basicInfo.name,
          description: basicInfo.description,
          imageUrl: basicInfo.imageUrl,
          url: productUrl,
          partnerPrice: basicInfo.partnerPrice,
          retailPrice: basicInfo.retailPrice,
          storefront: true,
          active: true,
          metadata: {
            category: 'peptide',
            vialSize: basicInfo.name.match(/(\d+mg|\d+mcg)/)?.[1] || '',
            protocolInstructions: protocolInstructions,
            educationalContent: educationalContent
          }
        };
        
        allPeptides.push(peptide);
        console.log(`    ✅ Completed: ${basicInfo.name} ($${basicInfo.partnerPrice} → $${basicInfo.retailPrice})`);
        
      } catch (error) {
        console.log(`    ❌ Error processing ${productName}: ${error.message}`);
      }
      
      // Small delay between products
      await page.waitForTimeout(1000);
    }
  }
  
  // Save complete data
  await fs.writeFile('complete-peptide-data.json', JSON.stringify(allPeptides, null, 2));
  
  console.log(`\n🎉 SCRAPING COMPLETE!`);
  console.log(`📊 Total peptides extracted: ${allPeptides.length}`);
  console.log(`📁 Data saved to: complete-peptide-data.json`);
  
  // Show summary
  const withPrices = allPeptides.filter(p => p.partnerPrice > 0);
  const withProtocols = allPeptides.filter(p => Object.keys(p.metadata.protocolInstructions).length > 0);
  const withEducation = allPeptides.filter(p => p.metadata.educationalContent);
  
  console.log(`💰 Products with prices: ${withPrices.length}`);
  console.log(`📋 Products with protocols: ${withProtocols.length}`);
  console.log(`📚 Products with education: ${withEducation.length}`);
  
  await browser.close();
})();