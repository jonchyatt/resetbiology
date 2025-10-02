import { test, expect } from '@playwright/test';

test.describe('Manual Visual Verification', () => {
  const BASE_URL = 'http://localhost:3002';

  test('Visual verification with screenshots', async ({ page }) => {
    console.log('=== COMPREHENSIVE TESTING REPORT ===\n');

    // 1. Profile Page - Navbar Hiding Test
    console.log('1. TESTING PROFILE PAGE - NAVBAR HIDING ISSUE');
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    
    const profileHeading = await page.locator('h1, h2').filter({ hasText: /profile/i }).first();
    if (await profileHeading.count() > 0) {
      const box = await profileHeading.boundingBox();
      console.log(`   ✅ Profile heading found at Y position: ${box?.y}px`);
      if (box && box.y > 80) {
        console.log('   ✅ Profile page title is NOT hidden under navbar');
      } else {
        console.log('   ❌ Profile page title may be hidden under navbar');
      }
    }
    await page.screenshot({ path: 'test-results/manual-profile-page.png', fullPage: true });

    // 2. Portal Page - Navbar Hiding Test  
    console.log('\n2. TESTING PORTAL PAGE - NAVBAR HIDING ISSUE');
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForLoadState('networkidle');
    
    const portalHeading = await page.locator('h1').filter({ hasText: /portal/i }).first();
    if (await portalHeading.count() > 0) {
      const box = await portalHeading.boundingBox();
      console.log(`   ✅ Portal heading found at Y position: ${box?.y}px`);
      if (box && box.y > 80) {
        console.log('   ✅ Portal page title is NOT hidden under navbar');
      } else {
        console.log('   ❌ Portal page title may be hidden under navbar');
      }
    } else {
      // Try alternative selectors
      const altHeading = await page.locator('text=Portal • Dashboard').first();
      if (await altHeading.count() > 0) {
        const box = await altHeading.boundingBox();
        console.log(`   ✅ Portal dashboard text found at Y position: ${box?.y}px`);
      }
    }
    await page.screenshot({ path: 'test-results/manual-portal-page.png', fullPage: true });

    // 3. Navigation Link Test
    console.log('\n3. TESTING NAVIGATION LINK FIX');
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    const profileLinks = await page.locator('a[href="/profile"], a:has-text("Profile")').all();
    for (let i = 0; i < profileLinks.length; i++) {
      const href = await profileLinks[i].getAttribute('href');
      console.log(`   Profile link ${i + 1}: ${href}`);
      if (href === '/profile') {
        console.log('   ✅ Profile link correctly points to /profile');
      } else if (href === '/auth/profile') {
        console.log('   ❌ Profile link incorrectly points to /auth/profile');
      }
    }

    // 4. Homepage Hover Effects
    console.log('\n4. TESTING HOMEPAGE HOVER EFFECTS');
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Count interactive elements
    const hoverElements = await page.locator('[class*="hover"], [class*="card-"], [class*="btn-"]').count();
    console.log(`   Found ${hoverElements} potentially hoverable elements`);
    
    // Test main CTA button
    const ctaButton = await page.locator('button, a').filter({ hasText: /get started|start|begin/i }).first();
    if (await ctaButton.count() > 0) {
      console.log('   ✅ Main CTA button found');
    }
    
    await page.screenshot({ path: 'test-results/manual-homepage.png', fullPage: true });

    // 5. Education Page - Category Buttons
    console.log('\n5. TESTING EDUCATION PAGE - CATEGORY BUTTONS');
    await page.goto(`${BASE_URL}/education`);
    await page.waitForLoadState('networkidle');
    
    const categoryButtons = await page.locator('button').filter({ hasText: /all|research|protocols/i }).count();
    console.log(`   Found ${categoryButtons} category filter buttons`);
    
    if (categoryButtons > 0) {
      console.log('   ✅ Category buttons are present');
      
      // Check if they're centered (look for flex/center classes)
      const centerContainer = await page.locator('[class*="center"], [class*="justify-center"]').count();
      if (centerContainer > 0) {
        console.log('   ✅ Centering containers detected');
      }
    }
    await page.screenshot({ path: 'test-results/manual-education-page.png', fullPage: true });

    // 6. Order Page - Package Cards Hover
    console.log('\n6. TESTING ORDER PAGE - ALL HOVER EFFECTS');
    await page.goto(`${BASE_URL}/order`);
    await page.waitForLoadState('networkidle');
    
    const packageCards = await page.locator('[class*="bg-gradient-to-br"]').count();
    console.log(`   Found ${packageCards} gradient cards (packages + peptides)`);
    
    const hoverCards = await page.locator('[class*="hover"]').count();
    console.log(`   Found ${hoverCards} cards with hover classes`);
    
    if (hoverCards > 0) {
      console.log('   ✅ Hover effects are implemented on cards');
    } else {
      console.log('   ❌ No hover effects detected - NEEDS FIXING');
    }
    
    await page.screenshot({ path: 'test-results/manual-order-page.png', fullPage: true });

    // 7. Portal Page - Stat Cards and Trial Box
    console.log('\n7. TESTING PORTAL PAGE - HOVER EFFECTS');
    await page.goto(`${BASE_URL}/portal`);
    await page.waitForLoadState('networkidle');
    
    const statCards = await page.locator('[class*="stat-card-hover"]').count();
    console.log(`   Found ${statCards} stat cards with hover effects`);
    
    const cardHovers = await page.locator('[class*="card-hover"]').count();
    console.log(`   Found ${cardHovers} general cards with hover effects`);
    
    const quickActions = await page.locator('[class*="quick-action-hover"]').count();
    console.log(`   Found ${quickActions} quick action links with hover effects`);
    
    if (statCards > 0 && cardHovers > 0) {
      console.log('   ✅ Portal hover effects are implemented');
    }
    
    await page.screenshot({ path: 'test-results/manual-portal-hover.png', fullPage: true });

    console.log('\n=== TESTING COMPLETE - CHECK SCREENSHOTS ===');
    console.log('Screenshots saved in test-results/ directory:');
    console.log('- manual-profile-page.png');
    console.log('- manual-portal-page.png'); 
    console.log('- manual-homepage.png');
    console.log('- manual-education-page.png');
    console.log('- manual-order-page.png');
    console.log('- manual-portal-hover.png');
  });
});