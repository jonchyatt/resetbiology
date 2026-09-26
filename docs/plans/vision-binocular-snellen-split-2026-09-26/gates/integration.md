# Gates: parent integration and proof

Scope: independently accept the Luna build as a working, visible split of the full Snellen chart.

- [x] G0 PROOF OF LIFE: Parent opened the final local Focus Training page in directional-E Red/Green, used the side answer arrows and central IPD controls, and watched the recorded paired charts at phone landscape size.
  CHECK: npx playwright test tests/vision-binocular-snellen.spec.ts --project="Desktop Chrome"
  EXPECT: /passed/
  EVIDENCE: Native local browser at http://localhost:3157/vision-training; parent drove three correct side arrows, keyboard answer, IPD 48/64/160, and synchronized manual scroll. Parent watched phone run video.webm at 2/10/20/25 seconds, including first rows, IPD changes, and bottom rows. Final static frames are saved beside this gate.

- [x] G1: Parent compared the user-supplied live binocular photo and five monocular progression photos with the final local E-mode screen; all fourteen levels remain reachable through synchronized manual chart scrolling, and the paired charts and side answer arrows match in size, relative position, sharpness, and opacity at phone landscape size, with no glyph/button overlap.
  EVIDENCE: Native 844x390 screenshot and saved final-e-phone-landscape.png show identical paired E rows and 40px side arrows with no overlap; 1280x589 native frame matches the live reference layout. Both eye charts expose 14 rows, and one user scroll reaches the last paired row with equal scrollTop. Focused test checks every paired glyph and arrow geometry.

- [x] G2: Parent measured arrow boxes and chart-center separation at default, narrower, and wider IPD; each tap changes separation and does not scale arrows or charts.
  EVIDENCE: At 844x390, center widths 48/64/160px gave chart separation 360/376/472px. Each of eight answer-arrow SVGs stayed 40x40px; both chart viewports stayed 232px wide. Native browser DOM bounding boxes plus focused test.

- [x] G3: A correct answer advances the paired target without moving the chart or page scroll position; Voice remains usable. Parent reran browser and TypeScript checks and reviewed the diff outside Red/Green.
  EVIDENCE: Three side-arrow answers moved both highlights into row 2 with scrollTop [0,0]; keyboard answer advanced once with no scroll. Voice toggle remains visible and the onResult path reaches the same handler; actual microphone recognition remains unmeasured. Parent focused suite 3 passed, TypeScript exit 0, whitespace check exit 0, and smoke checks of Off/Duplicate/Grid/Alternating passed.

- [x] G4: Final report names the exact commits, superseded failed proof, final phone screenshot, and local proof boundary without claiming deployment or millimeter-calibrated optical acceptance.
  EVIDENCE: Commit 249cecc80 and prior proof 96646e051 are explicitly superseded; final implementation commit 30e9a0cc2 and the three final-* screenshots are listed in this plan. Final response will state local browser proof, no production deploy, and no physical IPD calibration or glasses-based optical test.
