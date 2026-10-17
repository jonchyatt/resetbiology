# MEMORY

Dated digest of what Project threads learned. Newest first.

## 2026-10-17 - RBP-5 (live rerun 7 fixes)
- Duplicate journal days: daily history used to keep whichever row the DB returned last (overwrite loop), while writers picked newest (`desc`) or arbitrary. All journal day lookups and history now use oldest (`createdAt asc`).
- Drive workout files/outbox days now key on the session's `localDate` (legacy POST /api/workout/sessions now saves it); rows without one fall back to the UTC-day window.
- Drive callback: failures now log the step and redirect with `&step=`; a token-step failure polls up to 15 s for the first hit to finish. The duplicate-callback theory is unproven until a live run shows `step=token` in logs.
- `scripts/verify-containment.mjs` fails on a shallow clone (needs old commit add9dc29); it is unrelated to code changes.

## 2026-10-17 - Branch triage
- 96 remote branches besides master. 41 are fully in master (retire), 13 clean merges (mostly Pitchforks), 12 rebase-then-merge, 29 need Jonathan. Table: `docs/BRANCH-TRIAGE-2026-10.md`.
- All October feature branches (`t_*`, `card/rb-*`, `woden/*`, `harden/*`) stack on `harden/2026-09-06` and are ~540 commits behind master; the free-launch stack tip is `t_2f743162`. Direction of the free-first launch is an open question for Jonathan.
- The cloud clone is shallow by default; ahead/behind counts are wrong until `git fetch --unshallow`.
