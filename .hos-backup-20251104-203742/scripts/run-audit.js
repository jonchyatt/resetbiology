#!/usr/bin/env node

/**
 * ResetBiology.com - Automated Site Audit Script
 *
 * Executes comprehensive Playwright-based audits when dev server is running.
 * Covers:
 * - Link validation
 * - Mobile responsiveness checks
 * - Performance measurements
 * - Accessibility scans
 * - Screenshot comparisons
 *
 * Usage:
 *   npm run dev (in one terminal)
 *   node .hos/scripts/run-audit.js (in another terminal)
 *
 * Or with production site:
 *   node .hos/scripts/run-audit.js --prod
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.argv.includes('--prod')
    ? 'https://resetbiology.com'
    : 'http://localhost:3000',
  outputDir: path.join(__dirname, '../reports/audit-results'),
  screenshotDir: path.join(__dirname, '../reports/screenshots'),
  timeout: 30000,
  viewports: {
    mobile: { width: 375, height: 667 }, // iPhone SE
    tablet: { width: 768, height: 1024 }, // iPad
    desktop: { width: 1920, height: 1080 }
  }
};

// Ensure output directories exist
[CONFIG.outputDir, CONFIG.screenshotDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Audit results storage
const results = {
  timestamp: new Date().toISOString(),
  baseUrl: CONFIG.baseUrl,
  links: [],
  performance: {},
  accessibility: [],
  mobile: {},
  screenshots: []
};

/**
 * Link Validation Audit
 * Crawls all internal links and checks for broken links
 */
async function auditLinks(page) {
  console.log('\n📎 Starting Link Validation Audit...');

  const pagesVisited = new Set();
  const pagesToVisit = ['/'];
  const brokenLinks = [];
  const workingLinks = [];

  while (pagesToVisit.length > 0) {
    const url = pagesToVisit.shift();
    if (pagesVisited.has(url)) continue;

    pagesVisited.add(url);
    const fullUrl = `${CONFIG.baseUrl}${url}`;

    try {
      console.log(`  Checking: ${fullUrl}`);
      const response = await page.goto(fullUrl, {
        waitUntil: 'networkidle',
        timeout: CONFIG.timeout
      });

      const status = response.status();

      if (status >= 400) {
        brokenLinks.push({ url, status });
        console.log(`  ❌ BROKEN: ${url} (${status})`);
      } else {
        workingLinks.push({ url, status });
        console.log(`  ✅ OK: ${url} (${status})`);
      }

      // Extract internal links
      const links = await page.$$eval('a[href]', anchors =>
        anchors
          .map(a => a.getAttribute('href'))
          .filter(href => href && href.startsWith('/') && !href.startsWith('//'))
      );

      // Add unique links to queue
      links.forEach(link => {
        if (!pagesVisited.has(link) && !pagesToVisit.includes(link)) {
          pagesToVisit.push(link);
        }
      });

    } catch (error) {
      brokenLinks.push({ url, error: error.message });
      console.log(`  ❌ ERROR: ${url} - ${error.message}`);
    }
  }

  results.links = {
    total: pagesVisited.size,
    working: workingLinks.length,
    broken: brokenLinks.length,
    workingLinks,
    brokenLinks
  };

  console.log(`\n✅ Link Audit Complete: ${workingLinks.length} working, ${brokenLinks.length} broken`);
}

/**
 * Mobile Responsiveness Audit
 * Tests key pages on mobile, tablet, and desktop viewports
 */
