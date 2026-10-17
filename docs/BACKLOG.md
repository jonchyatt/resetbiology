# Backlog, 2026-10-17 (refill 2)

Written under the SEAT CONTRACT: everything is green unless it moves money, signs or binds, publishes under Jonathan's or a business name, destroys or cannot be undone, or hands credentials to a third party. Receipts are cited; anything not run is marked "not verified".

## Shipped

Merged on master: #38 to #43 (branch triage, Visit-seller links, email-capture card, rebased reports and voice metering, RBP-5, RBP-6), #45 (this backlog), #46 (funder page budget and slots), #47 (Cloudflare card), #48 (33-branch deletion list), #49 (lint to zero, public smoke test), #50 (email-capture preview, flag-off test, opt-in copy), #51 (OutboundLink and "From the same builder" row). #44 was closed in favour of #46, which carried its commits.

Open and marked ready, waiting on the local seat (rule 8):

| PR | What | Flag |
|---|---|---|
| #52 | Free-tool landing pages at `/tools/[slug]` (5 tools) | `NEXT_PUBLIC_RB_TOOL_PAGES` off |
| #53 | Flag-gated operator line on /privacy and /terms | `NEXT_PUBLIC_OPERATOR_LINE` off |
| #54 | Visit-seller click count, server log only | `NEXT_PUBLIC_RB_STORE_CLICKS` off |
| #55 | Free-launch replay: surface hiding and paid-AI denial | `NEXT_PUBLIC_FREE_LAUNCH` off |
| #56 | Branch retirement re-verified; cloud deletion still 403 | none (docs) |
| #57 | Weekly Reset report preview with synthetic data | `NEXT_PUBLIC_RB_REPORT_PREVIEW` off |

Not shipped: startup-credits `docs/credits/ENTITY-FACTS.md` (old queue item 2). Blocker receipt: the push of that draft was denied from the cloud; no file reached the repo. Re-queued as item 3 below.

Receipts are as stated in each PR body. Several say "not verified in a browser"; item 12 closes that.

## Queued: twelve threads, ordered by revenue (nearest dollar first)

Every item names its source. "Source gap" means the repo and threads do not hold the input (rule 10).

