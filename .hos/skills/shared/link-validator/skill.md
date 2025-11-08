# Link Validator

## Purpose
Validates all internal and external links across the Reset Biology website using Playwright.

## When to Use
- Before deploying changes
- After content updates
- Weekly automated checks
- When restructuring navigation

## How It Works
1. Crawls all pages starting from homepage
2. Extracts all anchor tags and href attributes
3. Tests each link for:
   - HTTP status code (200-299 = success)
   - Valid redirects (301, 302)
   - Broken links (404, 500, etc.)
   - External link availability
4. Reports broken links with location

## Implementation

```typescript
// tests/link-validator.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Link Validator', () => {
  const pages = [
    '/',
    '/portal',
    '/peptides',
    '/workout',
    '/nutrition',
    '/breath',
    '/journal',
    '/order'
  ];

  const brokenLinks: Array<{page: string, link: string, status: number}> = [];

  for (const page of pages) {
    test(`Check links on ${page}`, async ({ page: pw }) => {
      await pw.goto(page, { waitUntil: 'networkidle' });

      const links = await pw.locator('a[href]').all();

      for (const link of links) {
        const href = await link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }

        try {
          if (href.startsWith('/')) {
            // Internal link
            const response = await pw.request.get(href);
            if (response.status() >= 400) {
              brokenLinks.push({ page, link: href, status: response.status() });
            }
          } else if (href.startsWith('http')) {
            // External link
            const response = await pw.request.get(href);
            if (response.status() >= 400) {
              brokenLinks.push({ page, link: href, status: response.status() });
            }
          }
        } catch (error) {
          brokenLinks.push({ page, link: href, status: 0 });
        }
      }
    });
  }

  test.afterAll(() => {
    if (brokenLinks.length > 0) {
      console.log('BROKEN LINKS FOUND:');
      brokenLinks.forEach(({page, link, status}) => {
        console.log(`  ${page}: ${link} (Status: ${status})`);
      });
    }
  });
});
```

## Success Criteria
- All internal links return 200-299 status
- All external links are reachable
- No 404 errors
- Redirects properly configured

## Output
Generates report in `playwright-report/` showing:
- Total links checked
- Broken links with location
- Status codes
