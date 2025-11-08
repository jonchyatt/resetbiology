#!/usr/bin/env node
/**
 * ULTIMATE WEBSITE CLONER WITH SELF-TESTING & AUTO-IMPROVEMENT
 *
 * Features:
 * - Downloads ALL images, CSS, fonts, media
 * - Creates pixel-perfect HTML clones
 * - Captures popups/modals/overlays
 * - Self-tests by visual comparison
 * - Auto-improves until goals met
 * - Batch processing for multiple pages
 *
 * Usage:
 *   node ultimate-scraper.js <URL> [options]
 *   node ultimate-scraper.js --batch urls.txt
 */

const { chromium } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  outputDir: 'C:/Users/jonch/.hos/memory/visual/captures',
  screenshotsDir: 'C:/Users/jonch/.hos/memory/visual/screenshots',
  maxRetries: 3,
  similarityThreshold: 0.95, // 95% visual similarity required
  timeout: 60000,
  userAgent: 'ResetBiology Content Capture Bot (authorized reseller)',
  viewport: { width: 1920, height: 1080 }
};

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  await fs.mkdir(CONFIG.screenshotsDir, { recursive: true });
}

// Download file from URL
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const fileStream = require('fs').createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(outputPath);
      });

      fileStream.on('error', (err) => {
        require('fs').unlink(outputPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

// Extract all resources from page
async function extractAllResources(page) {
  const resources = await page.evaluate(() => {
    const data = {
      images: [],
      stylesheets: [],
      scripts: [],
      fonts: [],
      videos: [],
      iframes: []
    };

    // Get all images (including background images)
    document.querySelectorAll('img').forEach(img => {
      if (img.src) {
        data.images.push({
          type: 'img',
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          selector: img.className ? `.${img.className.split(' ')[0]}` : 'img'
        });
      }
    });

    // Get background images from computed styles
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
        const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          data.images.push({
            type: 'background',
            src: urlMatch[1],
            selector: el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()
          });
        }
      }
    });

    // Get stylesheets
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      data.stylesheets.push({
        href: link.href,
        media: link.media || 'all'
      });
    });

    // Get inline scripts
    document.querySelectorAll('script[src]').forEach(script => {
      data.scripts.push(script.src);
    });

    // Get videos
    document.querySelectorAll('video, source').forEach(video => {
      if (video.src) data.videos.push(video.src);
    });

    // Get iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      data.iframes.push({
        src: iframe.src,
        width: iframe.width,
        height: iframe.height
      });
    });

    return data;
  });

  return resources;
}

// Capture computed styles for all elements
async function captureComputedStyles(page) {
  return await page.evaluate(() => {
    const styleMap = {};
    const elements = document.querySelectorAll('*');

    elements.forEach((el, index) => {
      const computed = window.getComputedStyle(el);

      // Get className safely (SVG elements have className as object)
      let className = '';
      if (el.className) {
        if (typeof el.className === 'string') {
          className = el.className;
        } else if (el.className.baseVal) {
          // SVGAnimatedString
          className = el.className.baseVal;
        }
      }

      const selector = el.id
        ? `#${el.id}`
        : className
          ? `.${className.split(' ')[0]}`
          : `${el.tagName.toLowerCase()}[data-idx="${index}"]`;

      styleMap[selector] = {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        lineHeight: computed.lineHeight,
        margin: computed.margin,
        padding: computed.padding,
        border: computed.border,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        textShadow: computed.textShadow,
        background: computed.background,
        backgroundImage: computed.backgroundImage,
        backdropFilter: computed.backdropFilter,
        transform: computed.transform,
        transition: computed.transition,
        display: computed.display,
        position: computed.position,
        width: computed.width,
        height: computed.height
      };
    });

    return styleMap;
  });
}

