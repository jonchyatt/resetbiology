#!/usr/bin/env bash
set -euo pipefail
echo "Checking for direct /api/auth usage in source code (excluding shims, docs, and test files)..."
if git grep -nE "/api/auth/(login|logout|callback)" -- ':!app/api/auth/**' ':!*.md' ':!*.js' ':!test-*.ts' ; then
  echo "❌ Found illegal /api/auth/* references in source code. Fix them."
  exit 1
else
  echo "✅ No illegal /api/auth/* references in source code."
fi