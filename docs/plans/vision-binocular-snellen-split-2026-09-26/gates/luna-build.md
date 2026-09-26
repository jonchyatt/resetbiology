# Gates: Luna 6 split-chart build

Scope: adapt the single Snellen chart's size progression to the paired Red/Green binocular split while preserving correct fused directional-E geometry.

- [x] L1: Red/Green ABC and directional-E retain all fourteen Snellen size levels while showing as many synchronized rows as fit the landscape field; corresponding eye targets match in identity, size, stroke/sharpness, opacity, row position, and highlight, with only red/green color differing.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Commit 30e9a0cc2 reuses screenELineSize at all 14 indices; parent reran the focused Chrome suite, 3 passed. Paired-glyph assertions compare identity, size, bars, color, opacity, and relative position in both eye charts. Final phone and desktop frames saved beside this gate.

- [x] L2: In Red/Green directional-E, the inner and outer directional answer arrows render at the same size and corresponding offsets in the fused view at default, narrower, and wider IPD settings; each IPD tap changes chart-center separation without scaling either chart.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Parent native browser at 844x390 measured 48/64/160px IPD center widths and 360/376/472px chart-center separation. All eight answer-arrow SVGs remained 40x40px; both chart viewports stayed 232px wide with no horizontal overflow. Focused test also checks matching arrow offsets and no glyph collision.

- [x] L3: One correct touch, keyboard, or voice answer advances the shared target; neither answer nor progression changes the paired chart or page scroll position. The user can manually scroll both eyes together to later rows and reach an offscreen target. Phone landscape and desktop keep side answers, Voice, and Exit usable.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Parent native browser drove three correct side-arrow answers across the first row boundary; target moved to row 2 with both chart scrollTop values still 0. One manual scroll moved both to their identical maximum. A correct keyboard arrow advanced the target with no scroll. The existing WhisperService onResult still routes recognized answers through the same handleAnswer; microphone acoustics were not tested.

- [x] L4: Other binocular modes, the single black-and-white chart, and the voice service retain their behavior; the letter-mode IPD control changes separation immediately and its answers remain at least 48x48px.
  CHECK: git diff origin/master HEAD --check && echo CLEAN
  EXPECT: /CLEAN/
  EVIDENCE: Parent opened Duplicate, Square Grid, Diagonal Grid, and Alternating E modes: each retained two seven-row charts, eight answer arrows, two active targets, and Exit. Off opened the original single white directional-E chart. No speech-service file changed. Focused ABC test measured four 48x48px answers and responsive IPD separation.

- [x] L5: Component compiles and the focused browser check passes locally.
  CHECK: npx tsc --noEmit && echo TYPECHECK_OK
  EXPECT: /TYPECHECK_OK/
  EVIDENCE: Parent reran npx tsc --noEmit (exit 0), focused Desktop Chrome Playwright suite (3 passed in 29.1s), and git diff --check (exit 0) after Luna commit 30e9a0cc2.
