#!/usr/bin/env node

/**
 * Visual Baseline Capture Script
 *
 * Captures screenshots of the Reset Biology website at multiple viewports
 * for use in visual regression testing.
 *
 * Usage:
 *   node .hos/scripts/capture-baseline.js
 *
 * Prerequisites:
 *   - Playwright installed: npx playwright install
 *   - Dev server running: npm run dev
 *   - Server accessible at http://localhost:3000
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '..', 'memory', 'visual', 'screenshots', 'baseline');
const INDEX_FILE = path.join(__dirname, '..', 'memory', 'visual', 'index.json');

// Pages to capture
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'peptides', path: '/peptides' },
  { name: 'breathing', path: '/breathing' },
  { name: 'journal', path: '/journal' },
  { name: 'portal', path: '/portal', requiresAuth: true },
  { name: 'tracker', path: '/tracker', requiresAuth: true },
  { name: 'peptide-tracker', path: '/peptide-tracker', requiresAuth: true },
  { name: 'workout', path: '/workout', requiresAuth: true },
  { name: 'nutrition', path: '/nutrition', requiresAuth: true },
  { name: 'admin', path: '/admin', requiresAuth: true },
];

// Viewport sizes (common breakpoints)
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
];

// Main execution
async function captureBaseline() {
  console.log('🎬 Starting visual baseline capture...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const screenshots = [];
  let captureCount = 0;
  let errorCount = 0;

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    for (const page of PAGES) {
      console.log(`📄 Processing: ${page.name}`);

      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: {
            width: viewport.width,
            height: viewport.height,
          },
        });

        const browserPage = await context.newPage();
        const filename = `${page.name}_${viewport.name}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        try {
          // Navigate to page
          const url = `${BASE_URL}${page.path}`;
          console.log(`   ├─ ${viewport.name.padEnd(8)} → ${url}`);

          await browserPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

          // Wait for main content to load
          await browserPage.waitForLoadState('domcontentloaded');
          await browserPage.waitForTimeout(1000);

          // Capture screenshot
          await browserPage.screenshot({
            path: filepath,
            fullPage: false,
          });

          console.log(`   │   ✓ Screenshot saved (${viewport.width}x${viewport.height})`);

          screenshots.push({
            page: page.name,
            path: page.path,
            viewport: viewport.name,
            width: viewport.width,
            height: viewport.height,
            filename: filename,
            timestamp: new Date().toISOString(),
            requiresAuth: page.requiresAuth || false,
          });

          captureCount++;
        } catch (error) {
          console.error(`   │   ✗ Failed: ${error.message}`);
          errorCount++;
        } finally {
          await context.close();
        }
      }

      console.log('');
    }

    // Write index file
    const index = {
      version: '1.0',
      capturedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalPages: PAGES.length,
      totalViewports: VIEWPORTS.length,
      totalScreenshots: screenshots.length,
      pages: PAGES.map(p => ({ name: p.name, path: p.path, requiresAuth: p.requiresAuth || false })),
      viewports: VIEWPORTS,
      screenshots: screenshots,
    };

    // Ensure index directory exists
    await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
    await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

    console.log('\n✅ Visual baseline capture completed!\n');
    console.log(`📊 Results:`);
    console.log(`   Screenshots captured: ${captureCount}`);
    console.log(`   Capture errors: ${errorCount}`);
    console.log(`   Output directory: ${OUTPUT_DIR}`);
    console.log(`   Index file: ${INDEX_FILE}`);
    console.log('\n🎯 Next Steps:');
    console.log('   1. Review screenshots in: .hos/memory/visual/screenshots/baseline/');
    console.log('   2. Run visual regression tests: npm run hos:test visual/regression');
    console.log('   3. Use baseline for future regression testing\n');

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error during baseline capture:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Error handling
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Execute
captureBaseline().catch((error) => {
  console.error('Capture failed:', error);
  process.exit(1);
});
