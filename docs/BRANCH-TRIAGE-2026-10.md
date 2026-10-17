# Branch triage, October 2026

Generated 2026-10-17 from `origin` (all heads except `master`). Recommendations only: nothing was merged, deleted, rebased, or force-pushed to produce this.

## How to read it

- **Ahead / behind** are commit counts against `origin/master` (`fe0b36c9`, 2026-10-16), measured on a full (unshallowed) clone.
- **Merges clean?** comes from `git merge-tree` against current master. Clean does not mean correct.
- **Member-data / gated path** lists any file the branch changes from the gated list in the project rules: `member-data.ts`, `memberExport.ts`, `journalDelete.ts`, `driveSyncQueue.ts`, `google-drive.ts`, `journalDay.ts`, `localDay.ts`, `adminGuard.ts`, `products/route.ts`, `products/non-peptide`, `products/by-slug`, `next.config.ts`, `prisma/schema.prisma`, cron routes, Drive-drain routes, delete routes. "no" means none of those files changed. It is a file-name check, not a read of the code. Several "no" branches (journal explorer, hydration, mood, meal, report export) are still member-data features; they are called out in the notes.
- **Retire** means every commit is already reachable from master, so deleting the branch loses nothing. Several `t_*` and `card/*` branches belong to live local workers (rule 7); Jonathan decides.
- A branch marked retire with a note "contained in X" is only safe to delete once X has merged or been dropped on purpose; branches with "fully in master" are safe now.
- Open PR numbers are from the GitHub API on 2026-10-17. Descriptions come from commit subjects and PR bodies; I did not run any branch.

## Summary

96 branches: ask Jonathan 29, keep 1, merge 13, rebase-then-merge 12, retire 41.

### Stacks (why many branches show the same files)