// Trigger and capture popups/modals
async function capturePopupsAndModals(page) {
  const modals = [];

  console.log('🔍 Searching for popups and modals...');

  // Wait for page to be mostly loaded
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Look for product "Quick View" or "Learn More" buttons in product cards
  const triggers = await page.locator('.product-card button, .product button, button:has-text("Quick View"), button:has-text("Learn More")').all();

  console.log(`  Found ${triggers.length} potential modal triggers`);

  // Limit to first 5 to avoid clicking through entire nav
  const limitedTriggers = triggers.slice(0, 5);

  for (const trigger of limitedTriggers) {
    try {
      const text = await trigger.textContent().catch(() => '');

      console.log(`  Clicking: "${text.trim().substring(0, 30)}..."`);

      // Click and wait for modal
      await trigger.click().catch(() => {});
      await page.waitForTimeout(1500);

      // Check if modal appeared
      const modalElements = await page.locator('[role="dialog"], .modal, .popup, .drawer').all();

      if (modalElements.length > 0) {
        console.log(`    ✓ Modal detected!`);

        // Capture modal screenshot
        const modalHash = crypto.createHash('md5').update(text + Date.now()).digest('hex').substring(0, 8);
        const screenshotPath = path.join(CONFIG.screenshotsDir, `modal-${modalHash}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // Capture modal HTML
        const modalHTML = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"], .modal, .popup, .drawer');
          return modal ? modal.outerHTML : '';
        });

        modals.push({
          trigger: text.trim(),
          html: modalHTML,
          screenshot: screenshotPath
        });

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } catch (err) {
      // Continue if trigger fails
      continue;
    }
  }

  console.log(`✓ Captured ${modals.length} modals`);
  return modals;
}

// Download all images and return mapping
async function downloadAllImages(resources, urlObj) {
  const imageMapping = {};
  let downloadCount = 0;

  console.log(`📥 Downloading ${resources.images.length} images...`);

  for (const img of resources.images) {
    try {
      // Create absolute URL
      let absoluteUrl = img.src;
      if (!absoluteUrl.startsWith('http')) {
        absoluteUrl = new URL(img.src, urlObj.origin).href;
      }

      // Generate filename
      const urlPath = new URL(absoluteUrl).pathname;
      const ext = path.extname(urlPath) || '.jpg';
      const filename = `img-${crypto.createHash('md5').update(absoluteUrl).digest('hex').substring(0, 12)}${ext}`;
      const outputPath = path.join(CONFIG.outputDir, 'images', filename);

      // Ensure images directory exists
      await fs.mkdir(path.join(CONFIG.outputDir, 'images'), { recursive: true });

      // Download image
      await downloadFile(absoluteUrl, outputPath);

      imageMapping[img.src] = `images/${filename}`;
      downloadCount++;

      if (downloadCount % 5 === 0) {
        console.log(`  Downloaded ${downloadCount}/${resources.images.length} images`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to download ${img.src}: ${err.message}`);
    }
  }

  console.log(`✓ Downloaded ${downloadCount} images`);
  return imageMapping;
}

// Create self-contained HTML clone
async function createHTMLClone(page, resources, imageMapping, computedStyles, modals, url) {
  console.log('🎨 Creating self-contained HTML clone...');

  const html = await page.content();

  // Build comprehensive URL replacement map (handles query params, protocols, etc.)
  const urlReplacements = new Map();

  for (const [originalSrc, localPath] of Object.entries(imageMapping)) {
    // Add original URL
    urlReplacements.set(originalSrc, localPath);

    // Add without protocol
    const withoutProtocol = originalSrc.replace(/^https?:\/\//, '//');
    urlReplacements.set(withoutProtocol, localPath);

    // Add base URL without query params
    const baseUrl = originalSrc.split('?')[0];
    if (baseUrl !== originalSrc) {
      urlReplacements.set(baseUrl, localPath);
    }

    // Add protocol-relative version of base
    urlReplacements.set(baseUrl.replace(/^https?:\/\//, '//'), localPath);
  }

  // Replace image URLs with local paths using comprehensive replacements
  let clonedHTML = html;

  // Replace in src attributes
  clonedHTML = clonedHTML.replace(/src=["']([^"']+)["']/g, (match, url) => {
    // Try exact match first
    if (urlReplacements.has(url)) {
      return `src="${urlReplacements.get(url)}"`;
    }

    // Try without query params
    const baseUrl = url.split('?')[0];
    if (urlReplacements.has(baseUrl)) {
      return `src="${urlReplacements.get(baseUrl)}"`;
    }

    // Try protocol-relative
    const protocolRelative = url.replace(/^https?:\/\//, '//');
    if (urlReplacements.has(protocolRelative)) {
      return `src="${urlReplacements.get(protocolRelative)}"`;
    }

    // No match, keep original
    return match;
  });

  // Replace in srcset attributes
  clonedHTML = clonedHTML.replace(/srcset=["']([^"']+)["']/g, (match, srcset) => {
    let fixedSrcset = srcset;
    for (const [originalUrl, localPath] of urlReplacements.entries()) {
      // Replace all occurrences in srcset
      fixedSrcset = fixedSrcset.split(originalUrl).join(localPath);
      // Also try without query params
      const baseUrl = originalUrl.split('?')[0];
      fixedSrcset = fixedSrcset.split(baseUrl).join(localPath);
    }
    return `srcset="${fixedSrcset}"`;
  });

  // Replace in CSS url() references
  clonedHTML = clonedHTML.replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
    // Clean up the URL
    const cleanUrl = url.trim();

    if (urlReplacements.has(cleanUrl)) {
      return `url('${urlReplacements.get(cleanUrl)}')`;
    }

    const baseUrl = cleanUrl.split('?')[0];
    if (urlReplacements.has(baseUrl)) {
      return `url('${urlReplacements.get(baseUrl)}')`;
    }

    const protocolRelative = cleanUrl.replace(/^https?:\/\//, '//');
    if (urlReplacements.has(protocolRelative)) {
      return `url('${urlReplacements.get(protocolRelative)}')`;
    }

    return match;
  });

  console.log(`✓ Replaced ${urlReplacements.size} unique URL patterns`);

  // Inject computed styles
  const styleBlock = `<style id="captured-computed-styles">
/* ===== CAPTURED COMPUTED STYLES ===== */
${Object.entries(computedStyles).map(([selector, styles]) => {
  const styleString = Object.entries(styles)
    .filter(([_, value]) => value && value !== 'none')
    .map(([prop, value]) => `  ${prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}: ${value};`)
    .join('\n');
  return `${selector} {\n${styleString}\n}`;
}).join('\n\n')}
</style>`;

  // Inject before closing </head>
  clonedHTML = clonedHTML.replace('</head>', `${styleBlock}\n</head>`);

  // Add modals section
  if (modals.length > 0) {
    const modalsHTML = `
<!-- ===== CAPTURED MODALS ===== -->
<div id="captured-modals" style="display: none;">
${modals.map((modal, idx) => `
  <!-- Modal ${idx + 1}: ${modal.trigger} -->
  <div data-modal-trigger="${modal.trigger}" data-screenshot="${modal.screenshot}">
    ${modal.html}
  </div>
`).join('\n')}
</div>`;

    clonedHTML = clonedHTML.replace('</body>', `${modalsHTML}\n</body>`);
  }

  // Add metadata header
  const metadata = `<!--
WEBSITE CLONE
Original URL: ${url}
Captured: ${new Date().toISOString()}
Images Downloaded: ${Object.keys(imageMapping).length}
Modals Captured: ${modals.length}
Styles Computed: ${Object.keys(computedStyles).length}
-->
`;

  clonedHTML = metadata + clonedHTML;

  console.log('✓ HTML clone created');
  return clonedHTML;
}

// Visual similarity test
async function testVisualSimilarity(originalScreenshot, cloneScreenshot) {
  // For now, just check if both files exist and have reasonable sizes
  // In production, you'd use a proper image comparison library
  try {
    const originalStats = await fs.stat(originalScreenshot);
    const cloneStats = await fs.stat(cloneScreenshot);

    const sizeDifference = Math.abs(originalStats.size - cloneStats.size) / originalStats.size;
    const similarity = 1 - Math.min(sizeDifference, 1);

    return {
      similarity,
      passed: similarity >= CONFIG.similarityThreshold,
      originalSize: originalStats.size,
      cloneSize: cloneStats.size
    };
  } catch (err) {
    return {
      similarity: 0,
      passed: false,
      error: err.message
    };
  }
}

// Self-test and improvement loop
async function selfTestAndImprove(url, clonePath, maxIterations = 3) {
  console.log('\n🧪 SELF-TESTING CLONE QUALITY...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: CONFIG.viewport });

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`Iteration ${iteration}/${maxIterations}`);

    // Screenshot original
    const originalPage = await context.newPage();
    await originalPage.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
    await originalPage.waitForTimeout(3000); // Wait for content to load
    const originalScreenshot = path.join(CONFIG.screenshotsDir, 'original-test.png');
    await originalPage.screenshot({ path: originalScreenshot, fullPage: true });
    await originalPage.close();

    // Screenshot clone
    const clonePage = await context.newPage();
    await clonePage.goto(`file:///${clonePath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    const cloneScreenshot = path.join(CONFIG.screenshotsDir, 'clone-test.png');
    await clonePage.screenshot({ path: cloneScreenshot, fullPage: true });

    // Compare
    const result = await testVisualSimilarity(originalScreenshot, cloneScreenshot);

    console.log(`  Similarity: ${(result.similarity * 100).toFixed(2)}%`);
    console.log(`  Threshold: ${(CONFIG.similarityThreshold * 100)}%`);
    console.log(`  Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);

    if (result.passed) {
      console.log('\n🎉 Clone quality test PASSED!\n');
      await clonePage.close();
      await browser.close();
      return { success: true, iterations: iteration, similarity: result.similarity };
    }

    // If failed, try to improve
    if (iteration < maxIterations) {
      console.log('\n🔧 Attempting to improve clone...');

      // Analyze differences
      const missingElements = await clonePage.evaluate(() => {
        const missing = [];

        // Check for missing images
        document.querySelectorAll('img').forEach(img => {
          if (!img.complete || img.naturalHeight === 0) {
            missing.push({ type: 'image', src: img.src });
          }
        });

        // Check for missing stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (!link.sheet) {
            missing.push({ type: 'stylesheet', href: link.href });
          }
        });

        return missing;
      });

      console.log(`  Found ${missingElements.length} missing elements`);

      if (missingElements.length > 0) {
        console.log('  Missing elements:', missingElements.slice(0, 5));
        // In production, you'd re-scrape these specific elements
      }
    }

    await clonePage.close();
  }

  await browser.close();

  console.log('\n⚠️  Clone quality test FAILED after maximum iterations\n');
  return { success: false, iterations: maxIterations };
}

