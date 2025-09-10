const { chromium } = require('playwright');

async function examineOrderPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to Reset Biology order page...');
    await page.goto('https://resetbiology.com/order', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Take full page screenshot
    console.log('Taking full page screenshot...');
    await page.screenshot({ 
      path: 'order-page-full.png', 
      fullPage: true 
    });

    // Take viewport screenshot
    console.log('Taking viewport screenshot...');
    await page.screenshot({ 
      path: 'order-page-viewport.png' 
    });

    // Check for Auth0 elements
    console.log('Checking for Auth0 elements...');
    const auth0Elements = await page.$$('[class*="auth0"], [id*="auth0"], [data-testid*="auth0"]');
    console.log(`Found ${auth0Elements.length} potential Auth0 elements`);

    // Get page title and description
    const title = await page.title();
    console.log('Page title:', title);

    // Check for login/auth elements
    const loginElements = await page.$$('text=Login, text=Sign In, text=Sign Up, [href*="login"], [href*="auth"]');
    console.log(`Found ${loginElements.length} potential login/auth elements`);

    // Get the main content structure
    const mainContent = await page.textContent('body');
    
    // Look for package/product information
    const packageElements = await page.$$('[class*="package"], [class*="product"], [class*="price"]');
    console.log(`Found ${packageElements.length} potential package/product elements`);

    // Check current styling patterns
    const stylesheets = await page.$$eval('link[rel="stylesheet"]', links => 
      links.map(link => link.href)
    );
    console.log('Stylesheets:', stylesheets);

    // Get color scheme information from CSS variables or computed styles
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        fontFamily: styles.fontFamily
      };
    });
    console.log('Body styles:', bodyStyles);

    console.log('Screenshots saved successfully!');
    
  } catch (error) {
    console.error('Error examining order page:', error);
  } finally {
    await browser.close();
  }
}

examineOrderPage().catch(console.error);