- **Free-launch stack.** `harden/2026-09-06` -> `harden/rb-free-lanes-20261006` (PR #28) -> `card/rb-11` (PR #31). Separately `fix/rb-public-readiness-20261006` (PR #27) -> `card/rb-12` -> `card/rb-14` -> `card/rb-13` (PR #33) -> `card/rb-15` (PR #35) -> `t_2f743162` (hydration, tip). Merging the tip means merging all of it. Decide the launch direction first; master has gone a different way since (fix-1 to fix-8).
- **Meal / journal / mood line.** `woden/rb-05-meal-journal` -> `t_0a103957` (meal templates) -> `t_60aede0c` (journal explorer) -> `t_0a473b43` (mood timeline, tip).
- **Peptide line.** `woden/rb-04-peptide-library-growth` -> `t_8e307e0a` (history report) -> `t_2f3e5f4c` (weekly report). `t_9a9a0b7c` (sourced library) branches off the same base.
- **Pitchforks.** `pf-13` -> `t_94baa3b7`; `pf-8` -> `pf-14` -> `t_dd56ed50`; `pf3/refresh` -> `t_227ff35b`.
- Every October stacked branch also carries the two `harden/2026-09-06` commits (CodeGraph docs, 29-module audio wiring), which is why they all show about 540 commits behind master.

### Open question for Jonathan

Is the free-first launch (PR #27 and its stack) still the plan? Master already contains the fix-1 to fix-8 work and the public-face branch, and those do not include the free-launch surface hiding. Until that is answered, every branch in the stack is "ask".

### Not verified

- Whether the "rebase-then-merge" branches still work after rebasing; I did not rebase or build any of them.
- Whether the July Vision and Pitch Defender draft PRs were superseded in master by other means.
- Branch protection and which branches live workers are using right now.
- `harden/2026-09-06` audio-library commit: whether master already has equivalent code.

## Table

| Branch | Last commit | Ahead | Behind | Merges clean? | Member-data / gated path | What it carries | Recommendation | Notes |
|---|---|---|---|---|---|---|---|---|
| `card/pf-13-standalone-detector-benchmark` | 2026-10-11 | 2 | 92 | yes | no | Pitchforks: standalone browser pitch-detector benchmark | **merge** | Contained in t_94baa3b7; merge that one instead. |
| `card/pf-14-normal-route-preview` | 2026-10-09 | 9 | 92 | yes | yes (next.config.ts) | Pitchforks: normal-route persistence gate (PR #36) | **ask Jonathan** | Edits next.config.ts. Contained in t_dd56ed50. |
| `card/pf-6-build-identity` | 2026-10-06 | 1 | 92 | yes | yes (next.config.ts) | Deployed build SHA, /version endpoint (PR #32) | **ask Jonathan** | Edits next.config.ts (gated). |
| `card/pf-8-connected-candidate` | 2026-10-07 | 8 | 92 | yes | yes (next.config.ts) | Pitchforks III connected PF-2/3/6 candidate (PR #34) | **ask Jonathan** | Edits next.config.ts; includes pf-6. Contained in pf-14 and t_dd56ed50. |
| `card/pfii-responsive-frame` | 2026-10-11 | 1 | 92 | yes | no | Pitchforks II: responsive arena frame | **merge** |  |
| `card/rb-11-auth0-state-callback` | 2026-10-06 | 4 | 539 | no | no | Auth0 passwordless callback state fix (PR #31) | **rebase-then-merge** | Auth code; the seat should read it. Stacked on harden/rb-free-lanes. |
| `card/rb-12-launch-preview` | 2026-10-06 | 5 | 539 | no | no | Free-launch preview (surgical nutrition change) | **retire** | Contained in the free-launch stack tip t_2f743162. |
| `card/rb-13-integrated-free-candidate` | 2026-10-07 | 12 | 539 | no | yes (schema.prisma) | RB-13 integrated free-launch candidate (PR #33) | **ask Jonathan** | Part of the free-first launch stack (see notes). Product call. |
| `card/rb-14-protected-preview-preflight` | 2026-10-07 | 8 | 539 | no | no | Preview build identity and preflight probe (later reverted in stack) | **retire** | Contained in the stack tip; the stack reverts it. |
| `card/rb-15-restyled-free-candidate` | 2026-10-07 | 14 | 539 | no | yes (schema.prisma) | RB-15 restyled free-launch candidate (PR #35) | **ask Jonathan** | Part of the free-first launch stack. Product call. |
| `card/rb-16-local-free-journey-harness` | 2026-10-07 | 9 | 539 | no | no | Credential-free free-journey test harness | **rebase-then-merge** | Test tooling; useful if the free-launch stack is kept. |
| `card/t_afced160` | 2026-10-07 | 4 | 539 | no | no | WIP salvage from the conductor | **ask Jonathan** | Unlabelled WIP; four commits on top of harden/2026-09-06. |
| `cf-b-migration-harness` | 2026-07-17 | 0 | 371 | yes | no | Drive vault migration harness | **retire** | Fully in master. |
| `cf-c2-journal-inversion` | 2026-07-18 | 21 | 367 | no | yes (driveSyncQueue.ts, google-drive.ts) | Drive vault: journal inversion, C3-C5 fixes | **ask Jonathan** | Touches driveSyncQueue.ts and google-drive.ts (gated). 21 commits from July; master has since reworked the Drive path. |
| `chore/stripe-doctor-and-env-fallback` | 2025-09-29 | 0 | 1416 | yes | no | feat: unify peptide library with MongoDB for single source of truth | **retire** | Fully in master (no commits ahead). |
| `claude/branch-triage-2026-10-y4vtxo` | 2026-10-16 | 0 | 0 | yes | no | This triage PR branch | **keep** | Becomes the PR head. |
| `claude/investigate-plugins-0Gper` | 2026-01-25 | 2 | 1010 | no | no | Ethereal Flame video creator planning doc | **ask Jonathan** | Docs only (2 files), January. |
| `codex/issue-10-vision-progress-charts` | 2026-07-03 | 1 | 551 | no | no | Vision progress trend charts (PR #18, draft) | **ask Jonathan** | July draft; 551 behind master, conflicts. |
| `codex/issue-11-binocular-data-collection` | 2026-07-03 | 1 | 551 | no | yes (schema.prisma) | Vision binocular session data (PR #17, draft) | **ask Jonathan** | Adds Prisma fields; conflicts; July. |
| `codex/issue-12-vision-overhaul-phase-a` | 2026-07-02 | 1 | 553 | no | no | Vision exercise engine runner (PR #12, draft) | **ask Jonathan** | PR #22 says it supersedes this; July. |
| `codex/issue-14-guided-exercise-demos` | 2026-07-03 | 1 | 551 | no | no | Vision guided exercise demo animations (PR #19, draft) | **ask Jonathan** | July draft; conflicts. |
| `codex/issue-15-vision-prd-defect-sweep` | 2026-07-03 | 1 | 551 | no | no | Vision PRD defect sweep (PR #16, draft) | **ask Jonathan** | July draft; conflicts. |
| `codex/issue-20-pitchforks-meter-parity` | 2026-07-02 | 1 | 553 | yes | no | Pitch Defender v1 hold-meter parity (PR #13, draft) | **ask Jonathan** | Clean merge, but July and possibly overtaken by Pitchforks III. |
| `codex/issue-21-cross-device-pitch-scores` | 2026-07-03 | 1 | 553 | yes | yes (schema.prisma) | Cross-device pitch score sync, new GameScore model (PR #15, draft) | **ask Jonathan** | Adds a Prisma model and a user-score route; seat must read schema first. |
| `codex/issue-22-singing-baselines-volume-sliders` | 2026-07-02 | 1 | 553 | yes | no | Singing games 0-200% volume sliders (PR #14, draft) | **ask Jonathan** | Clean merge, but July and possibly overtaken. |
| `codex/rb-vision-scroll-integration-20260927` | 2026-09-27 | 0 | 95 | yes | no | Binocular follow-scroll acceptance doc | **retire** | Fully in master. |
| `codex/rb-vision-split-snellen-20260926` | 2026-09-26 | 0 | 103 | yes | no | Binocular Snellen split verification | **retire** | Fully in master. |
| `codex/vision-command-fastpath-20260926` | 2026-09-26 | 2 | 107 | no | no | Gated local voice commands for vision charts | **ask Jonathan** | 2 commits, conflicts. |
| `codex/vision-training-live` | 2026-07-11 | 2 | 500 | no | no | Vision Training live-build area (PR #22, draft) | **ask Jonathan** | Checkpoint Mode umbrella; conflicts. |
| `design/rb-cleanup-2026-10` | 2026-10-11 | 0 | 85 | yes | no | Motion/press-helper design cleanup | **retire** | Fully in master. |
| `docs/remove-supabase` | 2025-09-11 | 3 | 1467 | no | no | Remove Supabase from docs (PR #3, 2025) | **retire** | Superseded long ago. |
| `feature/nutrition-integration` | 2025-10-09 | 0 | 1267 | yes | no | fix: Regenerate package-lock.json to fix Vercel npm install error | **retire** | Fully in master (no commits ahead). |
| `feature/ready-for-stripe-and-portal` | 2025-09-11 | 2 | 1467 | no | no | Session-aware nav, portal guard, Stripe scaffold (PR #2, 2025) | **retire** | Superseded. |
| `feature/stripe-catalog-from-mongo` | 2025-09-17 | 0 | 1445 | yes | no | Add comprehensive admin store interface with product and price management | **retire** | Fully in master (no commits ahead). |
| `fix/auth0-state-parameter-invalid` | 2025-09-19 | 0 | 1423 | yes | no | Add user-friendly error page when Stripe is not configured | **retire** | Fully in master (no commits ahead). |
| `fix/portal-modules` | 2026-07-20 | 0 | 233 | yes | no | Merge branch 'master' into fix/portal-modules | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-1` | 2026-10-15 | 0 | 28 | yes | no | RB-FIX-1: fix ten defects from the 2026-10-15 black-box bug hunt | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-2` | 2026-10-15 | 0 | 25 | yes | no | rb-fix-2: member-day journal lines, Completed badge, frequency edit, history pri | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-3` | 2026-10-16 | 0 | 22 | yes | no | rb-fix-3: journal entry delete, every same-day dose line kept, newsletter sender | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-4` | 2026-10-16 | 0 | 21 | yes | no | rb-fix-4: selected-day heading uses the day key, not the server's UTC-midnight i | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-5` | 2026-10-16 | 0 | 20 | yes | no | rb-fix-5: public-page fixes from the 2026-10-16 hunt | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-6` | 2026-10-16 | 0 | 14 | yes | no | RB-FIX-6 item 1: server page wrapper for Meditation Visuals (admin check, title) | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-7` | 2026-10-16 | 0 | 14 | yes | no | rb-fix-7: isolation check follows readable export | **retire** | Fully in master (no commits ahead). |
| `fix/rb-fix-8` | 2026-10-16 | 0 | 0 | yes | no | fix-8: module completion sends member local day/time; non-peptide catalog + by-s | **retire** | Same commit as the master tip. |
| `fix/rb-followups-1` | 2026-10-15 | 0 | 23 | yes | no | Merge remote-tracking branch 'origin/master' into followups-merge | **retire** | Fully in master (no commits ahead). |
| `fix/rb-public-readiness-20261006` | 2026-10-06 | 5 | 539 | no | no | Free-first public launch surface (PR #27) | **ask Jonathan** | Hides Librarian, education, breath, pricing; retains code. Product call. Contained in t_2f743162. |
| `fix/rb-voice-metering-20261006` | 2026-10-06 | 3 | 539 | no | no | Reserve included voice minute before AI calls (PR #26) | **rebase-then-merge** | Rebase onto master, drop the two harden/2026-09-06 commits it inherited. No gated paths touched. |
| `fix/workout-rework` | 2026-07-19 | 0 | 294 | yes | no | Merge origin/master into fix/workout-rework (integrate 31 newer master commits b | **retire** | Fully in master (no commits ahead). |
| `harden/2026-09-06` | 2026-07-22 | 2 | 539 | no | no | CodeGraph docs note + 29-module audio library wiring | **ask Jonathan** | Base of every October stacked branch. The audio-library commit needs a check that master has it. |
| `harden/rb-free-lanes-20261006` | 2026-10-06 | 3 | 539 | no | no | Route RB experts and voice via free lanes (PR #28) | **ask Jonathan** | Removes OpenAI fallback; cost decision. Stack base for rb-11/13/15. |
| `hotfix/admin-guard-node-runtime` | 2025-09-18 | 0 | 1444 | yes | no | Admin guard Node runtime (2025) | **retire** | Fully in master. |
| `hotfix/auth-unify-with-shim` | 2025-09-18 | 0 | 1442 | yes | no | Auth shim (2025) | **retire** | Fully in master. |
| `hotfix/login-returnTo-admin-store` | 2025-09-18 | 0 | 1443 | yes | no | Login returnTo (2025) | **retire** | Fully in master. |
| `hotfix/zero-drift-auth` | 2025-09-18 | 0 | 1441 | yes | no | Auth drift fix (2025) | **retire** | Fully in master. |
| `online/rb-online-1` | 2026-10-15 | 0 | 28 | yes | no | Public face: titles, schema, /llms.txt, /about | **retire** | Fully in master. |
| `pf3/audio-instrument-20261006` | 2026-10-06 | 2 | 92 | yes | no | Pitchforks III audio instrumentation (PR #30) | **merge** | Receipts included; measurement honestly records dropouts. |
| `pf3/entry-flow-20261006` | 2026-10-06 | 1 | 92 | yes | no | Pitchforks III adventure-first entry (PR #29) | **merge** |  |
| `pf3/refresh-20261006` | 2026-10-06 | 1 | 92 | yes | no | Pitchforks audit refresh (receipts) | **merge** | Contained in t_227ff35b. |
| `preserve/rb-vision-worktree-scripts` | 2026-07-19 | 1 | 261 | no | no | Two orphaned probe/login scripts | **ask Jonathan** | rb-login-jon.mjs may hold personal login details; read before keeping. |
| `rb-connect-flow` | 2026-07-15 | 0 | 382 | yes | no | Merge remote-tracking branch 'origin/master' into rb-connect-flow | **retire** | Fully in master (no commits ahead). |
| `rb-drive-vault-phase1` | 2026-07-13 | 0 | 428 | yes | no | Merge remote-tracking branch 'origin/master' into rbw-drive-vault-work | **retire** | Fully in master (no commits ahead). |
| `rb-muscle-preservation-engine-v2` | 2026-07-22 | 12 | 169 | yes | no | Workout muscle-preservation engine plans, 12 commits | **ask Jonathan** | Mostly plan/docs commits; July. |
| `rb-peptide-library` | 2026-07-17 | 0 | 379 | yes | no | feat(peptides): searchable library hub + Start Protocol deep-links | **retire** | Fully in master (no commits ahead). |
| `rb-peptide-library-p4` | 2026-07-18 | 0 | 363 | yes | no | feat(peptides): T-A7 tracker top surface — today-first daily-prescription UX,  | **retire** | Fully in master (no commits ahead). |
| `rb-tracker-fixes-9c73` | 2026-07-19 | 2 | 251 | no | no | Peptide edit: Mon-Fri and custom day lists | **ask Jonathan** | Check whether master already has it. |
| `rebuild/site-from-prod` | 2025-10-02 | 1 | 1334 | no | yes (next.config.ts, schema.prisma, schema.prisma.bak-20250910-231350, schema.prisma.bak-drop-nextauth-20250910-234439, schema.prisma.bak-fixobjid-20250910-232756, adminGuard.ts, google-drive.ts) | Site rebuild scaffold (PR #11, Oct 2025) | **retire** | Superseded; touches old schema backups and adminGuard. |
| `recovery-final-working` | 2025-09-11 | 0 | 1467 | yes | no | Restore marketing site from src/legacy_app; keep auth/portal intact | **retire** | Fully in master (no commits ahead). |
| `recovery-working-version` | 2025-09-11 | 0 | 1468 | yes | no | Implement Auth0 middleware-mounted /auth/* routes | **retire** | Fully in master (no commits ahead). |
| `restore-marketing` | 2025-09-11 | 0 | 1467 | yes | no | Restore marketing site from src/legacy_app; keep auth/portal intact | **retire** | Fully in master (no commits ahead). |
| `restore-portal` | 2025-09-11 | 4 | 1467 | no | no | Restore portal/admin from legacy app (PR #4, 2025) | **retire** | Superseded. |
| `security/anon-crud-hotfix` | 2026-07-13 | 0 | 470 | yes | no | chore(security): drop middleware PII log line + rm 2 confirmed-dead duplicate fi | **retire** | Fully in master (no commits ahead). |
| `t_0a103957` | 2026-10-15 | 4 | 539 | no | yes (schema.prisma) | Private meal templates and repeat flow | **rebase-then-merge** | Stack: includes rb-05 meal-journal. Changes schema.prisma. |
| `t_0a473b43` | 2026-10-16 | 6 | 539 | no | yes (schema.prisma) | Private mood and energy timeline | **rebase-then-merge** | Stack tip: includes meal templates and journal explorer. Changes schema.prisma. |
| `t_19816700` | 2026-10-16 | 1 | 21 | yes | no | Pitchforks: tempo encore isolation test | **merge** |  |
| `t_227ff35b` | 2026-10-12 | 2 | 92 | yes | no | Pitchforks III offline practice shell (PR #37) | **merge** | Service worker scoped to one route. Includes pf3/refresh. |
| `t_2f3e5f4c` | 2026-10-11 | 5 | 539 | no | no | Weekly Reset report export | **rebase-then-merge** | Stack: includes peptide history. Member data export; seat reads first. |
| `t_2f743162` | 2026-10-16 | 16 | 539 | no | yes (schema.prisma) | Private hydration history; also tip of the whole free-launch stack | **ask Jonathan** | 16 commits. Contains RB-12..16, public readiness, free-lanes. Changes schema.prisma. |
| `t_4be31a68` | 2026-10-16 | 1 | 21 | yes | no | Pitchforks: share-safe mastery card | **merge** | Shared card goes out under the brand; skim the copy. |
| `t_595f07bc` | 2026-10-15 | 1 | 25 | yes | no | Pitchforks: Cathedral Songcraft finale | **merge** |  |
| `t_60235bdc` | 2026-10-15 | 1 | 26 | yes | no | Pitchforks: sound constellation and audio relief map | **merge** |  |
| `t_60aede0c` | 2026-10-15 | 5 | 539 | no | yes (schema.prisma) | Private searchable journal explorer | **rebase-then-merge** | Stack: includes meal templates. Changes schema.prisma. |
| `t_73382fea` | 2026-10-11 | 2 | 92 | yes | no | Retro blaster enemy dive receipt (docs) | **merge** |  |
| `t_8e307e0a` | 2026-10-11 | 4 | 539 | no | no | Personal peptide history report | **rebase-then-merge** | Stack: includes protocol library growth. |
| `t_94baa3b7` | 2026-10-11 | 3 | 92 | yes | no | Pitchforks: pesto detector adapter repair | **merge** | Includes pf-13 benchmark. |
| `t_952c0087` | 2026-10-07 | 3 | 539 | no | yes (schema.prisma) | WIP salvage, meal journal (disk emergency) | **retire** | Contained in woden/rb-05 and the later meal branches. |
| `t_9a9a0b7c` | 2026-10-11 | 4 | 539 | no | no | Searchable sourced peptide protocol library | **ask Jonathan** | Protocol content; each source must be checked before it is shown. |
| `t_9fc7cca2` | 2026-10-16 | 3 | 539 | no | yes (schema.prisma) | Private recipe builder with immutable meal snapshots | **rebase-then-merge** | Changes schema.prisma. |
| `t_b64e9040` | 2026-10-11 | 2 | 63 | yes | no | Pitchforks: microphone readiness check | **merge** |  |
| `t_b7a6ac54` | 2026-10-16 | 3 | 539 | no | yes (schema.prisma) | Barcode meal confirmation | **rebase-then-merge** | Changes schema.prisma. |
| `t_dd56ed50` | 2026-10-11 | 10 | 92 | yes | yes (next.config.ts) | Pitchforks: unified horror art and soundtrack | **ask Jonathan** | 149 files; edits next.config.ts; art and audio go out under the brand. Includes pf-8 and pf-14. |
| `vision-interactive-overhaul` | 2026-07-19 | 0 | 261 | yes | no | test(vision): oracle-gabor-placement — add per-session preservation check (bli | **retire** | Fully in master (no commits ahead). |
| `wip-autosave-` | 2025-10-02 | 1 | 1334 | no | yes (next.config.ts, schema.prisma, schema.prisma.bak-20250910-231350, schema.prisma.bak-drop-nextauth-20250910-234439, schema.prisma.bak-fixobjid-20250910-232756, adminGuard.ts, google-drive.ts) | WIP autosave (Oct 2025) | **retire** | Autosave, superseded. |
| `woden/rb-04-peptide-library-growth` | 2026-10-11 | 3 | 539 | no | no | Source protocol references for peptides | **rebase-then-merge** | Contained in t_8e307e0a, t_9a9a0b7c, t_2f3e5f4c. |
| `woden/rb-04-peptide-track` | 2026-10-07 | 3 | 539 | no | no | WIP salvage, neutral peptide tracker | **ask Jonathan** | Disk-emergency WIP; compare to the free-launch stack. |
| `woden/rb-05-meal-journal` | 2026-10-07 | 3 | 539 | no | yes (schema.prisma) | Meal journal, local-day idempotent saves (WIP salvage) | **rebase-then-merge** | Contained in the t_0a103957 / t_0a473b43 / t_60aede0c line. Changes schema.prisma. |
| `woden/rb-restyle-20261006` | 2026-10-07 | 3 | 539 | no | no | Slate/teal restyle (WIP salvage) | **ask Jonathan** | Restyle also in the free-launch stack. |
