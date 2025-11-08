---
name: responsive-tester
description: Tests website responsiveness across device sizes
version: 1.0.0
triggers:
  - test mobile responsiveness
  - check responsive design
  - validate on different devices
---

# Responsive Tester Skill

## Purpose
Tests pages across mobile, tablet, and desktop viewports

## When to Use
- Validating responsive design
- Testing mobile-first layouts
- Cross-device compatibility checks

## Required Tools
- playwright_mcp

## Operations

### test_viewport
Tests single viewport size
Parameters: url, width, height

### test_all_devices
Tests across device presets
Parameters: url, devices[]

### compare_layouts
Compares layouts across sizes
Parameters: url

## Usage Examples
- "Test mobile responsiveness of the dashboard"
- "Check responsive design on all device sizes"
