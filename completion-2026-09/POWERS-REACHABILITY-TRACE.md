# Pitchforks III power reachability trace

Date: 2026-09-15

## Verdict

- Thunderhead: working as designed and reachable. Its normal route opens when the Bell Tower world is unlocked.
- Galvanic Sweep: working as designed and reachable. Its normal route opens when the Cathedral world is unlocked.
- Neither power is an orphan. Both have runtime state, production callbacks, lifecycle effects, and HUD controls.
- No production readiness or wiring change was needed. I left the campaign gates unchanged.

The audit's result was a truthful **UNVERIFIED** observation, not proof that either power was broken: the report says the run stopped with neither power visible (`C:\Users\jonch\Projects\rb-pitchforks-wt-audit\campaign-audit\CAMPAIGN-AUDIT-REPORT.md:54`). The same report records five learned notes while the later world map remained locked (`C:\Users\jonch\Projects\rb-pitchforks-wt-audit\campaign-audit\CAMPAIGN-AUDIT-REPORT.md:58`).

## Root cause

There is no Dungeon-wave readiness threshold for either power. The wave director only chooses ordinary wave shape and tine counts (`src/components/PitchDefender/PitchforksIII.tsx:1836-1864`). A cleared Dungeon level advances `currentLevel` only (`src/components/PitchDefender/PitchforksIII.tsx:9345-9351`; `src/components/PitchDefender/pitchforksCurriculum.ts:425-433`).

The actual normal-route predicates are:

- Thunderhead requires `isWorldUnlocked('bell-tower', ...)` (`src/components/PitchDefender/PitchforksIII.tsx:5594-5598`).
- Galvanic Sweep requires `isWorldUnlocked('cathedral', ...)` (`src/components/PitchDefender/PitchforksIII.tsx:5600-5604`).

The registry's ordered prefix is Dungeon, Village Gate, Bell Tower, Cathedral (`src/components/PitchDefender/pitchforks3WorldRegistry.ts:20-25`). `isWorldUnlocked` requires a valid clear-prefix length equal to the target world's index (`src/components/PitchDefender/pitchforks3WorldRegistry.ts:64-75`). Therefore:

- Thunderhead needs Dungeon plus Village Gate clears before Bell Tower is unlocked.
- Galvanic Sweep needs Dungeon plus Village Gate plus Bell Tower clears before Cathedral is unlocked.

The journey projection supplies exactly those receipt fields (`src/components/PitchDefender/pitchforksCampaignProgress.ts:202-211`). Normal reconciliation writes the Dungeon/Village side of the prefix through the existing campaign progression functions (`src/components/PitchDefender/PitchforksIII.tsx:5018-5047`), and a successful normal Bell examination writes the Bell Tower receipt (`src/components/PitchDefender/PitchforksIII.tsx:9569-9585`). The examination gate is itself reachable only after the existing mastery projection reports a world clear (`src/components/PitchDefender/pitchforksCampaignProgress.ts:256-280`).

That mastery projection requires three distinct valid voice sessions per admitted note (`src/components/PitchDefender/pitchforksMasteryProjection.ts:185-194`) and requires every admitted note to carry that historical evidence (`src/components/PitchDefender/pitchforksMasteryProjection.ts:228-242`). The audit explicitly names that multi-session rule as the remaining campaign gate (`C:\Users\jonch\Projects\rb-pitchforks-wt-audit\campaign-audit\CAMPAIGN-AUDIT-REPORT.md:101`). Thus 23 Dungeon levels in the captured run do not imply Bell Tower or Cathedral access. The powers are further along the campaign, not beyond an unseen wave number.

## Runtime/HUD wiring check

