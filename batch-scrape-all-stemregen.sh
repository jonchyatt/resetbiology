#!/bin/bash
# Batch scrape all StemRegen products
# Run with: bash batch-scrape-all-stemregen.sh

echo "🔍 Scraping StemRegen Products..."

node ultimate-scraper-v2.js "https://www.stemregen.co/products/release?variant=46468643389718" "stemregen-release.json"
node ultimate-scraper-v2.js "https://www.stemregen.co/products/release-3-pack" "stemregen-release-3pack.json"
node ultimate-scraper-v2.js "https://www.stemregen.co/products/mobilize" "stemregen-mobilize.json"
node ultimate-scraper-v2.js "https://www.stemregen.co/products/activate" "stemregen-activate.json"

echo "✅ StemRegen scraping complete! Check the JSON files."
