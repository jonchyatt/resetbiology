# Branch deletions, 2026-10-17

Verified live via the GitHub compare API on 2026-10-17 (0 commits ahead of master, no open PR). Restore any branch with `git push origin <sha>:refs/heads/<name>`.

Status: NOT YET DELETED. The cloud proxy blocks branch deletion (HTTP 403, "Write access to this GitHub API path is not permitted"), so the local seat runs `scripts/delete-retired-branches.sh`.

## To delete (33)

| Branch | Last SHA |
|---|---|
| `cf-b-migration-harness` | `b8155699d21d870da4356c2abceef8be8c09bb60` |
| `chore/stripe-doctor-and-env-fallback` | `682e32e13bb5f76fb418196112a5092dafcd0022` |
| `codex/rb-vision-scroll-integration-20260927` | `9ed5a0885445e981faf98c81d461c1c208962a4e` |
| `codex/rb-vision-split-snellen-20260926` | `f309bce07cc0b6800a81890654c0aefea2a6b9e7` |
| `design/rb-cleanup-2026-10` | `4c91970e4fce070ebe2ed2b6b402940d11cd250c` |
| `feature/nutrition-integration` | `a32e5bda004e4c747eac1bbac477cd7b0d758168` |
| `feature/stripe-catalog-from-mongo` | `fb25b8b28c247ab63d139e068bd1e5d1f8900aea` |
| `fix/auth0-state-parameter-invalid` | `4a70ac1e87ae45b80c6a254d6b3ea2a167aaea88` |
| `fix/portal-modules` | `8bac5a2fd03ac4a8ba33a1253ff92826f9c5d5a5` |
| `fix/rb-fix-1` | `b1dc51315c0762beca7c64b3efd2b05904facfbc` |
| `fix/rb-fix-2` | `d26bc050ab8395259a39432553d2edfe9443fae9` |
| `fix/rb-fix-3` | `8cfcdbe4c525f8e2c5bcc1055cc16efbdc74599f` |
| `fix/rb-fix-4` | `a2c7e387f17b085c86bd000ca63c926782fa7faf` |
| `fix/rb-fix-5` | `9b26a47209d455d9e54434d6308c8ea3c6cc5135` |
| `fix/rb-fix-6` | `6299700ec138f5457303971f262071bdec3ec4ea` |
| `fix/rb-fix-7` | `c8c6a73c5c9678d77ab169a134a104aec0217a15` |
| `fix/rb-fix-8` | `fe0b36c99a5cefefb3800094c690982389a300c5` |
| `fix/rb-followups-1` | `c4a5de41a60f62dface9ac3c5c0c5a9adc0d84f9` |
| `fix/workout-rework` | `1cb83c631c2babf8e4dfa55fcc8bef012e6cfd0e` |
| `hotfix/admin-guard-node-runtime` | `e8a3177814ec9dab3a1b089ddac1e73f837878a1` |
| `hotfix/auth-unify-with-shim` | `5d41520b7fca955d0d5759b66ff8ec5419fff417` |
| `hotfix/login-returnTo-admin-store` | `2b34d78cf95be055430aecca5024ae8bb54020fb` |
| `hotfix/zero-drift-auth` | `db06fa3440d5ec9ccb0c9d45dab9e069f0a89f2b` |
| `online/rb-online-1` | `80d2c3758dfb32df45b497f4216cfe5bf12c8d9f` |
| `rb-connect-flow` | `63d6fe29f4d8f78c44b305c838debdff7fe6c51f` |
| `rb-drive-vault-phase1` | `865b05567490603625c7d2111bd92fa067fc7ba5` |
| `rb-peptide-library` | `03ceebebfa8f6f14ae39f2cc0a204fcf41ec2ab5` |
| `rb-peptide-library-p4` | `3fc7b5c6bcd96707eb968416e3d5533f9e823b09` |
| `recovery-final-working` | `0e8e7bd04ab0f4449fc5a6ebca4dbb60da22683f` |
| `recovery-working-version` | `7bd4686c69cbe7049b94cd52d5037d98399f84f3` |
| `restore-marketing` | `0e8e7bd04ab0f4449fc5a6ebca4dbb60da22683f` |
| `security/anon-crud-hotfix` | `f75779c9f1fce9e19d0aefd29ad94165938ff863` |
| `vision-interactive-overhaul` | `d7fd7f47b821177f362c6a8128b8e3d626c41d39` |

## Kept

| Branch | Reason |
|---|---|
| `card/rb-12-launch-preview` | triage: contained in stack tip t_2f743162, which has not merged (5 ahead) |
| `card/rb-14-protected-preview-preflight` | triage: contained in stack tip t_2f743162, which has not merged (8 ahead) |
| `docs/remove-supabase` | open PR; commits not in master (3 ahead); deleting would lose them |
| `feature/ready-for-stripe-and-portal` | open PR; commits not in master (2 ahead); deleting would lose them |
| `rebuild/site-from-prod` | open PR; commits not in master (1 ahead); deleting would lose them |
| `restore-portal` | open PR; commits not in master (4 ahead); deleting would lose them |
| `t_952c0087` | live-worker t_* branch with unmerged commits (3 ahead) |
| `wip-autosave-` | commits not in master (1 ahead); deleting would lose them |

Also untouched: master, preserve/rb-vision-worktree-scripts, and every branch not marked retire in docs/BRANCH-TRIAGE-2026-10.md.

## Blocker receipt, 2026-10-17 (second attempt, cloud thread)

Re-verified all 33 via `gh api repos/jonchyatt/resetbiology/compare/master...<branch>`: every one is `ahead_by=0`, and each branch tip SHA matches the table above. None is the head of an open PR. (Local `git rev-list` counts are wrong in the cloud clone because it is shallow.)

Command: `bash scripts/delete-retired-branches.sh` (also `git push origin --delete fix/rb-fix-1` alone).
Error: `error: RPC failed; HTTP 403 curl 22 The requested URL returned error: 403` / `fatal: the remote end hung up unexpectedly`. Nothing was deleted. Not routed around.
Next: the local seat runs the script; the card stays WAITING_ON_JON until then.
