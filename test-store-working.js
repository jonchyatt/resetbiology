const { chromium } = require('playwright');

async function testStoreOnWorkingServer() {
    console.log('🛒 Testing peptide store on working server (port 3002)...\n');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    try {
        // Test 1: Store listing page
        console.log('🏪 Test 1: Store Listing Page');
        await page.goto('http://localhost:3002/store', { waitUntil: 'networkidle' });
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Take screenshot
        await page.screenshot({ 
            path: 'store-working.png', 
            fullPage: true 
        });
        console.log('✅ Screenshot saved: store-working.png');
        
        // Check for any page title
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);
        
        // Check if page loaded successfully (no internal server error)
        const hasError = await page.locator('text=Internal Server Error').isVisible();
        console.log(`❌ Internal Server Error: ${hasError ? 'Yes' : 'No'}`);
        
        if (!hasError) {
            // Look for store content
            const storeTitle = await page.locator('h1').first().textContent();
            console.log(`🏷️ Store title: ${storeTitle || 'Not found'}`);
            
            // Check for "Featured Peptides" text
            const featuredText = await page.locator('text=Featured Peptides').first();
            if (await featuredText.isVisible()) {
                console.log('✅ "Featured Peptides" section found');
            } else {
                console.log('❌ "Featured Peptides" section not found');
            }
            
            // Count peptide cards with "Learn More" buttons
            const learnMoreButtons = await page.locator('text=Learn More').count();
            console.log(`🔍 Found ${learnMoreButtons} "Learn More" buttons`);
            
            // Count any peptide cards by looking for price elements
            const priceElements = await page.locator('text=/\\$\\d+/').count();
            console.log(`💰 Found ${priceElements} price elements`);
            
            // Check for statistics cards
            const statsCards = await page.locator('.grid').locator('div:has(.text-3xl)').count();
            console.log(`📊 Found ${statsCards} statistics cards`);
            
            // Test individual peptide page if we have buttons
            if (learnMoreButtons > 0) {
                console.log('\n🧪 Test 2: Individual Peptide Page');
                const firstLearnMore = page.locator('text=Learn More').first();
                await firstLearnMore.click();
                await page.waitForLoadState('networkidle');
                
                const currentUrl = page.url();
                console.log(`📍 Navigated to: ${currentUrl}`);
                
                // Take screenshot of individual page
                await page.screenshot({ 
                    path: 'peptide-page-working.png', 
                    fullPage: true 
                });
                console.log('✅ Screenshot saved: peptide-page-working.png');
                
                // Check for key sections on individual page
                const pageTitle = await page.locator('h1').first().textContent();
                console.log(`🧪 Peptide name: ${pageTitle || 'Not found'}`);
                
                const productDetails = await page.locator('text=Product Details').first();
                if (await productDetails.isVisible()) {
                    console.log('✅ Product Details section found');
                } else {
                    console.log('❌ Product Details section not found');
                }
                
                const orderButton = await page.locator('text=Order from Elite Biogenix').first();
                if (await orderButton.isVisible()) {
                    console.log('✅ "Order from Elite Biogenix" button found');
                } else {
                    console.log('❌ "Order from Elite Biogenix" button not found');
                }
                
                // Test navigation back to store
                const breadcrumbStore = page.locator('a[href="/store"]');
                if (await breadcrumbStore.first().isVisible()) {
                    await breadcrumbStore.first().click();
                    await page.waitForLoadState('networkidle');
                    console.log('✅ Successfully navigated back to store');
                }
            }
        }
        
        // Test specific peptide URLs
        console.log('\n🧪 Test 3: Direct Peptide URLs');
        const peptideUrls = [
            'http://localhost:3002/store/tb-500-5mg',
            'http://localhost:3002/store/bpc-157-5mg'
        ];
        
        for (const url of peptideUrls) {
            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
                const hasError = await page.locator('text=Internal Server Error').isVisible();
                const has404 = await page.locator('text=404').isVisible();
                
                if (!hasError && !has404) {
                    console.log(`✅ ${url} - Loads successfully`);
                    await page.screenshot({ 
                        path: `${url.split('/').pop()}-direct.png`, 
                        fullPage: true 
                    });
                } else if (has404) {
                    console.log(`⚠️  ${url} - 404 Not Found (peptide may not exist)`);
                } else {
                    console.log(`❌ ${url} - Internal Server Error`);
                }
            } catch (error) {
                console.log(`❌ ${url} - Failed to load: ${error.message}`);
            }
        }
        
        // Check for console errors
        console.log('\n🔍 Test 4: Console Error Check');
        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.push(msg.text());
            }
        });
        
        await page.waitForTimeout(2000);
        
        if (logs.length > 0) {
            console.log(`❌ Console errors: ${logs.length}`);
            logs.forEach(log => console.log(`   - ${log}`));
        } else {
            console.log('✅ No console errors detected');
        }
        
        console.log('\n🎉 Comprehensive store testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

testStoreOnWorkingServer().catch(console.error);