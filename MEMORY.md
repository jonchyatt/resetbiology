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

## 2026-10-17 - Free-launch replay (PR #55)
- Free-first stack lives on `harden/rb-free-lanes-20261006` / `card/rb-15-restyled-free-candidate` (commits `325e5b08`, `a43b9c25`). Ported only the middleware gate: `src/lib/freeLaunch.ts`, flag `NEXT_PUBLIC_FREE_LAUNCH=on`, default off.
- Not ported: `auth0.ts` signup grant removal (member creation, seat), Header/homepage, FoodQuickAdd camera removal, Workers AI routing. Each is its own PR.
- `/education` and `/breath` hide decision is on a second-look card; #52 links to breath.
- tsc and `npm run build` pass on master + this change; `npm ci` takes ~1 min.
- Render pass found a loop: gate sent /modules to /audio while next.config.ts sends /audio to /modules. Gate now sends /modules to /get-started; test fails if any gate target is a next.config redirect source. next.config.ts untouched (gated).
