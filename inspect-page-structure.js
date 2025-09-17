const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Inspecting page structure...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('📱 Loading collections page...');
  await page.goto('https://cellularpeptide.com/collections/all', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  console.log('🔍 Analyzing page structure...\n');
  
  // Find all possible product containers
  const analysis = await page.evaluate(() => {
    const results = {
      totalLinks: document.querySelectorAll('a').length,
      productLinks: [],
      possibleContainers: [],
      allClassNames: new Set(),
      prices: []
    };
    
    // Find links that look like product links
    document.querySelectorAll('a[href*="/products/"]').forEach(link => {
      results.productLinks.push({
        text: link.textContent?.trim(),
        href: link.href,
        parent: link.parentElement?.className || 'no-class'
      });
    });
    
    // Find elements with prices
    document.querySelectorAll('*').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (text.match(/\$\d+/) && text.length < 20) {
        results.prices.push({
          text: text,
          class: el.className,
          tag: el.tagName
        });
      }
    });
    
    // Get all class names that might be product containers
    document.querySelectorAll('[class]').forEach(el => {
      const classes = el.className.split(' ');
      classes.forEach(c => {
        if (c.toLowerCase().includes('product') || 
            c.toLowerCase().includes('item') || 
            c.toLowerCase().includes('card') ||
            c.toLowerCase().includes('grid')) {
          results.allClassNames.add(c);
        }
      });
    });
    
    // Look for grid or list containers
    document.querySelectorAll('ul, ol, div[class*="grid"], div[class*="list"], main').forEach(container => {
      const children = container.children;
      if (children.length > 3) {
        const firstChild = children[0];
        const hasLinks = firstChild.querySelector('a[href*="/products/"]');
        const hasPrice = firstChild.textContent?.includes('$');
        
        if (hasLinks || hasPrice) {
          results.possibleContainers.push({
            tag: container.tagName,
            class: container.className,
            childCount: children.length,
            firstChildClass: firstChild.className
          });
        }
      }
    });
    
    return results;
  });
  
  console.log('📊 Page Analysis Results:');
  console.log('========================');
  console.log(`Total links found: ${analysis.totalLinks}`);
  console.log(`Product links found: ${analysis.productLinks.length}`);
  
  console.log('\n🔗 First 5 Product Links:');
  analysis.productLinks.slice(0, 5).forEach(link => {
    console.log(`  - "${link.text}" → ${link.href}`);
    console.log(`    Parent class: ${link.parent}`);
  });
  
  console.log('\n💰 First 5 Price Elements:');
  analysis.prices.slice(0, 5).forEach(price => {
    console.log(`  - ${price.tag}.${price.class}: "${price.text}"`);
  });
  
  console.log('\n📦 Possible Product Container Classes:');
  [...analysis.allClassNames].slice(0, 10).forEach(className => {
    console.log(`  - ${className}`);
  });
  
  console.log('\n📋 Possible Container Elements:');
  analysis.possibleContainers.forEach(container => {
    console.log(`  - ${container.tag}.${container.class} (${container.childCount} children)`);
    console.log(`    First child: ${container.firstChildClass}`);
  });
  
  await browser.close();
})();