const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('🔍 Testing Store Pages Styling...\n');
  
  try {
    // Test store page
    console.log('1. Testing /store page...');
    await page.goto('http://localhost:3000/store');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Take screenshot of store page
    await page.screenshot({ 
      path: 'store-page-screenshot.png', 
      fullPage: true 
    });
    
    // Check background styling
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      return {
        backgroundColor: computedStyle.backgroundColor,
        backgroundImage: computedStyle.backgroundImage
      };
    });
    console.log('   Body background styles:', bodyStyles);
    
    // Check main container styling
    const containerStyles = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) {
        const computedStyle = window.getComputedStyle(main);
        return {
          backgroundColor: computedStyle.backgroundColor,
          backgroundImage: computedStyle.backgroundImage
        };
      }
      return null;
    });
    console.log('   Main container styles:', containerStyles);
    
    // Check card styling
    const cardStyles = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="bg-"]');
      if (cards.length > 0) {
        const firstCard = cards[0];
        const computedStyle = window.getComputedStyle(firstCard);
        return {
          backgroundColor: computedStyle.backgroundColor,
          backdropFilter: computedStyle.backdropFilter,
          border: computedStyle.border,
          className: firstCard.className
        };
      }
      return null;
    });
    console.log('   Card styles:', cardStyles);
    
    console.log('✅ /store page loaded successfully\n');
    
    // Test TB-500 product page
    console.log('2. Testing /store/tb-500-5mg page...');
    await page.goto('http://localhost:3000/store/tb-500-5mg');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Take screenshot of product page
    await page.screenshot({ 
      path: 'tb-500-page-screenshot.png', 
      fullPage: true 
    });
    
    // Check if product details are loaded
    const productTitle = await page.textContent('h1');
    console.log('   Product title:', productTitle);
    
    // Check styling consistency
    const productPageStyles = await page.evaluate(() => {
      const body = document.body;
      const main = document.querySelector('main');
      const cards = document.querySelectorAll('[class*="bg-"]');
      
      return {
        bodyBg: window.getComputedStyle(body).backgroundColor,
        mainBg: main ? window.getComputedStyle(main).backgroundColor : null,
        cardCount: cards.length,
        firstCardClass: cards[0] ? cards[0].className : null
      };
    });
    console.log('   Product page styles:', productPageStyles);
    
    console.log('✅ /store/tb-500-5mg page loaded successfully\n');
    
    // Test navigation between pages
    console.log('3. Testing navigation...');
    await page.goto('http://localhost:3000/store');
    await page.waitForSelector('a[href*="tb-500"]', { timeout: 5000 });
    
    // Click on TB-500 product link
    await page.click('a[href*="tb-500"]');
    await page.waitForSelector('h1', { timeout: 5000 });
    
    const navigationTitle = await page.textContent('h1');
    console.log('   After navigation, title:', navigationTitle);
    console.log('✅ Navigation working correctly\n');
    
    // Compare with order page for reference
    console.log('4. Checking /order page for reference...');
    await page.goto('http://localhost:3000/order');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const orderPageStyles = await page.evaluate(() => {
      const body = document.body;
      const main = document.querySelector('main');
      const cards = document.querySelectorAll('[class*="bg-"]');
      
      return {
        bodyBg: window.getComputedStyle(body).backgroundColor,
        mainBg: main ? window.getComputedStyle(main).backgroundColor : null,
        firstCardBg: cards[0] ? window.getComputedStyle(cards[0]).backgroundColor : null,
        firstCardClass: cards[0] ? cards[0].className : null
      };
    });
    console.log('   Order page reference styles:', orderPageStyles);
    
    await page.screenshot({ 
      path: 'order-page-reference.png', 
      fullPage: true 
    });
    
    console.log('✅ Reference comparison complete\n');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
  
  await browser.close();
  console.log('🎉 Store styling test complete! Check the screenshots for visual verification.');
})();