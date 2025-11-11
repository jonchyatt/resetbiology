#!/usr/bin/env node

/**
 * Ultimate Product Scraper v2.0
 * Scrapes StemRegen and EnergyBits products
 *
 * Usage:
 *   node ultimate-scraper-v2.js <URL> <output-file.json>
 *
 * Examples:
 *   node ultimate-scraper-v2.js "https://www.stemregen.co/products/release" "stemregen-release.json"
 *   node ultimate-scraper-v2.js "https://energybits.com/products/spirulina" "energybits-spirulina.json"
 */

const https = require('https');
const fs = require('fs');

const url = process.argv[2];
const outputFile = process.argv[3] || 'scraped-product.json';

if (!url) {
  console.error('❌ Please provide a URL');
  console.error('Usage: node ultimate-scraper-v2.js <URL> <output-file.json>');
  process.exit(1);
}

console.log('🔍 Scraping:', url);

// Fetch the page
https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (res) => {
  let html = '';

  res.on('data', (chunk) => {
    html += chunk;
  });

  res.on('end', () => {
    try {
      const product = extractProductData(html, url);

      fs.writeFileSync(outputFile, JSON.stringify(product, null, 2));
      console.log('✅ Scraped successfully! Saved to:', outputFile);
      console.log('📦 Product:', product.name);
      console.log('💰 Price:', product.price);

    } catch (err) {
      console.error('❌ Scraping failed:', err.message);
      process.exit(1);
    }
  });

}).on('error', (err) => {
  console.error('❌ Request failed:', err.message);
  process.exit(1);
});

function extractProductData(html, url) {
  const product = {
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    images: [],
    variants: [],
    ingredients: '',
    benefits: [],
    usage: '',
    sourceUrl: url,
    scrapedAt: new Date().toISOString()
  };

  // Extract product name
  const titleMatch = html.match(/<h1[^>]*class="[^"]*product[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                    html.match(/<title>([^|<]+)/);
  if (titleMatch) {
    product.name = titleMatch[1].trim();
  }

  // Extract description
  const descMatch = html.match(/<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]{0,2000}?)<\/div>/i) ||
                    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
  if (descMatch) {
    product.description = descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
  }

  // Extract price
  const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
  if (priceMatch) {
    product.price = priceMatch[1];
  }

  // Extract images
  const imgMatches = html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi);
  for (const match of imgMatches) {
    const src = match[1];
    if (src.includes('cdn.shopify.com') || src.includes('product') || src.includes('energybits') || src.includes('stemregen')) {
      if (src.startsWith('//')) {
        product.images.push('https:' + src);
      } else if (src.startsWith('http')) {
        product.images.push(src);
      }
    }
  }

  // Extract product JSON-LD data if available
  const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      if (jsonData['@type'] === 'Product') {
        product.name = jsonData.name || product.name;
        product.description = jsonData.description || product.description;
        if (jsonData.offers) {
          product.price = jsonData.offers.price || product.price;
          product.currency = jsonData.offers.priceCurrency || product.currency;
        }
        if (jsonData.image) {
          const images = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
          product.images = [...new Set([...product.images, ...images])];
        }
      }
    } catch (e) {
      // JSON-LD parsing failed, continue
    }
  }

  // Extract benefits (bullet points)
  const benefitsMatches = html.matchAll(/<li[^>]*>([^<]+(?:<[^>]+>[^<]+<\/[^>]+>)?[^<]*)<\/li>/gi);
  for (const match of benefitsMatches) {
    const benefit = match[1].replace(/<[^>]+>/g, '').trim();
    if (benefit.length > 10 && benefit.length < 200) {
      product.benefits.push(benefit);
    }
  }

  // Keep only unique, relevant benefits
  product.benefits = [...new Set(product.benefits)].slice(0, 8);

  return product;
}
