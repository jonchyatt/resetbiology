# Reset Biology — Education & Research Platform

## What This Is

A comprehensive wellness optimization platform combining breath training, cognitive exercises (N-Back, pitch recognition, ear training), vision training, workout tracking, nutrition logging, peptide protocols, journaling, and gamification — all backed by 74 peer-reviewed PubMed studies across 13 research domains. The platform serves health-conscious adults through a Next.js 15 web app with Auth0 authentication, MongoDB persistence, and Vercel deployment.

## Core Value

Every protocol, exercise, and recommendation on the platform must be justified by real, verifiable peer-reviewed research — building user trust and differentiating from unsubstantiated wellness claims.

## Current State (after v1.0)

**Shipped:** v1.0 Education & Research Justification (2026-03-19)

The /education page now contains 74 verified PubMed studies across 13 research domains with 58 cross-domain connections and portal feature links. Every study was individually verified via HTTP 200 against PubMed. Zero fabricated PMIDs remain.

**Education page stats:**
- 1,782 lines of TypeScript
- 13 research sections (breath, exercise, nutrition, peptides, N-Back, ear training, vision, mental mastery, journaling, accountability, gamification, meditation, general health)
- 74 verified PubMed citations
- 58 cross-domain crossReferences
- 8 category filter buttons
- Honest evidence framing throughout (pilot studies noted, mixed results acknowledged)

## Requirements

### Validated

- ✓ Auth0 authentication with Google OAuth
- ✓ Portal dashboard with 9 module containers
- ✓ Breath training with predefined exercises
- ✓ Workout tracking (30+ exercises)
- ✓ Nutrition tracking with food database
- ✓ Peptide tracker with protocols
- ✓ Vision training (Snellen, accommodation, contrast)
- ✓ N-Back cognitive training (5 modes)
- ✓ Pitch recognition / ear training
- ✓ Daily journal with mood tracking
- ✓ Education page with search/filter — v1.0 (74 verified studies)
- ✓ Peptide Co-op page (Zion Direct Care)
- ✓ Satori Living Foundation grant integration
- ✓ Comprehensive research backing for all 13 domains — v1.0
- ✓ Replace all fake/placeholder PubMed citations with real ones — v1.0
- ✓ Education page fully populated with verified studies — v1.0
- ✓ Cross-references between portal modules and supporting science — v1.0

### Active

(None — next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope

- Voice Agent ecosystem — separate milestone
- Google Drive Vault integration — separate milestone
- Stripe payment enhancements — separate milestone

## Context

- Education page at `app/education/page.tsx` — 1,782 lines, 13 sections, 74 studies
- Production at resetbiology.com, auto-deploy on git push to master
- Project has duplicate routes in `app/` and `src/app/` — Next.js serves `app/` over `src/app/`
- All portal pages use glassmorphic styling with hero-background.jpg
- Testing via Chrome DevTools MCP on production

## Constraints

- **Citations**: ALL PubMed IDs and DOIs must be real, verifiable studies
- **Styling**: Must match existing glassmorphic design system
- **Deployment**: Auto-deploy on push, ~4 min build time
- **Testing**: Production only via Chrome DevTools MCP
- **Route priority**: Edit files in `app/` directory, not `src/app/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use /education page as central research hub | Single location for all science, searchable/filterable | ✓ Good — 13 sections, category filters work well |
| 13 research domains mapped to portal features | Every feature must be justified | ✓ Good — all 13 sections have practicalApplication links |
| Sequential wave execution per phase | All plans modify same file, avoids merge conflicts | ✓ Good — zero merge issues across 17 plans |
| Honest evidence framing | Credibility over marketing — note pilot studies, mixed results | ✓ Good — builds trust, differentiates from competitors |
| crossReferences as data-only field | Wiring stored in study objects, rendered via relevance prose | ⚠️ Revisit — could render as clickable "Related Sections" links |

---
*Last updated: 2026-03-19 after v1.0 milestone completion*
