# HOS Quick Start Guide

Complete guide to the Holistic Observation System (HOS) - the automated testing and monitoring framework for Reset Biology.

## What is HOS?

HOS is an intelligent automation system that:
- **Captures** visual baselines for regression testing
- **Runs** comprehensive test suites (critical paths, mobile, checkout, visual)
- **Monitors** site health with continuous checks
- **Tracks** performance metrics
- **Reports** issues and improvements

Built on Playwright for browser automation and testing.

## Quick Start (5 minutes)

### 1. Install Prerequisites

```bash
# Install all dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### 2. Start Dev Server

```bash
npm run dev
```

Keep this terminal open. Server will run on http://localhost:3000

### 3. Capture Visual Baseline

In a new terminal:

```bash
node .hos/scripts/capture-baseline.js
```

**What happens:**
- Captures 33 screenshots (11 pages × 3 viewports)
- Creates: `.hos/memory/visual/screenshots/baseline/`
- Creates: `.hos/memory/visual/index.json` (metadata)
- Runtime: 2-5 minutes

**Expected output:**
```
🎬 Starting visual baseline capture...
📄 Processing: home
   ├─ mobile   → http://localhost:3000/
   │   ✓ Screenshot saved (375x667)
...
✅ Visual baseline capture completed!
📊 Results:
   Screenshots captured: 33
   Capture errors: 0
```

### 4. Run Your First Tests

```bash
# Run all HOS tests
npx playwright test .hos/tests/

# Or run visual regression tests only
npx playwright test .hos/tests/visual/regression.spec.ts

# Or run critical path tests
npx playwright test .hos/tests/playwright/critical-paths.spec.ts
```

## Common Commands

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production build locally
npm start
```

### Testing

```bash
# Run all HOS tests
npx playwright test .hos/tests/

# Run specific test type
npx playwright test .hos/tests/playwright/critical-paths.spec.ts
npx playwright test .hos/tests/playwright/mobile.spec.ts
npx playwright test .hos/tests/playwright/checkout.spec.ts
npx playwright test .hos/tests/visual/regression.spec.ts

# Run with UI (interactive)
npx playwright test .hos/tests/ --ui

# Run with headed browser (see browser)
npx playwright test .hos/tests/ --headed

# Debug a test
npx playwright test .hos/tests/playwright/critical-paths.spec.ts --debug
```

### Visual Baseline

```bash
# Capture baseline (run this first!)
node .hos/scripts/capture-baseline.js

# Or TypeScript version
npx ts-node .hos/scripts/capture-baseline.ts

# Run regression tests
npx playwright test .hos/tests/visual/regression.spec.ts
```

## Directory Structure

```
C:\Users\jonch\reset-biology-website\
├── .hos/                          # HOS system root
│   ├── QUICKSTART.md              # This file
│   ├── STATUS.md                  # Implementation progress
│   ├── orchestrator/              # Orchestration configuration
│   ├── agents/                    # 5 specialized agents
│   ├── memory/
│   │   ├── visual/
│   │   │   ├── screenshots/
│   │   │   │   └── baseline/      # Visual baseline (captured here)
│   │   │   └── index.json         # Screenshot metadata
│   │   └── knowledge/             # Site analysis docs
│   ├── tests/
│   │   ├── playwright/
│   │   │   ├── critical-paths.spec.ts
│   │   │   ├── mobile.spec.ts
│   │   │   └── checkout.spec.ts
│   │   ├── visual/
│   │   │   └── regression.spec.ts
│   │   ├── playwright.config.ts
│   │   └── README.md
│   ├── scripts/
│   │   ├── capture-baseline.js    # Main baseline capture
│   │   ├── capture-baseline.ts    # TypeScript version
│   │   ├── README.md
│   │   ├── CHECKLIST.md
│   │   └── update-package-json.md
│   ├── docs/
│   │   ├── ARCHITECTURE.md
│   │   └── USER-MANUAL.md (Phase 3.1)
│   ├── monitoring/                # Health monitoring
│   ├── reports/                   # Test reports
│   └── .gitignore

├── src/                           # Application source
│   ├── app/                       # Next.js app router
│   ├── components/
│   ├── lib/
│   └── styles/

├── package.json                   # npm configuration
├── tsconfig.json
└── ...other project files
```

## Test Suites Explained

### Critical Paths (`critical-paths.spec.ts`)
Tests the main user journeys:
- Marketing site navigation
- User registration flow
- Login with Auth0
- Portal access
- Peptide selection and dosing
- Basic functionality

**Run:** `npx playwright test .hos/tests/playwright/critical-paths.spec.ts`

### Mobile Tests (`mobile.spec.ts`)
Tests on mobile device viewports:
- Responsive layout
- Touch interactions
- Mobile-specific UI elements
- Performance on mobile devices

**Run:** `npx playwright test .hos/tests/playwright/mobile.spec.ts`

### Checkout Tests (`checkout.spec.ts`)
Tests Stripe payment integration:
- Cart management
- Checkout flow
- Payment processing
- Order confirmation

**Run:** `npx playwright test .hos/tests/playwright/checkout.spec.ts`

### Visual Regression (`regression.spec.ts`)
Compares current state to baseline:
- Captures current screenshots
- Compares to baseline
- Reports visual differences
- Detects accidental style changes

**Run:** `npx playwright test .hos/tests/visual/regression.spec.ts`

## Common Workflows

