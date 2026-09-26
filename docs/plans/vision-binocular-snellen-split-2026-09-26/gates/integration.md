# Gates: parent integration and proof

Scope: independently accept the Luna build as a working, visible split-chart trainer.

- [x] G0 PROOF OF LIFE: I opened the actual local Focus Training page, selected Red/Green, answered using real UI controls, and watched a recorded run showing two visible synchronized charts.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Parent native-browser run at http://localhost:3157/vision-training showed left red and right green charts; clicking the shared R answer moved both highlights to N, with the page stationary. Parent watched sampled frames from both Playwright video.webm recordings in test-results/, including before and after answer.

- [x] G1: Phone landscape and desktop views show both chart halves, with the intended sizes and usable answer and Exit controls.
  EVIDENCE: Parent inspected recorded desktop and 844x390 phone-landscape frames at desktop-after-answer.png and phone-landscape.png in this plan directory. Both charts, center answers, Voice OFF, and Exit are visible; phone test measured each element inside the viewport.

- [x] G2: Advancement occurs from an answer only; there is no timer-based advance or automatic scrolling, and the existing voice toggle remains available.
  EVIDENCE: Focused browser test asserts paired target change after one answer and unchanged window.scrollY. Source advanceToNext is called by handleAnswer only, after a correct response. In the native-browser session the new target held for over four minutes; Voice OFF remained visible.

- [x] G3: Parent reran the focused browser check and TypeScript check; no unrelated source or speech service edits landed.
  EVIDENCE: Parent: Playwright 2 passed (7.2s), npx tsc --noEmit exit 0, git diff HEAD^ HEAD --check exit 0. Commit 249cecc80 contains only BinocularChart.tsx and tests/vision-binocular-snellen.spec.ts.

- [x] G4: The final report names the exact commit, proof boundary, and any unmet gate without rounding a local run up to production acceptance.
  EVIDENCE: Commit 249cecc80; all four leaf and five integration gates met. Final report will say local UI/test proof only, with no production deploy or glasses-based optical acceptance claim.
