const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://reset-biology.vercel.app';
const SCREENSHOT_DIR = path.join(__dirname, '../../reports/screenshots');
const LOG_FILE = path.join(__dirname, '../../reports/playwright-health-log.json');

const PAGES_TO_CHECK = [
  { name: 'Homepage', path: '/' },
  { name: 'Portal', path: '/portal' },
  { name: 'Store', path: '/store' },
  { name: 'Process', path: '/process' }
];

async function checkPageHealth(page, pageConfig) {
  const result = {
    name: pageConfig.name,
    path: pageConfig.path,
    url: SITE_URL + pageConfig.path,
    timestamp: new Date().toISOString(),
    loaded: false,
    jsErrors: [],
    networkErrors: [],
    missingElements: [],
    screenshot: null,
    responseTime: null
  };

  const errors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()?.errorText
    });
  });

  try {
    const startTime = Date.now();
    await page.goto(result.url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    result.responseTime = Date.now() - startTime;
    result.loaded = true;

    // Wait for page to settle
    await page.waitForTimeout(1000);

    // Check for critical elements based on page
    const checks = {
      'Homepage': ['nav', 'main', 'footer'],
      'Portal': ['nav', 'main'],
      'Store': ['nav', 'main'],
      'Process': ['nav', 'main']
    };

    const elementsToCheck = checks[pageConfig.name] || ['body'];

    for (const selector of elementsToCheck) {
      const element = await page.$(selector);
      if (!element) {
        result.missingElements.push(selector);
      }
    }

    // Take screenshot
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`
    );
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

  } catch (error) {
    errors.push(error.message);
  }

  result.jsErrors = errors;
  result.networkErrors = networkErrors;

  return result;
}

async function runHealthChecks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const results = {
    timestamp: new Date().toISOString(),
    site: SITE_URL,
    pages: [],
    summary: {
      total: PAGES_TO_CHECK.length,
      passed: 0,
      failed: 0,
      totalErrors: 0
    }
  };

  for (const pageConfig of PAGES_TO_CHECK) {
    console.log(`Checking ${pageConfig.name}...`);
    const page = await context.newPage();
    const result = await checkPageHealth(page, pageConfig);
    await page.close();

    results.pages.push(result);

    const pageErrors = result.jsErrors.length +
                       result.networkErrors.length +
                       result.missingElements.length;

    if (result.loaded && pageErrors === 0) {
      results.summary.passed++;
    } else {
      results.summary.failed++;
    }

    results.summary.totalErrors += pageErrors;
  }

  await browser.close();

  return results;
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

  // Keep only last 200 entries
  if (logs.length > 200) {
    logs = logs.slice(-200);
  }

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

async function run() {
  console.log('Running Playwright health checks...');
  const result = await runHealthChecks();

  console.log(`\nSummary:`);
  console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
  console.log(`Failed: ${result.summary.failed}/${result.summary.total}`);
  console.log(`Total Errors: ${result.summary.totalErrors}`);

  saveLog(result);

  return result;
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { runHealthChecks, run };
