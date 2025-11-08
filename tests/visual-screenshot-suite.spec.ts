import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports/screenshots';

test.describe('Visual Screenshot Suite', () => {

  test('Homepage - Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/01-homepage-desktop.png`,
      fullPage: true
    });
  });

  test('Homepage - Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/02-homepage-mobile.png`,
      fullPage: true
    });
  });

  test('Order Page - Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/order`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/03-order-desktop.png`,
      fullPage: true
    });
  });

  test('Order Page - Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/order`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/04-order-mobile.png`,
      fullPage: true
    });
  });

  test('Breath Training - Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/breath`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/05-breath-desktop.png`,
      fullPage: true
    });
  });

  test('Breath Training - Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/breath`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `${REPORT_DIR}/06-breath-mobile.png`,
      fullPage: true
    });
  });

  test('Portal - Desktop (if accessible)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForTimeout(2000);

    // Check if redirected to login
    if (!page.url().includes('/auth/login') && !page.url().includes('auth0.com')) {
      await page.screenshot({
        path: `${REPORT_DIR}/07-portal-desktop.png`,
        fullPage: true
      });
    }
  });

  test('Portal - Mobile (if accessible)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForTimeout(2000);

    if (!page.url().includes('/auth/login') && !page.url().includes('auth0.com')) {
      await page.screenshot({
        path: `${REPORT_DIR}/08-portal-mobile.png`,
        fullPage: true
      });
    }
  });

  test('Peptides Page - Desktop (if accessible)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/peptides`);
    await page.waitForTimeout(2000);

    if (!page.url().includes('/auth/login') && !page.url().includes('auth0.com')) {
      await page.screenshot({
        path: `${REPORT_DIR}/09-peptides-desktop.png`,
        fullPage: true
      });
    }
  });

  test('Peptides Page - Mobile (if accessible)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/peptides`);
    await page.waitForTimeout(2000);

    if (!page.url().includes('/auth/login') && !page.url().includes('auth0.com')) {
      await page.screenshot({
        path: `${REPORT_DIR}/10-peptides-mobile.png`,
        fullPage: true
      });
    }
  });
});
