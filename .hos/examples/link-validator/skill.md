---
name: link-validator
description: Validates all links on a webpage are working and accessible
version: 1.0.0
triggers:
  - check all links
  - validate links on
  - test broken links
  - verify hyperlinks
---

# Link Validator

## Purpose
Automatically checks all hyperlinks on a webpage to ensure they are valid, accessible, and return proper HTTP status codes.

## When to Use
- Before deploying changes to production
- After updating navigation or footer links
- Periodic maintenance checks
- User reports broken links
- After content migration

## Operations

### validate_page_links
Scans a single page and tests all hyperlinks.

Parameters:
- url: Full URL of page to check
- include_external: Check external links (default: true)
- timeout: Request timeout in ms (default: 5000)

### validate_site_links
Crawls entire site and validates all links.

Parameters:
- base_url: Root URL to start crawl
- max_depth: How deep to crawl (default: 3)
- exclude_patterns: Array of URL patterns to skip

### generate_report
Creates report of broken links found.

Parameters:
- format: 'markdown' | 'json' | 'html'
- group_by: 'page' | 'status' | 'type'

## Output Format
Returns object:
```json
{
  "total_links": 47,
  "valid": 45,
  "broken": 2,
  "warnings": 0,
  "links": [
    {
      "url": "https://example.com/page",
      "status": 404,
      "found_on": "/about",
      "anchor_text": "Learn More"
    }
  ]
}
```

## Usage Examples
- "Validate links on https://resetbiology.com/portal"
- "Check all links across the entire site"
- "Test broken links and generate markdown report"

## Notes
- External links may be rate-limited
- Use respectful crawl delays for external sites
- Some sites block automated requests (403/429)
- Relative links resolved against base URL
