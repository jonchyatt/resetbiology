# Reset Biology Testing Protocol

**Version:** 1.0.0
**Last Updated:** November 15, 2025

This document outlines the permanent testing protocol for ensuring functionality and brand compliance across all features.

---

## Philosophy

Every new feature MUST pass:
1. **Functionality Tests** - Does it work correctly?
2. **Design System Compliance** - Does it match our brand?
3. **Responsive Design** - Does it work on all devices?
4. **Performance** - Does it load quickly?
5. **Error-Free** - Are there console errors?

---

## Existing Test Infrastructure

We already have comprehensive tests in place:

### Design System Validation
**File:** `tests/design-system-validation.spec.ts`

**What it checks:**
- ✅ Brand colors (#3FBFB5 teal, #72C247 green) are used
- ✅ No forbidden gray backgrounds (should use brand colors)
- ✅ Transparency is /20 or /30 max (not 0.7, 0.8, 0.9)
- ✅ Gradient cards have `backdrop-blur-sm`
- ✅ No horizontal overflow on mobile/tablet/desktop
- ✅ Text is readable (≥12px on mobile)
- ✅ No broken images or missing components

**Run it:**
```bash
npx playwright test tests/design-system-validation.spec.ts --headed
```

---

### Visual Screenshot Suite
**File:** `tests/visual-screenshot-suite.spec.ts`

**What it does:**
- Takes full-page screenshots at desktop (1920x1080) and mobile (390x844)
- Saves to `C:/Users/jonch/reset-biology-website/.hos/reports/screenshots`
- Covers all major pages

**Run it:**
```bash
npx playwright test tests/visual-screenshot-suite.spec.ts --headed
```

---

## New Feature Tests (Workout & Vision)

For the new Workout Tracker and Vision Healing modules, we created specialized comprehensive tests:

### Workout Tracker Comprehensive Test
**File:** `tests/workout-tracker-comprehensive.spec.ts`

**What it tests:**
1. **Design Compliance** - Validates brand colors, transparency, backdrop-blur
2. **Desktop Flow** - Full interaction (protocol library, session logging, check-ins)
3. **Mobile Flow** - Touch interactions, no overflow, readable text
4. **Tablet View** - Proper layout on 768x1024
5. **Console Errors** - Catches JavaScript errors
6. **Performance** - Load time <5 seconds

**Captures Screenshots:**
- `workout-01-desktop-initial.png` - Landing page
- `workout-02-desktop-protocol-library.png` - Protocol modal
- `workout-03-desktop-log-session.png` - Session logging
- `workout-04-desktop-checkin.png` - Readiness check-in
- `workout-05-desktop-scrolled.png` - Full page scrolled
- `workout-06-mobile-initial.png` - Mobile landing
- `workout-07-mobile-protocol-library.png` - Mobile modal
- `workout-08-mobile-fullpage.png` - Mobile full scroll
- `workout-09-tablet.png` - Tablet view

**Run it:**
```bash
npx playwright test tests/workout-tracker-comprehensive.spec.ts --headed
```

---

### Vision Healing Comprehensive Test
**File:** `tests/vision-healing-comprehensive.spec.ts`

**What it tests:**
1. **Design Compliance** - Brand colors, transparency, styling
2. **Desktop Flow** - Snellen trainer modes, wave selection, exercise filtering, session coach
3. **Mobile Flow** - Touch-friendly, no overflow, readable
4. **Tablet View** - Proper grid layout
5. **Console Errors** - JavaScript validation
6. **Performance** - Load time check

**Captures Screenshots:**
- `vision-01-desktop-initial.png` - Landing page
- `vision-02-desktop-snellen-near.png` - Near mode trainer
- `vision-03-desktop-snellen-far.png` - Far mode trainer
- `vision-04-desktop-wave1.png` - Wave 1 selected
- `vision-05-desktop-wave2.png` - Wave 2 selected
- `vision-06-desktop-wave3.png` - Wave 3 selected
- `vision-07-desktop-filtered.png` - Exercise category filter
- `vision-08-desktop-checkpoint.png` - Session coach
- `vision-09-desktop-scrolled.png` - Full page scroll
- `vision-10-mobile-initial.png` - Mobile landing
- `vision-11-mobile-wave.png` - Mobile wave selection
- `vision-12-mobile-fullpage.png` - Mobile full scroll
- `vision-13-tablet.png` - Tablet view

**Run it:**
```bash
npx playwright test tests/vision-healing-comprehensive.spec.ts --headed
```

---

## Mandatory Pre-Deployment Checklist

Before pushing ANY new feature to production:

### 1. Build Check
```bash
npm run build
```
- ✅ Build must succeed with 0 errors
- ✅ TypeScript must compile cleanly

### 2. Design System Validation
```bash
npx playwright test tests/design-system-validation.spec.ts --headed
```
- ✅ Must pass all brand color checks
- ✅ Must have no transparency violations
- ✅ Must have no responsive issues

### 3. Feature-Specific Test
```bash
# For Workout Tracker
npx playwright test tests/workout-tracker-comprehensive.spec.ts --headed

# For Vision Healing
npx playwright test tests/vision-healing-comprehensive.spec.ts --headed

# For new features (create similar test file)
npx playwright test tests/[your-feature]-comprehensive.spec.ts --headed
```
- ✅ Must pass all functional tests
- ✅ Must pass mobile responsive tests
- ✅ Must have no console errors
- ✅ Must load in <5 seconds

### 4. Visual Screenshot Review
```bash
npx playwright test tests/visual-screenshot-suite.spec.ts --headed
```
- ✅ Review screenshots in `.hos/reports/screenshots/`
- ✅ Verify styling matches existing pages
- ✅ Check for layout breaks, missing elements, color inconsistencies

### 5. Manual Verification (Production)
After deployment:
- ✅ Test on actual mobile device (iPhone/Android)
- ✅ Test on tablet (iPad)
- ✅ Test all interactive features (clicks, modals, forms)
- ✅ Verify data saves correctly to database

---

## Running All Tests Together

```bash
# Run all comprehensive tests
npx playwright test tests/workout-tracker-comprehensive.spec.ts tests/vision-healing-comprehensive.spec.ts tests/design-system-validation.spec.ts --headed

# Or use pattern matching
npx playwright test tests/*comprehensive*.spec.ts --headed
```

---

## Creating Tests for New Features

When adding a new feature, copy the template structure:

### 1. Create Test File
```bash
tests/[feature-name]-comprehensive.spec.ts
```

### 2. Include These Tests

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://resetbiology.com';
const REPORT_DIR = 'C:/Users/jonch/reset-biology-website/.hos/reports/screenshots';

test.describe('[Feature Name] - Comprehensive Testing', () => {
  test.setTimeout(120000);

  // 1. Design System Compliance
  test('should comply with Reset Biology design system', async ({ page }) => {
    // Check brand colors, transparency, backdrop-blur
  });

  // 2. Desktop Interaction Flow
  test('Desktop: Full interaction flow with screenshots', async ({ page }) => {
    // Test all buttons, modals, forms
    // Take screenshots at each step
  });

  // 3. Mobile Interaction Flow
  test('Mobile: Full interaction flow with screenshots', async ({ page }) => {
    // Test touch interactions
    // Check no overflow
    // Verify text readability
  });

  // 4. Tablet View
  test('Tablet: Visual verification', async ({ page }) => {
    // 768x1024 viewport test
  });

  // 5. Console Errors
  test('Should have no console errors', async ({ page }) => {
    // Capture and fail on errors
  });

  // 6. Performance
  test('Should load within acceptable time', async ({ page }) => {
    // Must load in <5000ms
  });
});
```

### 3. Validation Helpers

**Brand Color Check:**
```typescript
const brandColorFound = await page.evaluate(() => {
  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    const styles = window.getComputedStyle(el);
    const bgColor = styles.backgroundColor;
    if (bgColor.includes('63, 191, 181') || bgColor.includes('114, 194, 71')) {
      return true;
    }
  }
  return false;
});
expect(brandColorFound, 'No brand colors found').toBe(true);
```

**Responsive Check:**
```typescript
const hasOverflow = await page.evaluate(() => {
  return document.body.scrollWidth > window.innerWidth;
});
expect(hasOverflow, 'Horizontal overflow detected').toBe(false);
```

---

## Screenshot Organization

All screenshots save to:
```
C:/Users/jonch/reset-biology-website/.hos/reports/screenshots/
```

**Naming Convention:**
```
[feature]-[number]-[viewport]-[description].png

