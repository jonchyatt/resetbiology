---
name: seo-health-optimizer
description: SEO optimizations for health/wellness content, meta tags, structured data for peptides/health topics
category: reset-biology
tags: [seo, health, peptides, wellness]
version: 1.0.0
---

# SEO Health Optimizer

## Purpose
Optimizes SEO for health and wellness content, implements proper meta tags, structured data, and keywords specific to peptides, cellular health, and biohacking topics.

## When to Use
- When adding new health/peptide content pages
- When improving search rankings for wellness keywords
- When implementing structured data for products
- When debugging low organic traffic
- Before launching new content sections

## Validation Checklist

### 1. Meta Tags
- [ ] Title tag (50-60 characters)
- [ ] Meta description (150-160 characters)
- [ ] Open Graph tags (og:title, og:description, og:image)
- [ ] Twitter Card tags
- [ ] Canonical URL

### 2. Structured Data
- [ ] Product schema for peptides
- [ ] Organization schema
- [ ] Article/BlogPosting schema for content
- [ ] FAQPage schema for common questions
- [ ] Review/Rating schema if applicable

### 3. Content Optimization
- [ ] Target keywords in H1
- [ ] Secondary keywords in H2/H3
- [ ] Internal linking to related content
- [ ] Alt text for all images
- [ ] Mobile-friendly formatting

### 4. Technical SEO
- [ ] Fast page load (< 3 seconds)
- [ ] Mobile responsive
- [ ] HTTPS enabled
- [ ] Sitemap.xml includes all pages
- [ ] Robots.txt properly configured

## Health/Peptide-Specific SEO Strategy

### Primary Keywords (High Intent):
- "peptide therapy" (4,400 searches/month)
- "BPC-157 benefits" (3,600 searches/month)
- "thymosin alpha 1" (2,400 searches/month)
- "peptide dosage calculator" (720 searches/month)
- "cellular health optimization" (1,300 searches/month)

### Long-Tail Keywords:
- "how to dose BPC-157"
- "peptide protocol tracking"
- "cellular health supplements"
- "biohacking wellness platform"
- "peptide therapy near me"

### Content Clusters:
1. **Peptide Education Hub**
   - What are peptides?
   - Benefits of peptide therapy
   - Peptide safety and side effects

2. **Protocol Guides**
   - How to dose [specific peptide]
   - Best time to take peptides
   - Stacking peptides safely

3. **Wellness Tracking**
   - Track peptide dosing
   - Monitor cellular health markers
   - Optimize recovery and performance

## Implementation Steps

### Step 1: Add Meta Tags to Pages
```typescript
// Example: Peptide library page
// File: /app/peptides/page.tsx

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Peptide Library - Reset Biology | Track & Optimize Peptide Therapy',
  description: 'Comprehensive peptide library with dosing calculators, protocol tracking, and safety information. Track BPC-157, Thymosin Alpha-1, and more.',
  keywords: [
    'peptide therapy',
    'BPC-157',
    'thymosin alpha 1',
    'peptide dosage',
    'cellular health',
    'biohacking'
  ],
  openGraph: {
    title: 'Peptide Library - Reset Biology',
    description: 'Track and optimize your peptide therapy protocols',
    images: ['/og-peptides.jpg'],
    url: 'https://resetbiology.com/peptides'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peptide Library - Reset Biology',
    description: 'Track and optimize your peptide therapy protocols',
    images: ['/og-peptides.jpg']
  },
  alternates: {
    canonical: 'https://resetbiology.com/peptides'
  }
}
```

### Step 2: Implement Product Structured Data
```typescript
// Add to peptide detail pages
// File: /app/peptides/[id]/page.tsx

export default function PeptidePage({ peptide }) {
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: peptide.name,
    description: peptide.description,
    brand: {
      '@type': 'Organization',
      name: 'Reset Biology'
    },
    offers: {
      '@type': 'Offer',
      price: peptide.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `https://resetbiology.com/peptides/${peptide.id}`
    },
    aggregateRating: peptide.rating ? {
      '@type': 'AggregateRating',
      ratingValue: peptide.rating,
      reviewCount: peptide.reviewCount
    } : undefined
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productSchema)
        }}
      />
      {/* Page content */}
    </>
  )
}
```

### Step 3: Optimize Content Structure
```typescript
// Example: Peptide education page
// File: /app/learn/peptides/page.tsx

export default function PeptidesGuide() {
  return (
    <article>
      {/* H1 - Primary keyword */}
      <h1>Peptide Therapy: Complete Guide to Benefits & Dosing</h1>

      {/* Introduction with target keywords */}
      <p>
        Peptide therapy is emerging as a powerful tool for cellular health
        optimization. Learn how peptides like BPC-157 and Thymosin Alpha-1
        can support recovery, immunity, and longevity.
      </p>

      {/* H2 - Secondary keywords */}
      <h2>What Are Peptides and How Do They Work?</h2>
      <p>...</p>

      <h2>Benefits of Peptide Therapy for Cellular Health</h2>
      <p>...</p>

      <h2>How to Dose Peptides Safely</h2>
      <p>...</p>

      {/* Internal links */}
      <p>
        Ready to start tracking your peptide protocols?
        Visit our <a href="/peptides">Peptide Library</a> to get started.
      </p>
    </article>
  )
}
```

### Step 4: Generate Sitemap
```typescript
// File: /app/sitemap.ts

