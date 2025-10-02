import { test, expect } from '@playwright/test';

test.describe('Live Site Styling Analysis', () => {
  test('analyze resetbiology.com/order styling patterns', async ({ page }) => {
    // Navigate to the live site
    await page.goto('https://resetbiology.com/order');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take a full page screenshot
    await page.screenshot({ 
      path: 'order-page-full.png', 
      fullPage: true 
    });
    
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
      console.log('Main container styles:', containerStyles);
    }
    
    // Analyze card containers
    const cards = page.locator('.card, [class*="card"], .bg-gradient, [class*="bg-gradient"]');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} potential card elements`);
    
    if (cardCount > 0) {
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = cards.nth(i);
        const cardStyles = await card.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            className: el.className,
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
        console.log(`Card ${i + 1} styles:`, cardStyles);
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
    console.log('Body/HTML styles:', bodyStyles);
    
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
            cls.includes('blur')
          )) {
            classes.add(cls.trim());
          }
        });
      });
      return Array.from(classes).sort();
    });
    console.log('Background/styling related classes found:', allClasses);
    
    // Take a screenshot of the main content area
    const mainContent = page.locator('main, .container, .content').first();
    if (await mainContent.count() > 0) {
      await mainContent.screenshot({ path: 'order-page-main-content.png' });
    }
  });
});