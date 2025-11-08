# HOS Scripts

Utility scripts for the Holistic Observation System (HOS).

## Visual Baseline Capture

The visual baseline capture script takes screenshots of the Reset Biology website at multiple viewport sizes for use in automated visual regression testing.

### Prerequisites

Before running the baseline capture, ensure you have:

1. **Playwright installed:**
   ```bash
   npx playwright install
   ```

2. **Development server running:**
   ```bash
   npm run dev
   ```
   The server must be accessible at `http://localhost:3000` (or configured via `BASE_URL` env var)

3. **All dependencies installed:**
   ```bash
   npm install
   ```

### Running Baseline Capture

#### Using Node.js (Recommended)

```bash
node .hos/scripts/capture-baseline.js
```

#### Using TypeScript/tsx

```bash
npx ts-node .hos/scripts/capture-baseline.ts
```

Or with tsx (faster):

```bash
npx tsx .hos/scripts/capture-baseline.ts
```

### Output

The script captures screenshots for:

- **11 Pages:**
  - Marketing: home, about, peptides, breathing, journal
  - Protected: portal, tracker, peptide-tracker, workout, nutrition, admin

- **3 Viewport Sizes:**
  - Mobile: 375x667
  - Tablet: 768x1024
  - Desktop: 1920x1080

**Total: 33 screenshots**

### File Locations

- **Screenshots:** `.hos/memory/visual/screenshots/baseline/`
  - Format: `{page}_{viewport}.png`
  - Example: `portal_mobile.png`, `peptides_desktop.png`

- **Index:** `.hos/memory/visual/index.json`
  - Metadata about all captured screenshots
  - Used by regression tests

### Configuration

Customize baseline capture with environment variables:

```bash
# Use a different base URL
BASE_URL=https://resetbiology.com npm node .hos/scripts/capture-baseline.js

# Use staging server
BASE_URL=https://staging.resetbiology.com node .hos/scripts/capture-baseline.js
```

### Typical Output

```
🎬 Starting visual baseline capture...

Base URL: http://localhost:3000
Output directory: .hos/memory/visual/screenshots/baseline

📄 Processing: home
   ├─ mobile   → http://localhost:3000/
   │   ✓ Screenshot saved (375x667)
   ├─ tablet   → http://localhost:3000/
   │   ✓ Screenshot saved (768x1024)
   ├─ desktop  → http://localhost:3000/
   │   ✓ Screenshot saved (1920x1080)

...

✅ Visual baseline capture completed!

📊 Results:
   Screenshots captured: 33
   Capture errors: 0
   Output directory: .hos/memory/visual/screenshots/baseline/
   Index file: .hos/memory/visual/index.json

🎯 Next Steps:
   1. Review screenshots in: .hos/memory/visual/screenshots/baseline/
   2. Run visual regression tests: npm run hos:test visual/regression
   3. Use baseline for future regression testing
```

### Next: Visual Regression Testing

Once baseline is captured, run regression tests:

```bash
npm run hos:test visual/regression
```

This will:
1. Capture current screenshots
2. Compare against baseline
3. Report visual differences
4. Generate visual diff reports

### Troubleshooting

#### "Failed to connect to server"
- Ensure dev server is running: `npm run dev`
- Check server is accessible: `curl http://localhost:3000`
- Try setting `BASE_URL` explicitly

#### "Timeout waiting for selector"
- Dev server may be slow
- Increase timeout in script
- Ensure dev dependencies are installed

#### "Path not found" errors
- Protected pages (require auth) will show login pages
- This is expected for initial baseline
- Can be ignored for first capture

#### Playwright browsers not installed
- Run: `npx playwright install`
- This downloads chromium, firefox, webkit

### Files in This Directory

- **capture-baseline.js** - Node.js version (recommended)
- **capture-baseline.ts** - TypeScript version
- **README.md** - This file

### Maintenance

Update baseline after significant design changes:

```bash
# Clear old baseline
rm -rf .hos/memory/visual/screenshots/baseline

# Capture new baseline
node .hos/scripts/capture-baseline.js

# Commit new baseline
git add .hos/memory/visual/
git commit -m "chore: update visual baseline"
```

### See Also

- `.hos/tests/visual/regression.spec.ts` - Regression test suite
- `.hos/memory/visual/index.json` - Baseline metadata
- `.hos/tests/README.md` - Testing documentation
