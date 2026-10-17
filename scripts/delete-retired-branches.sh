#!/usr/bin/env bash
# Deletes remote branches verified fully merged into master. Restore with: git push origin <sha>:refs/heads/<name>
set -euo pipefail
git push origin --delete cf-b-migration-harness   # b8155699d21d870da4356c2abceef8be8c09bb60
git push origin --delete chore/stripe-doctor-and-env-fallback   # 682e32e13bb5f76fb418196112a5092dafcd0022
git push origin --delete codex/rb-vision-scroll-integration-20260927   # 9ed5a0885445e981faf98c81d461c1c208962a4e
git push origin --delete codex/rb-vision-split-snellen-20260926   # f309bce07cc0b6800a81890654c0aefea2a6b9e7
git push origin --delete design/rb-cleanup-2026-10   # 4c91970e4fce070ebe2ed2b6b402940d11cd250c
git push origin --delete feature/nutrition-integration   # a32e5bda004e4c747eac1bbac477cd7b0d758168
git push origin --delete feature/stripe-catalog-from-mongo   # fb25b8b28c247ab63d139e068bd1e5d1f8900aea
git push origin --delete fix/auth0-state-parameter-invalid   # 4a70ac1e87ae45b80c6a254d6b3ea2a167aaea88
git push origin --delete fix/portal-modules   # 8bac5a2fd03ac4a8ba33a1253ff92826f9c5d5a5
git push origin --delete fix/rb-fix-1   # b1dc51315c0762beca7c64b3efd2b05904facfbc
git push origin --delete fix/rb-fix-2   # d26bc050ab8395259a39432553d2edfe9443fae9
git push origin --delete fix/rb-fix-3   # 8cfcdbe4c525f8e2c5bcc1055cc16efbdc74599f
git push origin --delete fix/rb-fix-4   # a2c7e387f17b085c86bd000ca63c926782fa7faf
git push origin --delete fix/rb-fix-5   # 9b26a47209d455d9e54434d6308c8ea3c6cc5135
git push origin --delete fix/rb-fix-6   # 6299700ec138f5457303971f262071bdec3ec4ea
git push origin --delete fix/rb-fix-7   # c8c6a73c5c9678d77ab169a134a104aec0217a15
git push origin --delete fix/rb-fix-8   # fe0b36c99a5cefefb3800094c690982389a300c5
git push origin --delete fix/rb-followups-1   # c4a5de41a60f62dface9ac3c5c0c5a9adc0d84f9
git push origin --delete fix/workout-rework   # 1cb83c631c2babf8e4dfa55fcc8bef012e6cfd0e
git push origin --delete hotfix/admin-guard-node-runtime   # e8a3177814ec9dab3a1b089ddac1e73f837878a1
git push origin --delete hotfix/auth-unify-with-shim   # 5d41520b7fca955d0d5759b66ff8ec5419fff417
git push origin --delete hotfix/login-returnTo-admin-store   # 2b34d78cf95be055430aecca5024ae8bb54020fb
git push origin --delete hotfix/zero-drift-auth   # db06fa3440d5ec9ccb0c9d45dab9e069f0a89f2b
git push origin --delete online/rb-online-1   # 80d2c3758dfb32df45b497f4216cfe5bf12c8d9f
git push origin --delete rb-connect-flow   # 63d6fe29f4d8f78c44b305c838debdff7fe6c51f
git push origin --delete rb-drive-vault-phase1   # 865b05567490603625c7d2111bd92fa067fc7ba5
git push origin --delete rb-peptide-library   # 03ceebebfa8f6f14ae39f2cc0a204fcf41ec2ab5
git push origin --delete rb-peptide-library-p4   # 3fc7b5c6bcd96707eb968416e3d5533f9e823b09
git push origin --delete recovery-final-working   # 0e8e7bd04ab0f4449fc5a6ebca4dbb60da22683f
git push origin --delete recovery-working-version   # 7bd4686c69cbe7049b94cd52d5037d98399f84f3
git push origin --delete restore-marketing   # 0e8e7bd04ab0f4449fc5a6ebca4dbb60da22683f
git push origin --delete security/anon-crud-hotfix   # f75779c9f1fce9e19d0aefd29ad94165938ff863
git push origin --delete vision-interactive-overhaul   # d7fd7f47b821177f362c6a8128b8e3d626c41d39