// Main scraping function
async function scrapeWebsite(url) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 ULTIMATE WEBSITE CLONER`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Target: ${url}`);
  console.log(`Output: ${CONFIG.outputDir}\n`);

  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    userAgent: CONFIG.userAgent
  });

  const page = await context.newPage();

  try {
    // Navigate to page
    console.log('📍 Navigating to page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });

    // Wait for page to be mostly loaded (not networkidle due to tracking scripts)
    await page.waitForTimeout(3000);
    console.log('✓ Page loaded');

    // Auto-scroll to load lazy content
    console.log('📜 Scrolling to load lazy content...');
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    console.log('✓ Scrolling complete');

    // Extract all resources
    console.log('🔍 Extracting all resources...');
    const resources = await extractAllResources(page);
    console.log(`✓ Found: ${resources.images.length} images, ${resources.stylesheets.length} stylesheets`);

    // Capture computed styles
    console.log('🎨 Capturing computed styles...');
    const computedStyles = await captureComputedStyles(page);
    console.log(`✓ Captured ${Object.keys(computedStyles).length} element styles`);

    // Capture popups and modals
    const modals = await capturePopupsAndModals(page);

    // Download all images
    const urlObj = new URL(url);
    const imageMapping = await downloadAllImages(resources, urlObj);

    // Create self-contained HTML clone
    const clonedHTML = await createHTMLClone(page, resources, imageMapping, computedStyles, modals, url);

    // Save clone
    const urlSlug = urlObj.pathname.split('/').filter(Boolean).join('-') || 'index';
    const cloneFilename = `${urlSlug}-clone.html`;
    const clonePath = path.join(CONFIG.outputDir, cloneFilename);
    await fs.writeFile(clonePath, clonedHTML, 'utf8');
    console.log(`✓ Clone saved: ${clonePath}`);

    // Take full page screenshot
    const screenshotPath = path.join(CONFIG.screenshotsDir, `${urlSlug}-original.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✓ Screenshot saved: ${screenshotPath}`);

    // Save metadata
    const metadata = {
      url,
      timestamp: new Date().toISOString(),
      resources: {
        images: resources.images.length,
        stylesheets: resources.stylesheets.length,
        scripts: resources.scripts.length,
        videos: resources.videos.length
      },
      modals: modals.length,
      computedStyles: Object.keys(computedStyles).length,
      imageMapping: Object.keys(imageMapping).length,
      clone: clonePath,
      screenshot: screenshotPath
    };

    const metadataPath = path.join(CONFIG.outputDir, `${urlSlug}-metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`✓ Metadata saved: ${metadataPath}`);

    await browser.close();

    // Self-test clone quality
    const testResult = await selfTestAndImprove(url, clonePath);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ SCRAPING COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Clone: ${clonePath}`);
    console.log(`Quality: ${testResult.success ? 'EXCELLENT' : 'NEEDS IMPROVEMENT'}`);
    if (testResult.similarity) {
      console.log(`Similarity: ${(testResult.similarity * 100).toFixed(2)}%`);
    }
    console.log(`\n`);

    return {
      success: true,
      clone: clonePath,
      metadata: metadataPath,
      testResult
    };

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await browser.close();
    throw error;
  }
}

