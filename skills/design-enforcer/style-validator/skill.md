---
name: style-validator
description: Validates UI components against ResetBiology.com design system
version: 1.0.0
triggers:
  - validate design consistency
  - check style compliance
  - enforce design system
---

# Style Validator Skill

## Purpose
Ensures all UI components comply with ResetBiology.com design system.

## When to Use
- Validating new components
- Checking design consistency
- Enforcing Tailwind conventions
- Auditing visual consistency

## Required Tools
- playwright_mcp

## Operations

### check_colors
Validates color usage against design system
Parameters: component_path, design_system_rules

### check_spacing
Validates spacing consistency
Parameters: page_url

### check_typography
Validates font usage
Parameters: page_url

## Usage Examples
- "Use style-validator to check if new button follows design system"
- "Use style-validator to audit homepage colors"
