---
name: reset-biology-link-validator
description: Validates all links on ResetBiology.com pages
version: 1.0.0
triggers:
  - validate all links
  - check for broken links on
  - test link integrity
---

# ResetBiology Link Validator

## Purpose
Specifically validates links across ResetBiology.com site.

## Required Tools
- playwright_mcp

## Operations

### scan_all_pages
Crawls entire site checking links
Parameters: base_url

### validate_external_links
Checks external links (PubMed, research sites)
Parameters: page_url

### generate_report
Creates link health report
Parameters: results

## Usage Examples
- "Use reset-biology-link-validator to check all links"
- "Use reset-biology-link-validator to find broken research citations"
