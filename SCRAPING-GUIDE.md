# Product Scraping Guide

## Overview
This guide explains how to scrape and import products from StemRegen and EnergyBits.

## Tools Created

### 1. `ultimate-scraper-v2.js`
Universal product scraper that works with most Shopify-based stores.

**Usage:**
```bash
node ultimate-scraper-v2.js <URL> <output-file.json>
```

**Examples:**
```bash
# StemRegen products
node ultimate-scraper-v2.js "https://www.stemregen.co/products/release" "stemregen-release.json"
node ultimate-scraper-v2.js "https://www.stemregen.co/products/mobilize" "stemregen-mobilize.json"
node ultimate-scraper-v2.js "https://www.stemregen.co/products/activate" "stemregen-activate.json"

# EnergyBits products (find correct URLs from their site)
node ultimate-scraper-v2.js "https://energybits.com/products/PRODUCT_NAME" "energybits-PRODUCT.json"
```

### 2. `batch-scrape-all-stemregen.sh`
Automated batch scraper for all StemRegen products.

**Usage:**
```bash
bash batch-scrape-all-stemregen.sh
```

## Manual Scraping Steps

### For StemRegen:
1. Visit https://www.stemregen.co/collections/all
2. Copy product URLs
3. Run scraper for each product:
   ```bash
   node ultimate-scraper-v2.js "PRODUCT_URL" "stemregen-PRODUCT_NAME.json"
   ```

### For EnergyBits:
1. Visit https://energybits.com/collections/all
2. Find the correct product URLs (the site structure may require browsing)
3. Run scraper for each product:
   ```bash
   node ultimate-scraper-v2.js "PRODUCT_URL" "energybits-PRODUCT_NAME.json"
   ```

## Adding Products to Store

Once you have the JSON files, you can add them to your database using the admin store interface:

1. Go to `/admin/store`
2. Use the "Create New Product" form
3. Fill in:
   - **Name**: From scraped `name` field
   - **Slug**: Lowercase, hyphenated version (e.g., "stemregen-release")
   - **Description**: From scraped `description` field
   - **Image URL**: First item from `images` array
   - **Price**: From scraped `price` field

## Scraped Data Structure

Each JSON file contains:
```json
{
  "name": "Product Name",
  "description": "Product description...",
  "price": "99.00",
  "currency": "USD",
  "images": ["https://cdn.shopify.com/..."],
  "benefits": ["Benefit 1", "Benefit 2"],
  "sourceUrl": "https://...",
  "scrapedAt": "2025-11-11T..."
}
```

## Example: Adding StemRegen Release

From `stemregen-release.json`:

```
Name: StemRegen Release
Slug: stemregen-release
Description: Stemregen Release stimulates the release of stem cells from the bone marrow, leading to a wide range of benefits touching various aspects of human health.
Image: https://www.stemregen.co/cdn/shop/files/Front_d9a801e2-e09c-4ce2-a02e-f17650946fa9.png?v=1749678028&width=1024
Price: (check their website for current pricing - scraper found $1 which is likely a minimum)
```

## Pricing Note

The scraper may not always capture the correct price due to:
- JavaScript-rendered pricing
- Subscription options
- Volume discounts

**Always verify pricing manually** by visiting the product page before adding to your store.

## Next Steps

1. ✅ Scraper created
2. ⏳ Find correct product URLs for both sites
3. ⏳ Scrape all products
4. ⏳ Manually add to admin store with correct pricing
5. ⏳ Set up proper product categories/collections
6. ⏳ Configure Stripe integration for each product

## Troubleshooting

### 404 Errors
- The product URL may have changed
- Visit the site and copy the current URL
- Some products may require authentication

### Missing Prices
- Manually check the website
- Update the price in the admin interface after creating the product

### Image Issues
- The scraper collects all product images
- Choose the best primary image when creating the product
- Upload to Imgur if CDN links don't work

## Support

For issues or questions, check:
- StemRegen: https://www.stemregen.co
- EnergyBits: https://energybits.com
