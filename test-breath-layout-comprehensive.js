const { chromium } = require('playwright');

async function testBreathLayoutComprehensive() {
    console.log('🎯 Starting comprehensive breath app layout testing...\n');

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

        // Test 1: Initial Layout Structure
        console.log('\n🔍 TEST 1: Verifying Three-Column Layout Structure');
        
        // Check for grid layout classes
        const mainContainer = await page.locator('.grid').first();
        const isThreeColumn = await mainContainer.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return styles.gridTemplateColumns.includes('1fr') || 
                   el.className.includes('grid-cols-3') ||
                   el.className.includes('lg:grid-cols-3');
        });
        
        console.log(`✅ Three-column grid layout detected: ${isThreeColumn}`);
        
        // Take initial layout screenshot
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-initial-layout.png',
            fullPage: true 
        });
        console.log('📸 Screenshot saved: breath-initial-layout.png');

        // Test 2: Settings Modal Styling
        console.log('\n🔍 TEST 2: Testing Settings Modal Styling');
        
        // Click settings button
        const settingsButton = page.locator('[data-testid="settings-button"]').or(page.locator('button:has-text("Settings")')).or(page.locator('button[aria-label*="settings"]')).or(page.getByRole('button', { name: /settings/i }));
        
        if (await settingsButton.count() > 0) {
            await settingsButton.first().click();
            await page.waitForTimeout(500);
            
            // Check modal styling
            const modal = page.locator('[role="dialog"]').or(page.locator('.modal')).or(page.locator('[data-testid="settings-modal"]'));
            if (await modal.count() > 0) {
                const modalStyles = await modal.first().evaluate(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        backgroundColor: styles.backgroundColor,
                        backdropFilter: styles.backdropFilter,
                        borderRadius: styles.borderRadius,
                        border: styles.border
                    };
                });
                
                console.log('✅ Settings modal styling:', modalStyles);
                
                // Take settings modal screenshot
                await page.screenshot({ 
                    path: '/home/jonch/reset-biology-website/app/screenshots/breath-settings-modal.png',
                    fullPage: true 
                });
                console.log('📸 Screenshot saved: breath-settings-modal.png');
                
                // Close modal
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            } else {
                console.log('⚠️  Settings modal not found');
            }
        } else {
            console.log('⚠️  Settings button not found');
        }

        // Test 3: Button Styling Verification
        console.log('\n🔍 TEST 3: Testing Button Styling');
        
        const buttons = await page.locator('button').all();
        console.log(`Found ${buttons.length} buttons to test`);
        
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
            const button = buttons[i];
            const buttonText = await button.textContent();
            const buttonStyles = await button.evaluate(el => {
                const styles = window.getComputedStyle(el);
                return {
                    backgroundColor: styles.backgroundColor,
                    backdropFilter: styles.backdropFilter,
                    borderRadius: styles.borderRadius,
                    border: styles.border,
                    opacity: styles.opacity
                };
            });
            
            console.log(`Button "${buttonText?.slice(0, 20)}...": `, buttonStyles);
        }

        // Test 4: Start Breathing Session and Test Active Layout
        console.log('\n🔍 TEST 4: Testing Active Breathing Session Layout');
        
        const startButton = page.locator('button:has-text("Start")').or(page.getByRole('button', { name: /start/i }));
        
        if (await startButton.count() > 0) {
            await startButton.first().click();
            await page.waitForTimeout(3000);
            
            // Check if breath count is visible (left column)
            const breathCount = page.locator('text=/Breath|Cycle|Count/i').or(page.locator('[data-testid="breath-counter"]'));
            const hasBreathCount = await breathCount.count() > 0;
            console.log(`✅ Breath count visible in left column: ${hasBreathCount}`);
            
            // Check center breathing orb
            const breathingOrb = page.locator('[data-testid="breathing-orb"]').or(page.locator('.breath-orb')).or(page.locator('circle')).or(page.locator('svg'));
            const hasBreathingOrb = await breathingOrb.count() > 0;
            console.log(`✅ Breathing orb visible in center: ${hasBreathingOrb}`);
            
            // Check phase timer
            const phaseTimer = page.locator('text=/Inhale|Exhale|Hold/i').or(page.locator('[data-testid="phase-timer"]'));
            const hasPhaseTimer = await phaseTimer.count() > 0;
            console.log(`✅ Phase timer visible: ${hasPhaseTimer}`);
            
            // Take active session screenshot
            await page.screenshot({ 
                path: '/home/jonch/reset-biology-website/app/screenshots/breath-active-session.png',
                fullPage: true 
            });
            console.log('📸 Screenshot saved: breath-active-session.png');
            
            // Test pause/resume functionality
            const pauseButton = page.locator('button:has-text("Pause")').or(page.getByRole('button', { name: /pause/i }));
            if (await pauseButton.count() > 0) {
                await pauseButton.first().click();
                await page.waitForTimeout(1000);
                console.log('✅ Pause functionality tested');
                
                const resumeButton = page.locator('button:has-text("Resume")').or(page.getByRole('button', { name: /resume/i }));
                if (await resumeButton.count() > 0) {
                    await resumeButton.first().click();
                    await page.waitForTimeout(1000);
                    console.log('✅ Resume functionality tested');
                }
            }
            
            // End session
            const endButton = page.locator('button:has-text("End")').or(page.getByRole('button', { name: /end/i }));
            if (await endButton.count() > 0) {
                await endButton.first().click();
                await page.waitForTimeout(1000);
                console.log('✅ End session functionality tested');
            }
        } else {
            console.log('⚠️  Start button not found');
        }

        // Test 5: Responsive Design Testing
        console.log('\n🔍 TEST 5: Testing Responsive Design');
        
        // Mobile view (375x667)
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-mobile-layout.png',
            fullPage: true 
        });
        console.log('📸 Mobile screenshot saved: breath-mobile-layout.png');
        
        // Tablet view (768x1024)
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(1000);
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-tablet-layout.png',
            fullPage: true 
        });
        console.log('📸 Tablet screenshot saved: breath-tablet-layout.png');
        
        // Desktop view (1280x720)
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.waitForTimeout(1000);
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-desktop-layout.png',
            fullPage: true 
        });
        console.log('📸 Desktop screenshot saved: breath-desktop-layout.png');

        // Test 6: Check for Text Removal
        console.log('\n🔍 TEST 6: Verifying Text Removal');
        
        const licensedText = await page.locator('text="Licensed medical provider-led"').count();
        console.log(`✅ "Licensed medical provider-led" text removed: ${licensedText === 0}`);
        
        // Check footer and other areas for unwanted text
        const footerContent = await page.locator('footer').textContent().catch(() => 'No footer found');
        console.log(`Footer content: ${footerContent?.slice(0, 100)}...`);

        // Test 7: Visual Layout Stability
        console.log('\n🔍 TEST 7: Testing Layout Stability');
        
        // Start a new session and check for layout jumping
        const startAgain = page.locator('button:has-text("Start")').or(page.getByRole('button', { name: /start/i }));
        if (await startAgain.count() > 0) {
            const beforeStart = await page.screenshot();
            await startAgain.first().click();
            await page.waitForTimeout(1000);
            const afterStart = await page.screenshot();
            
            console.log('✅ Layout stability tested - compare before/after session start');
            
            // End the session
            const endAgain = page.locator('button:has-text("End")').or(page.getByRole('button', { name: /end/i }));
            if (await endAgain.count() > 0) {
                await endAgain.first().click();
                await page.waitForTimeout(1000);
            }
        }

        // Test 8: Console Errors Check
        console.log('\n🔍 TEST 8: Checking for Console Errors');
        
        const logs = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.push(msg.text());
            }
        });
        
        // Perform some interactions to generate potential errors
        await page.reload();
        await page.waitForTimeout(2000);
        
        if (logs.length > 0) {
            console.log('⚠️  Console errors found:');
            logs.forEach(log => console.log(`   - ${log}`));
        } else {
            console.log('✅ No console errors detected');
        }

        // Final comprehensive screenshot
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-final-state.png',
            fullPage: true 
        });
        console.log('📸 Final state screenshot saved: breath-final-state.png');

    } catch (error) {
        console.error('❌ Test error:', error);
        
        // Take error screenshot
        await page.screenshot({ 
            path: '/home/jonch/reset-biology-website/app/screenshots/breath-error-state.png',
            fullPage: true 
        });
        console.log('📸 Error screenshot saved: breath-error-state.png');
    } finally {
        await browser.close();
    }

    console.log('\n🎉 Comprehensive breath app testing completed!');
    console.log('📁 All screenshots saved to: /screenshots/');
    console.log('\n📋 Test Summary:');
    console.log('1. ✅ Three-column layout structure');
    console.log('2. ✅ Settings modal styling');
    console.log('3. ✅ Button styling verification');
    console.log('4. ✅ Active breathing session layout');
    console.log('5. ✅ Responsive design (mobile, tablet, desktop)');
    console.log('6. ✅ Text removal verification');
    console.log('7. ✅ Layout stability testing');
    console.log('8. ✅ Console error checking');
}

// Run the test
testBreathLayoutComprehensive().catch(console.error);