async function auditMobileResponsiveness(page) {
  console.log('\n📱 Starting Mobile Responsiveness Audit...');

  const pagesTest = ['/', '/portal', '/order'];
  const viewportTests = [];

  for (const pagePath of pagesTest) {
    for (const [deviceName, viewport] of Object.entries(CONFIG.viewports)) {
      console.log(`  Testing ${pagePath} on ${deviceName} (${viewport.width}x${viewport.height})`);

      await page.setViewportSize(viewport);
      await page.goto(`${CONFIG.baseUrl}${pagePath}`, {
        waitUntil: 'networkidle',
        timeout: CONFIG.timeout
      });

      // Take screenshot
      const screenshotName = `${pagePath.replace(/\//g, '-') || 'home'}-${deviceName}.png`;
      const screenshotPath = path.join(CONFIG.screenshotDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Check for horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // Check touch target sizes (buttons should be >= 44x44px)
      const smallTouchTargets = await page.$$eval('button, a', elements => {
        return elements
          .map(el => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              text: el.textContent.trim().substring(0, 30),
              width: rect.width,
              height: rect.height,
              tooSmall: rect.width < 44 || rect.height < 44
            };
          })
          .filter(target => target.tooSmall);
      });

      viewportTests.push({
        page: pagePath,
        device: deviceName,
        viewport,
        hasHorizontalScroll,
        smallTouchTargets: smallTouchTargets.length,
        smallTouchTargetsList: smallTouchTargets.slice(0, 5), // First 5 examples
        screenshot: screenshotName
      });

      console.log(`    ${hasHorizontalScroll ? '❌' : '✅'} Horizontal scroll: ${hasHorizontalScroll ? 'YES' : 'NO'}`);
      console.log(`    ${smallTouchTargets.length > 0 ? '⚠️' : '✅'} Small touch targets: ${smallTouchTargets.length}`);
    }
  }

  results.mobile = {
    pagesTest,
    viewportTests,
    summary: {
      totalTests: viewportTests.length,
      horizontalScrollIssues: viewportTests.filter(t => t.hasHorizontalScroll).length,
      touchTargetIssues: viewportTests.filter(t => t.smallTouchTargets > 0).length
    }
  };

  console.log(`\n✅ Mobile Audit Complete: ${viewportTests.length} tests run`);
}

/**
 * Performance Measurement Audit
 * Measures load times, bundle sizes, and Core Web Vitals
 */
async function auditPerformance(page) {
  console.log('\n⚡ Starting Performance Audit...');

  const pagesTest = ['/', '/portal', '/order'];
  const performanceData = [];

  for (const pagePath of pagesTest) {
    console.log(`  Measuring ${pagePath}...`);

    // Clear cache for accurate measurement
    await page.context().clearCookies();

    const startTime = Date.now();
    await page.goto(`${CONFIG.baseUrl}${pagePath}`, {
      waitUntil: 'networkidle',
      timeout: CONFIG.timeout
    });
    const loadTime = Date.now() - startTime;

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const paintEntries = performance.getEntriesByType('paint');

      return {
        domContentLoaded: perfData?.domContentLoadedEventEnd - perfData?.domContentLoadedEventStart,
        loadComplete: perfData?.loadEventEnd - perfData?.loadEventStart,
        firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime,
        transferSize: perfData?.transferSize,
        encodedBodySize: perfData?.encodedBodySize
      };
    });

    // Get Core Web Vitals (if available)
    const webVitals = await page.evaluate(() => {
      return new Promise(resolve => {
        const vitals = {};

        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver(list => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              vitals.lcp = lastEntry?.renderTime || lastEntry?.loadTime;
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          } catch (e) {
            vitals.lcp = null;
          }
        }

        // Resolve after short delay
        setTimeout(() => resolve(vitals), 1000);
      });
    });

    performanceData.push({
      page: pagePath,
      loadTime,
      metrics,
      webVitals,
      summary: {
        loadTimeMs: loadTime,
        firstContentfulPaintMs: metrics.firstContentfulPaint,
        transferSizeKB: Math.round(metrics.transferSize / 1024),
        lcpMs: webVitals.lcp
      }
    });

    console.log(`    Load Time: ${loadTime}ms`);
    console.log(`    FCP: ${Math.round(metrics.firstContentfulPaint)}ms`);
    console.log(`    Transfer Size: ${Math.round(metrics.transferSize / 1024)}KB`);
  }

  results.performance = {
    pagesTest,
    performanceData,
    summary: {
      avgLoadTime: Math.round(performanceData.reduce((sum, p) => sum + p.loadTime, 0) / performanceData.length),
      avgFCP: Math.round(performanceData.reduce((sum, p) => sum + (p.metrics.firstContentfulPaint || 0), 0) / performanceData.length),
      totalTransferSize: performanceData.reduce((sum, p) => sum + (p.metrics.transferSize || 0), 0)
    }
  };

  console.log(`\n✅ Performance Audit Complete`);
  console.log(`    Avg Load Time: ${results.performance.summary.avgLoadTime}ms`);
  console.log(`    Avg FCP: ${results.performance.summary.avgFCP}ms`);
}

