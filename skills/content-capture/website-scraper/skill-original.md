---
name: website-scraper
agent: content-capture
type: extraction
model: claude-3-haiku
---

# Website Scraper Skill

## Purpose
Captures complete website content using Playwright for accurate rendering and extraction.

## Trigger Phrases
- "scrape website [URL]"
- "capture all content from [URL]"
- "extract complete page data"
- "get all text and media from [URL]"
- "capture StemRegen product pages"

## Implementation

### 1. Setup Playwright Browser
```javascript
const { chromium } = require('@playwright/test');

async function scrapeWebsite(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
```

### 2. Navigate and Wait
```javascript
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for dynamic content
  await page.waitForTimeout(2000);

  // Scroll to load lazy images
  await autoScroll(page);
```

### 3. Extract Content
```javascript
  const content = await page.evaluate(() => {
    return {
      // Text content
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
        level: h.tagName,
        text: h.textContent.trim()
      })),

      // Paragraphs
      paragraphs: Array.from(document.querySelectorAll('p')).map(p =>
        p.textContent.trim()
      ).filter(text => text.length > 0),

      // Lists
      lists: Array.from(document.querySelectorAll('ul, ol')).map(list => ({
        type: list.tagName,
        items: Array.from(list.querySelectorAll('li')).map(li =>
          li.textContent.trim()
        )
      })),

      // Links
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.href,
        external: !a.href.includes(window.location.hostname)
      })),

      // Images
      images: Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth,
        height: img.naturalHeight
      })),

      // Videos
      videos: Array.from(document.querySelectorAll('video, iframe')).map(v => ({
        type: v.tagName,
        src: v.src || v.querySelector('source')?.src,
        poster: v.poster
      })),

      // Forms
      forms: Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.action,
        method: form.method,
        fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
          type: field.type,
          name: field.name,
          required: field.required,
          placeholder: field.placeholder
        }))
      })),

      // Meta data
      meta: {
        description: document.querySelector('meta[name="description"]')?.content,
        keywords: document.querySelector('meta[name="keywords"]')?.content,
        ogImage: document.querySelector('meta[property="og:image"]')?.content
      }
    };
  });
```

### 4. Capture Screenshots
```javascript
  // Full page screenshot
  await page.screenshot({
    path: `.hos/memory/visual/captures/${Date.now()}-full.png`,
    fullPage: true
  });

  // Above fold screenshot
  await page.screenshot({
    path: `.hos/memory/visual/captures/${Date.now()}-fold.png`
  });
```

### 5. Extract Structured Data
```javascript
  // Product data (for e-commerce)
  const products = await page.evaluate(() => {
    const productSchema = document.querySelector('script[type="application/ld+json"]');
    if (productSchema) {
      try {
        return JSON.parse(productSchema.textContent);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
```

### 6. Auto-scroll Function
```javascript
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if(totalHeight >= scrollHeight){
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}
```

## Output Format
```json
{
  "url": "https://example.com/page",
  "timestamp": "2025-01-15T10:30:00Z",
  "content": {
    "title": "Page Title",
    "headings": [...],
    "paragraphs": [...],
    "images": [...],
    "videos": [...],
    "links": [...],
    "forms": [...]
  },
  "screenshots": {
    "fullPage": "path/to/full.png",
    "aboveFold": "path/to/fold.png"
  },
  "structuredData": {...},
  "metrics": {
    "loadTime": 1234,
    "imageCount": 25,
    "linkCount": 45,
    "wordCount": 2500
  }
}
```

## Error Handling
```javascript
try {
  const data = await scrapeWebsite(url);
  return data;
} catch (error) {
  console.error('Scraping failed:', error);
  return {
    error: true,
    message: error.message,
    url: url
  };
} finally {
  await browser.close();
}
```

## Legal Compliance
- Check robots.txt before scraping
- Respect rate limits
- Only scrape authorized content
- Include user agent identification
- Honor copyright and terms of service