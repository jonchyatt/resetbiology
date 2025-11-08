---
name: playwright-vision
description: Gives agents eyes to see and interact with web pages using Playwright MCP
version: 1.0.0
triggers:
  - use playwright-vision to check
  - use playwright-vision to see
  - see what's displaying on
  - validate design implementation
  - test responsive layouts
  - verify user interactions
  - check element visibility
---

# Playwright Vision Skill

## Purpose
Provides visual inspection and interaction capabilities for web pages using Playwright MCP. This skill gives agents the ability to "see" what's actually rendering on web pages, not just the HTML/CSS code.

## When to Use This Skill
- See what's actually displaying on a webpage
- Check if specific elements are visible to users
- Validate design implementation matches specifications
- Test responsive layouts across device sizes
- Verify user interactions work correctly
- Take screenshots for documentation or comparison
- Debug visual issues

## Required Tools
- `playwright_mcp` must be installed and connected
- Access to the target website (local or remote)

## Operations

### take_screenshot
Takes a screenshot of current page state

**Parameters:**
- `url` (string): The URL to screenshot
- `filename` (string): Where to save the screenshot
- `fullPage` (boolean): Capture full scrollable page or just viewport

**Usage:**
```
Use playwright-vision to take screenshot of https://resetbiology.com and save as homepage.png
```

### check_element_visible
Verifies if an element is visible on the page

**Parameters:**
- `selector` (string): CSS selector for the element
- `timeout` (number): Max time to wait in milliseconds

**Usage:**
```
Use playwright-vision to check if .checkout-button is visible
```

### test_responsive
Tests page at different screen sizes

**Parameters:**
- `url` (string): The URL to test
- `devices` (array): Device names (iPhone 12, iPad Pro, Desktop, etc.)

**Usage:**
```
Use playwright-vision to test responsive design on mobile and desktop
```

### validate_design
Compares current view to design system specifications

**Parameters:**
- `url` (string): The page to validate
- `designSystemPath` (string): Path to design system specs

**Usage:**
```
Use playwright-vision to validate homepage design against specifications
```

### check_interactions
Verifies interactive elements work correctly

**Parameters:**
- `selector` (string): Element to interact with
- `action` (string): click, hover, type, etc.
- `expectedResult` (string): What should happen

**Usage:**
```
Use playwright-vision to check that clicking .menu-button opens navigation
```

## Usage Examples

### Basic Screenshot
```
Use playwright-vision to check if the homepage looks correct
```

### Mobile Testing
```
Use playwright-vision to test mobile responsiveness of the dashboard
```

### Element Validation
```
Use playwright-vision to see if the checkout button is visible to users
```

### Interaction Testing
```
Use playwright-vision to verify the signup form accepts user input
```

### Cross-Device Testing
```
Use playwright-vision to validate design on iPhone, iPad, and Desktop
```

## Integration with Other Skills
- Works with `link-validator` to visually confirm links exist
- Works with `style-validator` to check design consistency
- Works with `responsive-tester` for cross-device validation

## Notes
- Screenshots are stored in `.hos/memory/visual/screenshots/`
- Failed validations generate detailed reports
- All operations respect Playwright MCP timeout settings
