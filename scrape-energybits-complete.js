const { chromium } = require('playwright');
const fs = require('fs').promises;

(async () => {
  console.log('🚀 Starting EnergyBits Playwright scraper...');

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

  const allProducts = [];

  // Start at EnergyBits collections page
  const collectionUrl = 'https://energybits.com/collections/all';

  console.log(`\n📄 Loading page: ${collectionUrl}`);
  await page.goto(collectionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

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

  console.log(`Found ${productLinks.length} products on EnergyBits`);

  // Visit each product page
  for (let i = 0; i < productLinks.length; i++) {
    const productUrl = productLinks[i];
    const slug = productUrl.split('/').pop().split('?')[0]; // Remove query params

    console.log(`\n  [${i+1}/${productLinks.length}] Processing: ${slug}`);

    try {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // Extract all product data
      const productData = await page.evaluate(() => {
        const data = {};

        // Get title
        data.name = document.querySelector('h1, .product-title, .product__title, [class*="product-title"]')?.textContent?.trim() || '';

        // Get description
        const descEl = document.querySelector('.product-description, .product__description, [class*="description"]');
        data.description = descEl?.textContent?.trim() || '';

        // Get price - try multiple selectors
        const priceText = document.body.textContent;
        const priceMatch = priceText.match(/\$(\d+\.?\d*)/);
        data.price = priceMatch ? priceMatch[1] : '0';

        // Get all images
        data.images = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.dataset.src;
          if (src && (src.includes('cdn.shopify.com') || src.includes('energybits'))) {
            // Get high-res version
            const cleanSrc = src.split('?')[0];
            if (!data.images.includes(cleanSrc)) {
              data.images.push(cleanSrc);
            }
          }
        });

        // Get benefits/features (bullet points)
        data.benefits = [];
        document.querySelectorAll('li').forEach(li => {
          const text = li.textContent?.trim();
          if (text && text.length > 10 && text.length < 200) {
            data.benefits.push(text);
          }
        });

        // Extract ingredients
        const bodyText = document.body.innerText || '';
        const ingredientsMatch = bodyText.match(/Ingredients?[:\s]*([^\n]*(?:\n(?!Directions|Dosage|Warning)[^\n]*)*)/i);
        data.ingredients = ingredientsMatch ? ingredientsMatch[1].trim().substring(0, 500) : '';

        // Extract directions/usage
        const directionsMatch = bodyText.match(/Directions?|How to (use|take)[:\s]*([^\n]*(?:\n(?!Ingredients|Warning)[^\n]*)*)/i);
        data.usage = directionsMatch ? directionsMatch[2]?.trim().substring(0, 500) : '';

        // Extract nutrition facts
        const nutritionMatch = bodyText.match(/Nutrition Facts[:\s]*([\s\S]{0,500})/i);
        data.nutritionFacts = nutritionMatch ? nutritionMatch[1].trim() : '';

        return data;
      });

      // Try to find and click "Learn More" or expandable sections
      try {
        const buttons = await page.locator('button, [role="button"]').all();
        for (const button of buttons) {
          const text = await button.textContent();
          if (text && (text.includes('Learn') || text.includes('More') || text.includes('Read'))) {
            console.log(`    Clicking: ${text.trim()}`);
            await button.click();
            await page.waitForTimeout(1500);
          }
        }
      } catch (e) {
        // No expandable content
      }

      // Get any newly revealed content
      const expandedContent = await page.evaluate(() => {
        return document.body.innerText;
      });

      // Update description if we got more content
      if (expandedContent.length > productData.description.length) {
        productData.description = expandedContent.substring(0, 1000);
      }

      // Create final product object
      const product = {
        slug: slug,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        currency: 'USD',
        images: productData.images.slice(0, 10), // Keep best 10 images
        benefits: productData.benefits.slice(0, 8), // Keep top 8 benefits
        ingredients: productData.ingredients,
        usage: productData.usage,
        nutritionFacts: productData.nutritionFacts,
        sourceUrl: productUrl,
        storefront: true,
        active: true,
        category: 'algae-supplement',
        vendor: 'EnergyBits',
        scrapedAt: new Date().toISOString()
      };

      allProducts.push(product);
      console.log(`    ✅ Scraped: ${productData.name} - $${productData.price}`);
      console.log(`    📸 Images: ${productData.images.length}`);
      console.log(`    💊 Benefits: ${productData.benefits.length}`);

    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
    }

    // Small delay between products
    await page.waitForTimeout(1500);
  }

  // Save all data
  const filename = 'energybits-complete-scraped-data.json';
  await fs.writeFile(filename, JSON.stringify(allProducts, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('🎉 ENERGYBITS SCRAPING COMPLETE!');
  console.log('='.repeat(50));
  console.log(`📊 Total products scraped: ${allProducts.length}`);
  console.log(`💰 Products with prices: ${allProducts.filter(p => parseFloat(p.price) > 0).length}`);
  console.log(`📸 Products with images: ${allProducts.filter(p => p.images.length > 0).length}`);
  console.log(`💊 Products with benefits: ${allProducts.filter(p => p.benefits.length > 0).length}`);
  console.log(`📁 Data saved to: ${filename}`);

  // Show sample
  console.log('\n📦 Sample products:');
  allProducts.slice(0, 3).forEach(p => {
    console.log(`\n  ${p.name}`);
    console.log(`  Price: $${p.price}`);
    console.log(`  Images: ${p.images.length}`);
    if (p.benefits.length > 0) {
      console.log(`  First benefit: ${p.benefits[0].substring(0, 60)}...`);
    }
  });

  await browser.close();
})();
