import { test, expect, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const testDevices = [
  { name: 'iPhone-12', ...devices['iPhone 12'] },
  { name: 'iPhone-15-Pro', ...devices['iPhone 15 Pro'] },
  { name: 'Pixel-7', ...devices['Pixel 7'] },
  { name: 'iPad', ...devices['iPad (gen 7)'] },
  { name: 'Desktop', viewport: { width: 1920, height: 1080 } }
];

const pages = [
  { path: '/', name: 'homepage' },
  { path: '/portal', name: 'portal' },
  { path: '/peptides', name: 'peptides' },
  { path: '/workout', name: 'workout' },
  { path: '/nutrition', name: 'nutrition' },
  { path: '/breath', name: 'breath' }
];

for (const pageInfo of pages) {
  for (const device of testDevices) {
    test(`${pageInfo.name} - ${device.name}`, async ({ page, context }) => {
      // Apply device viewport
      if (device.viewport) {
        await page.setViewportSize(device.viewport);
      }

      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Check for horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance

      // Ensure screenshot directory exists
      const screenshotDir = path.join('.hos', 'memory', 'visual', 'baseline');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      // Capture screenshot
      const screenshotPath = path.join(
        screenshotDir,
        `${pageInfo.name}-${device.name}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Check tap target sizes on mobile
      if (device.name.includes('iPhone') || device.name.includes('Pixel')) {
        const smallButtons = await page.locator('button:visible, a:visible').evaluateAll(elements => {
          return elements.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
          }).length;
        });

        if (smallButtons > 0) {
          console.log(`Warning: ${smallButtons} tap targets < 44px on ${pageInfo.name} (${device.name})`);
        }
      }
    });
  }
}
