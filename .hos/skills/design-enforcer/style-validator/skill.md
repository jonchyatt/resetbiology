---
name: style-validator
description: Validates UI components against ResetBiology design system
version: 1.0.0
triggers:
  - validate design system compliance
  - check style consistency
  - verify component styling
  - validate UI against design system
---

# Style Validator Skill

## Purpose
Validates that UI components follow ResetBiology's design system including colors, typography, spacing, and component patterns.

## When to Use
- After implementing new UI components
- Before submitting PR with UI changes
- When reviewing component styling
- During design system audits

## Design System Reference

### Color Palette
```css
/* Primary Colors */
--primary-400: #3FBFB5  /* Teal - main brand */
--primary-500: #3FBFB5  /* Teal - buttons */
--primary-600: #359A92  /* Teal - hover */

/* Secondary Colors */
--secondary-400: #72C247  /* Green - accents */
--secondary-500: #72C247  /* Green - success */

/* Neutral Colors */
--gray-900: #1a1a2e  /* Dark background */
--gray-800: #252540  /* Card background */
--gray-700: #303050  /* Input background */
--gray-400: #9ca3af  /* Secondary text */
```

### Typography Scale
```css
text-4xl md:text-5xl lg:text-6xl  /* Hero titles */
text-2xl md:text-3xl              /* Section headers */
text-xl                           /* Card titles */
text-base                         /* Body text */
text-sm                           /* Labels */
text-xs                           /* Captions */
```

### Spacing System
```css
p-4  /* Cards, containers */
p-6  /* Large cards */
p-8  /* Page sections */

gap-2  /* Tight spacing */
gap-4  /* Standard spacing */
gap-6  /* Loose spacing */
```

## Validation Checklist

### ✅ Color Validation
- [ ] Uses only design system colors
- [ ] No arbitrary color values
- [ ] Primary color (#3FBFB5) for CTAs
- [ ] Secondary color (#72C247) for success states
- [ ] Gray scale for backgrounds and text

### ✅ Typography Validation
- [ ] Uses typography scale
- [ ] Responsive text sizes (md:, lg:)
- [ ] Consistent font weights
- [ ] Proper heading hierarchy

### ✅ Spacing Validation
- [ ] Uses spacing system (p-4, p-6, p-8)
- [ ] Consistent gap values
- [ ] Responsive spacing adjustments

### ✅ Component Patterns
- [ ] Glassmorphism: `bg-gray-800/50 backdrop-blur-sm`
- [ ] Primary buttons: `bg-primary-500 hover:bg-primary-600`
- [ ] Modal overlays: `fixed inset-0 bg-black/50 backdrop-blur-sm`
- [ ] Input fields: `bg-gray-700 border-gray-600 focus:border-primary-500`

## Validation Process

### 1. Read Component File
Extract component code to analyze.

### 2. Check Color Usage
```typescript
// Good ✅
className="bg-primary-500 text-white"

// Bad ❌
className="bg-blue-500 text-white"
```

### 3. Check Typography
```typescript
// Good ✅
className="text-xl font-bold"

// Bad ❌
className="text-[24px] font-[700]"
```

### 4. Check Spacing
```typescript
// Good ✅
className="p-6 gap-4"

// Bad ❌
className="p-[24px] gap-[16px]"
```

### 5. Check Component Patterns
```typescript
// Good ✅ - Glassmorphism card
<div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6">

// Bad ❌ - Solid card
<div className="bg-gray-800 rounded-lg p-6">
```

## Common Violations

### ❌ Arbitrary Colors
```jsx
// Wrong
<button className="bg-blue-500">Click</button>

// Correct
<button className="bg-primary-500">Click</button>
```

### ❌ Custom Font Sizes
```jsx
// Wrong
<h1 className="text-[32px]">Title</h1>

// Correct
<h1 className="text-2xl md:text-3xl">Title</h1>
```

### ❌ Breaking Glassmorphism
```jsx
// Wrong
<div className="bg-gray-800 p-6">

// Correct
<div className="bg-gray-800/50 backdrop-blur-sm p-6">
```

### ❌ No Responsive Spacing
```jsx
// Wrong
<div className="px-4 py-2">

// Correct (if needs responsive)
<div className="px-4 py-2 md:px-6 md:py-4">
```

## Playwright Integration

### Visual Validation Test
```typescript
import { test, expect } from '@playwright/test'

test('component matches design system', async ({ page }) => {
  await page.goto('https://resetbiology.com/component-page')

  // Check primary button color
  const button = page.locator('button.bg-primary-500')
  await expect(button).toHaveCSS('background-color', 'rgb(63, 191, 181)')

  // Check glassmorphism
  const card = page.locator('.bg-gray-800\\/50')
  await expect(card).toHaveCSS('backdrop-filter', 'blur(4px)')

  // Check typography
  const heading = page.locator('h1')
  const fontSize = await heading.evaluate(el =>
    window.getComputedStyle(el).fontSize
  )
  expect(['24px', '30px', '36px']).toContain(fontSize)
})
```

## Success Criteria
- All colors from design system
- Typography follows scale
- Spacing uses system values
- Component patterns correct
- Glassmorphism applied
- Responsive design implemented
- No arbitrary values

## Output
Validation report with:
- List of violations found
- File paths and line numbers
- Suggested corrections
- Design system reference links