import { MetadataRoute } from 'next'
import prisma from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all peptides from database
  const peptides = await prisma.product.findMany({
    where: { category: 'peptide' },
    select: { id: true, updatedAt: true }
  })

  // Static pages
  const routes = [
    '',
    '/peptides',
    '/workout',
    '/nutrition',
    '/portal',
    '/about',
    '/learn'
  ].map(route => ({
    url: `https://resetbiology.com${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8
  }))

  // Dynamic peptide pages
  const peptidePages = peptides.map(peptide => ({
    url: `https://resetbiology.com/peptides/${peptide.id}`,
    lastModified: peptide.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6
  }))

  return [...routes, ...peptidePages]
}
```

### Step 5: Add FAQ Structured Data
```typescript
// File: /app/learn/faq/page.tsx

export default function FAQPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is peptide therapy?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Peptide therapy uses short chains of amino acids to support cellular function, recovery, and overall health optimization.'
        }
      },
      {
        '@type': 'Question',
        name: 'How do I dose BPC-157?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'BPC-157 is typically dosed at 250-500mcg once or twice daily, either subcutaneously or orally. Consult with a healthcare provider for personalized guidance.'
        }
      },
      {
        '@type': 'Question',
        name: 'Are peptides safe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most peptides have excellent safety profiles when used properly. Always purchase from reputable sources and follow recommended dosing protocols.'
        }
      }
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema)
        }}
      />
      {/* FAQ content */}
    </>
  )
}
```

## Common Issues & Fixes

### Issue: Low rankings for peptide keywords
**Check:**
1. Are target keywords in H1 and title tag?
2. Is content comprehensive (1,500+ words)?
3. Are there internal links to related pages?

**Fix:**
- Add detailed peptide guides with target keywords
- Create content clusters around peptide topics
- Build internal linking structure

### Issue: Poor mobile performance
**Check:**
1. Run Lighthouse audit
2. Check Core Web Vitals
3. Test on actual mobile devices

**Fix:**
```typescript
// Optimize images
import Image from 'next/image'

<Image
  src="/peptide-image.jpg"
  alt="BPC-157 peptide vial"
  width={600}
  height={400}
  loading="lazy"
  quality={85}
/>
```

### Issue: Duplicate content
**Check:**
1. Verify canonical URLs
2. Check for duplicate product descriptions

**Fix:**
```typescript
// Add canonical tag
export const metadata = {
  alternates: {
    canonical: 'https://resetbiology.com/peptides/bpc-157'
  }
}
```

## Testing Scenarios

### Test 1: Meta Tags Present
```bash
# Check with curl
curl -s https://resetbiology.com/peptides | grep -o '<title>.*</title>'
curl -s https://resetbiology.com/peptides | grep -o '<meta name="description".*>'

# Expected:
# <title>Peptide Library - Reset Biology</title>
# <meta name="description" content="...">
```

### Test 2: Structured Data Valid
```bash
# Use Google's Rich Results Test
# https://search.google.com/test/rich-results
# Paste URL: https://resetbiology.com/peptides/bpc-157

# Expected: Product schema detected, no errors
```

### Test 3: Mobile Performance
```bash
# Run Lighthouse audit
npx lighthouse https://resetbiology.com/peptides --view

# Expected:
# Performance: 90+
# SEO: 100
# Mobile-friendly: Pass
```

## Integration with Existing Code

### Where this skill applies:
- `/app/layout.tsx` - Global meta tags
- `/app/peptides/page.tsx` - Peptide library SEO
- `/app/learn/*` - Educational content SEO
- `/app/sitemap.ts` - Sitemap generation
- `/app/robots.txt` - Crawler instructions

### Add to existing pages:
```typescript
// Example: Add to workout page
export const metadata: Metadata = {
  title: 'Workout Tracker - Reset Biology | Log Exercises & Progress',
  description: 'Track your workouts, log exercises, and monitor progress. Integrated with gamification system for motivation.',
  keywords: ['workout tracker', 'exercise log', 'fitness tracking']
}
```

## Success Criteria
- [ ] All pages have unique meta titles and descriptions
- [ ] Structured data validates without errors
- [ ] Sitemap includes all important pages
- [ ] Mobile performance score 90+
- [ ] Target keywords rank on Google (track with Google Search Console)
- [ ] Organic traffic increases month-over-month

## Related Skills
- `peptide-protocol-validator` - Content relates to peptide pages
- `checkout-flow-tester` - Product pages need good SEO

## Notes
- Focus on E-A-T (Expertise, Authority, Trust) for health content
- Include medical disclaimers on peptide information
- Link to scientific studies when possible
- Update content regularly to maintain freshness
- Monitor Google Search Console for indexing issues
- Consider adding blog for content marketing