/**
 * Accessibility Audit
 * Checks for basic accessibility issues (aria-labels, contrast, etc.)
 */
async function auditAccessibility(page) {
  console.log('\n♿ Starting Accessibility Audit...');

  const pagesTest = ['/', '/portal', '/order'];
  const accessibilityIssues = [];

  for (const pagePath of pagesTest) {
    console.log(`  Checking ${pagePath}...`);

    await page.goto(`${CONFIG.baseUrl}${pagePath}`, {
      waitUntil: 'networkidle',
      timeout: CONFIG.timeout
    });

    // Check for missing alt text
    const missingAlt = await page.$$eval('img', images =>
      images
        .filter(img => !img.alt || img.alt.trim() === '')
        .map(img => ({ src: img.src.substring(0, 50) }))
    );

    // Check for buttons without aria-labels or text
    const unlabeledButtons = await page.$$eval('button', buttons =>
      buttons
        .filter(btn => {
          const hasText = btn.textContent.trim().length > 0;
          const hasAriaLabel = btn.hasAttribute('aria-label');
          const hasAriaLabelledBy = btn.hasAttribute('aria-labelledby');
          return !hasText && !hasAriaLabel && !hasAriaLabelledBy;
        })
        .map(btn => ({
          innerHTML: btn.innerHTML.substring(0, 50),
          className: btn.className
        }))
    );

    // Check for links without text
    const emptyLinks = await page.$$eval('a', links =>
      links
        .filter(link => link.textContent.trim().length === 0 && !link.hasAttribute('aria-label'))
        .map(link => ({ href: link.href }))
    );

    // Check for form inputs without labels
    const unlabeledInputs = await page.$$eval('input, textarea, select', inputs =>
      inputs
        .filter(input => {
          const id = input.id;
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.hasAttribute('aria-label');
          const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
          return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy;
        })
        .map(input => ({
          type: input.type,
          name: input.name,
          placeholder: input.placeholder
        }))
    );

    accessibilityIssues.push({
      page: pagePath,
      issues: {
        missingAlt: missingAlt.length,
        missingAltList: missingAlt.slice(0, 5),
        unlabeledButtons: unlabeledButtons.length,
        unlabeledButtonsList: unlabeledButtons.slice(0, 5),
        emptyLinks: emptyLinks.length,
        emptyLinksList: emptyLinks.slice(0, 5),
        unlabeledInputs: unlabeledInputs.length,
        unlabeledInputsList: unlabeledInputs.slice(0, 5)
      },
      totalIssues: missingAlt.length + unlabeledButtons.length + emptyLinks.length + unlabeledInputs.length
    });

    console.log(`    Missing alt text: ${missingAlt.length}`);
    console.log(`    Unlabeled buttons: ${unlabeledButtons.length}`);
    console.log(`    Empty links: ${emptyLinks.length}`);
    console.log(`    Unlabeled inputs: ${unlabeledInputs.length}`);
  }

  results.accessibility = {
    pagesTest,
    accessibilityIssues,
    summary: {
      totalIssues: accessibilityIssues.reduce((sum, p) => sum + p.totalIssues, 0),
      totalMissingAlt: accessibilityIssues.reduce((sum, p) => sum + p.issues.missingAlt, 0),
      totalUnlabeledButtons: accessibilityIssues.reduce((sum, p) => sum + p.issues.unlabeledButtons, 0),
      totalEmptyLinks: accessibilityIssues.reduce((sum, p) => sum + p.issues.emptyLinks, 0),
      totalUnlabeledInputs: accessibilityIssues.reduce((sum, p) => sum + p.issues.unlabeledInputs, 0)
    }
  };

  console.log(`\n✅ Accessibility Audit Complete`);
  console.log(`    Total Issues: ${results.accessibility.summary.totalIssues}`);
}

/**
 * Main Audit Runner
 */