### First Time Setup
```bash
# 1. Install dependencies
npm install
npx playwright install

# 2. Start dev server
npm run dev

# 3. In new terminal, capture baseline
node .hos/scripts/capture-baseline.js

# 4. Run tests to verify
npx playwright test .hos/tests/

# 5. Commit baseline
git add .hos/memory/visual/
git commit -m "feat: initial visual baseline"
```

### Making Design Changes
```bash
# 1. Make your code changes
# 2. Run dev server
npm run dev

# 3. Run regression tests
npx playwright test .hos/tests/visual/regression.spec.ts

# 4. If visual changes are intentional:
node .hos/scripts/capture-baseline.js

# 5. Commit
git add .hos/memory/visual/
git commit -m "chore: update visual baseline"
```

### Fixing a Broken Test
```bash
# 1. Run tests to see failure
npx playwright test .hos/tests/ --ui

# 2. Open interactive UI
# 3. Step through test execution
# 4. See what's wrong
# 5. Fix the issue
# 6. Re-run tests

# Or use debug mode:
npx playwright test .hos/tests/playwright/critical-paths.spec.ts --debug
```

### Checking Site Health
```bash
# Run all test suites
npx playwright test .hos/tests/

# See results summary
# - How many tests passed/failed
# - Which pages are broken
# - Performance metrics
# - Visual regressions
```

## Important Configuration Files

### `.hos/tests/playwright.config.ts`
Main Playwright configuration:
- Browser types (chromium, firefox, webkit)
- Test timeout and retry settings
- Screenshot/trace capture options
- Custom configuration for Reset Biology

**View:** `cat .hos/tests/playwright.config.ts`

### `.hos/memory/visual/index.json`
Visual baseline metadata:
- List of all screenshots
- Viewport sizes
- Page paths
- Capture timestamp

**View:** `cat .hos/memory/visual/index.json`

### `.hos/STATUS.md`
Implementation progress and next steps:
- What's completed
- What's in progress
- Next phases
- How to continue

**View:** `cat .hos/STATUS.md`

## Troubleshooting

### Tests Fail with "Cannot reach server"
**Solution:**
```bash
# Make sure dev server is running
npm run dev

# Or specify different URL
BASE_URL=https://resetbiology.com npx playwright test .hos/tests/
```

### Playwright Browsers Not Found
**Solution:**
```bash
npx playwright install

# Verify installation
npx playwright --version
```

### Visual Regression Tests Show Large Diffs
**Solution:**
```bash
# 1. Review changes in screenshots
# 2. If changes are intentional, update baseline:
node .hos/scripts/capture-baseline.js

# 3. Re-run tests
npx playwright test .hos/tests/visual/regression.spec.ts
```

### Out of Memory During Tests
**Solution:**
```bash
# Run tests sequentially (slower but uses less memory)
npx playwright test .hos/tests/ --workers=1

# Or run smaller test suites
npx playwright test .hos/tests/visual/ --workers=2
```

### Test Timeouts
**Solution:**
```bash
# Increase timeout for slower connections
npx playwright test .hos/tests/ --timeout=60000

# Or check if dev server is slow
npm run dev  # Check if starts quickly
```

## Next Steps

1. **Run baseline capture** (if not done):
   ```bash
   node .hos/scripts/capture-baseline.js
   ```

2. **Run tests**:
   ```bash
   npx playwright test .hos/tests/
   ```

3. **Review results** in console and `.hos/tests/results/`

4. **Explore test code** to understand what's being tested:
   ```bash
   cat .hos/tests/playwright/critical-paths.spec.ts
   ```

5. **Read full documentation**:
   - Test details: `.hos/tests/README.md`
   - Scripts: `.hos/scripts/README.md`
   - Architecture: `.hos/docs/ARCHITECTURE.md`

## Documentation

- **This file:** `.hos/QUICKSTART.md` - You are here
- **Testing:** `.hos/tests/README.md` - Detailed test documentation
- **Scripts:** `.hos/scripts/README.md` - Baseline capture details
- **Architecture:** `.hos/docs/ARCHITECTURE.md` - System design
- **Status:** `.hos/STATUS.md` - Progress and phases
- **Checklist:** `.hos/scripts/CHECKLIST.md` - Verification steps

## Support

For more information:
- Check `.hos/STATUS.md` for current implementation status
- See `.hos/docs/ARCHITECTURE.md` for system design
- Review test output in `.hos/tests/results/`
- Look for error messages in test UI (`--ui` mode)

## Quick Reference Card

```bash
# Essential commands
npm install                                    # Install deps
npx playwright install                        # Install browsers
npm run dev                                   # Start dev server
node .hos/scripts/capture-baseline.js        # Capture baseline
npx playwright test .hos/tests/              # Run all tests
npx playwright test .hos/tests/ --ui         # Interactive test UI
npx playwright test .hos/tests/ --headed     # See browser while testing
npx playwright test .hos/tests/ --debug      # Debug mode

# Specific test suites
npx playwright test .hos/tests/playwright/critical-paths.spec.ts
npx playwright test .hos/tests/playwright/mobile.spec.ts
npx playwright test .hos/tests/playwright/checkout.spec.ts
npx playwright test .hos/tests/visual/regression.spec.ts

# Configuration
BASE_URL=http://localhost:3000 npm run ...   # Use custom URL
--workers=1                                   # Sequential execution
--timeout=60000                              # Custom timeout (ms)
```

**Last Updated:** November 3, 2025
