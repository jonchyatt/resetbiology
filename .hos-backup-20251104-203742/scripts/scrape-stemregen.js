#!/usr/bin/env node
/**
 * STEMREGEN COMPLETE SITE SCRAPER
 *
 * Scrapes:
 * - Main collections page
 * - All 8 product pages
 *
 * Output: Pixel-perfect HTML clones with all images downloaded
 */

const { batchScrape } = require('./ultimate-scraper.js');

const STEMREGEN_URLS = [
  // Main collections page
  'https://www.stemregen.co/collections/all',

  // 8 Product pages
  'https://www.stemregen.co/products/release?variant=46468643389718&selling_plan=10523050262',
  'https://www.stemregen.co/products/sport?variant=48449748173078&selling_plan=10523050262',
  'https://www.stemregen.co/products/signal?variant=48449773535510&selling_plan=10523050262',
  'https://www.stemregen.co/products/mobilize?variant=48449759019286&selling_plan=10523050262',
  'https://www.stemregen.co/products/daily-maintenance-protocol?variant=49927327154454',
  'https://www.stemregen.co/products/accelerated-repair-protocol?variant=49927565869334',
  'https://www.stemregen.co/products/daily-recovery-support?variant=49928590131478',
  'https://www.stemregen.co/products/accelerated-recovery-support?variant=49928752136470'
];

async function main() {
  console.log('🧬 STEMREGEN COMPLETE SITE CAPTURE');
  console.log('=' .repeat(80));
  console.log(`\nCapturing ${STEMREGEN_URLS.length} pages:`);
  console.log('  - 1 collections page');
  console.log('  - 8 product pages');
  console.log('\nThis will take approximately 10-15 minutes.\n');

  const results = await batchScrape(STEMREGEN_URLS);

  // Summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Successfully captured: ${successful.length} pages`);
  console.log(`❌ Failed: ${failed.length} pages\n`);

  if (successful.length > 0) {
    console.log('✅ Success:');
    successful.forEach(r => {
      console.log(`  ✓ ${r.url.split('/').pop()}`);
      console.log(`    Clone: ${r.clone}`);
      if (r.testResult?.similarity) {
        console.log(`    Quality: ${(r.testResult.similarity * 100).toFixed(2)}%`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed:');
    failed.forEach(r => {
      console.log(`  ✗ ${r.url.split('/').pop()}: ${r.error}`);
    });
  }

  console.log('\n🎉 All files saved to: C:/Users/jonch/.hos/memory/visual/captures/\n');
}

main().catch(console.error);
