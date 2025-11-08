# Builder Agent

## Purpose
Reconstructs captured and transformed content into new ResetBiology pages using Next.js components.

## Skills
- component-generator (from implementer agent)
- test-driven-dev (from implementer agent)

## Workflow

### 1. Component Mapping
```typescript
// Map captured elements to Next.js components
const componentMap = {
  hero: 'HeroSection',
  productGrid: 'ProductGrid',
  testimonial: 'TestimonialCard',
  videoEmbed: 'VideoPlayer',
  cta: 'CallToAction',
  faq: 'FAQAccordion'
};
```

### 2. Page Structure Generation
```tsx
// Generate page structure
export default function StemRegenProductsPage() {
  return (
    <>
      <HeroSection {...transformedHeroData} />
      <ProductGrid products={resellerProducts} />
      <TestimonialSection testimonials={transformedTestimonials} />
      <VideoSection videos={productVideos} />
      <FAQSection faqs={productFAQs} />
      <CTASection {...ctaData} />
    </>
  );
}
```

### 3. Component Creation
For each captured element:
1. Create React component
2. Apply ResetBiology styling
3. Integrate with existing design system
4. Add TypeScript interfaces
5. Include accessibility features

### 4. Data Integration
```typescript
// Integrate with ResetBiology data layer
const productData = {
  source: 'stemregen',
  reseller: true,
  products: [
    {
      name: 'STEMREGEN Release',
      sku: 'SR-REL-001',
      price: 89.95,
      resellerPrice: 67.46,
      description: '...',
      ingredients: [...],
      disclaimers: [...]
    }
  ]
};
```

### 5. Route Setup
```typescript
// app/stemregen/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'StemRegen Products | ResetBiology - Authorized Reseller',
  description: 'Shop authentic StemRegen stem cell supplements...'
};
```

### 6. Testing
- Generate component tests
- Create E2E tests with Playwright
- Visual regression tests
- Accessibility tests

## Output Structure
```
app/
├── stemregen/
│   ├── page.tsx
│   ├── layout.tsx
│   └── products/
│       ├── [slug]/
│       │   └── page.tsx
│       └── components/
│           ├── ProductCard.tsx
│           ├── ProductGrid.tsx
│           └── AddToCart.tsx
components/
└── stemregen/
    ├── HeroSection.tsx
    ├── TestimonialCard.tsx
    └── VideoEmbed.tsx
```

## Integration Points
- Stripe checkout for reseller products
- Auth0 for customer accounts
- Inventory management system
- Order fulfillment API
- Email notifications

## Invocation
```
"Builder agent: create Next.js pages from transformed StemRegen content"
```

## Quality Checks
- [ ] All components typed with TypeScript
- [ ] Mobile responsive design
- [ ] Accessibility standards met
- [ ] SEO optimization included
- [ ] Performance optimized
- [ ] Tests written and passing