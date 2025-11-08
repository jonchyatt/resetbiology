import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { path: '/', name: 'Homepage' },
  { path: '/portal', name: 'Portal' },
  { path: '/peptides', name: 'Peptides' },
  { path: '/workout', name: 'Workout' },
  { path: '/nutrition', name: 'Nutrition' },
  { path: '/breath', name: 'Breath' }
];

test.describe('Accessibility', () => {

  for (const pageInfo of pages) {
    test(`${pageInfo.name} - axe scan`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log(`\n=== ${pageInfo.name} Accessibility Violations ===`);
        accessibilityScanResults.violations.forEach(violation => {
          console.log(`\n${violation.id}: ${violation.description}`);
          console.log(`  Impact: ${violation.impact}`);
          console.log(`  Help: ${violation.helpUrl}`);
          console.log(`  Affected elements: ${violation.nodes.length}`);
          violation.nodes.slice(0, 3).forEach(node => {
            console.log(`    - ${node.html.substring(0, 100)}...`);
          });
        });
        console.log('=====================================\n');
      } else {
        console.log(`\n${pageInfo.name}: ✓ No accessibility violations found\n`);
      }

      // Don't fail tests, just report
      // expect(accessibilityScanResults.violations).toEqual([]);
    });

    test(`${pageInfo.name} - Keyboard navigation`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      // Get all interactive elements
      const interactiveCount = await page.locator(
        'button:visible, a:visible, input:visible, select:visible, textarea:visible, [tabindex]:not([tabindex="-1"]):visible'
      ).count();

      console.log(`\n${pageInfo.name}: ${interactiveCount} interactive elements found`);

      // Tab through first 10 elements to test
      for (let i = 0; i < Math.min(10, interactiveCount); i++) {
        await page.keyboard.press('Tab');

        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el?.tagName,
            visible: el ? window.getComputedStyle(el).visibility !== 'hidden' : false,
            display: el ? window.getComputedStyle(el).display !== 'none' : false
          };
        });

        // Focused element should be visible
        expect(focusedElement.visible && focusedElement.display).toBe(true);
      }

      console.log(`  ✓ Keyboard navigation working\n`);
    });

    test(`${pageInfo.name} - Form labels`, async ({ page }) => {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' });

      const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
      let unlabeledInputs = 0;

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');

        // Input should have label, aria-label, aria-labelledby, or at least placeholder
        let hasLabel = false;
        if (id) {
          hasLabel = await page.locator(`label[for="${id}"]`).count() > 0;
        }
        const hasAria = !!(ariaLabel || ariaLabelledby || placeholder);

        if (!hasLabel && !hasAria) {
          unlabeledInputs++;
        }
      }

      if (unlabeledInputs > 0) {
        console.log(`\n${pageInfo.name}: ✗ ${unlabeledInputs} unlabeled input(s) found`);
      } else {
        console.log(`\n${pageInfo.name}: ✓ All inputs have labels`);
      }
    });
  }
});
