---
name: link-validator
description: Shared skill for validating links across pages
version: 1.0.0
triggers:
  - validate links on
  - check for broken links
  - test link health
---

# Link Validator (Shared Skill)

## Purpose
Provides link validation capabilities to multiple agents.

## When to Use
- Pre-deployment checks
- Content audits
- Site health monitoring

## Required Tools
- playwright_mcp or network access

## Operations

### check_internal_links
Validates internal site links
Parameters: page_url

### check_external_links
Validates external links
Parameters: page_url

### generate_link_report
Creates report of link health
Parameters: scan_results

## Shared By
- test-oracle agent
- observer agent

## Usage Examples
- "Use link-validator to check all links on blog post"
- "Use link-validator to validate navigation links"
