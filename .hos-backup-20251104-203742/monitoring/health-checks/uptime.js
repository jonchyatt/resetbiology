const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'https://reset-biology.vercel.app';
const LOG_FILE = path.join(__dirname, '../../reports/uptime-log.json');

async function checkUptime() {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const url = new URL(SITE_URL);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.get(SITE_URL, (res) => {
      const responseTime = Date.now() - startTime;

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const result = {
          timestamp: new Date().toISOString(),
          url: SITE_URL,
          status: res.statusCode,
          responseTime,
          statusText: res.statusMessage,
          isUp: res.statusCode >= 200 && res.statusCode < 400,
          headers: res.headers
        };

        resolve(result);
      });
    });

    req.on('error', (error) => {
      resolve({
        timestamp: new Date().toISOString(),
        url: SITE_URL,
        status: 0,
        responseTime: Date.now() - startTime,
        isUp: false,
        error: error.message
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        timestamp: new Date().toISOString(),
        url: SITE_URL,
        status: 0,
        responseTime: 10000,
        isUp: false,
        error: 'Request timeout'
      });
    });
  });
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

  // Keep only last 1000 entries
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

async function run() {
  console.log('Checking uptime...');
  const result = await checkUptime();

  console.log(`Status: ${result.status}`);
  console.log(`Response Time: ${result.responseTime}ms`);
  console.log(`Is Up: ${result.isUp}`);

  if (result.error) {
    console.error(`Error: ${result.error}`);
  }

  saveLog(result);

  return result;
}

if (require.main === module) {
  run().then(() => process.exit(0));
}

module.exports = { checkUptime, run };
