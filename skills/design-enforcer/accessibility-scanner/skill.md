---
name: accessibility-scanner
description: Scans for WCAG 2.1 AA compliance issues
version: 1.0.0
triggers:
  - check accessibility
  - scan for WCAG compliance
  - validate accessibility
---

# Accessibility Scanner Skill

## Purpose
Ensures ResetBiology.com meets WCAG 2.1 AA accessibility standards.

## When to Use
- Pre-deployment accessibility checks
- New component validation
- Accessibility audits

## Required Tools
- playwright_mcp

## Operations

### check_contrast
Validates color contrast ratios
Parameters: page_url

### check_aria_labels
Validates ARIA labels presence
Parameters: page_url

### check_keyboard_nav
Tests keyboard navigation
Parameters: page_url

## Usage Examples
- "Use accessibility-scanner to check homepage compliance"
- "Use accessibility-scanner to validate form accessibility"
