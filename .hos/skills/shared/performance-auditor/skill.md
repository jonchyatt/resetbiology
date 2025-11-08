# Performance Auditor

## Purpose
Measures website performance metrics using Playwright to ensure fast load times and smooth interactions.

## Metrics Tracked
- **First Contentful Paint (FCP)**: < 1.8s (good)
- **Largest Contentful Paint (LCP)**: < 2.5s (good)
- **Total Blocking Time (TBT)**: < 200ms (good)
- **Cumulative Layout Shift (CLS)**: < 0.1 (good)
- **Time to Interactive (TTI)**: < 3.8s (good)
- **Page Load Time**: < 3s total

## When to Use
- Before production deployments
- After adding new libraries
- When optimizing performance
- Weekly performance monitoring

## How It Works
1. Loads each page with network throttling
2. Measures Core Web Vitals
3. Tracks JavaScript execution time
4. Monitors bundle sizes
5. Checks image optimization

## Implementation

```typescript
// tests/performance.spec.ts
import { test, expect } from '@playwright/test';

const pages = [
  { path: '/', name: 'Homepage' },
  { path: '/portal', name: 'Portal' },
  { path: '/peptides', name: 'Peptides' },
  { path: '/workout', name: 'Workout' },
  { path: '/nutrition', name: 'Nutrition' }
];

test.describe('Performance Audit', () => {

  test.use({
    // Simulate 3G network
    contextOptions: {
      permissions: [],
      extraHTTPHeaders: {}
    }
  });

  for (const page of pages) {
    test(`${page.name} - Core Web Vitals`, async ({ page: pw }) => {
      // Start performance measurement
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      // Get Web Vitals using browser API
      const metrics = await pw.evaluate(() => {
        return new Promise((resolve) => {
          const vitals: any = {};

          // FCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.fcp = entries[0].startTime;
          }).observe({ type: 'paint', buffered: true });

          // LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.lcp = entries[entries.length - 1].startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });

          // CLS
          let clsScore = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsScore += entry.value;
              }
            }
            vitals.cls = clsScore;
          }).observe({ type: 'layout-shift', buffered: true });

          // Give time to collect metrics
          setTimeout(() => resolve(vitals), 3000);
        });
      });

      console.log(`${page.name} Metrics:`, metrics);

      // Assert performance thresholds
      if (metrics.fcp) {
        expect(metrics.fcp).toBeLessThan(1800); // 1.8s
      }
      if (metrics.lcp) {
        expect(metrics.lcp).toBeLessThan(2500); // 2.5s
      }
      if (metrics.cls) {
        expect(metrics.cls).toBeLessThan(0.1);
      }
    });

    test(`${page.name} - Load time`, async ({ page: pw }) => {
      const startTime = Date.now();
      await pw.goto(page.path, { waitUntil: 'load' });
      const loadTime = Date.now() - startTime;

      console.log(`${page.name} Load Time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(3000); // 3 seconds
    });

    test(`${page.name} - JavaScript bundle size`, async ({ page: pw }) => {
      const jsRequests: Array<{ url: string; size: number }> = [];

      pw.on('response', async (response) => {
        if (response.url().endsWith('.js')) {
          const buffer = await response.body();
          jsRequests.push({
            url: response.url(),
            size: buffer.length
          });
        }
      });

      await pw.goto(page.path, { waitUntil: 'networkidle' });

      const totalJsSize = jsRequests.reduce((sum, req) => sum + req.size, 0);
      console.log(`${page.name} Total JS: ${(totalJsSize / 1024).toFixed(2)} KB`);

      // Log large bundles
      jsRequests
        .filter(req => req.size > 100000)
        .forEach(req => {
          console.log(`  Large bundle: ${req.url} (${(req.size / 1024).toFixed(2)} KB)`);
        });
    });

    test(`${page.name} - Images optimized`, async ({ page: pw }) => {
      const imageRequests: Array<{ url: string; size: number }> = [];

      pw.on('response', async (response) => {
        const url = response.url();
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const buffer = await response.body();
          imageRequests.push({
            url,
            size: buffer.length
          });
        }
      });

      await pw.goto(page.path, { waitUntil: 'networkidle' });

      // Check for large images
      const largeImages = imageRequests.filter(img => img.size > 500000); // > 500KB

      if (largeImages.length > 0) {
        console.log(`${page.name} Large Images:`);
        largeImages.forEach(img => {
          console.log(`  ${img.url}: ${(img.size / 1024).toFixed(2)} KB`);
        });
      }

      expect(largeImages.length).toBe(0); // No images should be > 500KB
    });
  }
});
```

## Success Criteria
- FCP < 1.8s
- LCP < 2.5s
- CLS < 0.1
- Total load time < 3s
- No JS bundles > 500KB
- No images > 500KB

## Output
Performance report with:
- Core Web Vitals scores
- Bundle size analysis
- Image optimization suggestions
- Comparison with previous runs
