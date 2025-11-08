# How to Add Visual Baseline Scripts to package.json

This file explains how to add npm scripts for running the visual baseline capture system.

## Option 1: Manual Edit (Recommended)

Open your `package.json` file and locate the `"scripts"` section.

### Add These Scripts

```json
{
  "scripts": {
    "hos:baseline:capture": "node .hos/scripts/capture-baseline.js",
    "hos:baseline:capture:ts": "npx ts-node .hos/scripts/capture-baseline.ts",
    "hos:test:visual": "npx playwright test .hos/tests/visual/",
    "hos:test:visual:regression": "npx playwright test .hos/tests/visual/regression.spec.ts",
    "hos:test:all": "npx playwright test .hos/tests/"
  }
}
```

### Example Full Scripts Section

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",

    "hos:baseline:capture": "node .hos/scripts/capture-baseline.js",
    "hos:baseline:capture:ts": "npx ts-node .hos/scripts/capture-baseline.ts",
    "hos:test:visual": "npx playwright test .hos/tests/visual/",
    "hos:test:visual:regression": "npx playwright test .hos/tests/visual/regression.spec.ts",
    "hos:test:all": "npx playwright test .hos/tests/",

    "hos:test": "npx playwright test"
  }
}
```

## Option 2: Command Line

Run these commands from project root:

```bash
# Add baseline capture script
npm set-script hos:baseline:capture "node .hos/scripts/capture-baseline.js"

# Add TypeScript version
npm set-script hos:baseline:capture:ts "npx ts-node .hos/scripts/capture-baseline.ts"

# Add visual test commands
npm set-script hos:test:visual "npx playwright test .hos/tests/visual/"
npm set-script hos:test:visual:regression "npx playwright test .hos/tests/visual/regression.spec.ts"

# Add comprehensive test suite
npm set-script hos:test:all "npx playwright test .hos/tests/"
```

## Using the Scripts

After adding to package.json:

### Capture Visual Baseline

```bash
npm run hos:baseline:capture
```

Or TypeScript version:

```bash
npm run hos:baseline:capture:ts
```

### Run Visual Regression Tests

```bash
npm run hos:test:visual:regression
```

### Run All HOS Tests

```bash
npm run hos:test:all
```

### Run All Tests (including regular tests)

```bash
npm run hos:test
```

## Expected Output

### Baseline Capture
```
🎬 Starting visual baseline capture...

Base URL: http://localhost:3000
...
✅ Visual baseline capture completed!

📊 Results:
   Screenshots captured: 33
   Capture errors: 0
```

### Regression Tests
```
Running 11 tests...
 ✓ [chromium] visual/regression.spec.ts (33 tests)

Tests completed successfully
```

## Workflow

1. **Initial Setup:**
   ```bash
   npm install
   npm run dev &
   npm run hos:baseline:capture
   ```

2. **Make Changes:**
   - Modify design
   - Fix bugs
   - Update components

3. **Check for Regressions:**
   ```bash
   npm run hos:test:visual:regression
   ```

4. **Update Baseline if Needed:**
   ```bash
   npm run hos:baseline:capture
   git add .hos/memory/visual/
   git commit -m "chore: update visual baseline"
   ```

## Script Details

### hos:baseline:capture
- Runs: `node .hos/scripts/capture-baseline.js`
- Captures 33 screenshots at different viewports
- Creates: `.hos/memory/visual/screenshots/baseline/`
- Creates: `.hos/memory/visual/index.json`
- Runtime: ~2-5 minutes depending on server

### hos:baseline:capture:ts
- Runs: `npx ts-node .hos/scripts/capture-baseline.ts`
- Same as above but using TypeScript
- Useful for TypeScript-first workflows
- Requires: ts-node or tsx installed

### hos:test:visual
- Runs: `npx playwright test .hos/tests/visual/`
- Runs all visual tests
- Includes regression and other visual tests

### hos:test:visual:regression
- Runs: `npx playwright test .hos/tests/visual/regression.spec.ts`
- Runs only regression tests
- Compares current screenshots to baseline

### hos:test:all
- Runs: `npx playwright test .hos/tests/`
- Runs all HOS Playwright tests
- Includes critical paths, mobile, checkout, visual

## Troubleshooting

### "Command not found: npm"
- Install Node.js from https://nodejs.org/
- Node.js includes npm

### "script not found"
- Check script name is exactly correct
- Run: `npm run` (shows all available scripts)
- Verify package.json was saved

### "Playwright not found"
- Run: `npm install`
- Run: `npx playwright install`

### "Dev server not running"
- Start with: `npm run dev`
- Keep terminal running while capturing baseline

### Permission denied errors
- Make scripts executable: `chmod +x .hos/scripts/*.js`
- Or run with node explicitly: `node .hos/scripts/capture-baseline.js`

## Next Steps

1. Add these scripts to your `package.json`
2. Run: `npm run hos:baseline:capture`
3. Run: `npm run hos:test:visual:regression`
4. See `.hos/scripts/README.md` for more details
