const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🚀 Fast scraper starting...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Try to load cookies
  try {
    const cookies = JSON.parse(await fs.readFile('/tmp/cellularpeptide_cookies_fresh.json', 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Cookies loaded');
  } catch (e) {}
  
  const allPeptides = [];
  
  console.log('📱 Going to first page...');
  await page.goto('https://cellularpeptide.com/collections/all', { 
    waitUntil: 'domcontentloaded',
    timeout: 15000 
  });
  
  console.log('⏳ Waiting for products to load...');
  await page.waitForTimeout(5000);
  
  // Get product links from all 3 pages at once
  const allProductLinks = [];
  
  for (let pageNum = 1; pageNum <= 3; pageNum++) {
    if (pageNum > 1) {
      console.log(`\n📄 Going to page ${pageNum}...`);
      const pageUrl = pageNum === 2 
        ? 'https://cellularpeptide.com/collections/all?page=2'
        : 'https://cellularpeptide.com/collections/all?page=3';
      
      await page.goto(pageUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await page.waitForTimeout(3000);
    }
    
    console.log(`🔍 Getting product links from page ${pageNum}...`);
    
    const links = await page.evaluate(() => {
      const productLinks = [];
      document.querySelectorAll('a').forEach(a => {
        if (a.href && a.href.includes('/products/') && !a.href.includes('?')) {
          productLinks.push(a.href);
        }
      });
      return [...new Set(productLinks)]; // Remove duplicates
    });
    
    console.log(`  Found ${links.length} products`);
    allProductLinks.push(...links);
  }
  
  const uniqueLinks = [...new Set(allProductLinks)];
  console.log(`\n📊 Total unique products to scrape: ${uniqueLinks.length}`);
  
  // Process each product
  for (let i = 0; i < uniqueLinks.length; i++) {
    const url = uniqueLinks[i];
    const slug = url.split('/').pop();
    
    console.log(`\n[${i+1}/${uniqueLinks.length}] ${slug}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      await page.waitForTimeout(2000);
      
      const data = await page.evaluate(() => {
        const result = {};
        
        // Name
        result.name = document.querySelector('h1')?.textContent?.trim() || '';
        
        // Price
        const priceText = document.body.textContent || '';
        const priceMatch = priceText.match(/\$(\d+(?:\.\d{2})?)/);
        result.partnerPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
        
        // Image
        const img = document.querySelector('img[src*="cdn"], img[src*="product"]');
        result.imageUrl = img?.src || '';
        
        // Description
        const desc = document.querySelector('[class*="description"], [class*="content"]');
        result.description = desc?.textContent?.trim().substring(0, 500) || '';
        
        // Full text for protocol extraction
        result.fullText = document.body.innerText || '';
        
        return result;
      });
      
      // Parse protocol from full text
      const protocol = {};
      
      if (data.fullText) {
        const reconMatch = data.fullText.match(/Reconstitution[:\s]*([^\n]+)/i);
        if (reconMatch) protocol.reconstitution = reconMatch[1].trim();
        
        const lengthMatch = data.fullText.match(/Protocol Length[:\s]*([^\n]+)/i);
        if (lengthMatch) protocol.protocolLength = lengthMatch[1].trim();
        
        const dosageMatch = data.fullText.match(/Dosage[:\s]*([^\n]+)/i);
        if (dosageMatch) protocol.dosage = dosageMatch[1].trim();
        
        const timingMatch = data.fullText.match(/Timing[:\s]*([^\n]+)/i);
        if (timingMatch) protocol.timing = timingMatch[1].trim();
      }
      
      // Try to click buttons for more info
      try {
        const learnMore = await page.locator('text="Learn More"').first();
        if (await learnMore.isVisible({ timeout: 1000 })) {
          await learnMore.click();
          await page.waitForTimeout(1500);
        }
      } catch (e) {}
      
      try {
        const moreProtocol = await page.locator('text="More Protocol Information"').first();
        if (await moreProtocol.isVisible({ timeout: 1000 })) {
          await moreProtocol.click();
          await page.waitForTimeout(1500);
        }
      } catch (e) {}
      
      // Get any expanded content
      const expandedContent = await page.evaluate(() => {
        return document.body.innerText?.substring(0, 3000) || '';
      });
      
      const peptide = {
        slug: slug,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        url: url,
        partnerPrice: data.partnerPrice,
        retailPrice: Math.round(data.partnerPrice * 1.5 * 100) / 100,
        storefront: true,
        active: true,
        metadata: {
          category: 'peptide',
          vialSize: data.name.match(/(\d+\s*mg)/i)?.[1] || '',
          protocolInstructions: protocol,
          educationalContent: expandedContent.length > data.fullText.length 
            ? expandedContent.substring(data.fullText.length, data.fullText.length + 1000)
            : ''
        }
      };
      
      allPeptides.push(peptide);
      console.log(`  ✅ ${data.name}: $${data.partnerPrice} → $${peptide.retailPrice}`);
      
      if (Object.keys(protocol).length > 0) {
        console.log(`  📋 Has protocol: ${Object.keys(protocol).join(', ')}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    // Quick delay
    await page.waitForTimeout(1000);
  }
  
  // Save data
  await fs.writeFile('peptide-data-complete.json', JSON.stringify(allPeptides, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ SCRAPING COMPLETE!');
  console.log(`📊 Total: ${allPeptides.length} peptides`);
  console.log(`💰 With prices: ${allPeptides.filter(p => p.partnerPrice > 0).length}`);
  console.log(`📋 With protocols: ${allPeptides.filter(p => Object.keys(p.metadata.protocolInstructions).length > 0).length}`);
  console.log(`📁 Saved to: peptide-data-complete.json`);
  
  await browser.close();
})();