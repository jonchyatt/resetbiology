---
name: style-validator
description: Validates CSS styles match design system and brand guidelines
version: 1.0.0
triggers:
  - validate styles
  - check brand colors
  - verify design system
  - audit CSS usage
---

# Style Validator

## Purpose
Ensures CSS styles adhere to design system guidelines, brand colors, spacing standards, and accessibility requirements.

## When to Use
- Before merging CSS changes
- After adding new components
- Design system compliance audit
- Checking brand consistency
- Accessibility review

## Operations

### validate_colors
Checks all colors match approved brand palette.

Parameters:
- file_paths: Array of CSS/component files to check
- brand_colors: Object of approved hex colors
- allow_variations: Allow opacity variants (default: true)

### check_spacing
Verifies spacing uses design system tokens.

Parameters:
- file_paths: Array of files to check
- spacing_scale: Array of approved spacing values
- properties: Which properties to check (margin, padding, gap)

### validate_typography
Ensures font sizes and families match design system.

Parameters:
- file_paths: Array of files
- font_scale: Array of approved font sizes
- font_families: Array of approved fonts

### check_accessibility
Tests color contrast ratios and focus states.

Parameters:
- url: Page URL to test
- wcag_level: 'AA' | 'AAA' (default: 'AA')
- check_focus_indicators: Test keyboard navigation (default: true)

## Output Format
Returns object:
```json
{
  "file": "src/components/Button.tsx",
  "violations": [
    {
      "type": "color",
      "line": 42,
      "found": "#FF5733",
      "message": "Color not in brand palette",
      "severity": "error",
      "suggestion": "Use #3FBFB5 (primary-teal)"
    }
  ],
  "warnings": 1,
  "errors": 3,
  "passed": false
}
```

## Usage Examples
- "Validate styles in Button component"
- "Check brand colors across all components"
- "Verify design system compliance"
- "Audit CSS for accessibility issues"

## Notes
- Brand colors: Primary Teal (#3FBFB5), Secondary Green (#72C247)
- Spacing scale: 4px base (1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64)
- Font scale: 12px, 14px, 16px, 18px, 24px, 32px, 48px
- WCAG AA requires 4.5:1 contrast for normal text
- Focus indicators must be visible and have 3:1 contrast
