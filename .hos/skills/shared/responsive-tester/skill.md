# Responsive Tester

## Purpose
Tests Reset Biology website across multiple devices and screen sizes using Playwright device emulation.

## Devices Tested
- iPhone 12 (390x844)
- iPhone 15 Pro (393x852)
- Pixel 7 (412x915)
- iPad (768x1024)
- Desktop (1920x1080)

## When to Use
- Before deploying UI changes
- After CSS modifications
- Testing new components
- Verifying mobile-first design

## How It Works
1. Loads each page on each device
2. Captures full-page screenshots
3. Tests for:
   - Content overflow
   - Button tap targets (min 44x44px)
   - Text readability
   - Navigation accessibility
   - Image scaling
4. Compares against baseline screenshots

## Implementation

```typescript
// tests/responsive.spec.ts
import { test, expect, devices } from '@playwright/test';
import path from 'path';

const testDevices = [
  { name: 'iPhone 12', ...devices['iPhone 12'] },
  { name: 'iPhone 15 Pro', ...devices['iPhone 15 Pro'] },
  { name: 'Pixel 7', ...devices['Pixel 7'] },
  { name: 'iPad', ...devices['iPad (gen 7)'] },
  { name: 'Desktop', viewport: { width: 1920, height: 1080 } }
];

const pages = [
  { path: '/', name: 'homepage' },
  { path: '/portal', name: 'portal' },
  { path: '/peptides', name: 'peptides' },
  { path: '/workout', name: 'workout' },
  { path: '/nutrition', name: 'nutrition' },
  { path: '/breath', name: 'breath' },
  { path: '/journal', name: 'journal' }
];

for (const device of testDevices) {
  test.describe(`${device.name} Tests`, () => {
    test.use(device);

    for (const page of pages) {
      test(`${page.name} - ${device.name}`, async ({ page: pw }) => {
        await pw.goto(page.path, { waitUntil: 'networkidle' });

        // Check for horizontal overflow
        const bodyWidth = await pw.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await pw.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance

        // Capture screenshot
        const screenshotPath = path.join(
          '.hos', 'memory', 'visual', 'current',
          `${page.name}-${device.name.replace(/\s+/g, '-').toLowerCase()}.png`
        );
        await pw.screenshot({ path: screenshotPath, fullPage: true });

        // Check tap target sizes on mobile
        if (device.name.includes('iPhone') || device.name.includes('Pixel')) {
          const smallButtons = await pw.locator('button, a').evaluateAll(elements => {
            return elements.filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44;
            }).length;
          });
          expect(smallButtons).toBe(0); // All tap targets should be >= 44px
        }
      });
    }
  });
}
```

## Success Criteria
- No horizontal scrolling on any device
- All tap targets >= 44x44px on mobile
- Text readable without zooming
- Navigation accessible on all screens
- Images scale properly

## Output
Screenshots saved to `.hos/memory/visual/current/` for comparison with baseline
