# HOS User Manual for ResetBiology.com
**Complete Reference Guide**
**Last Updated:** November 3, 2025

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Quick Start](#2-quick-start)
3. [Complete Skills Directory](#3-complete-skills-directory)
4. [Agent Directory](#4-agent-directory)
5. [ResetBiology.com Specific Workflows](#5-resetbiologycom-specific-workflows)
6. [Playwright Commands](#6-playwright-commands)
7. [Testing Guide](#7-testing-guide)
8. [Monitoring and Health Checks](#8-monitoring-and-health-checks)
9. [Emergency Procedures](#9-emergency-procedures)
10. [Common Commands Reference](#10-common-commands-reference)
11. [Directory Structure](#11-directory-structure)
12. [Troubleshooting](#12-troubleshooting)
13. [Tips and Best Practices](#13-tips-and-best-practices)

---

## 1. Introduction

### What is HOS?

HOS (Hierarchical Orchestration System) is a token-efficient AI development system designed for ResetBiology.com. It maintains low context usage through silent sub-agent delegation.

**Core Principle:**
```
Main Orchestrator (5% tokens) → Silent Sub-Agents (independent contexts) → Work Completed → No Reports → Orchestrator Stays Low
```

### How It Works

HOS uses **5 specialized agents**, each with specific **skills**, coordinated by a lightweight **orchestrator**:

- **Orchestrator**: Routes requests, stays at 5-10% token usage
- **Agents**: Independent specialists (Architect, Implementer, Design Enforcer, Test Oracle, Observer)
- **Skills**: Reusable capabilities that agents invoke
- **Playwright MCP**: Visual inspection and testing engine

### Token Efficiency Approach

| Component | Token Budget | Strategy |
|-----------|--------------|----------|
| Orchestrator | 10K (5%) | Coordination only, delegates everything |
| Each Agent | 15-20K | Per-session, works silently |
| Total Available | 200K | Agents use independent contexts |

**Key Strategy:** Sub-agents work silently and don't report back unless explicitly requested, keeping orchestrator context perpetually low.

---

## 2. Quick Start

### Daily Morning Commands

Start your development day with a health check:

```bash
"Observer agent: Run morning health check. Report back with summary only."
```

**What this does:**
- Checks site uptime
- Validates critical paths
- Tests mobile responsiveness
- Checks for broken links
- Reports performance metrics
- Identifies overnight issues

### Common Development Workflows

#### Building a New Feature
```bash
# Step 1: Plan architecture
"Architect agent: plan architecture for [feature name]"

# Step 2: Implement with tests
"Implementer agent: build [feature] from architect's plan"

# Step 3: Validate design
"Design-enforcer: audit [page] for compliance"

# Step 4: Comprehensive testing
"Test oracle: run full test suite for [feature]"
```

#### Quick Feature Implementation
```bash
"Use implementer sub-agent to build [feature]. Work silently."
```

#### Testing Existing Features
```bash
"Test-oracle agent: validate [feature] on mobile"
```

### Evening Checkpoint Commands

End your day by saving system state:

```bash
"Create checkpoint of current state."
```

**What this saves:**
- System state snapshot
- Agent statuses
- Recent activities
- Token usage statistics

**Location:** `.hos/orchestrator/checkpoints/YYYY-MM-DD-HHmm-checkpoint.json`

---

## 3. Complete Skills Directory

### Note on Skills

Skills are currently in **Phase 0 implementation**. The HOS system does not yet have a dedicated `/skills/` directory with individual skill files. Instead, agents have **documented capabilities** that serve as their "skills."

Below is the **complete list of agent capabilities** organized by agent, which function as the skill system.

---

### Architect Agent Skills

#### system-design

**Description:** Analyzes patterns and proposes architectures for new features

**Capabilities:**
- Reviews architectural proposals
- Maintains decision records
- Ensures pattern consistency
- Guides technical direction
- Prevents architectural drift
- Validates against existing patterns

**Agents That Can Use:** Architect only

**Usage Example:**
```bash
"Architect: evaluate this approach against existing patterns"
```

**Required Tools:**
- Read (for analyzing existing code)
- Grep (for pattern searching)
- Glob (for finding related files)

---

### Implementer Agent Skills

#### code-generator

**Description:** Creates production-ready code following ResetBiology.com patterns

**Capabilities:**
- Generates Next.js components
- Creates API routes
- Implements database models
- Follows TypeScript best practices
- Applies Tailwind CSS styling
- Integrates with Auth0, Stripe, MongoDB

**Agents That Can Use:** Implementer only

**Usage Example:**
```bash
"Implementer: build [component] with tests"
```

**Required Tools:**
- Read (for understanding context)
- Write (for creating files)
- Edit (for modifying files)

#### test-driven-dev

**Description:** Ensures TDD workflow for all implementations

**Capabilities:**
- Writes failing tests first
- Implements minimal code to pass
- Refactors for quality
- Maintains 100% test coverage for new code
- Creates comprehensive test suites

**Agents That Can Use:** Implementer only

**Usage Example:**
```bash
"Implementer agent: implement [feature] with TDD approach"
```

**Required Tools:**
- Write (for test files)
- Bash (for running tests)

---

### Design Enforcer Agent Skills

#### style-validator

**Description:** Checks design system compliance

**Capabilities:**
- Validates color usage (#3FBFB5 primary, #72C247 secondary)
- Checks typography consistency
- Verifies spacing patterns
- Validates component usage
- Ensures brand consistency

**Agents That Can Use:** Design Enforcer only

**Usage Example:**
```bash
"Design-enforcer: audit [page] for compliance"
```

**Required Tools:**
- Read (for component analysis)
- Grep (for finding color usage)

#### accessibility-scanner

**Description:** Validates WCAG 2.1 AA compliance

**Capabilities:**
- Checks color contrast ratios
- Validates semantic HTML
- Verifies ARIA labels
- Tests keyboard navigation
- Validates form accessibility
- Checks alt text for images

**Agents That Can Use:** Design Enforcer only

**Usage Example:**
```bash
"Design enforcer agent: check accessibility of [component]"
```

**Required Tools:**
- Playwright (for accessibility testing)
- Read (for code analysis)

---

### Test Oracle Agent Skills

#### test-generator

**Description:** Creates comprehensive test suites

**Capabilities:**
- Generates unit tests
- Creates integration tests
- Writes E2E tests with Playwright
- Creates visual regression tests
- Tests all critical paths

**Agents That Can Use:** Test Oracle only

**Usage Example:**
```bash
"Test oracle: generate test suite for [feature]"
```

**Required Tools:**
- Write (for test files)
- Bash (for running tests)

#### edge-case-finder

**Description:** Identifies boundary conditions and edge cases

**Capabilities:**
- Analyzes input validation requirements
- Identifies null/undefined scenarios
- Tests boundary values
- Validates error handling
- Checks timeout scenarios
- Tests race conditions

**Agents That Can Use:** Test Oracle only

**Usage Example:**
```bash
"Test-oracle: identify edge cases for [feature]"
```

**Required Tools:**
- Read (for code analysis)
- Grep (for finding validation logic)

---

### Observer Agent Skills

#### pattern-recognition

**Description:** Finds patterns and inefficiencies in codebase

**Capabilities:**
- Detects code duplication
- Identifies performance bottlenecks
- Finds improvement opportunities
- Analyzes UX patterns
- Discovers mobile issues

**Agents That Can Use:** Observer only

**Usage Example:**
```bash
"Observer: analyze for improvement opportunities"
```

**Required Tools:**
- Read (for code analysis)
- Grep (for pattern searching)
- Glob (for finding files)

#### health-monitor

**Description:** Tracks site health and performance

**Capabilities:**
- Monitors uptime (hourly)
- Tracks API response times
- Measures page performance
- Monitors error rates
- Generates daily reports

**Agents That Can Use:** Observer only

**Usage Example:**
```bash
"Observer: morning health check"
```

**Required Tools:**
- Playwright (for site testing)
- Bash (for running checks)

---

### Shared Skills (Multi-Agent)

#### playwright-vision

**Description:** Visual inspection and testing using Playwright

**Capabilities:**
- Captures screenshots across devices
- Tests responsive design
- Validates element visibility
- Performs visual regression testing
- Checks cross-browser compatibility

**Agents That Can Use:** Implementer, Design Enforcer, Test Oracle, Observer

**Usage Example:**
```bash
"Test oracle: validate [page] visual appearance on mobile"
```

**Required Tools:**
- Bash (to run Playwright commands)

**Playwright Script Locations:**
- `.hos/tests/playwright/critical-paths.spec.ts`
- `.hos/tests/playwright/mobile.spec.ts`
- `.hos/tests/playwright/checkout.spec.ts`
- `.hos/tests/visual/regression.spec.ts`

#### link-validator

**Description:** Validates all internal and external links

**Capabilities:**
- Checks internal navigation
- Validates external URLs
- Tests API endpoints
- Identifies broken links
- Checks redirect chains

**Agents That Can Use:** Test Oracle, Observer

**Usage Example:**
```bash
"Test oracle: validate all links on site"
```

**Required Tools:**
- Playwright (for navigation testing)

#### responsive-tester

**Description:** Cross-device validation

**Capabilities:**
- Tests on mobile viewports (iPhone 12, Pixel 7)
- Tests on tablet viewports (iPad Pro)
- Tests on desktop (1920x1080)
- Validates touch targets
- Checks viewport-specific styles

**Agents That Can Use:** Design Enforcer, Test Oracle

**Usage Example:**
```bash
"Design-enforcer: check responsive behavior of [component]"
```

**Required Tools:**
- Playwright (for device emulation)

---

### ResetBiology-Specific Skills

#### reset-biology-link-validator

**Description:** Validates links specific to ResetBiology.com structure

**Capabilities:**
- Tests marketing site navigation
- Validates portal links
- Checks store product links
- Tests Auth0 login flow links
- Validates assessment flow
- Checks breath training app links

**Agents That Can Use:** Test Oracle, Observer

**Usage Example:**
```bash
"Test oracle: validate all ResetBiology navigation"
```

**Required Tools:**
- Playwright (for testing)

**Critical Paths to Validate:**
- `/` → `/store` → `/order`
- `/` → `/portal` (requires Auth0 login)
- `/portal` → `/peptides`, `/nutrition`, `/workout`, `/journal`
- `/store` → individual product pages
- `/assessment` → IRB handoff flow

#### reset-biology-seo-optimizer

**Description:** SEO analysis and optimization for biology content

**Capabilities:**
- Analyzes keyword usage
- Validates meta tags
- Checks schema.org markup
- Tests Open Graph tags
- Validates canonical URLs
- Analyzes content structure

**Agents That Can Use:** Observer

**Usage Example:**
```bash
"Observer: generate SEO report for [page]"
```

**Required Tools:**
- Read (for meta tag analysis)
- Grep (for finding SEO elements)
- Playwright (for runtime SEO testing)

**Key SEO Elements to Check:**
- Title tags (unique per page)
- Meta descriptions
- H1/H2/H3 hierarchy
- Alt text for images
- Internal linking structure

#### reset-biology-checkout-validator

**Description:** Validates Stripe checkout flow end-to-end

**Capabilities:**
- Tests cart functionality
- Validates checkout form
- Tests Stripe test cards
- Validates order confirmation
- Tests email notifications
- Checks order tracking

**Agents That Can Use:** Test Oracle

**Usage Example:**
```bash
"Test oracle: check checkout flow"
```

**Required Tools:**
- Playwright (for E2E testing)

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- Requires Auth: `4000 0025 0000 3155`

**Test Scenarios:**
- Add product to cart → Checkout → Payment → Confirmation
- Empty cart validation
- Invalid card handling
- Successful payment webhook processing

---

### Meta Skills

#### skill-creator

**Description:** Meta-skill that creates other skills

**Capabilities:**
- Analyzes requirements for new skills
- Generates skill specifications
- Creates skill implementation files
- Writes skill documentation
- Integrates skills with agents

**Agents That Can Use:** Orchestrator (for system expansion)

**Usage Example:**
```bash
"Create new skill for [capability]"
```

**Note:** This skill is for future expansion of the HOS system.

---

## 4. Agent Directory

### Architect Agent

**Purpose:** Architectural guardian for ResetBiology.com. Ensures all new features align with established patterns and maintains system consistency.

**Skills Available:**
- system-design

**How to Invoke:**
```bash
"Architect agent: plan architecture for [feature]"
"Architect: evaluate this approach against existing patterns"
```

**When to Use:**
- Planning new features
- Evaluating architectural decisions
- Maintaining pattern consistency
- Reviewing technical direction
- Preventing architectural drift

**Responsibilities:**
1. Review all architectural proposals
2. Maintain decision records
3. Ensure pattern consistency
4. Guide technical direction
5. Prevent architectural drift

**Knowledge Sources:**
- `.hos/memory/knowledge/patterns.md` - Code patterns
- `.hos/memory/knowledge/tech-stack.md` - Technology documentation
- `.hos/memory/knowledge/discovered-vision.md` - Site vision
- Next.js 15 and React 19 best practices

---

### Implementer Agent

**Purpose:** Implements approved features using test-driven development, ensuring quality and consistency with ResetBiology.com patterns.

**Skills Available:**
- code-generator
- test-driven-dev
- playwright-vision

**How to Invoke:**
```bash
"Implementer: build [feature] from architect's plan"
"Implementer agent: implement [component] with tests"
```

**When to Use:**
- Building new features
- Creating components
- Implementing API routes
- Adding database models
- Writing tests

**Workflow:**
1. Pull task from approved queue
2. Create feature branch (optional)
3. Write failing tests (TDD)
4. Implement feature
5. Verify tests pass
6. Run full test suite
7. Create PR with comprehensive description (if requested)
8. Await approval

**Quality Standards:**
- 100% test coverage for new code
- No breaking changes to existing features
- Follow ResetBiology.com conventions
- Comprehensive documentation

---

### Design Enforcer Agent

**Purpose:** Ensures every page and component follows ResetBiology.com design system and accessibility standards.

**Skills Available:**
- style-validator
- accessibility-scanner
- playwright-vision
- responsive-tester

**How to Invoke:**
```bash
"Design-enforcer: audit [page] for compliance"
"Design enforcer agent: check accessibility of [component]"
```

**When to Use:**
- Validating new UI components
- Checking design consistency
- Ensuring accessibility compliance
- Testing responsive design
- Verifying brand consistency

**What It Checks:**
1. Color usage (Primary: #3FBFB5, Secondary: #72C247)
2. Typography consistency
3. Spacing patterns
4. Component usage
5. Accessibility (WCAG 2.1 AA)
6. Responsive behavior
7. Brand consistency

**Violation Handling:**
- Logs violations with severity
- Suggests fixes
- Blocks deployment for critical issues (if configured)
- Generates compliance reports

---

### Test Oracle Agent

**Purpose:** Orchestrates comprehensive testing across all ResetBiology.com features and devices.

**Skills Available:**
- test-generator
- edge-case-finder
- playwright-vision
- link-validator
- reset-biology-checkout-validator

**How to Invoke:**
```bash
"Test oracle: run full test suite"
"Test-oracle agent: validate [feature] on mobile"
"Test oracle: check checkout flow"
```

**When to Use:**
- Running comprehensive test suites
- Validating new features
- Testing across devices
- Checking critical paths
- Visual regression testing

**Testing Coverage:**

**Critical Paths:**
1. Auth0 authentication flow
2. Peptide protocol selection and tracking
3. Nutrition tracking and macros
4. Workout session logging
5. Breath training exercises
6. Store browsing and checkout

**Device Coverage:**
- Mobile: iPhone 12, Pixel 7
- Tablet: iPad Pro
- Desktop: 1920x1080

**Test Types:**
- Unit tests
- Integration tests
- E2E tests
- Visual regression
- Accessibility tests
- Performance tests
- Mobile-specific tests

---

### Observer Agent

**Purpose:** Continuously monitors ResetBiology.com, identifies patterns, and suggests improvements.

**Skills Available:**
- pattern-recognition
- health-monitor
- playwright-vision
- reset-biology-seo-optimizer

**How to Invoke:**
```bash
"Observer: morning health check"
"Observer agent: analyze for improvement opportunities"
"Observer: generate daily report"
```

**When to Use:**
- Daily morning health checks
- Identifying improvement opportunities
- Monitoring site health
- Generating reports
- SEO analysis

**What It Monitors:**

**Health Metrics:**
- Site uptime (hourly)
- API response times
- Page performance
- Error rates

**Improvement Opportunities:**
- Code duplication
- Performance bottlenecks
- SEO improvements
- UX enhancements
- Mobile issues

**Daily Reports:**
- Health status
- Test results
- Performance metrics
- Improvement suggestions
- Action items

---

## 5. ResetBiology.com Specific Workflows

### Adding New Biology Content

**Workflow for creating new articles or content pages:**

```bash
# Step 1: Plan content structure
"Architect agent: plan architecture for new biology article on [topic]"

# Step 2: Implement content page
"Implementer agent: create new content page at /app/[path]/page.tsx"

# Step 3: Optimize for SEO
"Observer: generate SEO recommendations for [new page]"

# Step 4: Validate accessibility and design
"Design-enforcer: audit [new page] for compliance"

# Step 5: Test across devices
"Test oracle: validate [new page] on mobile and desktop"
```

**Key Considerations:**
- Use semantic HTML (h1, h2, h3 hierarchy)
- Include meta descriptions (150-160 characters)
- Add schema.org markup for medical content
- Optimize images with alt text
- Internal linking to related content
- Mobile-first responsive design

**Citation Validation:**
- Ensure all medical claims have citations
- Link to peer-reviewed sources
- Use consistent citation format
- Validate external links are working

**Content Review Process:**
1. Medical accuracy check
2. SEO optimization
3. Accessibility validation
4. Mobile testing
5. Performance check

---

### Testing Checkout Flows

**Complete checkout testing workflow:**

```bash
# Step 1: Test basic cart functionality
"Test oracle: validate cart add/remove functionality"

# Step 2: Test full checkout flow
"Test oracle: check checkout flow with Stripe test cards"

# Step 3: Validate order confirmation
"Test oracle: verify order confirmation and email"

# Step 4: Check mobile checkout
"Test-oracle agent: validate checkout on mobile devices"
```

**Stripe Test Cards to Use:**

| Scenario | Card Number | CVV | Expiry |
|----------|-------------|-----|--------|
| Success | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Declined | 4000 0000 0000 0002 | Any 3 digits | Any future date |
| Requires Auth | 4000 0025 0000 3155 | Any 3 digits | Any future date |

**Order Validation Checklist:**
- [ ] Product added to cart
- [ ] Cart displays correct total
- [ ] Checkout form loads
- [ ] Stripe Elements render
- [ ] Payment processes successfully
- [ ] Order confirmation displays
- [ ] Confirmation email sent
- [ ] Order appears in admin panel
- [ ] Inventory updated (if applicable)

**Email Confirmation Testing:**
- Use test email addresses
- Verify email template renders correctly
- Check all links in email work
- Test mobile email display

---

### Mobile Testing Procedures

**Complete mobile testing workflow:**

```bash
# Step 1: Run mobile test suite
"Test oracle: run mobile test suite"

# Step 2: Validate touch targets
"Design-enforcer: check touch target sizes on [page]"

# Step 3: Test responsive design
"Design-enforcer: validate responsive behavior on all breakpoints"

# Step 4: Visual regression on mobile
"Test oracle: capture mobile screenshots for visual baseline"
```

**How to Test on iPhone/Android:**

**Using Playwright (Automated):**
```bash
npx playwright test .hos/tests/playwright/mobile.spec.ts --headed
```

**Device Emulation Settings:**
- iPhone 12: 390x844, 3x pixel ratio
- Pixel 7: 412x915, 2.625x pixel ratio
- iPad Pro: 1024x1366, 2x pixel ratio

**Touch Target Validation:**
- Minimum size: 44x44 pixels (iOS guideline)
- Recommended: 48x48 pixels (Material Design)
- Adequate spacing between targets

**Responsive Design Checks:**
- [ ] Navigation menu (hamburger on mobile)
- [ ] Text readability (minimum 16px on mobile)
- [ ] Forms usable on small screens
- [ ] Images scale appropriately
- [ ] Tables responsive or scroll horizontally
- [ ] Modals fit viewport
- [ ] Footer content accessible

**Common Mobile Issues to Check:**
- Horizontal scrolling (should be none)
- Text too small to read
- Buttons too small to tap
- Content hidden off-screen
- Modals taller than viewport

---

### Performance Optimization

**Performance audit and optimization workflow:**

```bash
# Step 1: Run performance audit
"Observer: generate performance report for [page]"

# Step 2: Identify bottlenecks
"Observer: analyze for performance bottlenecks"

# Step 3: Implement fixes
"Implementer agent: optimize [identified issue]"

# Step 4: Verify improvements
"Test oracle: measure performance improvement for [page]"
```

**Key Performance Metrics:**
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3.8s

**Common Optimizations:**

**Image Optimization:**
- Use Next.js Image component
- WebP format for modern browsers
- Lazy loading for below-fold images
- Proper sizing (srcset)

**Code Splitting:**
- Dynamic imports for large components
- Route-based code splitting (automatic in Next.js)
- Lazy load third-party scripts

**Database Query Optimization:**
- Add indexes for frequently queried fields
- Use `select` to limit returned fields
- Batch queries when possible
- Implement caching for static data

**Asset Optimization:**
- Minify CSS/JS (automatic in production)
- Remove unused CSS (Tailwind purge)
- Compress images
- Use CDN for static assets (Vercel Edge)

---

### SEO Improvements

**SEO optimization workflow:**

```bash
# Step 1: Generate SEO audit
"Observer: generate SEO report for entire site"

# Step 2: Analyze keywords
"Observer: analyze keyword usage for [topic]"

# Step 3: Implement optimizations
"Implementer agent: implement SEO improvements for [page]"

# Step 4: Validate changes
"Observer: verify SEO improvements"
```

**Keyword Analysis:**
- Target 1-2 primary keywords per page
- Use long-tail keywords for content
- Natural keyword density (avoid stuffing)
- Include keywords in: title, H1, first paragraph, meta description

**Meta Tag Optimization:**

**Essential Meta Tags:**
```html
<title>Page Title - ResetBiology</title>
<meta name="description" content="150-160 character description" />
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- Open Graph -->
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Description" />
<meta property="og:image" content="https://resetbiology.com/og-image.jpg" />
<meta property="og:url" content="https://resetbiology.com/page" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Description" />
```

**Schema.org Markup:**

For medical/health content:
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "name": "Page Title",
  "description": "Page description",
  "mainEntity": {
    "@type": "MedicalEntity",
    "name": "Topic"
  }
}
```

**Internal Linking Strategy:**
- Link to related content
- Use descriptive anchor text
- Maintain 2-3 clicks from homepage to any page
- Create content hubs for major topics

**Technical SEO Checklist:**
- [ ] Canonical URLs set correctly
- [ ] XML sitemap exists and submitted
- [ ] robots.txt properly configured
- [ ] HTTPS enabled (via Vercel)
- [ ] Mobile-friendly (responsive design)
- [ ] Page speed optimized
- [ ] Structured data implemented
- [ ] Alt text on all images

---

## 6. Playwright Commands

### Basic Playwright Operations

**Running Tests:**

```bash
# Run all tests
npx playwright test .hos/tests/

# Run specific test file
npx playwright test .hos/tests/playwright/critical-paths.spec.ts

# Run with UI (interactive mode)
npx playwright test .hos/tests/ --ui

# Run with headed browser (see browser)
npx playwright test .hos/tests/ --headed

# Debug a specific test
npx playwright test .hos/tests/playwright/checkout.spec.ts --debug
```

**Test-Specific Commands:**

```bash
# Critical paths only
npx playwright test .hos/tests/playwright/critical-paths.spec.ts

# Mobile tests only
npx playwright test .hos/tests/playwright/mobile.spec.ts

# Checkout tests only
npx playwright test .hos/tests/playwright/checkout.spec.ts

# Visual regression only
npx playwright test .hos/tests/visual/regression.spec.ts
```

---

### Taking Screenshots

**Capturing Visual Baseline:**

```bash
# Capture baseline for all pages
node .hos/scripts/capture-baseline.js

# Or TypeScript version
npx ts-node .hos/scripts/capture-baseline.ts
```

**What Gets Captured:**
- 11 pages × 3 viewports = 33 screenshots
- Viewports: mobile (375x667), tablet (768x1024), desktop (1920x1080)
- Saved to: `.hos/memory/visual/screenshots/baseline/`
- Metadata: `.hos/memory/visual/index.json`

**Manual Screenshot in Tests:**

```typescript
// In a Playwright test
await page.screenshot({ path: 'screenshot.png' });

// Full page screenshot
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// Screenshot specific element
await page.locator('#element').screenshot({ path: 'element.png' });
```

---

### Testing Responsive Design

**Using Playwright Device Emulation:**

```typescript
// In a test file
import { test, devices } from '@playwright/test';

test('responsive test', async ({ browser }) => {
  // iPhone 12
  const iphone = await browser.newContext({
    ...devices['iPhone 12']
  });
  const page = await iphone.newPage();
  await page.goto('http://localhost:3000');
  // Test mobile version

  // Desktop
  const desktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto('http://localhost:3000');
  // Test desktop version
});
```

**Available Device Presets:**
- 'iPhone 12'
- 'iPhone 12 Pro'
- 'Pixel 7'
- 'iPad Pro'
- 'Desktop Chrome'
- And many more...

---

### Validating Links

**Link Validation Example:**

```typescript
import { test, expect } from '@playwright/test';

test('validate all links', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Get all links
  const links = await page.locator('a').all();

  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && href.startsWith('http')) {
      const response = await page.request.get(href);
      expect(response.status()).toBeLessThan(400);
    }
  }
});
```

---

### Checking Accessibility

**Accessibility Testing with Playwright:**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility scan', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

**Note:** Requires `@axe-core/playwright` package (not currently installed).

---

### Visual Regression Testing

**Running Visual Regression:**

```bash
# Capture current state and compare to baseline
npx playwright test .hos/tests/visual/regression.spec.ts
```

**How It Works:**
1. Loads each page
2. Takes screenshot
3. Compares to baseline screenshot
4. Reports differences with percentage

**Updating Baseline (After Intentional Changes):**

```bash
# Recapture baseline
node .hos/scripts/capture-baseline.js

# Commit new baseline
git add .hos/memory/visual/
git commit -m "chore: update visual baseline"
```

---

## 7. Testing Guide

### Running All Tests

**Complete Test Suite:**

```bash
# All HOS tests
npx playwright test .hos/tests/

# With HTML report
npx playwright test .hos/tests/ --reporter=html

# With trace (for debugging)
npx playwright test .hos/tests/ --trace=on
```

---

### Running Specific Test Suites

**Critical Path Tests:**
```bash
npx playwright test .hos/tests/playwright/critical-paths.spec.ts
```

**What's Tested:**
- Marketing site navigation
- User registration flow
- Login with Auth0
- Portal access
- Peptide selection
- Basic functionality

---

**Mobile Tests:**
```bash
npx playwright test .hos/tests/playwright/mobile.spec.ts
```

**What's Tested:**
- Responsive layouts
- Touch interactions
- Mobile-specific UI
- Performance on mobile

---

**Checkout Tests:**
```bash
npx playwright test .hos/tests/playwright/checkout.spec.ts
```

**What's Tested:**
- Cart management
- Checkout flow
- Stripe payment processing
- Order confirmation

---

**Visual Regression Tests:**
```bash
npx playwright test .hos/tests/visual/regression.spec.ts
```

**What's Tested:**
- Screenshots match baseline
- No accidental style changes
- Visual consistency maintained

---

### Interpreting Test Results

**Success Output:**
```
Running 15 tests using 3 workers
  ✓ [chromium] › critical-paths.spec.ts:3:1 › homepage loads (1.2s)
  ✓ [chromium] › critical-paths.spec.ts:7:1 › portal accessible (2.5s)
  ...

15 passed (23.4s)
```

**Failure Output:**
```
Running 15 tests using 3 workers
  ✗ [chromium] › checkout.spec.ts:10:1 › checkout flow › payment succeeds (5.2s)

  Error: expect(received).toBe(expected)

  Expected: "Order Confirmed"
  Received: "Payment Failed"

  at path/to/test.spec.ts:25:30
```

**Viewing HTML Report:**
```bash
npx playwright show-report
```

**Viewing Traces (for failed tests):**
```bash
npx playwright show-trace trace.zip
```

---

### Updating Visual Baselines

**When to Update:**
- After intentional design changes
- After updating component styles
- After adding new pages
- After changing layouts

**How to Update:**

```bash
# Step 1: Review changes to ensure they're intentional
npx playwright test .hos/tests/visual/regression.spec.ts

# Step 2: If changes are correct, recapture baseline
node .hos/scripts/capture-baseline.js

# Step 3: Re-run tests to verify
npx playwright test .hos/tests/visual/regression.spec.ts

# Step 4: Commit new baseline
git add .hos/memory/visual/
git commit -m "chore: update visual baseline after [change description]"
```

---

## 8. Monitoring and Health Checks

### Daily Health Check Commands

**Morning Routine:**

```bash
"Observer agent: Run morning health check. Report back with summary only."
```

**What's Checked:**
- Site uptime (https://resetbiology.com)
- Critical path availability
- API endpoint responses
- Mobile responsiveness
- Link integrity
- Performance metrics

**Expected Output:**
```
Health Check Summary:
✓ Site Status: Online
✓ Critical Paths: All passing
✓ API Endpoints: 45/45 responding
✓ Mobile Tests: Passed
✓ Broken Links: None found
⚠ Performance: LCP 3.2s (target: <2.5s)

Action Items:
1. Optimize images on homepage to improve LCP
```

---

### Performance Monitoring

**Generate Performance Report:**

```bash
"Observer: generate performance report for [page]"
```

**Metrics Tracked:**
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- First Contentful Paint (FCP)

**Using Lighthouse (Manual):**

```bash
# Install Lighthouse globally
npm install -g lighthouse

# Run audit on production
lighthouse https://resetbiology.com --view

# Run on specific page
lighthouse https://resetbiology.com/portal --view
```

---

### Error Tracking

**Current Setup:**
- Console.error statements throughout codebase (282 instances)
- No centralized error tracking service

**Recommended Setup (Future):**
- Sentry for error tracking
- Vercel Analytics for performance
- Custom error logging to database

**Manual Error Checking:**

```bash
# Check browser console
# Open DevTools → Console → Filter by "Error"

# Check Vercel logs (if deployed)
# Visit Vercel dashboard → Select project → Logs
```

---

### Uptime Validation

**Manual Uptime Check:**

```bash
# Using curl
curl -I https://resetbiology.com

# Expected: HTTP/2 200
```

**Automated Uptime Monitoring:**

```bash
"Observer: check site uptime"
```

**Recommended External Service (Future):**
- UptimeRobot (free tier available)
- Pingdom
- StatusCake

---

## 9. Emergency Procedures

### Rollback

**When to Rollback:**
- Deployment caused critical bug
- Site is down or broken
- Data corruption detected
- Security vulnerability introduced

**Rollback on Vercel:**

```bash
# Via Vercel CLI
vercel rollback

# Or via Vercel dashboard:
# 1. Go to Deployments
# 2. Find previous working deployment
# 3. Click "..." menu
# 4. Select "Promote to Production"
```

**Restore from Checkpoint:**

```bash
# Find latest checkpoint
ls .hos/orchestrator/checkpoints/

# Restore system state
"Restore system from checkpoint [date-time]"
```

**Database Rollback (MongoDB Atlas):**
- Use Point-in-Time Recovery (if enabled)
- Or restore from backup snapshot
- Contact MongoDB Atlas support if needed

---

### Health Check

**System Status Check:**

```bash
"Observer agent: Run emergency health check. Report all issues immediately."
```

**Manual System Status:**

```bash
# Check dev server
npm run dev
# Expected: Server starts on http://localhost:3000

# Check database connection
npx prisma db push
# Expected: Database connection successful

# Check build
npm run build
# Expected: Build completes without errors

# Check environment variables
npx tsx scripts/verify-auth-env.ts
# Expected: All required env vars present
```

**Agent Status Verification:**

```bash
"Verify all agents are operational and report their status."
```

**Expected Output:**
```
Agent Status:
✓ Architect: Ready
✓ Implementer: Ready
✓ Design Enforcer: Ready
✓ Test Oracle: Ready
✓ Observer: Ready
```

---

### Debug Procedures

**Common Issues and Solutions:**

#### Issue: Dev Server Won't Start

**Symptoms:**
- `npm run dev` fails
- Port 3000 already in use
- Module not found errors

**Solutions:**
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for syntax errors
npx tsc --noEmit
```

---

#### Issue: Playwright Errors

**Symptoms:**
- "Browser not found"
- "Cannot connect to browser"
- Tests timing out

**Solutions:**
```bash
# Reinstall Playwright browsers
npx playwright install

# Check Playwright version
npx playwright --version

# Run with debug output
DEBUG=pw:* npx playwright test
```

---

#### Issue: Test Failures

**Symptoms:**
- Tests fail inconsistently
- Visual regression shows differences
- Authentication tests fail

**Solutions:**
```bash
# Run single test to isolate
npx playwright test .hos/tests/playwright/critical-paths.spec.ts --debug

# Check if dev server is running
curl http://localhost:3000

# Update visual baseline if intentional
node .hos/scripts/capture-baseline.js

# Check Auth0 credentials
npx tsx scripts/verify-auth-env.ts
```

---

#### Issue: Agent Invocation Issues

**Symptoms:**
- Agent doesn't respond
- Token usage too high
- Unexpected behavior

**Solutions:**
```bash
# Create checkpoint and restart
"Create checkpoint of current state."
# Then start new session

# Verify agent configuration
cat .hos/agents/[agent-name]/config.yaml

# Check orchestrator state
cat .hos/orchestrator/state.json
```

---

### Log File Locations

**Application Logs:**
- Browser console (DevTools)
- Vercel deployment logs (Vercel dashboard)
- Local terminal output (when running dev server)

**HOS System Logs:**
- `.hos/orchestrator/state.json` - Current system state
- `.hos/orchestrator/checkpoints/` - Historical checkpoints
- `.hos/memory/conversations/` - Agent conversation logs (future)

**Test Logs:**
- `.hos/tests/results/` - Test output
- `playwright-report/` - HTML test reports
- `test-results/` - Trace files and screenshots

**Database Logs:**
- MongoDB Atlas logs (via Atlas dashboard)
- Prisma query logs (console output when debugging)

---

### Error Troubleshooting

**Database Connection Errors:**

```bash
# Test connection
npx prisma db push

# Check connection string
echo $DATABASE_URL

# Verify MongoDB Atlas access
# 1. Check IP whitelist in Atlas
# 2. Verify password hasn't expired
# 3. Check cluster is running
```

**Auth0 Errors:**

```bash
# Verify credentials
npx tsx scripts/verify-auth-env.ts

# Check Auth0 dashboard
# 1. Verify application is enabled
# 2. Check allowed callback URLs
# 3. Verify client secret is correct
```

**Stripe Errors:**

```bash
# Check webhook secret
# Verify in Stripe dashboard → Developers → Webhooks

# Test with Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Verify API keys (test vs. live mode)
```

---

## 10. Common Commands Reference

### Quick Reference Table

| Command | Description |
|---------|-------------|
| `"Observer: morning health check"` | Daily health check with summary |
| `"Architect: plan architecture for [feature]"` | Plan new feature architecture |
| `"Implementer: build [feature]"` | Implement feature with TDD |
| `"Design-enforcer: audit [page]"` | Check design compliance |
| `"Test oracle: run full test suite"` | Run all tests |
| `"Observer: generate daily report"` | Daily insights and suggestions |
| `"Create checkpoint of current state"` | Save system state |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npx playwright test .hos/tests/` | Run all Playwright tests |
| `node .hos/scripts/capture-baseline.js` | Capture visual baseline |
| `npx prisma db push` | Sync database schema |
| `vercel --prod` | Deploy to production |

---

### Agent Invocations

**Architect:**
```bash
"Architect agent: plan architecture for [feature]"
"Architect: evaluate this approach against existing patterns"
"Architect: review this design decision"
```

**Implementer:**
```bash
"Implementer: build [feature] from architect's plan"
"Implementer agent: implement [component] with tests"
"Use implementer sub-agent to build [feature]. Work silently."
```

**Design Enforcer:**
```bash
"Design-enforcer: audit [page] for compliance"
"Design enforcer agent: check accessibility of [component]"
"Design-enforcer: validate responsive behavior"
```

**Test Oracle:**
```bash
"Test oracle: run full test suite"
"Test-oracle agent: validate [feature] on mobile"
"Test oracle: check checkout flow"
"Test oracle: generate test suite for [feature]"
```

**Observer:**
```bash
"Observer: morning health check"
"Observer agent: analyze for improvement opportunities"
"Observer: generate daily report"
"Observer: generate SEO report"
```

---

### Test Commands

```bash
# All tests
npx playwright test .hos/tests/

# Specific suites
npx playwright test .hos/tests/playwright/critical-paths.spec.ts
npx playwright test .hos/tests/playwright/mobile.spec.ts
npx playwright test .hos/tests/playwright/checkout.spec.ts
npx playwright test .hos/tests/visual/regression.spec.ts

# Interactive modes
npx playwright test .hos/tests/ --ui
npx playwright test .hos/tests/ --headed
npx playwright test .hos/tests/ --debug

# Reports
npx playwright show-report
```

---

### Monitoring Commands

```bash
# Health checks
"Observer: morning health check"
"Observer: check site uptime"

# Performance
"Observer: generate performance report for [page]"
lighthouse https://resetbiology.com --view

# Link validation
"Test oracle: validate all links on site"
```

---

### Maintenance Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm start                      # Run production build locally

# Database
npx prisma generate            # Generate Prisma client
npx prisma db push             # Sync schema to database
npx prisma studio              # Open Prisma Studio GUI

# Deployment
vercel                         # Deploy preview
vercel --prod                  # Deploy to production
vercel rollback                # Rollback deployment

# Testing
node .hos/scripts/capture-baseline.js    # Capture visual baseline
npx playwright install         # Install browsers
```

---

## 11. Directory Structure

### Project Root

```
C:\Users\jonch\reset-biology-website\
├── .hos/                          # HOS system (this manual)
├── app/                           # Next.js App Router pages
├── src/                           # React components and utilities
├── prisma/                        # Database schema
├── public/                        # Static assets
├── .git/                          # Git repository
├── node_modules/                  # Dependencies
├── package.json                   # npm configuration
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── next.config.js                 # Next.js configuration
├── .env.local                     # Environment variables
└── README.md                      # Project readme
```

---

### HOS System Structure

```
.hos/
├── QUICKSTART.md              # Quick start guide
├── STATUS.md                  # Implementation status
├── orchestrator/              # Orchestrator configuration
│   ├── main.md                # Orchestrator documentation
│   ├── config.json            # System configuration
│   ├── state.json             # Current state
│   └── checkpoints/           # State snapshots
├── agents/                    # Agent configurations
│   ├── architect/
│   │   ├── agent.md           # Agent documentation
│   │   └── config.yaml        # Agent configuration
│   ├── implementer/
│   ├── design-enforcer/
│   ├── test-oracle/
│   └── observer/
├── memory/                    # System memory
│   ├── visual/
│   │   ├── screenshots/
│   │   │   └── baseline/      # Visual baseline images
│   │   └── index.json         # Screenshot metadata
│   ├── knowledge/             # Site analysis
│   │   ├── discovered-vision.md
│   │   ├── patterns.md
│   │   ├── tech-stack.md
│   │   └── pain-points.md
│   └── conversations/         # Agent logs (future)
├── tests/                     # Test infrastructure
│   ├── playwright/            # E2E tests
│   │   ├── critical-paths.spec.ts
│   │   ├── mobile.spec.ts
│   │   └── checkout.spec.ts
│   ├── visual/                # Visual regression
│   │   └── regression.spec.ts
│   ├── playwright.config.ts   # Test configuration
│   └── README.md              # Test documentation
├── scripts/                   # Utility scripts
│   ├── capture-baseline.js    # Visual baseline capture
│   ├── capture-baseline.ts    # TypeScript version
│   ├── run-audit.js           # Site audit script
│   ├── README.md              # Script documentation
│   └── CHECKLIST.md           # Verification checklist
├── monitoring/                # Health monitoring
│   └── dashboards/
│       └── status.md          # Health dashboard
├── reports/                   # Generated reports
│   ├── initial-audit.md       # Initial audit results
│   └── priorities.md          # Prioritized issues
└── docs/                      # Documentation
    ├── ARCHITECTURE.md        # System architecture
    └── USER-MANUAL.md         # This file
```

---

### Application Structure

```
app/                           # Next.js App Router
├── api/                       # API routes
│   ├── auth/                  # Auth0 integration
│   ├── peptides/              # Peptide tracking
│   ├── nutrition/             # Nutrition tracking
│   ├── workout/               # Workout tracking
│   ├── checkout/              # Stripe checkout
│   └── ... (45+ endpoints)
├── portal/                    # User dashboard
├── store/                     # E-commerce
├── assessment/                # Health assessment
├── page.tsx                   # Homepage
├── layout.tsx                 # Root layout
└── globals.css                # Global styles

src/
├── components/                # React components
│   ├── Admin/                 # Admin panel
│   ├── Auth/                  # Authentication
│   ├── Breath/                # Breath training
│   ├── Gamification/          # Points system
│   ├── Navigation/            # Site navigation
│   ├── Nutrition/             # Nutrition tracking
│   ├── Peptides/              # Peptide protocols
│   ├── Portal/                # User dashboard
│   ├── Workout/               # Workout tracking
│   └── ... (20+ feature directories)
└── lib/                       # Shared utilities
    ├── prisma.ts              # Prisma client
    ├── getUserFromSession.ts  # Auth helper
    └── ... (utility files)

prisma/
└── schema.prisma              # Database schema (30+ models)

public/
├── manifest.json              # PWA manifest
├── service-worker.js          # Service worker
├── hero-background.jpg        # Hero image
└── ... (static assets)
```

---

## 12. Troubleshooting

### Tests Fail with "Cannot reach server"

**Problem:** Playwright tests can't connect to dev server

**Solution:**
```bash
# Make sure dev server is running
npm run dev

# Or test against production
BASE_URL=https://resetbiology.com npx playwright test .hos/tests/
```

**Verification:**
```bash
# Check if server is accessible
curl http://localhost:3000
```

---

### Playwright Browsers Not Found

**Problem:** "Executable doesn't exist" error

**Solution:**
```bash
# Install Playwright browsers
npx playwright install

# Verify installation
npx playwright --version

# If still failing, reinstall completely
npm uninstall @playwright/test playwright
npm install --save-dev @playwright/test playwright
npx playwright install
```

---

### Visual Regression Tests Show Large Diffs

**Problem:** Visual tests fail with significant differences

**Solution:**

**Step 1: Review the differences**
```bash
npx playwright test .hos/tests/visual/regression.spec.ts
# Check output for which pages differ
```

**Step 2: Determine if changes are intentional**
- Are you working on UI updates?
- Did you change styles, colors, or layouts?
- Are differences expected?

**Step 3: If intentional, update baseline**
```bash
node .hos/scripts/capture-baseline.js
```

**Step 4: Re-run tests**
```bash
npx playwright test .hos/tests/visual/regression.spec.ts
```

**Step 5: Commit new baseline**
```bash
git add .hos/memory/visual/
git commit -m "chore: update visual baseline after [change]"
```

---

### Out of Memory During Tests

**Problem:** Tests crash with "JavaScript heap out of memory"

**Solution:**

**Option 1: Run sequentially (slower but uses less memory)**
```bash
npx playwright test .hos/tests/ --workers=1
```

**Option 2: Run smaller test suites**
```bash
npx playwright test .hos/tests/visual/ --workers=2
```

**Option 3: Increase Node.js memory**
```bash
# Windows PowerShell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npx playwright test .hos/tests/

# Git Bash
NODE_OPTIONS="--max-old-space-size=4096" npx playwright test .hos/tests/
```

---

### Test Timeouts

**Problem:** Tests fail with timeout errors

**Solution:**

**Increase timeout:**
```bash
npx playwright test .hos/tests/ --timeout=60000
```

**Check if dev server is slow:**
```bash
npm run dev
# Watch startup time
```

**Check network speed:**
- Slow internet may cause Auth0 or API timeouts
- Test on local dev first, then production

**Check specific test:**
```bash
npx playwright test .hos/tests/playwright/critical-paths.spec.ts --debug
# Step through to see where it hangs
```

---

### Auth0 Login Fails in Tests

**Problem:** Authentication tests fail or hang

**Solution:**

**Verify Auth0 credentials:**
```bash
npx tsx scripts/verify-auth-env.ts
```

**Check callback URLs in Auth0 dashboard:**
- Allowed Callback URLs should include: `http://localhost:3000/api/auth/callback`
- Allowed Logout URLs should include: `http://localhost:3000`

**Check if Auth0 is down:**
- Visit: https://status.auth0.com

**Use test mode (if available):**
- Some tests may need to mock Auth0 for reliability

---

### Database Connection Errors

**Problem:** "Can't reach database server" or connection timeouts

**Solution:**

**Check database URL:**
```bash
# Verify DATABASE_URL is set
echo $DATABASE_URL
```

**Test connection:**
```bash
npx prisma db push
```

**MongoDB Atlas specific:**
- Check IP whitelist (0.0.0.0/0 for development)
- Verify cluster is running (not paused)
- Check username/password are correct
- Ensure connection string is complete

**Local development alternative:**
```bash
# Use SQLite for local dev
DATABASE_URL="file:./dev.db" npx prisma db push
```

---

### Build Fails on Vercel

**Problem:** Deployment fails during build

**Solution:**

**Check build locally first:**
```bash
npm run build
```

**Common issues:**

**TypeScript errors:**
```bash
npx tsc --noEmit
# Fix all type errors
```

**Missing environment variables:**
- Verify all required env vars in Vercel dashboard
- Check `.env.local` vs. Vercel environment variables

**Dependency issues:**
```bash
# Clear lock file and reinstall
rm package-lock.json
npm install
npm run build
```

**Check Vercel logs:**
- Vercel dashboard → Deployments → Failed deployment → Build logs

---

### Agent Not Responding

**Problem:** Agent invocation doesn't work

**Solution:**

**Check invocation syntax:**
```bash
# Correct
"Architect agent: plan architecture for feature"

# Incorrect
"architect: plan feature"  # Missing "agent" keyword
```

**Verify agent exists:**
```bash
ls .hos/agents/
# Should see: architect, implementer, design-enforcer, test-oracle, observer
```

**Check orchestrator state:**
```bash
cat .hos/orchestrator/state.json
```

**Restart with checkpoint:**
```bash
"Create checkpoint of current state."
# Start new session
```

---

### Token Usage Too High

**Problem:** Orchestrator context growing beyond 10%

**Solution:**

**Create checkpoint and restart:**
```bash
"Create checkpoint of current state."
# Then start new session
```

**Use silent sub-agents:**
```bash
# Instead of:
"Architect: analyze all files and report back"

# Use:
"Use architect sub-agent to analyze patterns. Work silently."
```

**Delegate heavy work:**
- Never ask orchestrator to read/analyze many files
- Always delegate to appropriate agent
- Use "work silently" instruction

---

## 13. Tips and Best Practices

### When to Use Which Agent

**Use Architect When:**
- Planning new features
- Evaluating architectural decisions
- Ensuring pattern consistency
- Making technology choices
- Reviewing system design

**Use Implementer When:**
- Building new components
- Creating API routes
- Adding database models
- Writing tests (TDD)
- Implementing features from plans

**Use Design Enforcer When:**
- Validating UI consistency
- Checking accessibility
- Testing responsive design
- Ensuring brand compliance
- Auditing visual elements

**Use Test Oracle When:**
- Running comprehensive tests
- Validating across devices
- Testing critical paths
- Checking checkout flows
- Visual regression testing

**Use Observer When:**
- Daily health checks
- Monitoring performance
- Generating reports
- Identifying improvements
- SEO analysis

---

### How to Keep Context Low

**1. Use Silent Sub-Agents**

```bash
# Good - Silent delegation
"Use implementer sub-agent to build feature X. Work silently."

# Bad - Direct work
"Let me analyze all the files in the codebase..."
```

**2. Delegate Everything**

- Orchestrator coordinates, never implements
- Heavy work goes to agents
- Agents work in independent contexts

**3. Report Back Only When Needed**

```bash
# Most commands
"Use sub-agent to [task]. Work silently."

# Only when you need results
"Observer: morning health check. Report back with summary only."
```

**4. Create Checkpoints Regularly**

```bash
# End of day
"Create checkpoint of current state."

# Before major changes
"Create checkpoint before implementing [feature]."
```

**5. Start Fresh When Needed**

If orchestrator context grows beyond 10%, start a new session and restore from checkpoint.

---

### Effective Skill Usage

**Combine Skills for Complex Tasks:**

```bash
# Architecture + Implementation + Testing
"Architect: plan [feature]"
"Implementer: build from architect's plan"
"Test oracle: validate implementation"
```

**Use Right Skill for the Job:**

| Task | Skill | Agent |
|------|-------|-------|
| Plan feature | system-design | Architect |
| Build component | code-generator | Implementer |
| Write tests | test-driven-dev | Implementer |
| Check styles | style-validator | Design Enforcer |
| Test accessibility | accessibility-scanner | Design Enforcer |
| Run E2E tests | playwright-vision | Test Oracle |
| Find edge cases | edge-case-finder | Test Oracle |
| Check health | health-monitor | Observer |
| Find patterns | pattern-recognition | Observer |

---

### Pattern Recognition

**Let Observer Find Improvements:**

```bash
"Observer: analyze for improvement opportunities"
```

**Observer looks for:**
- Code duplication
- Performance bottlenecks
- SEO issues
- UX problems
- Mobile issues
- Accessibility gaps

**Act on Insights:**

```bash
# After Observer identifies issue
"Implementer: fix [issue identified by Observer]"
```

---

### Development Workflow Best Practices

**1. Start with Architecture**

```bash
"Architect: plan architecture for [feature]"
```

**2. Implement with TDD**

```bash
"Implementer: build [feature] from architect's plan with TDD"
```

**3. Validate Design**

```bash
"Design-enforcer: audit [new pages] for compliance"
```

**4. Test Comprehensively**

```bash
"Test oracle: run full test suite for [feature]"
```

**5. Monitor Performance**

```bash
"Observer: check performance of [new feature]"
```

---

### Testing Best Practices

**Always Capture Baseline First:**

Before running visual regression tests:
```bash
node .hos/scripts/capture-baseline.js
```

**Test Locally Before Production:**

```bash
# Start dev server
npm run dev

# Run tests against local
npx playwright test .hos/tests/
```

**Update Baseline After Intentional Changes:**

After UI updates:
```bash
node .hos/scripts/capture-baseline.js
git add .hos/memory/visual/
git commit -m "chore: update visual baseline"
```

**Use Interactive Mode for Debugging:**

```bash
npx playwright test .hos/tests/ --ui
```

---

### Performance Best Practices

**Regular Performance Checks:**

```bash
# Weekly or after major changes
"Observer: generate performance report"
```

**Optimize Images:**
- Use Next.js Image component
- WebP format when possible
- Proper sizing with srcset

**Monitor Core Web Vitals:**
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

**Test on Real Devices:**
- Use Playwright device emulation
- Test on actual mobile devices when possible

---

### SEO Best Practices

**Regular SEO Audits:**

```bash
# Monthly
"Observer: generate SEO report for entire site"
```

**Every New Page:**
- Unique title tag
- Meta description (150-160 chars)
- H1/H2/H3 hierarchy
- Alt text on images
- Internal links to related content

**Schema.org Markup:**
- Use structured data for medical content
- Test with Google Rich Results Test

---

### Security Best Practices

**Never Commit Secrets:**
- Keep `.env.local` in `.gitignore`
- Use Vercel environment variables for production
- Rotate API keys regularly

**Validate All Inputs:**
- Use TypeScript for compile-time checks
- Validate on both client and server
- Sanitize user input

**Keep Dependencies Updated:**
```bash
# Check for updates
npm outdated

# Update with caution
npm update
```

---

### Collaboration Best Practices

**Document Decisions:**
- Architect maintains decision records
- Update `.hos/memory/knowledge/` when patterns change

**Communicate Changes:**
- Commit messages describe what and why
- PRs include comprehensive descriptions

**Maintain Consistency:**
- Follow established patterns
- Use Design Enforcer to validate
- Let Architect guide technical direction

---

### Daily Routine Recommendation

**Morning (5 minutes):**
```bash
"Observer: morning health check. Report summary."
```

**During Development:**
```bash
# Plan before implementing
"Architect: plan [feature]"

# Implement with tests
"Implementer: build [feature]"

# Validate quality
"Design-enforcer: audit [changes]"
"Test oracle: validate [feature]"
```

**Evening (2 minutes):**
```bash
"Create checkpoint of current state."
```

---

## Appendix A: File Locations Quick Reference

| What | Where |
|------|-------|
| This manual | `.hos/docs/USER-MANUAL.md` |
| Quick start guide | `.hos/QUICKSTART.md` |
| System status | `.hos/STATUS.md` |
| Architecture docs | `.hos/docs/ARCHITECTURE.md` |
| Agent configs | `.hos/agents/[agent-name]/` |
| Visual baseline | `.hos/memory/visual/screenshots/baseline/` |
| Test files | `.hos/tests/playwright/` |
| Scripts | `.hos/scripts/` |
| Knowledge base | `.hos/memory/knowledge/` |
| Checkpoints | `.hos/orchestrator/checkpoints/` |
| System state | `.hos/orchestrator/state.json` |

---

## Appendix B: Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Cannot reach database server" | MongoDB connection failed | Check DATABASE_URL, verify Atlas access |
| "Executable doesn't exist" | Playwright browsers missing | `npx playwright install` |
| "JavaScript heap out of memory" | Node.js out of memory | Use `--workers=1` or increase memory |
| "Timeout of 30000ms exceeded" | Test timed out | Increase timeout or check network |
| "User not found" | Auth0 user not in database | Callback should auto-create users |
| "Build failed" | TypeScript or build error | Run `npx tsc --noEmit` to find errors |

---

## Appendix C: Keyboard Shortcuts

**Playwright UI Mode:**
- `Space` - Pause/Resume test
- `F8` - Step over
- `F11` - Step into
- `F10` - Step out
- `→` - Next action
- `←` - Previous action

**VS Code (Recommended):**
- `Ctrl+\`` - Toggle terminal
- `Ctrl+Shift+P` - Command palette
- `Ctrl+P` - Quick file open
- `Ctrl+Shift+F` - Search across files

---

## Appendix D: External Resources

**Documentation:**
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- Playwright: https://playwright.dev
- Prisma: https://www.prisma.io/docs
- Auth0: https://auth0.com/docs
- Stripe: https://stripe.com/docs
- Tailwind CSS: https://tailwindcss.com/docs

**ResetBiology.com:**
- Production site: https://resetbiology.com
- Vercel dashboard: https://vercel.com/dashboard
- MongoDB Atlas: https://cloud.mongodb.com

**Support:**
- HOS system questions: Reference this manual
- Technical issues: Check troubleshooting section
- Agent invocations: See agent directory section

---

**End of User Manual**

For questions or issues not covered in this manual, refer to:
- `.hos/STATUS.md` for implementation status
- `.hos/QUICKSTART.md` for quick commands
- `.hos/docs/ARCHITECTURE.md` for system design
- `.hos/memory/knowledge/` for ResetBiology.com patterns
