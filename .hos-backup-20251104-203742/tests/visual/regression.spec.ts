import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/', name: 'homepage' },
  { path: '/portal', name: 'portal-dashboard' },
  { path: '/peptides', name: 'peptide-tracker' },
  { path: '/nutrition', name: 'nutrition-tracker' },
  { path: '/workout', name: 'workout-tracker' },
  { path: '/breath', name: 'breath-training' },
  { path: '/store', name: 'store' },
  { path: '/assessment', name: 'assessment' },
];

const VIEWPORTS = [
  { width: 375, height: 667, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1920, height: 1080, name: 'desktop' },
];

test.describe('Visual Regression Testing', () => {
  for (const page of PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${page.name} - ${viewport.name}`, async ({ page: playwright }) => {
        // Set viewport
        await playwright.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        // Navigate
        await playwright.goto(page.path);

        // Wait for page to stabilize
        await playwright.waitForLoadState('networkidle');

        // Take screenshot
        await expect(playwright).toHaveScreenshot(
          `${page.name}-${viewport.name}.png`,
          {
            fullPage: true,
            maxDiffPixels: 100, // Allow small differences
          }
        );
      });
    }
  }
});
