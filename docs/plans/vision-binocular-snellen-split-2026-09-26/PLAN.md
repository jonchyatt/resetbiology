# Plan: Split Snellen presentation for Red/Green binocular training

Depth: tree 2   Mode: orchestrated (Jon requested Luna 6 implementation)

## Contract

Jon's requested outcome: keep the existing two-eye Red/Green split, but make each eye's chart follow the current black-and-white Snellen trainer's optotype sizes, weight progression, row spacing, and answer-led flow. Both eyes show the same target at the same time. The current Red/Green mode remains selected through the existing Focus Training control; no new mode or automatic scrolling is needed.

- Render red targets on the left and green targets on the right using the current binocular color constants and adjustable center separation. Keep a dark stimulus field if needed for red/green contrast, while matching the Snellen chart's geometry and sizing.
- One touch, keyboard, or voice answer applies to the shared target. Advance only as a consequence of that answer, as the current black-and-white trainer does. Do not add timed progression, auto-scroll, or a moving chart animation.
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
