# Phase 2 — Drive-Primary Architecture

> **Last Updated:** 2026-04-26
> **Status:** P2.0 plan locked · P2.1 complete · P2.2 in progress
> **Companion docs:** [`VAULT.md`](./VAULT.md) · [`AGENT-VAULT-INTEGRATION.md`](./AGENT-VAULT-INTEGRATION.md)

---

## North Star

The user's Google Drive is the **authoritative store** for their tracking data — peptide protocols, dose logs, workouts, nutrition, breath sessions, vision training, n-back scores, journal entries. Reset Biology ships the UI; the user owns the data.

MongoDB holds **only**: authentication identity, Drive folder pointers, transient cache, and (legacy) data for users who haven't yet connected Drive.

## Why this architecture

1. **Legal/medical liability separation.** Peptides are gray-market. Storing dose schedules + protocol regimens server-side creates a subpoena surface that conflicts with the medical licenses on the line (Jon's CRNA + brother's licenses). Drive-primary moves that surface off our infrastructure. RB provides research access and community — the user owns their research data.

2. **Eliminates structural Atlas pressure.** The 2026-04-26 outage (Mongo M0 quota exhaustion at 6,365 stale `scheduledNotification` rows) is a symptom. The cure is to stop storing that data on our side at all — compute reminders on-demand from Drive data.

3. **Pre-positions for HIPAA-adjacent compliance.** Even if RB never seeks BAA status, the architecture conforms to the principle: medical-adjacent data lives where the patient controls it.

4. **Aligns with the agent vision.** [`AGENT-VAULT-INTEGRATION.md`](./AGENT-VAULT-INTEGRATION.md) already established that 11 voice agents read partition-aware context from Drive. Drive-primary completes the loop — agents read AND the underlying data lives there.

## Current state audit (what already exists)

| Component | Status | Reference |
|---|---|---|
| OAuth flow (5 endpoints) | ✅ Shipped | `app/api/integrations/google-drive/{connect,callback,status,disconnect,sync}` |
| `getDriveClient`, `uploadJsonFile`, `uploadTextFile`, formatters | ✅ Shipped | `src/lib/google-drive.ts` (838 LOC) |
| `createVaultStructure`, `logToVault` | ✅ Shipped | `src/lib/googleDriveService.ts` (187 LOC) |
| **`readFromVault` / `writeToVault` / `isVaultConnected` / cache layer** | ✅ Shipped (commit `4c68bf8d`) | `src/lib/vaultService.ts` (791 LOC) |
| User schema fields | ✅ Shipped | `googleDriveRefreshToken / driveFolder / drivePermissions / googleDriveConnectedAt / googleDriveSyncEnabled` |
| Profile UI Connect/Disconnect (Privacy tab) | ✅ Shipped | `app/profile/page.tsx:374-445` |
| Auto-sync on 6 routes | ✅ Shipped | workout, nutrition, **peptide DOSES**, breath, vision, nback POSTs call `syncUserDataForDate()` |
| 11 voice agents using `buildAgentContext()` | ✅ Shipped (commit `2d5fa698`) | `src/lib/agents/{Peptide,Nutrition,Exercise,Breath,Vision,NBack,Journal,BioCoach,Onboarding,...}` |
| `analyzeQueryIntent`, `compressContext`, `loadCrossPartitionContext` | ✅ Shipped | `vaultService.ts` |

**This is not greenfield.** Phase 2.1 (vault foundation) was completed in December 2025. The remaining gaps are user-facing surfaces and a write-path inversion.

## Gaps (what Phase 2 needs to ship)

### Gap 1 — Onboarding/Connect-Drive UX (P2.2)
Today the only place to connect Drive is `/profile` → Privacy tab → Connect button. No new user discovers it. **Fix:** dedicated `/connect-drive` route + portal-level soft banner + just-in-time hard modal on tracking pages.

### Gap 2 — Protocol storage swap (P2.3)
`/api/peptides/protocols` POST writes to `prisma.user_peptide_protocols.create()` only. **Fix:** when user is Drive-connected, write to `Profile/protocols.json` in their Vault. Mongo holds only `(userId, driveFileId)` pointer. Read path inverts symmetrically.

