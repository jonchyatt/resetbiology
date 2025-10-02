const { chromium } = require('playwright');

async function testBreathLayoutFocused() {
    console.log('🎯 Starting focused breath app layout testing...\n');

    const browser = await chromium.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    try {
        // Navigate to breath training page
        console.log('📱 Navigating to breath training app...');
        await page.goto('http://localhost:3000/breath', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // First, dismiss any modal overlays that might be blocking interactions
        console.log('🔍 Dismissing any modal overlays...');
        
        // Try to close "How it Works" modal if it exists
        const closeButton = page.locator('button:has-text("×")').or(page.locator('[aria-label="Close"]')).or(page.locator('.close')).first();
        if (await closeButton.count() > 0) {
            await closeButton.click();
            await page.waitForTimeout(1000);
            console.log('✅ Modal dismissed');
        }
        
        // Try pressing Escape to close modals
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Test 1: Verify Three-Column Layout Structure
        console.log('\n🔍 TEST 1: Analyzing Three-Column Layout Structure');
        
        // Take a clean screenshot first
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-clean-layout.png',
            fullPage: true 
        });
        console.log('📸 Clean layout screenshot saved');

        // Check for grid container and structure
        const mainContainer = await page.locator('main, .container, .breath-app, [class*="grid"]').first();
        if (await mainContainer.count() > 0) {
            const containerHTML = await mainContainer.innerHTML();
            const hasGrid = containerHTML.includes('grid') || containerHTML.includes('col');
            console.log(`✅ Grid-based layout detected: ${hasGrid}`);
            
            // Look for the specific layout sections
            const leftSection = await page.locator('[class*="col"]:first-child, .left-section, [data-section="left"]').count();
            const centerSection = await page.locator('[class*="col"]:nth-child(2), .center-section, [data-section="center"]').count();
            const rightSection = await page.locator('[class*="col"]:nth-child(3), .right-section, [data-section="right"]').count();
            
            console.log(`Left section found: ${leftSection > 0}`);
            console.log(`Center section found: ${centerSection > 0}`);
            console.log(`Right section found: ${rightSection > 0}`);
        }

        // Test 2: Examine Current Layout Components
        console.log('\n🔍 TEST 2: Current Layout Component Analysis');
        
        // Check what's currently visible
        const components = {
            breathCounter: await page.locator('text=/Cycle|Breath/i').count(),
            breathOrb: await page.locator('circle, .orb, [class*="breath"]').count(),
            startButton: await page.locator('button:has-text("Start")').count(),
            settingsButton: await page.locator('button[aria-label*="settings"], button:has-text("Settings"), [data-testid="settings"]').count(),
            statsCards: await page.locator('[class*="card"], [class*="stat"]').count()
        };
        
        console.log('Component visibility:', components);
        
        // Look for the stats cards at the top (the 4 cards showing cycle, breaths, holds)
        const topCards = await page.locator('.grid').first().locator('[class*="card"], [class*="stat"], [class*="bg-"]');
        const topCardsCount = await topCards.count();
        console.log(`Stats cards at top: ${topCardsCount}`);

        // Test 3: Button Styling Analysis
        console.log('\n🔍 TEST 3: Button Styling Analysis');
        
        // Find the main action button (Start Session)
        const startButton = page.locator('button:has-text("Start"), button:has-text("Session")').first();
        
        if (await startButton.count() > 0) {
            const buttonStyles = await startButton.evaluate(el => {
                const styles = window.getComputedStyle(el);
                const classList = Array.from(el.classList);
                return {
                    classList: classList,
                    backgroundColor: styles.backgroundColor,
                    backdropFilter: styles.backdropFilter,
                    borderRadius: styles.borderRadius,
                    border: styles.border,
                    hasGlassEffect: classList.some(c => c.includes('backdrop-blur')) && classList.some(c => c.includes('/20') || c.includes('/30'))
                };
            });
            
            console.log('Start button styling:', buttonStyles);
            
            // Check if it has the new transparent glass effect
            const hasTransparentGlass = buttonStyles.classList.some(c => 
                c.includes('from-primary') || c.includes('backdrop-blur')
            );
            console.log(`✅ Button has transparent glass effect: ${hasTransparentGlass}`);
        }

        // Test 4: Settings Button and Modal
        console.log('\n🔍 TEST 4: Settings Button Analysis');
        
        // Look for settings button (gear icon or text)
        const settingsButton = page.locator('[aria-label*="settings"], button:has([class*="gear"]), button:has(svg), .settings').first();
        
        if (await settingsButton.count() > 0) {
            console.log('✅ Settings button found');
            
            // Try to click it (if not blocked by overlays)
            try {
                await settingsButton.click({ timeout: 5000 });
                await page.waitForTimeout(1000);
                
                // Check if modal appeared
                const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
                if (await modal.count() > 0) {
                    const modalStyles = await modal.evaluate(el => {
                        const styles = window.getComputedStyle(el);
                        const classList = Array.from(el.classList);
                        return {
                            classList: classList,
                            backgroundColor: styles.backgroundColor,
                            backdropFilter: styles.backdropFilter
                        };
                    });
                    
                    console.log('Settings modal styling:', modalStyles);
                    
                    // Take screenshot of modal
                    await page.screenshot({ 
                        path: '/home/jonch/reset-biology-website/app/screenshots/breath-settings-modal-captured.png',
                        fullPage: true 
                    });
                    console.log('📸 Settings modal screenshot saved');
                    
                    // Close modal
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(500);
                }
            } catch (e) {
                console.log('⚠️  Could not interact with settings button:', e.message);
            }
        } else {
            console.log('⚠️  Settings button not found in expected locations');
        }

        // Test 5: Responsive Layout Check
        console.log('\n🔍 TEST 5: Responsive Layout Testing');
        
        // Mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-responsive-mobile.png',
            fullPage: true 
        });
        console.log('📸 Mobile responsive screenshot saved');
        
        // Check if layout stacks properly on mobile
        const mobileLayout = await page.evaluate(() => {
            const main = document.querySelector('main, .container');
            if (main) {
                const styles = window.getComputedStyle(main);
                return {
                    display: styles.display,
                    gridTemplateColumns: styles.gridTemplateColumns,
                    flexDirection: styles.flexDirection
                };
            }
            return null;
        });
        console.log('Mobile layout styles:', mobileLayout);
        
        // Desktop view
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(1000);

        // Test 6: Text Content Verification
        console.log('\n🔍 TEST 6: Text Content Analysis');
        
        const pageText = await page.textContent('body');
        const hasLicensedText = pageText.includes('Licensed medical provider-led');
        console.log(`✅ "Licensed medical provider-led" text removed: ${!hasLicensedText}`);
        
        if (hasLicensedText) {
            console.log('⚠️  Found "Licensed medical provider-led" text in:');
            const elements = await page.locator('text="Licensed medical provider-led"').all();
            for (let element of elements) {
                const text = await element.textContent();
                console.log(`   - ${text}`);
            }
        }

        // Test 7: Layout Structure Deep Dive
        console.log('\n🔍 TEST 7: Layout Structure Analysis');
        
        // Get the main content structure
        const structureInfo = await page.evaluate(() => {
            // Find the main breath app container
            const containers = document.querySelectorAll('[class*="grid"], [class*="flex"], main, .container');
            const info = [];
            
            containers.forEach((container, index) => {
                if (container.children.length > 0) {
                    const styles = window.getComputedStyle(container);
                    info.push({
                        index,
                        tagName: container.tagName,
                        classes: Array.from(container.classList),
                        childrenCount: container.children.length,
                        display: styles.display,
                        gridColumns: styles.gridTemplateColumns,
                        hasBreathingContent: container.textContent.includes('Breath') || container.textContent.includes('Start')
                    });
                }
            });
            
            return info;
        });
        
        console.log('Layout structure analysis:');
        structureInfo.forEach(info => {
            console.log(`  Container ${info.index}: ${info.tagName} - ${info.childrenCount} children`);
            console.log(`    Classes: ${info.classes.join(', ')}`);
            console.log(`    Display: ${info.display}, Grid: ${info.gridColumns}`);
            console.log(`    Has breathing content: ${info.hasBreathingContent}`);
        });

        // Final comprehensive screenshot
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-final-analysis.png',
            fullPage: true 
        });
        console.log('📸 Final analysis screenshot saved');

    } catch (error) {
        console.error('❌ Test error:', error);
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-test-error.png',
            fullPage: true 
        });
    } finally {
        await browser.close();
    }

    console.log('\n🎉 Focused breath app testing completed!');
    console.log('📁 All screenshots saved to: /screenshots/');
}

// Run the test
testBreathLayoutFocused().catch(console.error);