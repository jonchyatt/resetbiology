---
name: website-scraper
agent: content-capture
type: extraction
model: claude-3-haiku
---

# Website Scraper Skill

## Purpose
Captures complete website content using Playwright for accurate rendering and extraction, with automatic verification of HTML clones.

## Trigger Phrases
- "scrape website [URL]"
- "capture all content from [URL]"
- "extract complete page data"
- "get all text and media from [URL]"
- "capture StemRegen product pages"

## Auto-Verification Feature

The ultimate scraper automatically verifies HTML clones after creation to ensure all images load correctly.

### How It Works

1. **Scrape & Download**: Downloads ALL image variants (srcset, responsive sizes)
2. **Create HTML Clone**: Replaces all image URLs with local paths
3. **Self-Check**: Opens clone in Playwright and counts loaded images
4. **Auto-Retry**: If <95% images load, retries up to 3 times
5. **Save Only If Pass**: Only saves clone if ≥95% similarity threshold

### Usage

```bash
# Use the ultimate scraper
node .hos/scripts/ultimate-scraper.js https://example.com/page
```

### Image URL Replacement

The scraper handles ALL image URL variations and replaces them with: `../images/slug-img-1.jpg`

### Verification Threshold

- **SIMILARITY_THRESHOLD**: 95.0% (95% of images must load)
- **MAX_VERIFICATION_ATTEMPTS**: 3 (Retry up to 3 times)

## Legal Compliance
- Check robots.txt before scraping
- Respect rate limits
- Only scrape authorized content
- Include user agent identification
- Honor copyright and terms of service
