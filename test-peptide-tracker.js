const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📍 Testing Peptide Tracker...\n');

  try {
    // 1. Navigate to local dev
    console.log('1. Navigating to http://localhost:3001/peptides');
    await page.goto('http://localhost:3001/peptides');
    await page.waitForTimeout(2000);

    // 2. Click Login
    console.log('2. Clicking Login/Sign Up button');
    const loginButton = await page.locator('text="Login / Sign Up"').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      console.log('   ✓ Redirected to Auth0');

      // Wait for Auth0 redirect back
      await page.waitForURL(/localhost:3001/, { timeout: 30000 });
      console.log('   ✓ Returned from Auth0');
    } else {
      console.log('   → Already logged in');
    }

    // 3. Check if we're on peptides page
    await page.goto('http://localhost:3001/peptides');
    await page.waitForTimeout(2000);

    // 4. Click Add Protocol button
    console.log('3. Clicking Add Protocol button');
    const addButton = await page.locator('button:has-text("Add Protocol"), button:has-text("Add Your First Protocol")').first();
    await addButton.click();
    await page.waitForTimeout(1000);

    // 5. Check if modal opened
    const modalVisible = await page.locator('text="Select Peptide from Library"').isVisible();
    console.log(`4. Modal opened: ${modalVisible ? '✓' : '✗'}`);

    if (modalVisible) {
      // 6. Check dropdown options
      console.log('5. Checking peptide dropdown');
      await page.locator('select').click();
      const options = await page.locator('select option').count();
      console.log(`   → Found ${options - 1} peptides in dropdown (excluding placeholder)`);

      // List all peptides
      for (let i = 1; i < Math.min(options, 6); i++) {
        const optionText = await page.locator(`select option:nth-child(${i + 1})`).textContent();
        console.log(`     • ${optionText}`);
      }

      // 7. Select Semaglutide
      console.log('6. Selecting Semaglutide');
      await page.selectOption('select', { label: /Semaglutide/i });
      await page.waitForTimeout(500);

      // 8. Check if fields populated
      const dosageValue = await page.locator('input[placeholder*="dosage"]').inputValue();
      console.log(`   → Dosage field: ${dosageValue || 'EMPTY'}`);

      // 9. Click Add Protocol button in modal
      console.log('7. Clicking Add Protocol to save');
      const saveButton = await page.locator('button:has-text("Add Protocol")').last();
      await saveButton.click();
      await page.waitForTimeout(2000);

      // 10. Check if protocol was added
      console.log('8. Checking if protocol appears in Active Protocols');
      const protocolCard = await page.locator('text="Semaglutide"').count();
      if (protocolCard > 0) {
        console.log('   ✓ Protocol added successfully!');
      } else {
        console.log('   ✗ Protocol NOT visible in Active Protocols');

        // Check for errors
        const errorVisible = await page.locator('text=/error|failed/i').isVisible();
        if (errorVisible) {
          const errorText = await page.locator('text=/error|failed/i').textContent();
          console.log(`   ⚠️ Error found: ${errorText}`);
        }
      }

      // 11. Check browser console for errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('   ⚠️ Console error:', msg.text());
        }
      });

      // 12. Check network requests
      console.log('\n9. Checking API calls:');
      page.on('response', response => {
        if (response.url().includes('/api/peptides')) {
          console.log(`   → ${response.status()} ${response.url()}`);
        }
      });

      // Refresh to see if protocol persists
      console.log('10. Refreshing page to check persistence');
      await page.reload();
      await page.waitForTimeout(2000);

      const protocolAfterRefresh = await page.locator('text="Semaglutide"').count();
      console.log(`   → Protocol visible after refresh: ${protocolAfterRefresh > 0 ? '✓' : '✗'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n📊 Test complete. Keeping browser open for inspection...');
  await page.waitForTimeout(60000); // Keep open for 1 minute
  await browser.close();
})();