Examples:
workout-01-desktop-initial.png
workout-06-mobile-initial.png
vision-01-desktop-initial.png
```

**Review Process:**
1. Run test suite
2. Open `.hos/reports/screenshots/` folder
3. View images chronologically
4. Check for:
   - Color consistency (teal/green accents)
   - Proper transparency (not too dark/light)
   - Clean borders and spacing
   - No layout breaks
   - Readable text on all sizes

---

## Common Design Violations to Catch

### ❌ Forbidden Patterns

1. **Gray backgrounds instead of brand colors**
   ```css
   /* ❌ BAD */
   bg-gray-800 bg-gray-900

   /* ✅ GOOD */
   bg-primary-500/20 bg-secondary-500/10
   ```

2. **High opacity without backdrop blur**
   ```css
   /* ❌ BAD */
   bg-black/80

   /* ✅ GOOD */
   bg-black/20 backdrop-blur-sm
   ```

3. **No brand colors visible**
   - Every page should have teal (#3FBFB5) or green (#72C247) somewhere
   - Usually in buttons, accents, highlights, borders

4. **Horizontal overflow on mobile**
   - Test: `document.body.scrollWidth > window.innerWidth`
   - Should always be false

5. **Text too small on mobile**
   - Minimum 12px font size
   - Ideally 14px+ for body text

---

## CI/CD Integration (Future)

When setting up automated testing:

```yaml
# .github/workflows/test.yml
name: Comprehensive Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npx playwright install
      - run: npx playwright test tests/*comprehensive*.spec.ts
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: screenshots
          path: .hos/reports/screenshots/
```

---

## Quick Reference Commands

```bash
# Build check
npm run build

# TypeScript check
npx tsc --noEmit

# Design system validation
npx playwright test tests/design-system-validation.spec.ts --headed

# Workout tracker tests
npx playwright test tests/workout-tracker-comprehensive.spec.ts --headed

# Vision healing tests
npx playwright test tests/vision-healing-comprehensive.spec.ts --headed

# All comprehensive tests
npx playwright test tests/*comprehensive*.spec.ts --headed

# Visual screenshots
npx playwright test tests/visual-screenshot-suite.spec.ts --headed

# Deploy to production
git add . && git commit -m "feat: description" && git push origin master
npx vercel --prod

# Update production database
npx prisma db push
```

---

## Success Criteria

A feature is ready for production when:
- ✅ `npm run build` succeeds with 0 errors
- ✅ Design system validation passes
- ✅ Feature-specific tests pass (desktop, mobile, tablet)
- ✅ No console errors detected
- ✅ Load time <5 seconds
- ✅ Screenshots show brand-consistent styling
- ✅ Manual testing on actual devices passes

---

## Support & Updates

- **Protocol Owner:** Jon Chyatt
- **Last Review:** November 15, 2025
- **Next Review:** December 15, 2025 (monthly review cycle)
- **Update Process:** Edit this file when adding new test patterns or validation rules