The component imports the Thunderhead reducer and Galvanic planner (`src/components/PitchDefender/PitchforksIII.tsx:187-206`). Thunderhead transitions replace the authoritative ref and publish state (`src/components/PitchDefender/PitchforksIII.tsx:5517-5530`); Galvanic resets a new battle ledger and clears only its ephemeral banks (`src/components/PitchDefender/PitchforksIII.tsx:5633-5654`). The live loop calls both lifecycle consumers (`src/components/PitchDefender/PitchforksIII.tsx:9219-9229`).

The HUD computes both route flags (`src/components/PitchDefender/PitchforksIII.tsx:10606-10607`). The Galvanic and Thunderhead sections are deliberately conditional on those flags (`src/components/PitchDefender/PitchforksIII.tsx:12424-12522`), which explains why neither appeared in the Dungeon HUD. Once the prefix exists, the actual request/confirm/release callbacks are connected (`src/components/PitchDefender/PitchforksIII.tsx:7595-7708`, `8413-8514`, `8516-8597`). Close Smash is different: it earns during ordinary play at the existing close boundary and lock-progress condition (`src/components/PitchDefender/PitchforksIII.tsx:5742-5779`), and its ready/action state is separate (`src/components/PitchDefender/PitchforksIII.tsx:10706-10710`, `12242-12273`).

This makes the classification case (a), with an important correction: the missing powers were not waiting for level 24. They were waiting for later campaign receipts. I did not lower the gate to match Close Smash because that would collapse a deliberate world/curriculum boundary rather than correct a conservative wave cadence. The audit's request for a normal later-world acceptance path is recorded at `C:\Users\jonch\Projects\rb-pitchforks-wt-audit\campaign-audit\CAMPAIGN-AUDIT-REPORT.md:103`; the present source already contains that receipt-to-route path, and this ticket verifies its power endpoint.

## End-to-end reachability test

Extended `tests/pitchforks-earned-power-access.test.ts` with `a 23-wave Dungeon run reaches and fires both powers after their campaign gates` (`tests/pitchforks-earned-power-access.test.ts:136-204`). It:

1. Runs the shipped `fixedWaveDirector` through 23 normal Dungeon waves, materializes each plan's live targets, and asserts both normal routes remain unavailable.
2. Applies the ordered Dungeon and Village receipts and asserts Thunderhead becomes available.
3. Uses the extracted production request, lock confirmation, release, lifecycle, and strike path for Thunderhead.
4. Applies the Bell Tower receipt and uses the extracted Galvanic bank, release, sweep, and strike path.

The test preserves the existing multi-tine target data and does not modify lock, hold, confidence, or note-pool production logic. It is a harness integration pass, not mounted-browser acceptance.

## Verification

- Focused: `npx.cmd tsx --test tests/pitchforks-earned-power-access.test.ts` — **38 passed, 0 failed**.
- Pitchforks suite: `npx.cmd tsx --test tests/pitchforks*.test.ts tests/pitchforks*.test.tsx` — **217 total, 213 passed, 4 failed**. The three expected baseline failures remain: `pitchforks-bell-runtime.test.ts`, `pitchforks-one-tine-assets.test.ts`, and `pitchforks-thunderhead-runtime.test.ts`. The Thunderhead failure is still the optional Storm Heart source assertion at `tests/pitchforks-thunderhead-runtime.test.ts:149`; no Thunderhead runtime source file was changed. One additional unrelated failure is present in this isolated worktree: `pitchforks-cathedral-gameplay.test.ts` cannot read the absent `data/pitchforks-repair-20260914/cathedral-gameplay/INTEGRATION.md` (`tests/pitchforks-cathedral-gameplay.test.ts:61-64`).
- Repository-wide: `npx.cmd tsx --test tests/*.test.ts tests/*.test.tsx` — **274 total, 268 passed, 6 failed**. In addition to the four Pitchforks failures above, `row33-override-warning-fresh-schedule.test.ts` and `t3-validation-banner-gate.test.ts` fail; neither is related to this ticket. The changed-file list contains only this test plus this findings document.
- Typecheck: `npx.cmd tsc --noEmit` — **exit 0, no diagnostics**.
