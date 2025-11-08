---
name: responsive-tester
description: Tests webpage layout and functionality across different screen sizes
version: 1.0.0
triggers:
  - test responsive design
  - check mobile layout
  - validate breakpoints
  - test at different screen sizes
---

# Responsive Tester

## Purpose
Validates that webpages display correctly and remain functional across mobile, tablet, and desktop screen sizes by testing at common breakpoints.

## When to Use
- After CSS changes
- New component development
- Before production deployment
- User reports mobile issues
- Testing new responsive features

## Operations

### test_breakpoints
Tests page at standard responsive breakpoints.

Parameters:
- url: Page URL to test
- breakpoints: Array of widths (default: [375, 768, 1024, 1440])
- capture_screenshots: Take screenshots at each size (default: true)

### check_element_visibility
Verifies elements are visible/hidden at correct breakpoints.

Parameters:
- url: Page URL
- selectors: Array of CSS selectors to check
- expected_visibility: Object mapping breakpoint to visibility

### test_navigation
Ensures navigation works on mobile (hamburger menu, etc).

Parameters:
- url: Page URL
- mobile_breakpoint: Width considered mobile (default: 768)
- test_menu_toggle: Test hamburger menu opens/closes

### detect_overflow
Finds horizontal scroll issues on mobile.

Parameters:
- url: Page URL
- breakpoint: Width to test (default: 375)

## Output Format
Returns object:
```json
{
  "breakpoint": 375,
  "issues": [
    {
      "type": "horizontal_scroll",
      "element": ".wide-table",
      "width": "450px",
      "severity": "high"
    }
  ],
  "screenshot": "base64_data_or_path",
  "passed": false
}
```

## Usage Examples
- "Test responsive design on /portal"
- "Check mobile layout at 375px width"
- "Validate breakpoints and detect overflow"
- "Test navigation menu on mobile"

## Notes
- Default breakpoints: 375 (mobile), 768 (tablet), 1024 (desktop), 1440 (large)
- Screenshots saved to /test-results/responsive/
- Checks for common issues: overflow, text cutoff, broken layouts
- Tests both portrait and landscape orientations