### Gap 3 — On-demand notification compute (P2.4)
`/api/notifications/send` (every 5 min cron) iterates `ScheduledNotification` queue rows. **Fix:** for Drive-connected users, iterate active protocols from Drive, compute "is now within ±N min of any dose time?", fire push/email if yes. No queue table for connected users. Legacy queue path stays for unconnected users.

### Gap 4 — Existing-user migration (P2.5)
~50 active protocols + 78 dose logs live in Mongo today. **Fix:** on next login of any user with Mongo data + connected Drive, push to Drive then delete from Mongo. 30-day grace period before hard cutover.

## Feature flag

The existing `user.googleDriveConnectedAt` field IS the flag. No new env var.

```typescript
const isDriveConnected = !!user.googleDriveConnectedAt && !!user.driveFolder
```

- `true` → Drive-primary code path
- `false` → Legacy Mongo code path (existing behavior, kept alive indefinitely)

This makes Phase 2 incremental and reversible. Every change adds a Drive branch alongside the existing Mongo branch — nothing is deleted from Mongo until P2.5 migration completes.

## Ship sequence

| Phase | Scope | Commit target |
|---|---|---|
| **P2.0** | This plan doc | THIS COMMIT |
| **P2.1** | `vaultService.ts` foundation | DONE (commit `4c68bf8d`) |
| **P2.2** | `/connect-drive` route + portal banner + (later) just-in-time modal | THIS COMMIT (route + banner) |
| P2.3 | Protocol storage swap (Drive-primary write path on `/api/peptides/protocols` POST + GET) | Next commit |
| P2.4 | On-demand notification compute in `/api/notifications/send` | Next commit |
| P2.5 | Existing-user migration tooling + grace period + cutover | Final commit of Phase 2 |

## Risk + mitigations

| Risk | Mitigation |
|---|---|
| Drive offline during user action | Graceful degrade: read returns empty, write returns error. UI surfaces "Drive unreachable — try again" — never silently falls back to Mongo (which would split state). |
| Refresh token expired (90+ days inactive) | Status endpoint returns `{connected: false, reason: "expired"}` → re-prompt OAuth via `/connect-drive`. |
| User disconnects Drive | Enter "view-only" mode for new protocols. Existing data on their Drive remains untouched. Notifications stop until reconnected. |
| Drive write race condition (two devices) | `writeToVault` reads existing JSON, merges, writes — last-write-wins per-protocol (acceptable for personal data). |
| Migration script orphans data | Mark migrated rows with `migratedAt` field BEFORE deletion. 30-day grace period in case reversal needed. |
| New user can't use peptide tracker without Drive | Just-in-time modal explains why. Soft-block, not hard-block: "Connect Drive to enable tracking" — they can still browse the catalog/research. |

## Success metrics

| Metric | Target | Measurement |
|---|---|---|
| % of new users who connect Drive within 7 days | > 70% | DB count: `googleDriveConnectedAt > createdAt + 7d` |
| % of active users on Drive-primary path | > 90% (post-migration) | `user.googleDriveConnectedAt IS NOT NULL` |
| `ScheduledNotification` queue size | < 1000 rows steady-state | Atlas dashboard |
| MongoDB total document count | Trending DOWN over 90 days | Atlas dashboard |
| Notification delivery success rate | > 99% | `/api/notifications/send` success log |
| `/api/peptides/protocols` POST p99 latency | < 1s | Vercel observability |

## Out of scope for Phase 2

- HIPAA BAA compliance work
- End-to-end encryption of Drive data (Google's drive.file scope already isolates per-app)
- Multi-Drive-account support (single-account per user)
- Drive backup/export (already covered by user owning their own Drive)
- Migrating non-tracking data (Auth0 identity stays in Mongo; that's correct)

## Open questions for Jon (decision required during build)

1. **Just-in-time modal frequency.** Show once per session? Once forever (until they connect)? On every page load? — Recommend: once per session via sessionStorage `vaultPromptDismissed`.
2. **Block vs degrade for unconnected users.** Should `/peptides` actively prevent protocol creation, or allow it in "Mongo legacy mode" forever? — Recommend: hard-block new protocol creation when Drive available but unconnected (clear UX); allow read-only browsing of community/research content always.
3. **Migration prompt cadence.** Monthly nudge for un-migrated users? — Recommend: one prompt 7 days post-Drive-connect, then dormant.
