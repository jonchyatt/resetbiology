---
name: responsive-tester
description: Shared skill for testing responsive design across viewport sizes
version: 1.0.0
triggers:
  - test responsive design
  - check mobile layout
  - validate viewport sizes
---

# Responsive Tester (Shared Skill)

## Purpose
Tests responsive design across different viewport sizes and devices.

## When to Use
- Mobile responsiveness validation
- Cross-device testing
- Layout verification

## Required Tools
- playwright_mcp

## Operations

### test_viewports
Tests across common viewport sizes
Parameters: page_url, viewports

### test_mobile_first
Tests mobile-first design approach
Parameters: page_url

### identify_responsive_issues
Finds layout issues at different sizes
Parameters: page_url

## Shared By
- design-enforcer agent
- test-oracle agent

## Usage Examples
- "Use responsive-tester to check mobile layout of homepage"
- "Use responsive-tester to validate tablet view of product page"
