---
name: playwright-vision
description: Shared skill for visual validation using Playwright MCP
version: 1.0.0
triggers:
  - take screenshot of
  - visually inspect
  - capture page state
---

# Playwright Vision (Shared Skill)

## Purpose
Provides visual validation capabilities to all agents using Playwright MCP.

## When to Use
- Visual regression testing
- Layout validation
- Screenshot documentation
- Visual bug investigation

## Required Tools
- playwright_mcp

## Operations

### capture_screenshot
Takes screenshot of page
Parameters: page_url, viewport_size

### compare_visual
Compares screenshots for differences
Parameters: baseline_image, current_image

### inspect_element
Takes screenshot of specific element
Parameters: page_url, selector

## Shared By
- design-enforcer agent
- test-oracle agent
- observer agent

## Usage Examples
- "Use playwright-vision to capture homepage screenshot"
- "Use playwright-vision to compare button styles"