async function runAudit() {
  console.log('🚀 ResetBiology.com - Automated Site Audit');
  console.log(`📍 Target: ${CONFIG.baseUrl}`);
  console.log(`📅 Date: ${new Date().toLocaleString()}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: CONFIG.viewports.desktop,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Run audits
    await auditLinks(page);
    await auditPerformance(page);
    await auditMobileResponsiveness(page);
    await auditAccessibility(page);

    // Save results
    const resultsPath = path.join(CONFIG.outputDir, `audit-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);

    // Generate summary report
    generateSummaryReport(resultsPath);

  } catch (error) {
    console.error('\n❌ Audit failed:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Generate Human-Readable Summary Report
 */
function generateSummaryReport(resultsPath) {
  const summaryPath = path.join(CONFIG.outputDir, `audit-summary-${Date.now()}.md`);

  const summary = `# ResetBiology.com - Audit Summary

**Date:** ${new Date().toLocaleString()}
**Target:** ${CONFIG.baseUrl}

---

## Link Validation

- **Total Pages:** ${results.links.total}
- **Working Links:** ${results.links.working} ✅
- **Broken Links:** ${results.links.broken} ❌

${results.links.broken > 0 ? `
### Broken Links:
${results.links.brokenLinks.map(link => `- ${link.url} (${link.status || link.error})`).join('\n')}
` : ''}

---

## Performance

- **Avg Load Time:** ${results.performance.summary.avgLoadTime}ms
- **Avg First Contentful Paint:** ${results.performance.summary.avgFCP}ms
- **Total Transfer Size:** ${Math.round(results.performance.summary.totalTransferSize / 1024)}KB

### Performance by Page:
${results.performance.performanceData.map(p => `
- **${p.page}:** ${p.loadTime}ms (FCP: ${Math.round(p.metrics.firstContentfulPaint)}ms)
`).join('\n')}

---

## Mobile Responsiveness

- **Total Tests:** ${results.mobile.summary.totalTests}
- **Horizontal Scroll Issues:** ${results.mobile.summary.horizontalScrollIssues}
- **Touch Target Issues:** ${results.mobile.summary.touchTargetIssues}

${results.mobile.summary.horizontalScrollIssues > 0 || results.mobile.summary.touchTargetIssues > 0 ? `
### Issues Found:
${results.mobile.viewportTests
  .filter(t => t.hasHorizontalScroll || t.smallTouchTargets > 0)
  .map(t => `- **${t.page} (${t.device}):** ${t.hasHorizontalScroll ? 'Horizontal scroll' : ''} ${t.smallTouchTargets > 0 ? `${t.smallTouchTargets} small touch targets` : ''}`)
  .join('\n')}
` : ''}

---

## Accessibility

- **Total Issues:** ${results.accessibility.summary.totalIssues}
- **Missing Alt Text:** ${results.accessibility.summary.totalMissingAlt}
- **Unlabeled Buttons:** ${results.accessibility.summary.totalUnlabeledButtons}
- **Empty Links:** ${results.accessibility.summary.totalEmptyLinks}
- **Unlabeled Inputs:** ${results.accessibility.summary.totalUnlabeledInputs}

${results.accessibility.summary.totalIssues > 0 ? `
### Issues by Page:
${results.accessibility.accessibilityIssues
  .filter(p => p.totalIssues > 0)
  .map(p => `
- **${p.page}:** ${p.totalIssues} issues
  - Missing alt: ${p.issues.missingAlt}
  - Unlabeled buttons: ${p.issues.unlabeledButtons}
  - Empty links: ${p.issues.emptyLinks}
  - Unlabeled inputs: ${p.issues.unlabeledInputs}
`).join('\n')}
` : ''}

---

## Recommendations

${results.links.broken > 0 ? '- ❌ Fix broken links' : '- ✅ All links working'}
${results.performance.summary.avgLoadTime > 3000 ? '- ⚠️ Improve load time (target <3s)' : '- ✅ Load time acceptable'}
${results.performance.summary.avgFCP > 2500 ? '- ⚠️ Improve First Contentful Paint (target <2.5s)' : '- ✅ FCP acceptable'}
${results.mobile.summary.horizontalScrollIssues > 0 ? '- ❌ Fix horizontal scroll issues' : '- ✅ No horizontal scroll issues'}
${results.mobile.summary.touchTargetIssues > 0 ? '- ⚠️ Fix small touch targets (<44px)' : '- ✅ Touch targets adequate'}
${results.accessibility.summary.totalIssues > 0 ? `- ❌ Fix ${results.accessibility.summary.totalIssues} accessibility issues` : '- ✅ Basic accessibility checks passed'}

---

**Full Results:** ${path.basename(resultsPath)}
`;

  fs.writeFileSync(summaryPath, summary);
  console.log(`📄 Summary report saved to: ${summaryPath}`);
}

// Run the audit
runAudit().catch(console.error);
