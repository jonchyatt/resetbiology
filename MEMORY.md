# MEMORY

Dated digest of what Project threads learned. Newest first.

## 2026-10-17 - Branch triage
- 96 remote branches besides master. 41 are fully in master (retire), 13 clean merges (mostly Pitchforks), 12 rebase-then-merge, 29 need Jonathan. Table: `docs/BRANCH-TRIAGE-2026-10.md`.
- All October feature branches (`t_*`, `card/rb-*`, `woden/*`, `harden/*`) stack on `harden/2026-09-06` and are ~540 commits behind master; the free-launch stack tip is `t_2f743162`. Direction of the free-first launch is an open question for Jonathan.
- The cloud clone is shallow by default; ahead/behind counts are wrong until `git fetch --unshallow`.
