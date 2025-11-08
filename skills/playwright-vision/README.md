# Playwright Vision Skill

A production-ready Playwright vision skill that provides visual inspection and interaction capabilities for web pages using Playwright MCP.

## Overview

This skill gives agents the ability to "see" what's actually rendering on web pages, validate design implementations, test responsive layouts, and verify user interactions.

## Installation

1. Ensure Playwright MCP is installed and connected
2. Place this skill directory in your skills folder
3. The skill is ready to use immediately

## File Structure

```
playwright-vision/
├── skill.md                    # Skill specification and triggers
├── playwright_operations.py    # Core implementation
├── test_data.csv              # Sample test cases
├── README.md                  # This file
└── .skillignore              # Files to exclude from packaging
```

## Features

### take_screenshot
Captures a screenshot of a web page at current state

```python
await vision.take_screenshot(
    url="https://resetbiology.com",
    filename="homepage.png",
    full_page=True
)
```

### check_element_visible
Verifies if a specific element is visible to users

```python
await vision.check_element_visible(
    url="https://resetbiology.com",
    selector=".checkout-button",
    timeout=5000
)
```

### test_responsive
Tests page rendering across multiple device sizes

```python
await vision.test_responsive(
    url="https://resetbiology.com",
    devices=["iPhone 12", "iPad", "Desktop"]
)
```

### validate_design
Compares current page against design system specifications

```python
await vision.validate_design(
    url="https://resetbiology.com",
    design_system_path="design-system.json"
)
```

### check_interactions
Verifies interactive elements work correctly

```python
await vision.check_interactions(
    url="https://resetbiology.com",
    selector=".menu-button",
    action="click",
    expected_result=".navigation-open"
)
```

## Supported Devices

- iPhone 12 (390x844)
- iPhone 15 (393x852)
- Pixel 7 (412x915)
- iPad (768x1024)
- iPad Pro (1024x1366)
- Desktop (1920x1080)

## Usage Examples

### Check if homepage looks correct
```
Use playwright-vision to check if the homepage looks correct
```

### Test mobile responsiveness
```
Use playwright-vision to test mobile responsiveness of the dashboard
```

### Validate element visibility
```
Use playwright-vision to see if the checkout button is visible to users
```

### Verify form interactions
```
Use playwright-vision to verify the signup form accepts user input
```

### Cross-device design validation
```
Use playwright-vision to validate design on iPhone, iPad, and Desktop
```

## Design System Validation

The skill can validate pages against a design system specification file. The design system JSON should follow this format:

```json
{
  "colors": [
    "#000000",
    "#ffffff",
    "#ff0000"
  ],
  "typography": {
    "fonts": [
      "Roboto",
      "Arial",
      "Helvetica"
    ]
  }
}
```

## Dependencies

- Python 3.8+
- Playwright MCP (must be installed and running)
- Access to target websites (local or remote)

## Output

All screenshots are stored in `.hos/memory/visual/screenshots/`

Validation reports include:
- Success/failure status
- Element positions and visibility information
- Responsive layout analysis
- Design system violations
- Interaction test results

## Integration

Works seamlessly with other skills:
- **link-validator**: Visually confirm links exist
- **style-validator**: Check design consistency
- **responsive-tester**: Cross-device validation

## Notes

- All operations respect Playwright MCP timeout settings
- Screenshots directory is created automatically if missing
- The skill maintains detailed error messages for debugging
- Responsive testing includes horizontal scroll detection
- Element positions are provided when elements are visible
