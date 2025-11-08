# Style Consistency Checker

## Purpose
Validates that all pages follow the Reset Biology design system.

## Design System Rules
- **Primary Teal**: #3FBFB5 (rgb(63, 191, 181))
- **Secondary Green**: #72C247 (rgb(114, 194, 71))
- **Font Family**: System font stack
- **Transparency Pattern**: `/20` or `/30` with `backdrop-blur-sm`
- **Button Style**: Rounded with hover states
- **Card Style**: Dark background with subtle borders

## When to Use
- After CSS changes
- When adding new components
- Before design reviews
- Weekly consistency checks

## How It Works
1. Scans all pages for color usage
2. Checks font consistency
3. Validates spacing patterns
4. Ensures button styles match
5. Verifies card styling

## Implementation

```typescript
// tests/style-consistency.spec.ts
import { test, expect } from '@playwright/test';

const BRAND_COLORS = {
  primaryTeal: 'rgb(63, 191, 181)',
  secondaryGreen: 'rgb(114, 194, 71)',
  darkBg: 'rgb(26, 26, 46)',
  gray800: 'rgb(31, 41, 55)'
};

const pages = ['/', '/portal', '/peptides', '/workout', '/nutrition', '/breath'];

test.describe('Style Consistency', () => {

  for (const page of pages) {
    test(`${page} - Brand colors used correctly`, async ({ page: pw }) => {
      await pw.goto(page, { waitUntil: 'networkidle' });

      // Check for off-brand colors (common mistakes)
      const elements = await pw.locator('*').all();

      for (const el of elements) {
        const bgColor = await el.evaluate(node =>
          window.getComputedStyle(node).backgroundColor
        );

        const color = await el.evaluate(node =>
          window.getComputedStyle(node).color
        );

        // Ensure no random blues/greens outside brand palette
        if (bgColor.includes('rgb')) {
          const [r, g, b] = bgColor.match(/\d+/g)!.map(Number);

          // If it's a blue/green, it should be brand color
          if (g > r && g > b && g > 100) {
            const isValidGreen = (
              Math.abs(r - 114) < 10 && Math.abs(g - 194) < 10 && Math.abs(b - 71) < 10
            ) || (
              Math.abs(r - 63) < 10 && Math.abs(g - 191) < 10 && Math.abs(b - 181) < 10
            );

            expect(isValidGreen).toBe(true);
          }
        }
      }
    });

    test(`${page} - Buttons styled consistently`, async ({ page: pw }) => {
      await pw.goto(page, { waitUntil: 'networkidle' });

      const buttons = await pw.locator('button, .button, a[role="button"]').all();

      for (const button of buttons) {
        const borderRadius = await button.evaluate(node =>
          window.getComputedStyle(node).borderRadius
        );

        // All buttons should have rounded corners
        expect(parseInt(borderRadius)).toBeGreaterThan(0);
      }
    });

    test(`${page} - Typography consistent`, async ({ page: pw }) => {
      await pw.goto(page, { waitUntil: 'networkidle' });

      const headings = await pw.locator('h1, h2, h3').all();

      for (const heading of headings) {
        const fontWeight = await heading.evaluate(node =>
          window.getComputedStyle(node).fontWeight
        );

        // Headings should be bold
        expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
      }
    });

    test(`${page} - Transparency effects applied`, async ({ page: pw }) => {
      await pw.goto(page, { waitUntil: 'networkidle' });

      const cards = await pw.locator('.bg-gray-800\\/20, .bg-gray-800\\/30').all();

      for (const card of cards) {
        const backdropFilter = await card.evaluate(node =>
          window.getComputedStyle(node).backdropFilter
        );

        // Should have backdrop blur
        expect(backdropFilter).toContain('blur');
      }
    });
  }
});
```

## Success Criteria
- Only brand colors used
- Consistent button styling
- Typography follows system
- Proper transparency effects
- Card styles uniform

## Output
Report listing any style inconsistencies with element selectors
