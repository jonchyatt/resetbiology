# Branch deletions, 2026-10-17

Verified live via the GitHub compare API on 2026-10-17 (0 commits ahead of master, no open PR). Restore any branch with `git push origin <sha>:refs/heads/<name>`.

Status: NOT YET DELETED. The cloud proxy blocks branch deletion (HTTP 403, "Write access to this GitHub API path is not permitted"), so the local seat runs `scripts/delete-retired-branches.sh`.

## To delete (0)

| Branch | Last SHA |
|---|---|

## Kept

| Branch | Reason |
|---|---|
| `card/rb-12-launch-preview` | triage says contained in stack tip t_2f743162, which has not merged; 5 ahead |
| `card/rb-14-protected-preview-preflight` | triage says contained in stack tip t_2f743162, which has not merged; 8 ahead |
| `cf-b-migration-harness` | has commits not in master (0 ahead); deleting would lose them |
| `chore/stripe-doctor-and-env-fallback` | has commits not in master (0 ahead); deleting would lose them |
| `codex/rb-vision-scroll-integration-20260927` | has commits not in master (0 ahead); deleting would lose them |
| `codex/rb-vision-split-snellen-20260926` | has commits not in master (0 ahead); deleting would lose them |
| `design/rb-cleanup-2026-10` | has commits not in master (0 ahead); deleting would lose them |
| `docs/remove-supabase` | has commits not in master (3 ahead); deleting would lose them |
| `feature/nutrition-integration` | has commits not in master (0 ahead); deleting would lose them |
| `feature/ready-for-stripe-and-portal` | has commits not in master (2 ahead); deleting would lose them |
| `feature/stripe-catalog-from-mongo` | has commits not in master (0 ahead); deleting would lose them |
| `fix/auth0-state-parameter-invalid` | has commits not in master (0 ahead); deleting would lose them |
| `fix/portal-modules` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-1` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-2` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-3` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-4` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-5` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-6` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-7` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-fix-8` | has commits not in master (0 ahead); deleting would lose them |
| `fix/rb-followups-1` | has commits not in master (0 ahead); deleting would lose them |
| `fix/workout-rework` | has commits not in master (0 ahead); deleting would lose them |
| `hotfix/admin-guard-node-runtime` | has commits not in master (0 ahead); deleting would lose them |
| `hotfix/auth-unify-with-shim` | has commits not in master (0 ahead); deleting would lose them |
| `hotfix/login-returnTo-admin-store` | has commits not in master (0 ahead); deleting would lose them |
| `hotfix/zero-drift-auth` | has commits not in master (0 ahead); deleting would lose them |
| `online/rb-online-1` | has commits not in master (0 ahead); deleting would lose them |
| `rb-connect-flow` | has commits not in master (0 ahead); deleting would lose them |
| `rb-drive-vault-phase1` | has commits not in master (0 ahead); deleting would lose them |
| `rb-peptide-library` | has commits not in master (0 ahead); deleting would lose them |
| `rb-peptide-library-p4` | has commits not in master (0 ahead); deleting would lose them |
| `rebuild/site-from-prod` | has commits not in master (1 ahead); deleting would lose them |
| `recovery-final-working` | has commits not in master (0 ahead); deleting would lose them |
| `recovery-working-version` | has commits not in master (0 ahead); deleting would lose them |
| `restore-marketing` | has commits not in master (0 ahead); deleting would lose them |
| `restore-portal` | has commits not in master (4 ahead); deleting would lose them |
| `security/anon-crud-hotfix` | has commits not in master (0 ahead); deleting would lose them |
| `t_952c0087` | live-worker t_* branch with unmerged commits (3 ahead) |
| `vision-interactive-overhaul` | has commits not in master (0 ahead); deleting would lose them |
| `wip-autosave-` | has commits not in master (1 ahead); deleting would lose them |

Also untouched: master, preserve/rb-vision-worktree-scripts, and every branch not marked retire in docs/BRANCH-TRIAGE-2026-10.md.
