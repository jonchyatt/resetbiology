# Visual Baseline Capture Checklist

Complete this checklist to successfully set up and run visual baseline capture.

## Prerequisites

- [ ] Playwright installed
  ```bash
  npx playwright install
  ```
  - Verify: `npx playwright --version`

- [ ] Dev server running
  ```bash
  npm run dev
  ```
  - Keep this terminal open in another window

- [ ] Server accessible at http://localhost:3000
  - Verify: Open http://localhost:3000 in browser
  - Should see Reset Biology homepage

- [ ] All npm dependencies installed
  ```bash
  npm install
  ```

## Optional: Add npm Scripts

- [ ] Review: `.hos/scripts/update-package-json.md`
- [ ] Update: `package.json` with HOS scripts
  ```json
  {
    "scripts": {
      "hos:baseline:capture": "node .hos/scripts/capture-baseline.js",
      "hos:test:visual:regression": "npx playwright test .hos/tests/visual/regression.spec.ts"
    }
  }
  ```

## Execution: Capture Baseline

Choose one method:

### Method 1: Direct Node (Recommended)
- [ ] Run: `node .hos/scripts/capture-baseline.js`
- [ ] Monitor progress in console
- [ ] Wait for completion (2-5 minutes)

### Method 2: NPM Script (if added to package.json)
- [ ] Run: `npm run hos:baseline:capture`
- [ ] Monitor progress in console
- [ ] Wait for completion (2-5 minutes)

### Method 3: TypeScript Version
- [ ] Run: `npx ts-node .hos/scripts/capture-baseline.ts`
- [ ] Or: `npx tsx .hos/scripts/capture-baseline.ts`

## Expected Console Output

- [ ] See: `🎬 Starting visual baseline capture...`
- [ ] See: `Base URL: http://localhost:3000`
- [ ] See: List of pages being processed (home, about, peptides, etc.)
- [ ] See: ✓ checkmarks for successful captures
- [ ] See: `✅ Visual baseline capture completed!`
- [ ] See: Results summary (Screenshots captured: 33)

## Verification: Files Created

- [ ] Verify directory exists: `.hos/memory/visual/screenshots/baseline/`
  ```bash
  ls -la .hos/memory/visual/screenshots/baseline/
  ```

- [ ] Verify 33 screenshot files created
  - Mobile versions (11 files): `*_mobile.png`
  - Tablet versions (11 files): `*_tablet.png`
  - Desktop versions (11 files): `*_desktop.png`

- [ ] Check screenshot files are valid PNG
  - Example files:
    - `home_mobile.png` (375x667)
    - `portal_mobile.png` (375x667, may show login)
    - `peptides_desktop.png` (1920x1080)

- [ ] Verify index file created: `.hos/memory/visual/index.json`
  ```bash
  cat .hos/memory/visual/index.json
  ```

## Verification: Index File Contents

- [ ] Index file is valid JSON
- [ ] Contains field: `"version": "1.0"`
- [ ] Contains field: `"totalPages": 11`
- [ ] Contains field: `"totalViewports": 3`
- [ ] Contains field: `"totalScreenshots": 33`
- [ ] Contains all page names: home, about, peptides, breathing, journal, portal, tracker, peptide-tracker, workout, nutrition, admin
- [ ] Contains all viewport sizes: mobile (375x667), tablet (768x1024), desktop (1920x1080)

## Verification: Screenshot Quality

- [ ] Open a few screenshot files to verify image quality
  - Example: `open .hos/memory/visual/screenshots/baseline/home_mobile.png`
  - Should show: Reset Biology homepage
  - Should be readable at each viewport size

- [ ] Check protected pages show appropriate content
  - `portal_mobile.png` may show login page (expected)
  - `admin_desktop.png` may show login page (expected)

- [ ] Verify no error/blank pages
  - Screenshots should have content
  - Not blank/white (indicates load failure)

## Console Output: No Errors

- [ ] Console shows no fatal errors
- [ ] "Capture errors: 0" in results
- [ ] Script exits with code 0 (success)
  ```bash
  echo $?  # Should output: 0
  ```

- [ ] If errors occurred:
  - [ ] Check error messages for failed pages
  - [ ] Verify dev server is still running
  - [ ] Check network connectivity
  - [ ] Retry with `BASE_URL` if needed

## Ready for Testing

- [ ] Visual baseline successfully captured
- [ ] All 33 screenshots created
- [ ] Index file is complete
- [ ] Screenshots are valid PNGs

## Next Steps

- [ ] Review visual baseline: `.hos/memory/visual/screenshots/baseline/`
- [ ] Run visual regression tests:
  ```bash
  npm run hos:test:visual:regression
  ```
  Or:
  ```bash
  npx playwright test .hos/tests/visual/regression.spec.ts
  ```

- [ ] Check regression test results
  - Should see: Test passed (baseline comparison works)
  - Should show: Visual diffs (if any changes made)

## Commit to Git

- [ ] Stage files:
  ```bash
  git add .hos/
  ```

- [ ] Commit:
  ```bash
  git commit -m "feat: complete visual baseline capture (33 screenshots)"
  ```

- [ ] Verify commit:
  ```bash
  git log --oneline -1
  ```

## Troubleshooting

### Dev Server Not Running
- [ ] Open new terminal
- [ ] Run: `npm run dev`
- [ ] Wait for: "ready on http://localhost:3000"
- [ ] Retry baseline capture

### Connection Refused (localhost:3000)
- [ ] Check dev server is running
- [ ] Run: `curl http://localhost:3000`
- [ ] If timeout, restart server: `Ctrl+C`, then `npm run dev`

### Playwright Browsers Not Installed
- [ ] Run: `npx playwright install`
- [ ] Wait for browsers to download
- [ ] Retry baseline capture

### Timeout Errors
- [ ] Dev server may be slow
- [ ] Increase network timeout
- [ ] Ensure no other heavy processes running
- [ ] Try: `BASE_URL=http://localhost:3000 node .hos/scripts/capture-baseline.js`

### Some Screenshots Missing
- [ ] Check console for specific page errors
- [ ] Protected pages (portal, admin) may fail if auth is required
- [ ] This is expected for baseline
- [ ] Can retry after setting up test auth accounts

### Script Exits With Error Code 1
- [ ] Some captures failed
- [ ] Check console output for error details
- [ ] Ensure all pages are accessible
- [ ] Retry after fixing errors

## Quick Reference

```bash
# Full workflow
npm install
npm run dev &                    # Start dev server in background
npx playwright install
node .hos/scripts/capture-baseline.js  # Capture baseline
npm run hos:test:visual:regression     # Run regression tests

# Check results
ls -la .hos/memory/visual/screenshots/baseline/ | wc -l  # Should be 34 (33 files + . + ..)
cat .hos/memory/visual/index.json | grep totalScreenshots
```

## Support

- **Script Documentation:** `.hos/scripts/README.md`
- **Testing Documentation:** `.hos/tests/README.md`
- **HOS Architecture:** `.hos/docs/ARCHITECTURE.md`
- **STATUS:** `.hos/STATUS.md`
