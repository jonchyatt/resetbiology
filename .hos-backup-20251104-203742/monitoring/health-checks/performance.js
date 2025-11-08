const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://reset-biology.vercel.app';
const LOG_FILE = path.join(__dirname, '../../reports/performance-log.json');

async function measurePerformance() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const metrics = {
    timestamp: new Date().toISOString(),
    url: SITE_URL,
    ttfb: null,
    fcp: null,
    lcp: null,
    cls: null,
    fid: null,
    loadTime: null,
    domContentLoaded: null,
    performanceScore: null,
    error: null
  };

  try {
    const startTime = Date.now();

    // Navigate and wait for load
    const response = await page.goto(SITE_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    if (!response) {
      throw new Error('No response received');
    }

    // Get navigation timing
    const performanceTiming = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0];

      return {
        ttfb: timing.responseStart - timing.requestStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadTime: timing.loadEventEnd - timing.navigationStart,
        navigationEntry: navigation
      };
    });

    metrics.ttfb = performanceTiming.ttfb;
    metrics.domContentLoaded = performanceTiming.domContentLoaded;
    metrics.loadTime = performanceTiming.loadTime;

    // Get Web Vitals using PerformanceObserver data
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = { fcp: null, lcp: null, cls: 0 };

        // FCP
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) {
          vitals.fcp = fcpEntry.startTime;
        }

        // LCP
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        });

        try {
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
          // LCP not supported
        }

        // CLS
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              vitals.cls += entry.value;
            }
          }
        });

        try {
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {
          // CLS not supported
        }

        setTimeout(() => {
          observer.disconnect();
          clsObserver.disconnect();
          resolve(vitals);
        }, 1000);
      });
    });

    metrics.fcp = webVitals.fcp;
    metrics.lcp = webVitals.lcp;
    metrics.cls = webVitals.cls;

    // Calculate simple performance score
    let score = 100;
    if (metrics.ttfb > 600) score -= 20;
    else if (metrics.ttfb > 300) score -= 10;

    if (metrics.fcp > 3000) score -= 20;
    else if (metrics.fcp > 1800) score -= 10;

    if (metrics.lcp > 4000) score -= 20;
    else if (metrics.lcp > 2500) score -= 10;

    if (metrics.cls > 0.25) score -= 20;
    else if (metrics.cls > 0.1) score -= 10;

    metrics.performanceScore = Math.max(0, score);

  } catch (error) {
    metrics.error = error.message;
  } finally {
    await browser.close();
  }

  return metrics;
}

function saveLog(result) {
  let logs = [];

  if (fs.existsSync(LOG_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing log file, starting fresh');
    }
  }

  logs.push(result);

  // Keep only last 500 entries
  if (logs.length > 500) {
    logs = logs.slice(-500);
  }

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

async function run() {
  console.log('Measuring performance...');
  const result = await measurePerformance();

  console.log(`TTFB: ${result.ttfb}ms`);
  console.log(`FCP: ${result.fcp}ms`);
  console.log(`LCP: ${result.lcp}ms`);
  console.log(`CLS: ${result.cls}`);
  console.log(`Performance Score: ${result.performanceScore}/100`);

  if (result.error) {
    console.error(`Error: ${result.error}`);
  }

  saveLog(result);

  return result;
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { measurePerformance, run };
