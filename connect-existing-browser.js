const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🔗 Connecting to existing browser session...');
  
  // Try to connect to existing browser on common debug ports
  let browser;
  let page;
  
  for (const port of [9222, 9223, 9224]) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${port}`);
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        const context = contexts[0];
        const pages = context.pages();
        if (pages.length > 0) {
          page = pages[0];
          console.log(`✅ Connected to existing browser on port ${port}`);
          console.log(`📄 Current page: ${page.url()}`);
          break;
        }
      }
    } catch (e) {
      // Try next port
    }
  }
  
  if (!page) {
    console.log('❌ Could not connect to existing browser');
    console.log('Please ensure browser is running with --remote-debugging-port=9222');
    return;
  }
  
  // Navigate to the collections page if not already there
  if (!page.url().includes('cellularpeptide.com')) {
    console.log('📱 Navigating to cellularpeptide.com...');
    await page.goto('https://cellularpeptide.com/collections/all');
  }
  
  console.log('🔍 Extracting product links...');
  
  // Get all product links from current page
  const productLinks = await page.evaluate(() => {
    const links = [];
    const anchors = document.querySelectorAll('a');
    anchors.forEach(anchor => {
      if (anchor.href && anchor.href.includes('/products/')) {
        if (!links.includes(anchor.href)) {
          links.push(anchor.href);
        }
      }
    });
    return links;
  });
  
  console.log(`Found ${productLinks.length} product links`);
  
  if (productLinks.length === 0) {
    console.log('🔍 Trying alternative selectors...');
    
    // Try to find any links on the page
    const allLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach(a => {
        links.push({
          href: a.href,
          text: a.textContent?.trim().substring(0, 50)
        });
      });
      return links.slice(0, 10); // Just first 10 for debugging
    });
    
    console.log('📋 Sample links found:');
    allLinks.forEach(link => {
      console.log(`  - ${link.text}: ${link.href}`);
    });
    
    return;
  }
  
  // Process each product
  const allPeptides = [];
  
  for (let i = 0; i < Math.min(productLinks.length, 5); i++) { // Start with first 5
    const productUrl = productLinks[i];
    const productName = productUrl.split('/').pop();
    
    console.log(`\n📦 [${i+1}/5] Processing: ${productName}`);
    
    try {
      await page.goto(productUrl);
      await page.waitForLoadState('networkidle');
      
      // Extract all data from this product page
      const productData = await page.evaluate(() => {
        const data = {};
        
        // Basic info
        data.name = document.querySelector('h1')?.textContent?.trim() || 'Unknown';
        
        // Price
        const priceText = document.body.textContent;
        const priceMatch = priceText.match(/\$(\d+\.?\d*)/);
        data.partnerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
        data.retailPrice = data.partnerPrice * 1.5;
        
        // Image
        data.imageUrl = document.querySelector('img')?.src || '';
        
        // Description
        data.description = document.querySelector('[class*="description"]')?.textContent?.trim() || '';
        
        // Protocol Instructions - extract from page text
        const pageText = document.body.textContent;
        
        // Extract protocol data using regex
        const reconMatch = pageText.match(/Reconstitution[:\s]+(.*?)(?=Protocol Length|Dosage|Timing|$)/si);
        const lengthMatch = pageText.match(/Protocol Length[:\s]+(.*?)(?=Reconstitution|Dosage|Timing|$)/si);
        const dosageMatch = pageText.match(/Dosage[:\s]+(.*?)(?=Reconstitution|Protocol Length|Timing|$)/si);
        const timingMatch = pageText.match(/Timing[:\s]+(.*?)(?=Reconstitution|Protocol Length|Dosage|$)/si);
        
        data.protocolInstructions = {
          reconstitution: reconMatch ? reconMatch[1].trim() : '',
          protocolLength: lengthMatch ? lengthMatch[1].trim() : '',
          dosage: dosageMatch ? dosageMatch[1].trim() : '',
          timing: timingMatch ? timingMatch[1].trim() : ''
        };
        
        // Look for educational content
        const learnMoreMatch = pageText.match(/Learn More[:\s]+(.*?)(?=Protocol|$)/si);
        data.educationalContent = learnMoreMatch ? learnMoreMatch[1].trim() : '';
        
        return data;
      });
      
      // Click Learn More if available
      try {
        const learnMoreBtn = page.locator('text="Learn More"').first();
        if (await learnMoreBtn.isVisible({ timeout: 3000 })) {
          await learnMoreBtn.click();
          await page.waitForTimeout(2000);
          
          // Get additional educational content
          const additionalContent = await page.evaluate(() => {
            return document.body.textContent;
          });
          
          if (additionalContent.length > productData.educationalContent.length) {
            productData.educationalContent = additionalContent;
          }
        }
      } catch (e) {
        // No Learn More button
      }
      
      const peptide = {
        slug: productName,
        name: productData.name,
        description: productData.description,
        imageUrl: productData.imageUrl,
        url: productUrl,
        partnerPrice: productData.partnerPrice,
        retailPrice: Math.round(productData.retailPrice * 100) / 100,
        storefront: true,
        active: true,
        metadata: {
          category: 'peptide',
          vialSize: productData.name.match(/(\d+mg|\d+mcg)/)?.[1] || '',
          protocolInstructions: productData.protocolInstructions,
          educationalContent: productData.educationalContent.substring(0, 1000) // Limit length
        }
      };
      
      allPeptides.push(peptide);
      console.log(`✅ ${productData.name}: $${productData.partnerPrice} → $${peptide.retailPrice}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  // Save data
  await fs.writeFile('peptide-data-sample.json', JSON.stringify(allPeptides, null, 2));
  console.log(`\n✅ Saved ${allPeptides.length} peptides to peptide-data-sample.json`);
  
})();