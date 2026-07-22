# Reset Biology Vision GODMODE — Requirements

## Foundation

- **FND-01:** Every vision-owned day uses a validated browser local date and IANA timezone; server UTC never owns the member's day.
- **FND-02:** Every vision point award is atomic and idempotent through `DailyAward`, with current values unchanged.
- **FND-03:** Every existing therapeutic canvas and Gabor path is true-DPR at DPR 1, 2, and 3 without CSS-resolution upscaling.
- **FND-04:** Exactly 12 clearly identified automated tester filler sessions are snapshotted and removed; broad deletion is impossible.
- **FND-05:** Reminders, 24 supplement days, pinned saccade, and `testDayOffset` reconcile on production.

## Adult trunk

- **TRK-01:** Gabor difficulty is controlled by a robust visual-threshold staircase; reaction time is bonus-only.
- **TRK-02:** Trials include spatial forced choice, false-alarm penalties, roving, transfer blend, and evidence-backed collinear flankers.
- **TRK-03:** Snellen stimuli are crisp vectors and become distance-anchored after camera calibration; voice remains on-demand.
- **TRK-04:** Detection zones remain low-structure and calm.
- **TRK-05:** One hard session per local day; supplements are above-threshold; plateaus rotate stimuli; sleep/recovery copy is honest and neutral.

## Camera and games

- **CAM-01:** Iris landmark inference, frames, and landmarks remain on device.
- **CAM-02:** Card calibration solves per-device scale/focal behavior; refusal provides a labeled screening-grade fallback.
- **CAM-03:** Lock mode gates scored Snellen by distance; live-rescale preserves angular size while the member moves.
- **CAM-04:** The pipeline uses client-side MediaPipe FaceLandmarker iris landmarks 468–477, the maximum of the two iris widths per frame, a rolling median, and rejects frames with absolute yaw above 15 degrees.
- **GME-01:** The flagship shooter seals the staircase core away from its juice layer.
- **GME-02:** Empty-space action counts as a miss; speed never changes the therapeutic score.
- **GME-03:** All 11 curriculum exercises gain tasteful feedback without replacement or core contamination.

## Branches, art, coach, and headset

- **INT-01:** Dichoptic play requires complementary per-eye information and supports contrast rebalance; amblyopia copy is adjunct-only.
- **CON-01:** Convergence work adapts fusional demand and is not a pencil-pushup toy; eligibility and symptom gates are hard stops.
- **ART-01:** Generated art has provenance, stays outside detection zones, and never replaces procedural optotypes or Gabors.
- **COA-01:** Coach persona source is unresolved in the control inputs: Jon's direct 2026-07-21 request says “inverse-Gil” and says its doctrine file will be supplied, while the separately saved rail copy names the existing Inverse Yale voice constants. Phase 8 may not build until Jon resolves that identity; no worker may re-derive or blend personas.
- **COA-02:** Medical, diagnosis, refraction-cure, and symptom paths are deterministic referral templates, not generated advice.
- **COA-03:** The Quad-Lock belief-installation mechanism, fractionation, confusion, timed peak/seal sequences, forced acceptance, and identity pressure are banned from the health coach regardless of which voice Jon selects.
- **COA-04:** Personal health data never enters a public unauthenticated chat lane; member grounding requires the authenticated private product path.
- **HMD-01:** Per-eye scene logic is independent of flat-screen/anaglyph presentation so WebXR is a renderer swap.
- **HMD-02:** Headset near-vision work is documented as experimental and VAC-aware, never marketed as a cure.

## Universal acceptance

- **ACC-01:** Three tabs, six binocular modes, gates, streaks, points, untimed mode, and enrollment never regress.
- **ACC-02:** Safety stops, reduced motion, rests, 20-20-20, comfort/brightness guidance, and no-shame copy pass each phase.
- **ACC-03:** Build, targeted deterministic checks, blind verification, production phone/desktop/WebKit retest, zero console errors, and dual-eye evidence close every applicable ticket.
- **ACC-04:** Existing on-demand Whisper loading remains user-triggered and is never moved to mount time.
- **ACC-05:** Every deploy follows `git fetch origin master` → `git rebase origin/master` → candidate gates → `git push origin vision-interactive-overhaul:master` → live retest; Vercel CLI is banned.
