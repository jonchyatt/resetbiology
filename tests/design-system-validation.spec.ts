import { test, expect } from '@playwright/test';

test.describe('Design System Validation', () => {
  test.setTimeout(60000);

  test('should enforce brand colors and transparency patterns', async ({ page }) => {
    await page.goto('/');
    
    // Verify brand colors are being used (not gray)
    const brandColorCheck = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const grayIssues: string[] = [];
      const transparencyIssues: string[] = [];
      
      elements.forEach((el, index) => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const className = el.className;
        
        // Check for forbidden gray backgrounds on cards/containers
        if (className.includes('bg-') && (
          bgColor.includes('rgb(31, 41, 55)') || // gray-800
          bgColor.includes('rgb(17, 24, 39)') || // gray-900
          bgColor.includes('rgba(31, 41, 55, 0.9)') || // gray-800/90
          bgColor.includes('rgba(17, 24, 39, 0.9)')    // gray-900/90
        )) {
          grayIssues.push(`Element ${index}: ${className} - using gray instead of brand colors`);
        }
        
        // Check for high opacity violations (should be /20 or /30 max)
        if (className.includes('bg-') && (
          bgColor.includes('0.8') || bgColor.includes('0.9') || bgColor.includes('0.7')
        )) {
          transparencyIssues.push(`Element ${index}: ${className} - opacity too high (should be /20 or /30 max)`);
        }
        
        // Check for missing backdrop-blur on transparent cards
        if (className.includes('bg-gradient') && !className.includes('backdrop-blur')) {
          transparencyIssues.push(`Element ${index}: ${className} - missing backdrop-blur-sm`);
        }
      });
      
      return { grayIssues, transparencyIssues };
    });
    
    // Report any design violations
    if (brandColorCheck.grayIssues.length > 0) {
      console.log('❌ BRAND COLOR VIOLATIONS:');
      brandColorCheck.grayIssues.forEach(issue => console.log(`  ${issue}`));
    }
    
    if (brandColorCheck.transparencyIssues.length > 0) {
      console.log('❌ TRANSPARENCY VIOLATIONS:');
      brandColorCheck.transparencyIssues.forEach(issue => console.log(`  ${issue}`));
    }
    
    // These should be zero for proper brand compliance
    expect(brandColorCheck.grayIssues.length, 
      `Found ${brandColorCheck.grayIssues.length} gray color violations`).toBe(0);
    expect(brandColorCheck.transparencyIssues.length, 
      `Found ${brandColorCheck.transparencyIssues.length} transparency violations`).toBe(0);
  });

  test('should verify correct brand colors are present', async ({ page }) => {
    await page.goto('/');
    
    const brandColorPresence = await page.evaluate(() => {
      const expectedColors = {
        primary: '#3FBFB5',   // Primary Teal
        secondary: '#72C247'  // Secondary Green
      };
      
      const elementsWithBrandColors = {
        primaryFound: false,
        secondaryFound: false,
        details: [] as string[]
      };
      
      // Check all elements for brand color usage
      const elements = document.querySelectorAll('*');
      elements.forEach((el, index) => {
        const styles = window.getComputedStyle(el);
        const bgColor = styles.backgroundColor;
        const textColor = styles.color;
        const borderColor = styles.borderColor;
        
        // Check for primary teal (rgb(63, 191, 181))
        if (bgColor.includes('63, 191, 181') || textColor.includes('63, 191, 181') || borderColor.includes('63, 191, 181')) {
          elementsWithBrandColors.primaryFound = true;
          elementsWithBrandColors.details.push(`Primary teal found on element ${index}`);
        }
        
        // Check for secondary green (rgb(114, 194, 71))
        if (bgColor.includes('114, 194, 71') || textColor.includes('114, 194, 71') || borderColor.includes('114, 194, 71')) {
          elementsWithBrandColors.secondaryFound = true;
          elementsWithBrandColors.details.push(`Secondary green found on element ${index}`);
        }
      });
      
      return elementsWithBrandColors;
    });
    
    console.log('Brand color usage:', brandColorPresence.details);
    
    // At least one of the brand colors should be present
    expect(brandColorPresence.primaryFound || brandColorPresence.secondaryFound, 
      'No brand colors found - page may be using generic styling').toBe(true);
  });

  test('should check for broken layouts and missing components', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    // Capture console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`${msg.type()}: ${msg.text()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Check for common layout issues
    const layoutIssues = await page.evaluate(() => {
      const issues: string[] = [];
      
      // Check for elements that might be off-screen or hidden
      const hiddenElements = document.querySelectorAll('[style*="display: none"]');
      if (hiddenElements.length > 5) {
        issues.push(`Too many hidden elements: ${hiddenElements.length}`);
      }
      
      // Check for missing key components
      const heroSection = document.querySelector('h1');
      if (!heroSection) {
        issues.push('Missing main headline (h1)');
      }
      
      // Check for broken images
      const images = document.querySelectorAll('img');
      let brokenImages = 0;
      images.forEach(img => {
        if (!(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalHeight === 0) {
          brokenImages++;
        }
      });
      if (brokenImages > 0) {
        issues.push(`${brokenImages} broken images found`);
      }
      
      return issues;
    });
    
    // Take screenshot for visual verification
    await page.screenshot({ path: 'design-validation.png', fullPage: true });
    
    // Report issues
    if (consoleErrors.length > 0) {
      console.log('❌ CONSOLE ERRORS:');
      consoleErrors.forEach(error => console.log(`  ${error}`));
    }
    
    if (layoutIssues.length > 0) {
      console.log('❌ LAYOUT ISSUES:');
      layoutIssues.forEach(issue => console.log(`  ${issue}`));
    }
    
    // Fail test if critical issues found
    expect(consoleErrors.length, `Found ${consoleErrors.length} console errors`).toBe(0);
    expect(layoutIssues.length, `Found ${layoutIssues.length} layout issues`).toBe(0);
  });

  test('should validate responsive design integrity', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForTimeout(1000);
      
      // Check for overflow issues
      const overflowIssues = await page.evaluate((viewportName) => {
        const issues: string[] = [];
        
        // Check horizontal scroll
        if (document.body.scrollWidth > window.innerWidth) {
          issues.push(`Horizontal overflow on ${viewportName}`);
        }
        
        // Check for elements extending beyond viewport
        const elements = document.querySelectorAll('*');
        elements.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.right > window.innerWidth + 10) { // 10px tolerance
            issues.push(`Element ${index} extends beyond viewport on ${viewportName}`);
          }
        });
        
        return issues;
      }, viewport.name);
      
      if (overflowIssues.length > 0) {
        console.log(`❌ RESPONSIVE ISSUES on ${viewport.name}:`);
        overflowIssues.forEach(issue => console.log(`  ${issue}`));
      }
      
      expect(overflowIssues.length, 
        `Found ${overflowIssues.length} responsive issues on ${viewport.name}`).toBe(0);
      
      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `responsive-${viewport.name}-validation.png`, 
        clip: { x: 0, y: 0, width: Math.min(viewport.width, 1200), height: Math.min(viewport.height, 800) }
      });
    }
  });
});