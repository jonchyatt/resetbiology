# Plan: Split Snellen presentation for Red/Green binocular training

Depth: tree 2   Mode: orchestrated (Jon requested Luna 6 implementation)

## Contract

Jon's requested outcome: keep the existing two-eye Red/Green split, but make each eye's chart follow the current black-and-white Snellen trainer's optotype sizes, weight progression, row spacing, and answer-led flow. Both eyes show the same target at the same time. The current Red/Green mode remains selected through the existing Focus Training control; no new mode or automatic scrolling is needed.

- Render red targets on the left and green targets on the right using the current binocular color constants and adjustable center separation. Retain all fourteen levels of the single chart's size rail; choose the number visible at once by the landscape space available and let the user manually scroll the two eye charts together. Keep the side answers fixed and usable. Both eye views must render corresponding targets with identical identity, row position, size, stroke/sharpness, opacity, and feedback treatment; only red/green color differs. Keep a dark stimulus field for color contrast.
- Jon's live reference photo is the Red/Green directional-E chart. The outer and inner arrows are duplicate directional answer buttons for the respective eye views; their rendered size and relative placement must match when the two views fuse. The small central gray arrows adjust image separation (IPD). One tap of that control must visibly change center-to-center chart separation without changing chart or answer-arrow scale. Physical millimeter calibration is unmeasured.
- One correct touch, keyboard, or voice answer advances the shared target. Neither answering nor advancing scrolls the chart or page; the user moves the synchronized chart viewport manually. Do not add timed progression or a moving chart animation. This is the current working interpretation of Jon's no-auto-scroll wording while his clarification is pending.
- Reuse the existing `@/lib/speech` voice integration; voice improvement is already underway elsewhere. Do not edit the speech service or interrupt that work.
- Preserve the other five binocular modes, the three tabs, Exit, free practice, near/far and phone/desktop controls, and the black-and-white chart.
- Claim only visual and interaction proof from local runtime. Optical isolation through Jon's glasses and clinical benefit are not established by a browser check.

## Tree

- 1 Split binocular Snellen-style training: `gates/integration.md`
  - 1.1 Luna 6 implementation and focused check: `gates/luna-build.md`

## Leaves

| Leaf | Owns | Needs | Tier |
|---|---|---|---|
| 1.1 | `src/components/Vision/Training/BinocularChart.tsx`, `tests/vision-binocular-snellen.spec.ts` | - | `gpt-6-luna` |

Luna is not alone in the repo. It must preserve all other edits and may not revert others' work. The parent owns this plan, all gates, local runtime inspection, and the final acceptance verdict.

## Critical path

`critical-path.mjs`: 1 leaf, chain 1 deep, wave 1 ready, VERDICT OK.

## Dispatch schedule

Wave 1: 1.1. Parent reruns its focused check, then closes the integration gates against the actual UI.

## Status log

- 2026-09-26: Jon chose two synchronized side-by-side charts, current Snellen sizing and format, existing voice path, and no automatic scrolling. Isolated worktree created from `origin/master` at `dc5035f5b915beed587c18766e8a5e1b3e9b05f2`.
- 2026-09-26: Luna 6 dispatched for `BinocularChart.tsx` and one focused browser test. First artifact delivered. Parent TypeScript check passed; initial browser check could not launch missing bundled Chromium. Parent found the edit affected other modes and imposed a 14px size floor, so the leaf was sent back with exact findings.
- 2026-09-26: Parent re-linked the isolated checkout to an installed dependency set with the same package-lock hash, started local port 3157, and saw the two Red/Green charts render and advance together on one answer. Final visual and browser gates remain open.
- 2026-09-26: Luna committed the scoped component and browser test as `249cecc80`. Parent reran the focused check (2 passed), TypeScript (exit 0), and committed-diff whitespace check (exit 0); watched desktop and phone-landscape recordings and saved representative frames. `/unlazy` gate checker reports all 9 gates met. Evidence is local only; no deployment or glasses-based optical acceptance was performed.
- 2026-09-26: Parent compared the actual Off trainer against Red/Green and found the first acceptance sheet had missed two visible parts of Jon's "copy what we have" request: fourteen rows versus seven, and large touch answers versus compact center buttons. Those earlier gates proved only size/weight parity. Reopened acceptance and sent the format gap back to Luna 6; the final result must be verified again.
- 2026-09-26: Jon supplied live directional-E and failed local letters screenshots, and rejected the claimed result. Parent identified that the test exercised ABC while Jon's reference was E-directional, and that the inside answer-arrow column's 6% width can shrink the same requested SVG icon relative to the outside arrow. Reopened acceptance for equal corresponding arrows and working IPD separation at multiple settings. Any prior 9/9 gate report is superseded.
- 2026-09-26: Jon supplied five monocular photos and explained the moving 14-line strip: it begins at the top, gains visible rows through the middle, then the tiny rows crawl downward toward the end. That mechanism serves the monocular view with buttons below. For binocular, side answers stay beside the paired views and the visible row count is chosen for the landscape layout. Jon requires every corresponding right/left feature to match in size and sharpness when fused.
- 2026-09-26: Parent clarified the distinction between total levels and visible rows. Pending Jon's explicit answer to a two-choice panel, the working implementation retains all fourteen size levels, shows only those fitting the landscape viewport, advances the shared target on a correct answer, and never scrolls the chart automatically. This assumption is revisable if Jon answers differently.
- 2026-09-26: Luna 6 committed the corrected component and focused test in `30e9a0cc2`. Parent independently reran TypeScript (exit 0), focused installed-Chrome Playwright (3 passed), and whitespace check (exit 0). Native phone-landscape proof showed 14 paired rows, equal 40px answer arrows, synchronized manual scroll, immediate shared-target advancement without scroll, and IPD separation 360/376/472px at 48/64/160px settings. Parent also opened Off, Duplicate, Square Grid, Diagonal Grid, and Alternating modes. Final screenshots: `final-e-phone-landscape.png`, `final-abc-phone-landscape.png`, and `final-e-desktop.png`. Production deployment, glasses-based optical fusion, physical millimeter calibration, and microphone audibility remain unverified.
