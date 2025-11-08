#!/bin/bash

# Run all HOS tests for ResetBiology.com

echo "Starting HOS Test Suite..."

# Critical paths
echo "Running critical path tests..."
npx playwright test critical-paths.spec.ts

# Mobile tests
echo "Running mobile tests..."
npx playwright test mobile.spec.ts

# Checkout tests
echo "Running checkout tests..."
npx playwright test checkout.spec.ts

# Visual regression (only if baseline exists)
if [ -d ".hos/tests/visual/baseline" ]; then
  echo "Running visual regression tests..."
  npx playwright test visual/regression.spec.ts
fi

echo "Test suite complete. Results in .hos/tests/results/"
