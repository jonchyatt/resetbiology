import { test, expect } from '@playwright/test';

test.describe('Link Validator', () => {
  const pages = [
    '/',
    '/portal',
    '/peptides',
    '/workout',
    '/nutrition',
    '/breath',
    '/order'
  ];

  const brokenLinks: Array<{page: string, link: string, status: number | string}> = [];

  for (const pagePath of pages) {
    test(`Check links on ${pagePath}`, async ({ page }) => {
      await page.goto(pagePath, { waitUntil: 'networkidle' });

      const links = await page.locator('a[href]').all();

      for (const link of links) {
        const href = await link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }

        try {
          if (href.startsWith('/')) {
            // Internal link
            const response = await page.request.get(href);
            if (response.status() >= 400) {
              brokenLinks.push({ page: pagePath, link: href, status: response.status() });
            }
          } else if (href.startsWith('http')) {
            // External link
            const response = await page.request.get(href);
            if (response.status() >= 400) {
              brokenLinks.push({ page: pagePath, link: href, status: response.status() });
            }
          }
        } catch (error) {
          brokenLinks.push({ page: pagePath, link: href, status: 'ERROR' });
        }
      }
    });
  }

  test.afterAll(() => {
    if (brokenLinks.length > 0) {
      console.log('\n=== BROKEN LINKS FOUND ===');
      brokenLinks.forEach(({page, link, status}) => {
        console.log(`  ${page}: ${link} (Status: ${status})`);
      });
      console.log('==========================\n');
    } else {
      console.log('\n=== ALL LINKS VALID ===\n');
    }
  });
});
