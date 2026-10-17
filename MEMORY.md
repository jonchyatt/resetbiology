# MEMORY

Dated digest of what Project threads learned. Newest first.

## 2026-10-17 - RBP-6 (live rerun 9 polish)
- /profile now shows the same friendly Drive reason text as /connect-drive (shared `src/lib/driveConnectMessages.ts`).
- N-Back: each of the four channel accuracies (position, audio, letter, color) is null when that channel had nothing to score; the en dash is now proven by a render test on `StatCard`. Saved payload still writes 0 for position/audio and null for letter/color when empty (unchanged).
- Journal lines written before module titles were stored are retitled at read time (`retitleModuleNotes`) in journal history and entry GET; stored rows are not migrated.
- There is no rb-fix-9 check script in the repo; rb-fix-7/8 pass under TZ=UTC. `verify-containment.mjs` passes 22 checks then crashes on the shallow-clone git lookup (known).

## 2026-10-17 - RBP-5 (live rerun 7 fixes)
- Duplicate journal days: daily history used to keep whichever row the DB returned last (overwrite loop), while writers picked newest (`desc`) or arbitrary. All journal day lookups and history now use oldest (`createdAt asc`).
- Drive workout files/outbox days now key on the session's `localDate` (legacy POST /api/workout/sessions now saves it); rows without one fall back to the UTC-day window.
- Drive callback: failures now log the step and redirect with `&step=`; a token-step failure polls up to 15 s for the first hit to finish. The duplicate-callback theory is unproven until a live run shows `step=token` in logs.
- `scripts/verify-containment.mjs` fails on a shallow clone (needs old commit add9dc29); it is unrelated to code changes.

## 2026-10-17 - Branch triage
- 96 remote branches besides master. 41 are fully in master (retire), 13 clean merges (mostly Pitchforks), 12 rebase-then-merge, 29 need Jonathan. Table: `docs/BRANCH-TRIAGE-2026-10.md`.
- All October feature branches (`t_*`, `card/rb-*`, `woden/*`, `harden/*`) stack on `harden/2026-09-06` and are ~540 commits behind master; the free-launch stack tip is `t_2f743162`. Direction of the free-first launch is an open question for Jonathan.
- The cloud clone is shallow by default; ahead/behind counts are wrong until `git fetch --unshallow`.

## 2026-10-17 public-ready sweep
- `tsc --noEmit` on master: 0 errors. `eslint app src middleware.ts`: had 8 errors (7 `no-html-link-for-pages`, 1 `no-unsafe-function-type`), now 0; 981 warnings remain (unused vars/any), not touched.
- `npm run smoke:public [baseUrl]` GETs 16 public routes (dev-mode run with no DB: all pass). It does not cover DB-backed pages or auth-gated routes.
