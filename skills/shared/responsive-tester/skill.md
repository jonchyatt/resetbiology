---
name: responsive-tester
description: Tests responsive design across device sizes
version: 1.0.0
triggers:
  - test mobile responsiveness
  - check responsive design
  - validate on different devices
  - test on iPhone and Android
---

# Responsive Tester Skill

## Purpose
Tests pages across mobile, tablet, and desktop viewports to ensure responsive design works correctly.

## When to Use
- Validating responsive design
- Testing mobile-first layouts
- Cross-device compatibility
- Touch target validation

## Required Tools
- playwright_mcp

## Operations

### test_viewport
Tests single viewport size
Parameters: url, width, height, device_name

### test_all_devices
Tests across all device presets
Parameters: url

### check_horizontal_scroll
Detects unwanted horizontal scroll
Parameters: url, viewport

### validate_touch_targets
Ensures touch targets are 44x44px minimum
Parameters: url

### compare_layouts
Compares layouts across sizes
Parameters: url, viewports[]

## Devices Tested
- iPhone SE (375x667)
- iPhone 12 (390x844)
- iPhone 15 Pro (393x852)
- Pixel 5 (412x915)
- iPad (768x1024)
- iPad Pro (1024x1366)
- Desktop (1920x1080)

## Usage Examples
- "Use responsive-tester to check dashboard on mobile"
- "Use responsive-tester to validate all pages"
- "Use responsive-tester to test touch targets"
