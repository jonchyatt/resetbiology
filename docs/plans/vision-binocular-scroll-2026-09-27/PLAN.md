# Binocular Snellen follow-scroll correction

Jon's 2026-09-27 phone screenshots show that red/green fusion works, while the selected row falls beneath the chart viewport as answers advance. The prior no-auto-scroll interpretation in the split plan was provisional and is superseded by Jon's instruction: "Fusion is solid . But not advance scroll once middle is reached."

Use the existing paired Red/Green chart. It begins with the top rows in place. Once the selected row reaches the visible chart midpoint, answer-led progression moves both eye viewports together to keep the selected row around that midpoint. At the chart's end, clamp to the scroll limit so the final smaller rows move toward the bottom. Compute travel from the rendered row and viewport dimensions; the monocular `screenEChartPosition` uses a fixed stage and cannot be copied pixel for pixel.

Keep the two eyes on the same target with matching size, shape, sharpness, opacity, and vertical position. Preserve the 14 size levels, synchronized hand scrolling, fixed matching inner/outer arrows, IPD separation behavior, immediate correct-answer advancement, ABC mode, other binocular modes, and the existing voice path. No page-wide jump. Jon has already confirmed physical fusion; avoid changing its geometry.

Luna 6 owns the minimal component and focused test changes in `src/components/Vision/Training/BinocularChart.tsx` and `tests/vision-binocular-snellen.spec.ts`. The parent owns this plan, `/unlazy` gates, independent browser verification, and release. The worker is not alone in the codebase and must preserve all other edits.

Acceptance centers on phone landscape at 844x390: answer through the first midpoint crossing and late rows, observe equal paired scroll positions, visible matching targets, fixed controls, and no window scroll. Verify on local runtime, then on the hosted production page after merge. Browser evidence cannot prove iOS Safari behavior; Jon's phone check remains the final physical confirmation.
