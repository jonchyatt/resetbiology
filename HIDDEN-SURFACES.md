# Hidden surfaces

Reset Biology launches **free first**. Jon's 2026-10-06 ruling limits the visible product to signup, peptide tracking, meal tracking, the daily journal, hypnosis/audio modules, their tracking, and the peptide Librarian. The routes below remain built in the repository as the backup we can grow toward, but middleware redirects them to `/get-started` and navigation must not link to them.

## Hidden route families

| Route family | Preserved capability | Why hidden now |
|---|---|---|
| `/store` and `/store/*` | $297 / $597 / $897 protocol packages and peptide product pages | Paid offer is not part of the free-first launch. |
| `/subscription` | $29/month premium subscription | Upgrades come later, after the free product is simplified and standardized. |
| `/order` and `/order/*` | Peptide co-op, ENERGYbits, and non-peptide order surfaces | Revenue and partner surfaces stay offline until the business/entity and partner paths are approved. |
| `/product` and `/product/*` | Product-detail commerce pages | Same paid-surface gate as `/store`. |
| `/pricing` | Compatibility route for old pricing links | Pricing is not public during the free-first launch. |
| `/affiliates` and `/affiliates/*` | Future Reset Biology merchant-affiliate program | Terms and paying entity are not approved. |
| `/cellular-peptide` and `/cellular-peptide/*` | IRB protocol catalog and BioLongevity source links | The catalog is preserved but not part of the launch surface. |
| `/modules` and `/modules/*` | Old hardcoded 90-slot Mental Mastery pages using `/1mmm1.mp3` as a placeholder | Redirected to `/audio`, which serves the real 29-module cloned-voice library. |

The gate lives in the root `middleware.ts` `HIDDEN_SURFACE_PREFIXES` list. To reactivate a surface, Jon must first approve the offer/entity where needed; then remove only that route prefix, restore a matching navigation link, and run the public-readiness checks.

## Preserved catalog and partner work

- The complete cellular protocol implementation remains under `app/cellular-peptide/` and `src/data/cellular-peptide/`.
- Commit `2c46e1d9e` is already an ancestor of this branch. It supplies `app/audio/page.tsx`, `src/components/Audio/ModuleLibrary.tsx`, and 29 MP3s under `public/audio/mmm/`; `/audio` is the canonical hypnosis route.
- BioLongevity product/source URLs remain in the generated peptide research corpus and repository history; they were not deleted. The audit's formerly stripped catalog is intentionally documented here instead of being exposed during the free-first launch.
- ENERGYbits checkout code remains under `app/order/energybits/`, but `/order/*` is hidden. The vendor-request draft is outside this repository at `data/reset-biology/outreach/DRAFT-energybits-affiliate-request-2026-10-06.md`.
- The Cellular Peptide / Elite Biogenix request draft is at `data/reset-biology/outreach/DRAFT-cellular-peptide-elite-biogenix-affiliate-request-2026-10-06.md`.

## Visible launch routes

The header exposes only the free-first surfaces plus the conductor-approved free tools: `/education/peptides` (Librarian), `/peptides`, `/nutrition`, `/journal`, `/audio`, `/breath`, `/education`, and Auth0 login/signup. The Inverse Yale protocol stays out of the launch until a later standardized release.

New users use the existing `subscriber` database value as the compatibility access level, but the launch behavior is free and non-expiring: `subscriptionStatus = active`, `subscriptionExpiry = null`. This is not a paid subscription and does not expose the hidden `/subscription` route.
