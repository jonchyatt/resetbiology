import { test, expect } from '@playwright/test';

test.describe('Hover Effects Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Configure viewport for consistent testing
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('Order Page - Individual Peptides hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001/order');
    await page.waitForLoadState('networkidle');

    // Test Individual Peptides section hover effects
    const peptideCards = page.locator('text=Individual Peptides').locator('..').locator('[class*="bg-gradient-to-br"]').first();
    
    // Take screenshot before hover
    await page.screenshot({ path: 'order-page-before-hover.png', fullPage: true });

    // Hover over BPC-157 card
    const bpcCard = page.getByText('BPC-157').locator('..');
    await bpcCard.hover();
    await page.waitForTimeout(500); // Wait for animation
    
    // Take screenshot during hover
    await page.screenshot({ path: 'order-page-bpc157-hover.png', fullPage: true });

    // Test Ipamorelin card
    const ipaCard = page.getByText('Ipamorelin').locator('..');
    await ipaCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'order-page-ipamorelin-hover.png', fullPage: true });

    // Test DSIP card
    const dsipCard = page.getByText('DSIP').locator('..');
    await dsipCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'order-page-dsip-hover.png', fullPage: true });

    // Test package cards
    const packageCards = page.locator('text=Weight Loss Package').locator('..');
    await packageCards.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'order-page-package-hover.png', fullPage: true });
  });

  test('Education Page - Research section hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001/education');
    await page.waitForLoadState('networkidle');

    // Take screenshot before hover
    await page.screenshot({ path: 'education-page-before-hover.png', fullPage: true });

    // Test Breath Training card
    const breathCard = page.getByText('🌬️ Breath Training').locator('..');
    await breathCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'education-breath-hover.png', fullPage: true });

    // Test Peptides card
    const peptidesCard = page.getByText('💉 Peptides').locator('..');
    await peptidesCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'education-peptides-hover.png', fullPage: true });

    // Test Exercise card
    const exerciseCard = page.getByText('💪 Exercise').locator('..');
    await exerciseCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'education-exercise-hover.png', fullPage: true });

    // Test collapsible sections
    const collapsibleSections = page.locator('[class*="cursor-pointer"]');
    const firstSection = collapsibleSections.first();
    await firstSection.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'education-collapsible-hover.png', fullPage: true });
  });

  test('Portal Page - Stat cards and modules hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001/portal');
    await page.waitForLoadState('networkidle');

    // Take screenshot before hover
    await page.screenshot({ path: 'portal-page-before-hover.png', fullPage: true });

    // Test stat cards
    const statCards = page.locator('[class*="bg-gradient-to-br"]').first();
    await statCards.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'portal-stat-card-hover.png', fullPage: true });

    // Test Mental Mastery Modules
    const mentalModules = page.getByText('Mental Mastery Modules').locator('..');
    await mentalModules.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'portal-mental-modules-hover.png', fullPage: true });

    // Test Exercise & Fitness section
    const exerciseSection = page.getByText('Exercise & Fitness').locator('..');
    await exerciseSection.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'portal-exercise-hover.png', fullPage: true });

    // Test individual module cards if present
    const moduleCards = page.locator('[class*="hover:scale-"]');
    if (await moduleCards.count() > 0) {
      await moduleCards.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'portal-module-card-hover.png', fullPage: true });
    }
  });

  test('Profile Page - Tab navigation and form hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001/profile');
    await page.waitForLoadState('networkidle');

    // Take screenshot before hover
    await page.screenshot({ path: 'profile-page-before-hover.png', fullPage: true });

    // Test tab navigation
    const tabs = page.locator('button[role="tab"]');
    if (await tabs.count() > 0) {
      await tabs.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'profile-tab-hover.png', fullPage: true });
    }

    // Test form elements and buttons
    const buttons = page.locator('button[class*="hover:"]');
    if (await buttons.count() > 0) {
      await buttons.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'profile-button-hover.png', fullPage: true });
    }

    // Test form input hover effects
    const inputs = page.locator('input[class*="hover:"]');
    if (await inputs.count() > 0) {
      await inputs.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'profile-input-hover.png', fullPage: true });
    }
  });

  test('Homepage - Hero section and feature cards hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Take screenshot before hover
    await page.screenshot({ path: 'homepage-before-hover.png', fullPage: true });

    // Test feature cards
    const featureCards = page.locator('[class*="hover:scale-"]');
    if (await featureCards.count() > 0) {
      await featureCards.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'homepage-feature-card-hover.png', fullPage: true });
    }

    // Test CTA buttons
    const ctaButtons = page.locator('button[class*="hover:"], a[class*="hover:"]');
    if (await ctaButtons.count() > 0) {
      await ctaButtons.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'homepage-cta-hover.png', fullPage: true });
    }
  });

  test('Navigation hover effects', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Test navigation links
    const navLinks = page.locator('nav a[class*="hover:"]');
    if (await navLinks.count() > 0) {
      await navLinks.first().hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'navigation-link-hover.png', fullPage: true });
    }

    // Test mobile menu if present
    const menuButton = page.locator('button[aria-label*="menu"], button[class*="hamburger"]');
    if (await menuButton.count() > 0) {
      await menuButton.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'navigation-menu-hover.png', fullPage: true });
    }
  });
});