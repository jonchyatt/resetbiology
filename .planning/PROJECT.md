# Reset Biology — Education & Research Platform

## What This Is

A comprehensive wellness optimization platform combining breath training, cognitive exercises (N-Back, pitch recognition, ear training), vision training, workout tracking, nutrition logging, peptide protocols, journaling, and gamification — all backed by peer-reviewed science. The platform serves health-conscious adults through a Next.js 15 web app with Auth0 authentication, MongoDB persistence, and Vercel deployment.

## Core Value

Every protocol, exercise, and recommendation on the platform must be justified by real, verifiable peer-reviewed research — building user trust and differentiating from unsubstantiated wellness claims.

## Current Milestone: v1.0 Education & Research Justification

**Goal:** Comprehensively document the scientific basis for every portal feature, rendering as searchable, categorized research on the /education page with real PubMed/DOI citations.

**Target features:**
- Research documentation for all 13 portal domains
- Real verified PubMed citations (replace all placeholder/fake PMIDs)
- Expandable sections per research domain on /education page
- Cross-linking from portal containers to supporting research

## Requirements

### Validated

- Auth0 authentication with Google OAuth
- Portal dashboard with 9 module containers
- Breath training with predefined exercises
- Workout tracking (30+ exercises)
- Nutrition tracking with food database
- Peptide tracker with protocols
- Vision training (Snellen, accommodation, contrast)
- N-Back cognitive training (5 modes)
- Pitch recognition / ear training
- Daily journal with mood tracking
- Education page with search/filter (exists but incomplete research)
- Peptide Co-op page (Zion Direct Care)
- Satori Living Foundation grant integration

### Active

- [ ] Comprehensive research backing for all 13 domains
- [ ] Replace all fake/placeholder PubMed citations with real ones
- [ ] Education page fully populated with verified studies
- [ ] Cross-references between portal modules and supporting science

### Out of Scope

- Voice Agent ecosystem — separate milestone
- Google Drive Vault integration — separate milestone
- Stripe payment enhancements — separate milestone
- New feature development — this milestone is research/documentation only

## Context

- Education page exists at `app/education/page.tsx` with 7 sections, but some studies have placeholder PMIDs
- Project has duplicate routes in `app/` and `src/app/` — Next.js serves `app/` over `src/app/`
- All portal pages use glassmorphic styling with hero-background.jpg
- Production at resetbiology.com, auto-deploy on git push to master
- Testing must be done on production using Chrome DevTools MCP, never localhost

## Constraints

- **Citations**: ALL PubMed IDs and DOIs must be real, verifiable studies
- **Styling**: Must match existing glassmorphic design system (see app/globals.css)
- **Deployment**: Auto-deploy on push, ~4 min build time
- **Testing**: Production only via Chrome DevTools MCP
- **Route priority**: Edit files in `app/` directory, not `src/app/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use /education page as central research hub | Single location for all science, searchable/filterable | — Pending |
| 13 research domains mapped to portal features | Every feature must be justified | — Pending |
| Parallel research agents per domain | Massive parallelization for efficiency | — Pending |

---
*Last updated: 2026-03-18 after milestone v1.0 initialization*
