# Run all HOS tests for ResetBiology.com

Write-Host "Starting HOS Test Suite..." -ForegroundColor Green

# Critical paths
Write-Host "Running critical path tests..." -ForegroundColor Cyan
npx playwright test critical-paths.spec.ts

# Mobile tests
Write-Host "Running mobile tests..." -ForegroundColor Cyan
npx playwright test mobile.spec.ts

# Checkout tests
Write-Host "Running checkout tests..." -ForegroundColor Cyan
npx playwright test checkout.spec.ts

# Visual regression
if (Test-Path ".hos/tests/visual/baseline") {
  Write-Host "Running visual regression tests..." -ForegroundColor Cyan
  npx playwright test visual/regression.spec.ts
}

Write-Host "Test suite complete. Results in .hos/tests/results/" -ForegroundColor Green
