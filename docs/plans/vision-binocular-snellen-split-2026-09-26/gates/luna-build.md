# Gates: Luna 6 split-chart build

Scope: implement Snellen-style sizing and presentation inside the existing Red/Green binocular chart, with one focused browser check.

- [x] L1: Red/Green shows two synchronized charts, left red and right green, with the black-and-white trainer's optotype size and weight progression; both halves fit phone landscape and desktop.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Parent rerun: 2 passed (7.2s). Recorded desktop and 844x390 phone-landscape runs in test-results/vision-binocular-snellen-R-*/video.webm show both colored charts and matching targets; source uses screenELineSize and font weight 500 only for Red/Green.

- [x] L2: One answer advances the shared target without timed advance or automatic page/chart scrolling.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Parent rerun: 2 passed (7.2s). Focused test asserts one answer advances and window.scrollY stays fixed. Parent native-browser session held the same target after more than four minutes until an answer.

- [x] L3: Existing six binocular modes, single black-and-white chart, and voice service are preserved.
  CHECK: git diff HEAD^ HEAD --check && echo CLEAN
  EXPECT: /CLEAN/
  EVIDENCE: CLEAN. Commit 249cecc80 changes BinocularChart.tsx and one test only; size/weight changes are conditional on redgreen. Parent opened the unchanged Off single chart and verified it rendered.

- [x] L4: Component compiles and the focused check is runnable on a local app.
  CHECK: npx tsc --noEmit && echo TYPECHECK_OK
  EXPECT: /TYPECHECK_OK/
  EVIDENCE: TYPECHECK_OK; local Next dev server on port 3157 served the page for the focused browser run.
