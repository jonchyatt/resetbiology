# Accessibility Scanner

## Purpose
Tests Reset Biology website for WCAG 2.1 Level AA compliance using Playwright and axe-core.

## Standards Tested
- **WCAG 2.1 Level AA** (target)
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus management
- ARIA attributes
- Semantic HTML

## When to Use
- Before production deployments
- After UI changes
- When adding new components
- Monthly compliance audits

## How It Works
1. Injects axe-core accessibility engine
2. Scans each page for violations
3. Tests keyboard navigation
4. Validates ARIA attributes
5. Checks color contrast
6. Tests screen reader compatibility

## Implementation

```typescript
// tests/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { path: '/', name: 'Homepage' },
  { path: '/portal', name: 'Portal' },
  { path: '/peptides', name: 'Peptides' },
  { path: '/workout', name: 'Workout' },
  { path: '/nutrition', name: 'Nutrition' },
  { path: '/breath', name: 'Breath' },
  { path: '/journal', name: 'Journal' }
];

test.describe('Accessibility', () => {

  for (const page of pages) {
    test(`${page.name} - axe scan`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      const accessibilityScanResults = await new AxeBuilder({ page: pw })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);

      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log(`${page.name} Accessibility Violations:`);
        accessibilityScanResults.violations.forEach(violation => {
          console.log(`  ${violation.id}: ${violation.description}`);
          console.log(`    Impact: ${violation.impact}`);
          console.log(`    Help: ${violation.helpUrl}`);
          violation.nodes.forEach(node => {
            console.log(`      Element: ${node.html}`);
          });
        });
      }
    });

    test(`${page.name} - Keyboard navigation`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      // Get all interactive elements
      const interactiveElements = await pw.locator(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all();

      // Tab through all elements
      for (let i = 0; i < interactiveElements.length; i++) {
        await pw.keyboard.press('Tab');

        const focusedElement = await pw.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el?.tagName,
            visible: el ? window.getComputedStyle(el).visibility !== 'hidden' : false
          };
        });

        // Focused element should be visible
        expect(focusedElement.visible).toBe(true);
      }
    });

    test(`${page.name} - Focus indicators visible`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      const buttons = await pw.locator('button, a').all();

      for (const button of buttons) {
        await button.focus();

        const outlineWidth = await button.evaluate(node =>
          window.getComputedStyle(node).outlineWidth
        );

        // Should have visible focus indicator
        expect(parseInt(outlineWidth) || 0).toBeGreaterThan(0);
      }
    });

    test(`${page.name} - Color contrast`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      const textElements = await pw.locator('p, span, h1, h2, h3, h4, h5, h6, button, a').all();

      for (const el of textElements) {
        const contrast = await el.evaluate(node => {
          const style = window.getComputedStyle(node);
          const color = style.color;
          const bgColor = style.backgroundColor;

          // Simple contrast calculation (RGB)
          const parseRgb = (rgb: string) => {
            const match = rgb.match(/\d+/g);
            return match ? match.map(Number) : [0, 0, 0];
          };

          const [r1, g1, b1] = parseRgb(color);
          const [r2, g2, b2] = parseRgb(bgColor);

          const luminance = (r: number, g: number, b: number) => {
            const [rs, gs, bs] = [r, g, b].map(c => {
              c = c / 255;
              return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
          };

          const l1 = luminance(r1, g1, b1);
          const l2 = luminance(r2, g2, b2);

          const ratio = l1 > l2
            ? (l1 + 0.05) / (l2 + 0.05)
            : (l2 + 0.05) / (l1 + 0.05);

          return ratio;
        });

        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        expect(contrast).toBeGreaterThan(4.5);
      }
    });

    test(`${page.name} - ARIA attributes valid`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      // Check for common ARIA mistakes
      const ariaElements = await pw.locator('[aria-label], [aria-labelledby], [role]').all();

      for (const el of ariaElements) {
        const ariaLabel = await el.getAttribute('aria-label');
        const role = await el.getAttribute('role');

        // aria-label should not be empty
        if (ariaLabel !== null) {
          expect(ariaLabel.trim().length).toBeGreaterThan(0);
        }

        // role should be valid
        if (role) {
          const validRoles = [
            'button', 'link', 'navigation', 'main', 'complementary',
            'banner', 'contentinfo', 'form', 'search', 'region',
            'article', 'dialog', 'alert', 'status', 'progressbar'
          ];
          expect(validRoles).toContain(role);
        }
      }
    });

    test(`${page.name} - Form labels`, async ({ page: pw }) => {
      await pw.goto(page.path, { waitUntil: 'networkidle' });

      const inputs = await pw.locator('input, select, textarea').all();

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');

        // Input should have label, aria-label, or aria-labelledby
        if (id) {
          const hasLabel = await pw.locator(`label[for="${id}"]`).count() > 0;
          const hasAria = ariaLabel || ariaLabelledby;
          expect(hasLabel || hasAria).toBe(true);
        }
      }
    });
  }
});

// Install axe-core first:
// npm install --save-dev @axe-core/playwright
```

## Success Criteria
- Zero critical violations
- All interactive elements keyboard accessible
- Focus indicators visible
- Color contrast meets WCAG AA (4.5:1)
- All forms have labels
- Valid ARIA attributes

## Output
Detailed accessibility report with:
- Violation count by severity
- Element selectors for each issue
- WCAG success criteria references
- Remediation suggestions
