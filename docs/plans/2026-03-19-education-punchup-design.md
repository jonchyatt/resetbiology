# Education Page Punch-Up + Missing Exercise Content

**Date:** 2026-03-19
**Status:** Approved

## Problem

The education page has 74 verified PubMed studies but reads like an academic journal. Every study needs a direct, factual benefit statement (TLDR) that leads with "why this matters to you." Additionally, key exercise research is missing: isometric exercise for blood pressure and hypertrophy, and movement snacking for metabolism.

## Scope

### 1. Data Model: Add `tldr` field to Study interface

```typescript
interface Study {
  // ... existing fields
  tldr: string  // Direct benefit statement — "Your tendons need Gelatin + Vitamin C before you train"
}
```

TLDR tone: **Confident, factual, direct benefit.** Not clickbait. Not questions. Not hyperbole.

Examples of the correct tone:
- "Your tendons need Gelatin + Vitamin C before you train"
- "Breathing method improves your immune system"
- "223 studies: Slow your breathing, improve your nervous system"
- "Isometric holds create hypertrophy"
- "Breathing method leads to best autophagy stimulation"

### 2. New Exercise Research (3-4 verified studies)

| Topic | Research Target | Example TLDR |
|-------|----------------|--------------|
| Isometric exercise + blood pressure | 2023 BJSM meta-analysis (Edwards et al.) — isometrics beat cardio and drugs for BP | "Isometric exercise lowers blood pressure better than medication" |
| Isometric exercise + hypertrophy | Time-under-tension / mechanical tension research | "Isometric holds build muscle through sustained mechanical tension" |
| Movement snacking | Sitting break research — brief exercise every 30-60 min | "10 squats every 45 minutes rescue your metabolism from sitting" |

### 3. Rewrite all `relevance` fields

Lead with "Why this matters:" before cross-references. Make it personal and direct.

### 4. "On The Horizon" section

New ResearchSection at end of page:
- Blood Flow Restricted (BFR) training teaser
- Rebounder / mini trampoline benefits teaser
- User engagement: "What should we research next? Share your suggestion"
- No fake studies — topic descriptions only with "Research in progress"

### 5. UI Changes

- Render `tldr` as a bold headline above the academic title when study card is expanded
- "On The Horizon" section styled differently (coming-soon aesthetic)
- User suggestion link/form in the horizon section

## Constraints

- ALL new PMIDs must be real, verified via PubMed fetch
- Existing 74 PMIDs unchanged
- TypeScript must compile
- Build must pass
- Auto-deploys on push

## Out of Scope

- Full BFR training research (future milestone)
- Full rebounder research (future milestone)
- New portal features