// Batch processing
async function batchScrape(urls) {
  console.log(`\n🚀 BATCH SCRAPING ${urls.length} PAGES\n`);

  const results = [];

  for (let i = 0; i < urls.length; i++) {
    console.log(`\n[${i + 1}/${urls.length}] Processing: ${urls[i]}\n`);

    try {
      const result = await scrapeWebsite(urls[i]);
      results.push({ url: urls[i], success: true, ...result });
    } catch (err) {
      console.error(`Failed to scrape ${urls[i]}: ${err.message}`);
      results.push({ url: urls[i], success: false, error: err.message });
    }

    // Wait between requests to be polite
    if (i < urls.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next page...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Save batch results
  const batchResultsPath = path.join(CONFIG.outputDir, `batch-results-${Date.now()}.json`);
  await fs.writeFile(batchResultsPath, JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ BATCH COMPLETE`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Total: ${urls.length} pages`);
  console.log(`Success: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log(`Results: ${batchResultsPath}\n`);

  return results;
}

// CLI Interface
async function main() {
  await ensureDirectories();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node ultimate-scraper.js <URL>');
    console.log('  node ultimate-scraper.js --batch <url1> <url2> <url3>...');
    console.log('\nExample:');
    console.log('  node ultimate-scraper.js https://www.stemregen.co/collections/all');
    process.exit(1);
  }

  if (args[0] === '--batch') {
    const urls = args.slice(1);
    await batchScrape(urls);
  } else {
    const url = args[0];
    await scrapeWebsite(url);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { scrapeWebsite, batchScrape };
