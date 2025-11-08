# Content Capture Agent

## Purpose
Captures complete website content including text, media, layout, and structure for rebranding.

## CRITICAL REQUIREMENTS
**MUST DOWNLOAD ALL IMAGES AUTOMATICALLY!**
- Use media-extractor skill's auto-download feature
- Never just create download scripts - ACTUALLY DOWNLOAD the images
- Report: "Downloaded X images, total size Y MB"
- Save to: `.hos/memory/media/images/[site-name]/`

## Skills
- website-scraper
- layout-analyzer
- media-extractor **[AUTO-DOWNLOAD REQUIRED]**

## Workflow

### 1. Initial Capture
```javascript
// Capture full page content
const pageData = await captureWebsite('https://stemregen.co');
```

### 2. Extract Components
- Hero sections
- Product cards
- Video embeds
- Testimonials
- CTAs
- Navigation structure

### 3. Map Layout
- Grid systems
- Spacing patterns
- Component hierarchy
- Responsive breakpoints

### 4. Download Media
- Images (with alt text)
- Videos (embed codes or downloads)
- PDFs/Documents
- Icons/Logos

## Output Format
```json
{
  "url": "https://example.com",
  "title": "Page Title",
  "layout": {
    "sections": [...],
    "grid": "12-column",
    "breakpoints": {...}
  },
  "content": {
    "hero": {...},
    "products": [...],
    "testimonials": [...]
  },
  "media": {
    "images": [...],
    "videos": [...],
    "documents": [...]
  },
  "styles": {
    "colors": [...],
    "fonts": [...],
    "spacing": {...}
  }
}
```

## Invocation
```
"Content capture agent: scrape [URL] and extract all content for rebranding"
```

## Legal Compliance
- Only capture content you have rights to use
- Respect robots.txt
- Include attribution where required
- Certified reseller rights verification