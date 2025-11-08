---
name: playwright-vision
description: Gives agents eyes to see and interact with web pages
version: 1.0.0
triggers:
  - use playwright-vision to check
  - see what's displaying on
  - validate visual design
  - test page responsiveness
---

# Playwright Vision Skill

## Purpose
Provides visual inspection capabilities using Playwright MCP

## When to Use
- Need to see actual page rendering
- Validate design implementation
- Test responsive layouts
- Check element visibility

## Required Tools
- playwright_mcp (must be installed and connected)

## Operations

### take_screenshot
Captures page screenshot
Parameters: url, filename, fullPage

### check_element_visible
Verifies element visibility
Parameters: selector, timeout

### test_responsive
Tests across device sizes
Parameters: url, devices[]

## Usage Examples
- "Use playwright-vision to check if homepage looks correct"
- "Use playwright-vision to validate mobile layout"
