import { test, expect } from '@playwright/test';

test('Order page styling verification', async ({ page }) => {
  // Navigate to order page
  await page.goto('http://localhost:3000/order');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take full page screenshot
  await page.screenshot({
    path: 'order-page-styling.png',
    fullPage: true
  });
  
  // Check for glassmorphism elements
  const glassmorphismCards = await page.locator('.backdrop-blur-sm').count();
  const transparentBackgrounds = await page.locator('[class*="/20"], [class*="/30"]').count();
  
  console.log('Glassmorphism cards found:', glassmorphismCards);
  console.log('Transparent backgrounds found:', transparentBackgrounds);
  
  // Check for dark background
  const heroSection = page.locator('body');
  const backgroundStyle = await heroSection.evaluate(el => getComputedStyle(el).backgroundImage);
  console.log('Background style:', backgroundStyle);
  
  // Check for white text elements
  const whiteTextElements = await page.locator('[class*="text-white"]').count();
  console.log('White text elements found:', whiteTextElements);
});