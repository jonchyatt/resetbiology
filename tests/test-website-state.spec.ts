import { test, expect } from '@playwright/test';

test.describe('Website Current State Screenshots', () => {
  test.setTimeout(120000); // 2 minutes timeout

  const testPorts = [3001, 3000, 3002];

  for (const port of testPorts) {
    test(`Screenshots on port ${port}`, async ({ page }) => {
      const baseUrl = `http://localhost:${port}`;
      
      try {
        console.log(`Testing on port ${port}...`);
        
        // 1. Homepage screenshot
        console.log('Navigating to homepage...');
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `homepage-port-${port}.png`, fullPage: true });
        console.log(`Homepage screenshot saved for port ${port}`);

        // Check for console errors
        const consoleErrors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        // 2. Store page screenshot  
        console.log('Navigating to /store...');
        try {
          await page.goto(`${baseUrl}/store`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `store-page-port-${port}.png`, fullPage: true });
          console.log(`Store page screenshot saved for port ${port}`);
        } catch (error) {
          console.log(`Store page error on port ${port}: ${error}`);
        }

        // 3. Portal page screenshot
        console.log('Navigating to /portal...');
        try {
          await page.goto(`${baseUrl}/portal`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `portal-page-port-${port}.png`, fullPage: true });
          console.log(`Portal page screenshot saved for port ${port}`);
        } catch (error) {
          console.log(`Portal page error on port ${port}: ${error}`);
        }

        // 4. Try clicking Sign In button
        console.log('Going back to homepage to test Sign In...');
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Look for sign in button with various selectors
        const signInSelectors = [
          'text=Sign in',
          'text=Sign In', 
          'text=Login',
          'text=Log in',
          '[data-testid="sign-in"]',
          'button:has-text("Sign")',
          'a:has-text("Sign")'
        ];

        let signInFound = false;
        for (const selector of signInSelectors) {
          try {
            const signInButton = page.locator(selector).first();
            if (await signInButton.isVisible({ timeout: 1000 })) {
              console.log(`Found sign in button with selector: ${selector}`);
              await signInButton.click();
              await page.waitForTimeout(3000);
              await page.screenshot({ path: `signin-clicked-port-${port}.png`, fullPage: true });
              console.log(`Sign in click screenshot saved for port ${port}`);
              signInFound = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        if (!signInFound) {
          console.log(`No sign in button found on port ${port}`);
          await page.screenshot({ path: `no-signin-found-port-${port}.png`, fullPage: true });
        }

        // Log console errors
        if (consoleErrors.length > 0) {
          console.log(`Console errors on port ${port}:`, consoleErrors);
        } else {
          console.log(`No console errors on port ${port}`);
        }

        console.log(`Completed testing port ${port}`);
        
      } catch (error) {
        console.log(`Failed to test port ${port}: ${error}`);
        // Try to take a screenshot anyway
        try {
          await page.screenshot({ path: `error-port-${port}.png`, fullPage: true });
        } catch (e) {
          console.log(`Could not take error screenshot for port ${port}`);
        }
      }
    });
  }
});