1. **Funder page amounts and measure.** Fill `BUDGET`, `EQUIPMENT_LOCATION`, `OPERATOR`, `SUCCESS_MEASURE` at the top of `app/community/womens-health/page.tsx` the moment the application wording is pasted, then re-render at 390px and 1280px. Source: `docs/grants/VERIZON-WEBSITE-SECTION.md` line 32, PR #46. Source gap: amounts, location, operator, measure, revenue band. Revenue: the $10,000 award. Red 3 only at the flag flip.
2. **Startup-credits entity pack.** Re-draft `docs/credits/ENTITY-FACTS.md`: legal name, site, verified versus unverified facts, reusable answer block for cloud, AI and payments programs. Source: `approvals/2026-10-17-credits-application.md`, `/privacy` and `/terms` entity comments. Source gap: link between Satori Enterprises, Inc. and Reset Biology, and equipment ownership. Drafting green; submitting red 2; credentials red 5.
3. **Land the open PRs in revenue order.** Per-PR checklist for the seat (#52, #53, #54, #55, #57, then #56): what to read, what flag stays off, what to run. Docs only, no code. Source: PR bodies above. Revenue: unblocks every item below.
4. **Vision training copy.** PR #52 skipped Vision training because no description exists in the repo. Draft one candidate paragraph from `docs/VISION-HEALING-MANUAL.md` and `docs/plans/vision-training-interactive-overhaul.md` (including its stop rule: pain, dizziness, double vision, persistent blur), add the entry to `src/config/toolPages.ts` with its source named, and extend the contract test. Source gap on any medical claim: use only what the manual states.
5. **Email capture on the tool pages.** Confirm the `/tools/[slug]` email card (#52) uses the same flag and double opt-in copy as #50, add a render test for flag off on a tool page. The newsletter sender stays off-limits (rule 2). Revenue: owned audience.
6. **Free-launch replay, second slice.** #55 left four items: the `auth0.ts` signup grant change (member creation, gated by rule 6 review), Header and homepage, FoodQuickAdd camera removal, Workers AI routing. One small PR per surface, each flag-off. Source: `docs/FREE-LAUNCH-REPLAY.md` (on #55).
7. **Link-outs placement review.** Source: `docs/SAME-BUILDER-LINKOUTS.md`, `EnhancedDashboard.tsx` parked Emotional Health tile. Add the row to the /tools pages, and point the parked tile at the shared `OutboundLink`. Source gap: the public domain wording and URL (Jonathan's call). Red 3 at flag flip.
8. **Store seller links, real URLs.** `src/config/sellerLinks.ts` ships empty, so every Visit-seller button is disabled ("Seller link coming soon"). Build a fill-in checklist with the exact keys and a test that fails if a live key is not an https URL. Source gap: vendor URLs and referral terms. Revenue: referral fees.
9. **Patron wall.** Source gap: no patron, sponsor or donor content or data model exists in the repo (searched `app`, `src`, `docs`, `approvals`). Thread's first job is a one-page spec from Jonathan's words, then a static flag-off page with synthetic names only (rule 4). Any real name or payment link is red 3 or 1.
10. **Analytics loop.** Source gap: no analytics package is in `package.json`. #54 logs `store_click` lines server-side; build a script that tallies Visit-seller clicks and `/tools` views from server logs into a weekly markdown table, no new Mongo collection (Atlas rule in CLAUDE.md). Adding a third-party script is a red 5 question for the seat.
11. **Funder page evidence strip.** Add an "at a glance" block that reuses figures already attributed to the application (1,200 attributed in #44/#46), no new number. Add a robots/noindex test so the page stays noindex until the flag flips. Source: `docs/grants/VERIZON-WEBSITE-SECTION.md`.
12. **Render pass on the flagged pages.** #52, #53, #54, #57 and the funder page were never run in a browser. With each flag on locally, screenshot at 390px and 1280px, list defects, fix the cheap ones. Mark what was run versus not.

## Red (named) and the card for each

| Item | Which red | Card | Built up to the line |
|---|---|---|---|
| Turn on `NEXT_PUBLIC_FUNDER_PAGE` | 3 | `approvals/2026-10-17-funder-page-flag-on.md` | Page, footer link, budget slots, noindex |
| Turn on `NEXT_PUBLIC_OPERATOR_LINE` | 3 | `approvals/2026-10-17-operator-line-legal-pages.md` | #53 |
| Submit credit or grant applications | 2 | `approvals/2026-10-17-credits-application.md` | Draft pending (item 2) |
| Account logins in any program | 5 | covered by the credits card | Never started |
| Flip tool pages, link-outs, email capture, free-launch, store clicks | 3 | no card yet; the card is written when each item's PR is read | #52, #51, #50, #55, #54 all flag-off |
| Delete remote branches | not red (green per Jonathan 2026-10-17), cloud blocked | `approvals/2026-10-17-branch-retirements.md` (`GREEN_PENDING_LOCAL_RUN`) | 33 verified, script in #48 |
| Cloudflare Pages check | second-look, dashboard only | `approvals/2026-10-17-cloudflare-pages-check.md` | Cause identified; Jonathan's conductor browser worker owns it |
| Production Mongo, env, Vercel, deploys | 4 or 5 | none; rule 2 | Not touched |

## Source gaps (rule 10)

- Revenue band, budget amounts, equipment location, operator and success measure from the Verizon application.
- Link between Satori Enterprises, Inc. and Reset Biology; who owns the equipment.
- Vision training public description (beyond the manual and plan).
- Vendor URLs and referral terms for `sellerLinks.ts`.
- Patron wall content and rules; analytics tool choice.
- What Am I Appreciating Now public URL.
- Cloudflare Pages build logs.
- Not verified this session: no page was rendered and no build was run; this PR is docs only.
