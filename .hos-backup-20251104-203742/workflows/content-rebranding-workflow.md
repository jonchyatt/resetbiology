# Content Capture & Rebranding Workflow

## Overview
Complete system for capturing website content and rebranding it for ResetBiology.com while preserving scientific integrity and compliance requirements.

## System Architecture

```
┌─────────────────────┐
│  Content Capture    │ ← Scrapes website
│      Agent          │   Extracts all content
└──────────┬──────────┘   Analyzes layout
           │
           ▼ (captured data)
┌─────────────────────┐
│   Transform Agent   │ ← Rebrand content
│                     │   Preserve compliance
└──────────┬──────────┘   Map styles
           │
           ▼ (transformed data)
┌─────────────────────┐
│   Builder Agent     │ ← Generate Next.js pages
│                     │   Create components
└─────────────────────┘   Write tests
```

## Complete Workflow

### Step 1: Initial Content Capture
```bash
# Invoke Content Capture Agent
"Content capture agent: scrape https://stemregen.co and extract all content for rebranding"
```

**What happens:**
1. **website-scraper** skill activates
   - Launches Playwright browser
   - Navigates to target URL
   - Extracts all text, images, videos, links
   - Takes screenshots

2. **layout-analyzer** skill activates
   - Maps component hierarchy
   - Detects grid systems
   - Identifies responsive breakpoints
   - Analyzes spacing patterns

3. **media-extractor** skill activates
   - Downloads all images
   - Captures video information
   - Extracts PDFs and documents
   - Catalogues all media assets

**Output:**
```json
{
  "url": "https://stemregen.co",
  "content": {
    "pages": [...],
    "components": [...],
    "media": [...]
  },
  "layout": {
    "grid": "12-column",
    "breakpoints": {...}
  }
}
```

### Step 2: Content Transformation
```bash
# Invoke Transform Agent
"Transform agent: rebrand StemRegen content to ResetBiology while preserving product integrity"
```

**What happens:**
1. **rebrand-skill** activates
   - Detects glassmorphism effects
   - Identifies glow effects
   - Captures gradients
   - Replaces branding elements
   - Preserves scientific content
   - Maintains compliance text

2. **style-mapper** activates
   - Maps colors to ResetBiology palette
   - Translates typography
   - Converts spacing to design system
   - Generates CSS mappings

**Output:**
```json
{
  "transformed": {
    "branding": "ResetBiology",
    "styles": {
      "glassmorphism": [...],
      "glows": [...],
      "gradients": [...]
    },
    "preserved": {
      "scientific": [...],
      "compliance": [...]
    }
  }
}
```

### Step 3: Page Building
```bash
# Invoke Builder Agent
"Builder agent: create Next.js pages from transformed StemRegen content"
```

**What happens:**
1. Creates Next.js page structure
2. Generates TypeScript components
3. Applies ResetBiology styling
4. Integrates with existing systems
5. Writes Playwright tests

**Output:**
```
app/
├── stemregen/
│   ├── page.tsx
│   └── products/
│       └── [slug]/page.tsx
components/
└── stemregen/
    ├── ProductCard.tsx
    └── HeroSection.tsx
tests/
└── stemregen/
    └── products.spec.ts
```

## Advanced Usage

### Selective Capture
```bash
# Capture only specific pages
"Content capture agent: scrape StemRegen product pages only"

# Capture with focus on media
"Content capture agent: extract all videos and images from StemRegen"
```

### Style Preservation
```bash
# Keep specific effects
"Transform agent: rebrand but preserve glassmorphism effects exactly"

# Maintain layout
"Transform agent: rebrand content keeping original grid system"
```

### Custom Components
```bash
# Generate specific component types
"Builder agent: create testimonial carousel from StemRegen reviews"

# Focus on mobile
"Builder agent: create mobile-first components from captured content"
```

## Automation Commands

### Full Pipeline
```bash
# Complete capture and rebrand pipeline
"Run content rebranding workflow for https://stemregen.co"
```

This triggers:
1. Content capture (all 3 skills)
2. Transformation (both skills)
3. Building (component generation)
4. Testing (Playwright tests)

### Batch Processing
```javascript
// Process multiple pages
const pages = [
  'https://stemregen.co/',
  'https://stemregen.co/products',
  'https://stemregen.co/science'
];

for (const page of pages) {
  await invoke('Content capture agent: scrape ' + page);
  await invoke('Transform agent: rebrand captured content');
  await invoke('Builder agent: create Next.js page');
}
```

## Quality Checks

### Compliance Verification
```javascript
// Verify preserved content
const compliance = {
  disclaimers: checkDisclaimers(transformed),
  ingredients: verifyIngredients(transformed),
  certifications: validateCertifications(transformed)
};
```

### Visual Regression
```bash
# Compare before/after
npx playwright test visual-regression.spec.ts
```

