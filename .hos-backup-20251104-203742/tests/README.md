# HOS Testing Suite for ResetBiology.com

## Overview

Comprehensive Playwright-based testing using HOS skills and sub-agents.

## Test Suites

### Critical Paths (`critical-paths.spec.ts`)
Tests essential user journeys:
- Auth0 authentication
- Peptide protocol selection
- Nutrition logging
- Workout tracking
- Breath training
- Store checkout

### Mobile Tests (`mobile.spec.ts`)
Mobile-specific testing:
- Navigation menus
- Touch interactions
- Form inputs
- Touch target sizes
- Horizontal scroll detection

### Checkout Tests (`checkout.spec.ts`)
Stripe integration testing:
- Payment form loading
- Successful payments
- Declined card handling
- 3D Secure flow

### Visual Regression (`visual/regression.spec.ts`)
Screenshot comparison across:
- 8 key pages
- 3 viewports (mobile, tablet, desktop)
- 24 total comparisons

## Running Tests

### All Tests
```bash
npm run test:hos
# or
./.hos/tests/run-tests.sh
```

### Specific Suite
```bash
npx playwright test critical-paths
npx playwright test mobile
npx playwright test checkout
npx playwright test visual/regression
```

### With UI
```bash
npx playwright test --ui
```

### Headed Mode (see browser)
```bash
npx playwright test --headed
```

## Test Results

Results stored in:
- HTML: `.hos/tests/results/html/`
- JSON: `.hos/tests/results/results.json`
- Screenshots: `.hos/tests/results/screenshots/`
- Videos: `.hos/tests/results/videos/`

## Using with HOS Agents

### Test Oracle Agent
```bash
"Test oracle agent: run full test suite"
"Test oracle: validate checkout flow"
```

### Design Enforcer
```bash
"Design enforcer: run visual regression tests"
```

## Playwright MCP Integration

All tests can be run via Playwright MCP by agents:
- Test Oracle uses for E2E testing
- Design Enforcer uses for visual validation
- Observer uses for health monitoring

## Configuration

Main config: `.hos/tests/playwright.config.ts`

Devices tested:
- Desktop: Chrome, Firefox, Safari
- Mobile: iPhone 12, iPhone 15, Pixel 5
- Tablet: iPad Pro

## Baseline Management

### Create Baseline
```bash
npx playwright test visual/regression --update-snapshots
```

### Update Baseline
```bash
npx playwright test visual/regression --update-snapshots
```

Baselines stored: `.hos/memory/visual/screenshots/baseline/`

## CI/CD Integration

Tests run on:
- Pre-deployment (via HOS pre-deploy hook)
- Post-deployment (via HOS post-deploy hook)
- On-demand (via agent invocation)

## Notes

- Tests use `data-testid` attributes for stability
- Stripe tests require test mode enabled
- Auth0 tests require test account
- Visual tests need baseline captured first
