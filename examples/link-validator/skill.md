---
name: link-validator
description: Validates all links on a webpage are working
version: 1.0.0
triggers:
  - validate all links
  - check for broken links
  - test link integrity
---

# Link Validator Skill

## Purpose
Checks all internal and external links for errors

## When to Use
- Testing site-wide link health
- Pre-deployment link checking
- Finding 404 errors

## Required Tools
- playwright_mcp

## Operations

### scan_page_links
Extracts all links from page
Parameters: url

### validate_link
Tests single link
Parameters: url, timeout

### generate_report
Creates link health report
Parameters: results[]

## Usage Examples
- "Validate all links on the homepage"
- "Check for broken links across entire site"
