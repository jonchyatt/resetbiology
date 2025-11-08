---
name: playwright-vision
description: Gives agents eyes to see and interact with web pages
version: 1.0.0
triggers:
  - use playwright-vision to check
  - use playwright-vision to see
  - verify design with playwright
  - test responsive with playwright
---

# Playwright Vision Skill

## When to Use
Use this skill when you need to:
- See what's actually displaying on a webpage
- Check if elements are visible
- Validate design implementation
- Test responsive layouts
- Verify user interactions work

## Required Tools
- playwright_mcp must be installed and connected

## Operations

### take_screenshot
Takes a screenshot of current page state
Parameters: url, filename, fullPage (boolean)

### check_element_visible
Verifies if an element is visible on page
Parameters: selector, timeout

### test_responsive
Tests page at different screen sizes
Parameters: url, devices[] (iPhone 12, iPhone 15, Pixel 7, iPad, Desktop)

### validate_design
Compares current view to design system
Parameters: url, designSystemPath

### check_interactions
Verifies interactive elements work correctly
Parameters: selector, action, expectedResult

## Usage Examples
'Use playwright-vision to check if the homepage looks correct'
'Use playwright-vision to test mobile responsiveness of the dashboard'
'Use playwright-vision to verify the checkout button is visible'
