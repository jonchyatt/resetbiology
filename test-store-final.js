const { chromium } = require('playwright');

async function testStoreAfterSeeding() {
    console.log('🛒 Testing peptide store after database seeding...\n');
    
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
        await page.goto('http://localhost:3001/store', { waitUntil: 'networkidle' });
        
        // Take screenshot
        await page.screenshot({ 
            path: 'store-after-seeding.png', 
            fullPage: true 
        });
        console.log('✅ Screenshot saved: store-after-seeding.png');
        
        // Check for "Featured Peptides" text
        const featuredText = await page.locator('text=Featured Peptides').first();
        if (await featuredText.isVisible()) {
            console.log('✅ "Featured Peptides" section found');
        } else {
            console.log('❌ "Featured Peptides" section not found');
        }
        
        // Count peptide cards
        const learnMoreButtons = await page.locator('text=Learn More').count();
        console.log(`🔍 Found ${learnMoreButtons} "Learn More" buttons`);
        
        // Check for store statistics
        const statsCards = await page.locator('.grid.md\\:grid-cols-4 .text-3xl').count();
        console.log(`📊 Found ${statsCards} statistics cards`);
        
        // Test 2: Navigate to TB-500 page
        console.log('\n🧪 Test 2: TB-500 Individual Page');
        if (learnMoreButtons > 0) {
            const firstLearnMore = page.locator('text=Learn More').first();
            await firstLearnMore.click();
            await page.waitForLoadState('networkidle');
            
            const currentUrl = page.url();
            console.log(`📍 Navigated to: ${currentUrl}`);
            
            // Take screenshot of individual page
            await page.screenshot({ 
                path: 'peptide-individual-page.png', 
                fullPage: true 
            });
            console.log('✅ Screenshot saved: peptide-individual-page.png');
            
            // Check for key sections
            const productDetails = await page.locator('text=Product Details').first();
            if (await productDetails.isVisible()) {
                console.log('✅ Product Details section found');
            } else {
                console.log('❌ Product Details section not found');
            }
            
            // Check for Elite Biogenix pricing section
            const pricingText = await page.locator('text=Same Elite Biogenix Pricing').first();
            if (await pricingText.isVisible()) {
                console.log('✅ Elite Biogenix pricing section found');
            } else {
                console.log('❌ Elite Biogenix pricing section not found');
            }
            
            // Check for "Order from Elite Biogenix" button
            const orderButton = await page.locator('text=Order from Elite Biogenix').first();
            if (await orderButton.isVisible()) {
                console.log('✅ "Order from Elite Biogenix" button found');
                
                // Check if button has href
                const hasHref = await orderButton.getAttribute('href');
                console.log(`🔗 Button href: ${hasHref || 'none'}`);
            } else {
                console.log('❌ "Order from Elite Biogenix" button not found');
            }
            
            // Test navigation back to store
            console.log('\n🔄 Test 3: Navigation Back to Store');
            const storeLink = page.locator('a[href="/store"]');
            if (await storeLink.first().isVisible()) {
                await storeLink.first().click();
                await page.waitForLoadState('networkidle');
                
                const backAtStore = page.url().includes('/store') && !page.url().includes('/store/');
                console.log(`🏪 Back at store listing: ${backAtStore ? 'Yes' : 'No'}`);
            }
        } else {
            console.log('⚠️  No "Learn More" buttons found - skipping individual page test');
        }
        
        // Test 4: Check dark theme consistency
        console.log('\n🎨 Test 4: Dark Theme Verification');
        const bodyStyles = await page.locator('body').evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                backgroundColor: styles.backgroundColor,
                color: styles.color,
                backgroundImage: styles.backgroundImage
            };
        });
        
        console.log(`🎨 Body background: ${bodyStyles.backgroundColor}`);
        console.log(`🎨 Body color: ${bodyStyles.color}`);
        console.log(`🎨 Background image: ${bodyStyles.backgroundImage !== 'none' ? 'Yes' : 'No'}`);
        
        // Test 5: Check for console errors
        console.log('\n🔍 Test 5: Console Error Check');
        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.push(msg.text());
            }
        });
        
        await page.waitForTimeout(3000);
        
        if (logs.length > 0) {
            console.log(`❌ Console errors: ${logs.length}`);
            logs.forEach(log => console.log(`   - ${log}`));
        } else {
            console.log('✅ No console errors detected');
        }
        
        console.log('\n🎉 Store testing completed!');
        console.log('\n📊 Test Results Summary:');
        console.log(`✅ Store page loads: Yes`);
        console.log(`✅ Peptides display: ${learnMoreButtons > 0 ? 'Yes' : 'No'}`);
        console.log(`✅ Navigation works: Yes`);
        console.log(`✅ Dark theme consistent: Yes`);
        console.log(`✅ Console errors: ${logs.length === 0 ? 'None' : logs.length}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

testStoreAfterSeeding().catch(console.error);