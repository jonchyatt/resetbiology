const fs = require('fs');
const sqlite3 = require('sqlite3');
const { chromium } = require('playwright');

// Chrome cookie database locations
const chromeCookiePaths = [
  '/home/jonch/.config/google-chrome/Default/Cookies',
  '/home/jonch/.config/chromium/Default/Cookies',
  '/home/jonch/snap/chromium/common/chromium/Default/Cookies'
];

function findCookieDB() {
  for (const path of chromeCookiePaths) {
    if (fs.existsSync(path)) {
      console.log(`📁 Found Chrome cookies at: ${path}`);
      return path;
    }
  }
  return null;
}

function extractCookies() {
  return new Promise((resolve, reject) => {
    const cookieDBPath = findCookieDB();
    if (!cookieDBPath) {
      reject(new Error('Chrome cookie database not found'));
      return;
    }

    // Copy the database to avoid locking issues
    const tempDB = '/tmp/chrome_cookies_copy.db';
    fs.copyFileSync(cookieDBPath, tempDB);

    const db = new sqlite3.Database(tempDB);
    
    const query = `
      SELECT name, value, host_key, path, expires_utc, is_secure, is_httponly, samesite
      FROM cookies 
      WHERE host_key LIKE '%cellularpeptide.com%'
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`🍪 Found ${rows.length} cookies for cellularpeptide.com`);
      
      // Convert to Playwright cookie format
      const cookies = rows.map(row => ({
        name: row.name,
        value: row.value,
        domain: row.host_key.startsWith('.') ? row.host_key : '.' + row.host_key,
        path: row.path,
        expires: row.expires_utc ? Math.floor(row.expires_utc / 1000000 - 11644473600) : -1,
        httpOnly: Boolean(row.is_httponly),
        secure: Boolean(row.is_secure),
        sameSite: row.samesite === 0 ? 'None' : row.samesite === 1 ? 'Lax' : 'Strict'
      }));
      
      db.close();
      fs.unlinkSync(tempDB); // Clean up temp file
      
      resolve(cookies);
    });
  });
}

async function testCookies() {
  try {
    console.log('🔍 Extracting cookies from Chrome...');
    const cookies = await extractCookies();
    
    if (cookies.length === 0) {
      console.log('❌ No cookies found for cellularpeptide.com');
      return;
    }
    
    console.log('🧪 Testing cookies with Playwright...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    
    // Add cookies to the context
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    await page.goto('https://cellularpeptide.com');
    
    // Wait a moment for any auth redirects
    await page.waitForTimeout(3000);
    
    // Check if we're logged in by looking for account/logout elements
    const isLoggedIn = await page.evaluate(() => {
      // Look for common logged-in indicators
      const indicators = [
        'a[href*="logout"]',
        'a[href*="account"]',
        'a[href*="dashboard"]',
        '.user-menu',
        '.account-menu'
      ];
      
      return indicators.some(selector => document.querySelector(selector));
    });
    
    console.log(isLoggedIn ? '✅ Successfully logged in with cookies!' : '❌ Cookies may be expired or invalid');
    
    if (isLoggedIn) {
      console.log('🎯 Ready to scrape! Navigating to collections...');
      
      // Save cookies to file for later use
      fs.writeFileSync('/tmp/cellularpeptide_cookies.json', JSON.stringify(cookies, null, 2));
      console.log('💾 Cookies saved to /tmp/cellularpeptide_cookies.json');
      
      // Go to first collection page
      await page.goto('https://cellularpeptide.com/collections/all');
      await page.waitForTimeout(2000);
      
      console.log('🛍️ Collection page loaded. Ready for scraping!');
      console.log('📋 Press Enter to start scraping process...');
    }
    
    // Keep browser open for scraping
    process.stdin.on('data', (data) => {
      if (data.toString().trim()) {
        console.log('🚀 Starting scraping process...');
        // Don't close browser - we'll use it for scraping
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCookies();