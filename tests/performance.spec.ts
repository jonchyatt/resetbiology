import { test, expect } from '@playwright/test';

const pages = [
  { path: '/', name: 'Homepage' },
  { path: '/portal', name: 'Portal' },
  { path: '/peptides', name: 'Peptides' },
  { path: '/workout', name: 'Workout' },
  { path: '/nutrition', name: 'Nutrition' }
];

test.describe('Performance Audit', () => {

  for (const pageInfo of pages) {
    test(`${pageInfo.name} - Core Web Vitals`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Get Web Vitals using browser API
      const metrics = await page.evaluate(() => {
        return new Promise<any>((resolve) => {
          const vitals: any = {};

          // FCP
          const paintObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcpEntry = entries.find(e => e.name === 'first-contentful-paint');
            if (fcpEntry) {
              vitals.fcp = fcpEntry.startTime;
            }
          });
          paintObserver.observe({ type: 'paint', buffered: true });

          // LCP
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              vitals.lcp = entries[entries.length - 1].startTime;
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          // CLS
          let clsScore = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsScore += entry.value;
              }
            }
            vitals.cls = clsScore;
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });

          // Give time to collect metrics
          setTimeout(() => resolve(vitals), 3000);
        });
      });

      console.log(`\n${pageInfo.name} Metrics:`, metrics);

      // Assert performance thresholds (with warnings, not failures)
      if (metrics.fcp) {
        console.log(`  FCP: ${metrics.fcp.toFixed(2)}ms ${metrics.fcp < 1800 ? '✓' : '✗ (target: <1800ms)'}`);
      }
      if (metrics.lcp) {
        console.log(`  LCP: ${metrics.lcp.toFixed(2)}ms ${metrics.lcp < 2500 ? '✓' : '✗ (target: <2500ms)'}`);
      }
      if (metrics.cls !== undefined) {
        console.log(`  CLS: ${metrics.cls.toFixed(3)} ${metrics.cls < 0.1 ? '✓' : '✗ (target: <0.1)'}`);
      }
    });

    test(`${pageInfo.name} - Load time`, async ({ page }) => {
      const startTime = Date.now();
      await page.goto(pageInfo.path, { waitUntil: 'load' });
      const loadTime = Date.now() - startTime;

      console.log(`\n${pageInfo.name} Load Time: ${loadTime}ms ${loadTime < 3000 ? '✓' : '✗ (target: <3000ms)'}`);
    });

    test(`${pageInfo.name} - JavaScript bundle size`, async ({ page }) => {
      const jsRequests: Array<{ url: string; size: number }> = [];

      page.on('response', async (response) => {
        if (response.url().endsWith('.js')) {
          try {
            const buffer = await response.body();
            jsRequests.push({
              url: response.url(),
              size: buffer.length
            });
          } catch (e) {
            // Ignore errors reading response bodies
          }
        }
      });

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      const totalJsSize = jsRequests.reduce((sum, req) => sum + req.size, 0);
      console.log(`\n${pageInfo.name} Total JS: ${(totalJsSize / 1024).toFixed(2)} KB`);

      // Log large bundles
      const largeBundles = jsRequests.filter(req => req.size > 100000);
      if (largeBundles.length > 0) {
        console.log('  Large bundles (>100KB):');
        largeBundles.forEach(req => {
          console.log(`    ${req.url.split('/').pop()} - ${(req.size / 1024).toFixed(2)} KB`);
        });
      }
    });

    test(`${pageInfo.name} - Images optimized`, async ({ page }) => {
      const imageRequests: Array<{ url: string; size: number }> = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          try {
            const buffer = await response.body();
            imageRequests.push({
              url,
              size: buffer.length
            });
          } catch (e) {
            // Ignore errors
          }
        }
      });

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Check for large images
      const largeImages = imageRequests.filter(img => img.size > 500000); // > 500KB

      if (largeImages.length > 0) {
        console.log(`\n${pageInfo.name} Large Images (>500KB):`);
        largeImages.forEach(img => {
          console.log(`  ${img.url.split('/').pop()}: ${(img.size / 1024).toFixed(2)} KB`);
        });
      } else {
        console.log(`\n${pageInfo.name} Image Optimization: ✓ All images < 500KB`);
      }
    });
  }
});
