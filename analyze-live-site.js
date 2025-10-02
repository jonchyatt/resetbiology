const { chromium } = require('playwright');

async function analyzeLiveSite() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to https://resetbiology.com/order...');
    await page.goto('https://resetbiology.com/order');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take a full page screenshot
    await page.screenshot({ 
      path: 'order-page-full.png', 
      fullPage: true 
    });
    console.log('Full page screenshot saved as order-page-full.png');
    
    // Get page title for verification
    const title = await page.title();
    console.log('Page title:', title);
    
    // Analyze main container styling
    const mainContainer = page.locator('main, .main, [role="main"]').first();
    if (await mainContainer.count() > 0) {
      const containerStyles = await mainContainer.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          background: styles.background,
          backgroundColor: styles.backgroundColor,
          backgroundImage: styles.backgroundImage,
          backdropFilter: styles.backdropFilter,
          borderRadius: styles.borderRadius,
          boxShadow: styles.boxShadow,
          border: styles.border
        };
      });
      console.log('\n=== MAIN CONTAINER STYLES ===');
      console.log(JSON.stringify(containerStyles, null, 2));
    }
    
    // Analyze card containers
    const cards = page.locator('.card, [class*="card"], .bg-gradient, [class*="bg-gradient"], [class*="rounded"]');
    const cardCount = await cards.count();
    console.log(`\n=== FOUND ${cardCount} POTENTIAL CARD ELEMENTS ===`);
    
    if (cardCount > 0) {
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = cards.nth(i);
        const cardStyles = await card.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            className: el.className,
            tagName: el.tagName,
            background: styles.background,
            backgroundColor: styles.backgroundColor,
            backgroundImage: styles.backgroundImage,
            backdropFilter: styles.backdropFilter,
            borderRadius: styles.borderRadius,
            boxShadow: styles.boxShadow,
            border: styles.border,
            opacity: styles.opacity
          };
        });
        console.log(`\n--- Card ${i + 1} ---`);
        console.log(JSON.stringify(cardStyles, null, 2));
      }
    }
    
    // Analyze body/html background
    const bodyStyles = await page.evaluate(() => {
      const bodyStyles = window.getComputedStyle(document.body);
      const htmlStyles = window.getComputedStyle(document.documentElement);
      return {
        body: {
          background: bodyStyles.background,
          backgroundColor: bodyStyles.backgroundColor,
          backgroundImage: bodyStyles.backgroundImage
        },
        html: {
          background: htmlStyles.background,
          backgroundColor: htmlStyles.backgroundColor,
          backgroundImage: htmlStyles.backgroundImage
        }
      };
    });
    console.log('\n=== BODY/HTML BACKGROUND STYLES ===');
    console.log(JSON.stringify(bodyStyles, null, 2));
    
    // Get all CSS classes used on the page
    const allClasses = await page.evaluate(() => {
      const elements = document.querySelectorAll('*[class]');
      const classes = new Set();
      elements.forEach(el => {
        el.className.split(' ').forEach(cls => {
          if (cls.trim() && (
            cls.includes('bg-') || 
            cls.includes('gradient') || 
            cls.includes('backdrop') || 
            cls.includes('card') ||
            cls.includes('glass') ||
            cls.includes('blur') ||
            cls.includes('rounded') ||
            cls.includes('shadow')
          )) {
            classes.add(cls.trim());
          }
        });
      });
      return Array.from(classes).sort();
    });
    console.log('\n=== STYLING CLASSES FOUND ===');
    console.log(allClasses);
    
    // Take a screenshot of the main content area
    const mainContent = page.locator('main, .container, .content').first();
    if (await mainContent.count() > 0) {
      await mainContent.screenshot({ path: 'order-page-main-content.png' });
      console.log('\nMain content screenshot saved as order-page-main-content.png');
    }
    
    // Wait a moment to keep browser open for inspection
    console.log('\nBrowser will remain open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error analyzing site:', error);
  } finally {
    await browser.close();
  }
}

analyzeLiveSite();