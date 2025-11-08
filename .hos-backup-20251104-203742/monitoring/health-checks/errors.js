const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://reset-biology.vercel.app';
const LOG_FILE = path.join(__dirname, '../../reports/errors-log.json');

async function checkForErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = {
    timestamp: new Date().toISOString(),
    url: SITE_URL,
    consoleErrors: [],
    networkErrors: [],
    brokenLinks: [],
    uncaughtExceptions: [],
    totalErrors: 0
  };

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    errors.uncaughtExceptions.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Capture failed requests
  page.on('requestfailed', (request) => {
    errors.networkErrors.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'Unknown error'
    });
  });

  try {
    await page.goto(SITE_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Check for broken links (sample first 50 links)
    const links = await page.$$eval('a[href]', (anchors) =>
      anchors.slice(0, 50).map(a => ({
        href: a.href,
        text: a.textContent?.trim() || ''
      }))
    );

    for (const link of links) {
      if (link.href.startsWith('http')) {
        try {
          const response = await page.request.get(link.href, { timeout: 5000 });
          if (!response.ok()) {
            errors.brokenLinks.push({
              url: link.href,
              text: link.text,
              status: response.status()
            });
          }
        } catch (e) {
          errors.brokenLinks.push({
            url: link.href,
            text: link.text,
            error: e.message
          });
        }
      }
    }

  } catch (error) {
    errors.uncaughtExceptions.push({
      message: error.message,
      stack: error.stack
    });
  } finally {
    await browser.close();
  }

  errors.totalErrors =
    errors.consoleErrors.length +
    errors.networkErrors.length +
    errors.brokenLinks.length +
    errors.uncaughtExceptions.length;

  return errors;
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
  console.log('Checking for errors...');
  const result = await checkForErrors();

  console.log(`Total Errors: ${result.totalErrors}`);
  console.log(`Console Errors: ${result.consoleErrors.length}`);
  console.log(`Network Errors: ${result.networkErrors.length}`);
  console.log(`Broken Links: ${result.brokenLinks.length}`);
  console.log(`Uncaught Exceptions: ${result.uncaughtExceptions.length}`);

  if (result.totalErrors > 0) {
    console.warn('Errors detected! Check log file for details.');
  }

  saveLog(result);

  return result;
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { checkForErrors, run };
