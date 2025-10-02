// This script should be run in the browser console on cellularpeptide.com/collections/all

console.log('🔍 Scraping products from current page...\n');

const products = [];

// Find all product links
document.querySelectorAll('a[href*="/products/"]').forEach(link => {
  const url = link.href;
  
  // Skip duplicates
  if (products.find(p => p.url === url)) return;
  
  // Get product name
  let name = link.textContent?.trim();
  if (!name) {
    // Try parent element
    name = link.parentElement?.textContent?.trim();
  }
  
  // Find price
  let price = null;
  let parent = link.parentElement;
  let attempts = 0;
  while (parent && !price && attempts < 5) {
    const priceMatch = parent.textContent?.match(/\$(\d+\.?\d*)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }
    parent = parent.parentElement;
    attempts++;
  }
  
  // Find image
  let imageUrl = null;
  parent = link.parentElement;
  attempts = 0;
  while (parent && !imageUrl && attempts < 5) {
    const img = parent.querySelector('img');
    if (img) {
      imageUrl = img.src;
    }
    parent = parent.parentElement;
    attempts++;
  }
  
  if (name && url) {
    const slug = url.split('/').pop() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    products.push({
      name: name.replace(/\$\d+\.?\d*/, '').trim(),
      url: url,
      slug: slug,
      partnerPrice: price || 0,
      retailPrice: price ? Math.round(price * 1.5 * 100) / 100 : 0,
      imageUrl: imageUrl
    });
  }
});

console.log(`Found ${products.length} products\n`);
console.log('Sample data:');
products.slice(0, 3).forEach(p => {
  console.log(`- ${p.name}: $${p.partnerPrice} → $${p.retailPrice}`);
});

console.log('\n📋 Full JSON data (copy this):');
console.log(JSON.stringify(products, null, 2));

// Also copy to clipboard if possible
if (navigator.clipboard) {
  navigator.clipboard.writeText(JSON.stringify(products, null, 2))
    .then(() => console.log('✅ Data copied to clipboard!'))
    .catch(() => console.log('⚠️  Could not copy to clipboard, please copy manually'));
}

products;