### Style Validation
```javascript
// Check glassmorphism preservation
const effects = {
  glassmorphism: validateGlassmorphism(styles),
  glows: validateGlows(styles),
  gradients: validateGradients(styles)
};
```

## Skill Invocation Reference

### Content Capture Agent Skills
| Skill | Trigger Phrases |
|-------|----------------|
| website-scraper | "scrape website [URL]", "capture all content from [URL]" |
| layout-analyzer | "analyze page layout", "map grid system" |
| media-extractor | "extract all media from [URL]", "download images and videos" |

### Transform Agent Skills
| Skill | Trigger Phrases |
|-------|----------------|
| rebrand-skill | "rebrand with glassmorphism effects", "transform keeping glow effects" |
| style-mapper | "map styles to design system", "convert to ResetBiology theme" |

### Builder Agent Skills
| Skill | Trigger Phrases |
|-------|----------------|
| component-generator | "create Next.js components", "generate TypeScript components" |
| test-driven-dev | "write tests for components", "create Playwright tests" |

## Error Handling

### Content Capture Failures
```javascript
try {
  await captureContent(url);
} catch (error) {
  if (error.code === 'AUTH_REQUIRED') {
    // Handle authentication
    console.log('Site requires login');
  } else if (error.code === 'RATE_LIMITED') {
    // Handle rate limiting
    await delay(60000);
    await retry();
  }
}
```

### Transformation Issues
```javascript
if (!transformed.preserved.compliance) {
  console.error('Compliance text not preserved!');
  // Manual review required
  await flagForReview(transformed);
}
```

## Legal Compliance Checklist

- [ ] Verify reseller agreement covers content usage
- [ ] Check robots.txt compliance
- [ ] Preserve all medical disclaimers
- [ ] Maintain ingredient accuracy
- [ ] Include "Authorized Reseller" attribution
- [ ] Keep certification logos/text
- [ ] Preserve clinical study references
- [ ] Maintain dosage information

## Performance Optimization

### Caching
```javascript
// Cache captured content
const cacheKey = `capture_${url}_${Date.now()}`;
await saveToCache(cacheKey, capturedContent);
```

### Parallel Processing
```javascript
// Process multiple skills in parallel
await Promise.all([
  extractImages(page),
  extractVideos(page),
  extractDocuments(page)
]);
```

### Incremental Updates
```javascript
// Only capture changed content
const diff = await compareWithBaseline(url);
if (diff.hasChanges) {
  await captureChanges(diff.changedElements);
}
```

## Monitoring & Reporting

### Success Metrics
- Pages captured: X
- Media assets extracted: Y
- Components generated: Z
- Tests written: N
- Compliance preserved: 100%

### Error Tracking
```javascript
const errors = {
  capture: [],
  transform: [],
  build: []
};

// Log errors for review
if (errors.capture.length > 0) {
  await logToFile('.hos/reports/capture-errors.log', errors.capture);
}
```

## Quick Start Commands

```bash
# 1. Test the system with a single page
"Content capture agent: scrape https://stemregen.co/products/stemregen-release"

# 2. Transform the captured content
"Transform agent: rebrand captured content preserving glassmorphism"

# 3. Build the page
"Builder agent: create Next.js page from transformed content"

# 4. Run visual tests
npx playwright test stemregen.spec.ts

# 5. Review the results
"Show me the generated components for StemRegen"
```

## Advanced Features

### AI-Powered Content Enhancement
```javascript
// Enhance product descriptions
const enhanced = await enhanceWithAI({
  original: productDescription,
  tone: 'scientific-yet-accessible',
  keywords: ['stem cells', 'regeneration', 'peptides']
});
```

### SEO Optimization
```javascript
// Generate SEO-optimized metadata
const seo = {
  title: generateTitle(content),
  description: generateDescription(content),
  keywords: extractKeywords(content),
  schema: generateStructuredData(content)
};
```

### A/B Testing Support
```javascript
// Create variant pages
const variants = {
  a: buildPage(content, 'variant-a'),
  b: buildPage(content, 'variant-b')
};
```

## System Integration Points

1. **Stripe Checkout**: Automatic integration for reseller products
2. **Auth0**: User authentication for protected content
3. **Analytics**: Track conversions from rebranded pages
4. **CMS**: Import content into Sanity/Contentful
5. **CDN**: Automatic media optimization and delivery

## Troubleshooting

### Common Issues
1. **Glassmorphism not preserved**: Check backdrop-filter support
2. **Media not downloading**: Verify CORS settings
3. **Styles not mapping**: Update design system tokens
4. **Components not rendering**: Check TypeScript types
5. **Tests failing**: Update data-testid attributes

### Debug Commands
```bash
# Check capture status
"Show capture log for last session"

# Validate transformation
"Verify compliance preservation in transformed content"

# Test component generation
"Generate test component from sample data"
```

---

**System Status:** Ready for production use
**Last Updated:** 2025-01-15
**Version:** 1.0.0