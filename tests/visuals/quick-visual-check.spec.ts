/**
 * Quick Visual Check - Takes screenshots of the Visual Studio page
 * Run with: npx playwright test tests/visuals/quick-visual-check.spec.ts --project="Desktop Chrome" --headed
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const VISUAL_STUDIO_URL = `${BASE_URL}/visuals/breathing`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.setTimeout(120000);

test('Visual Studio Quick Check', async ({ page }) => {
  console.log('Navigating to Visual Studio...');
  await page.goto(VISUAL_STUDIO_URL);
  await page.waitForLoadState('networkidle');

  console.log('Taking initial screenshot...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-01-initial.png') });

  // Check header
  await expect(page.locator('h1')).toContainText('Visual Studio');
  console.log('Header verified');

  // Wait for canvas to render
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-02-canvas-loaded.png') });
  console.log('Canvas screenshot taken');

  // Click Orb tab
  await page.locator('button:has-text("Orb")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-03-orb-tab.png') });
  console.log('Orb tab screenshot taken');

  // Click Environment tab
  await page.locator('button:has-text("Environment")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-04-environment-tab.png') });
  console.log('Environment tab screenshot taken');

  // Click Export tab
  await page.locator('button:has-text("Export")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-05-export-tab.png') });
  console.log('Export tab screenshot taken');

  // Go back to Mode tab and switch to Audio mode
  await page.locator('button:has-text("Mode")').click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Audio Reactive")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vs-06-audio-mode.png') });
  console.log('Audio mode screenshot taken');

  console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}`);
});
