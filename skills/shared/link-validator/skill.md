---
name: link-validator
description: Validates all internal and external links on pages
version: 1.0.0
triggers:
  - validate all links
  - check for broken links
  - test link integrity
  - find 404 errors
---

# Link Validator Skill

## Purpose
Checks all internal and external links for errors, 404s, redirects, and slow responses.

## When to Use
- Pre-deployment link checking
- Testing site-wide link health
- Finding broken links
- Validating navigation

## Required Tools
- playwright_mcp

## Operations

### scan_page_links
Extracts all links from page
Parameters: url, include_external (boolean)

### validate_link
Tests single link
Parameters: url, timeout (ms)

### generate_report
Creates link health report
Parameters: results[], output_path

### check_all_pages
Validates links across entire site
Parameters: base_url, pages[]

## Usage Examples
- "Use link-validator to check homepage links"
- "Use link-validator to find all broken links"
- "Use link-validator to validate navigation"
