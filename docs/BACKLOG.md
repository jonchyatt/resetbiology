# Backlog, 2026-10-17

Written under the SEAT CONTRACT: everything is green unless it moves money, signs or binds, publishes under Jonathan's or a business name, destroys or cannot be undone, or hands credentials to a third party. Receipts are cited; anything not run is marked "not verified".

## Shipped (merged on master, 2026-10-17)

| PR | What |
|---|---|
| #38 | Branch triage table (`docs/BRANCH-TRIAGE-2026-10.md`) |
| #39 | Store: Visit-seller outbound links instead of on-site checkout |
| #40 | Email-capture card on free tools, behind `NEXT_PUBLIC_RB_EMAIL_CAPTURE` (off) |
| #41 | Voice metering, peptide history report, weekly Reset report rebased onto master |
| #42 | RBP-5: Drive connect retry, same-day journal pick, workout local day, module titles |
| #43 | RBP-6: Drive error text on /profile, N-Back render test, read-time module titles |

Open: #44 funder page `/community/womens-health` (draft, flag `NEXT_PUBLIC_FUNDER_PAGE` off). It now shows the 1,200 figure attributed to the application. The revenue band is not in the repo and is not shown.

## Reclassified holds (last 48 hours)

| Hold | Old label | Class | Action |
|---|---|---|---|
| Funder sentence "figures taken from the application" held back | waiting on Jonathan | **Green** | Jonathan supplied the 1,200 and said it is on the application. Added to the page behind the flag, with the TODO now only asking for S-corp confirmation. Revenue band: a source gap (rule 10), not a red. Blocker receipt: the band is absent from the repo, the PR #44 docs and the thread. Next thing I can do: render the line the moment the wording is pasted. |
| PR #44 kept draft | waiting | **Red 3 at go-live only** | Publishing under a business name. Everything before it (page, flag, copy, docs) is green and done. Draft stays because Jonathan said so; the flag flip is the red step. |
| Every project PR marked ready, not merged | waiting on local seat | **Not a red; a standing rule 8** | Merging is allowed only to the local seat until three PRs have merged with receipts. Six have merged (#38 to #43), so the question is for Jonathan to retire rule 8, not for a thread. |
| Gated member-data paths waiting on seat diff review | waiting | **Green to build, review gate by rule 6** | Not a red. Build the diff, open the PR, mark ready; the seat reads it before merge. Nothing to wait on while building. |
| Free-launch stack direction (PR #27 stack, 540 commits behind) | open question | **Green** | The branch triage already shows master took a different path. Build the replay as one small PR per surface instead of asking (thread 8 below). |
| 29 "ask Jonathan" branches in triage | waiting | **Green to prepare, red 4 to delete** | Preparing keep or retire notes and rebase-by-copy PRs is green. Deleting a remote branch is red 4 and rule 7 forbids it for me. Recommend only. |
| Cloudflare Pages check failing on #44 | waiting | **Green** | Logs not readable from here. Can be diagnosed from the repo (build config) in thread 9. |
| Deploys, env, flag flips, production Mongo | seat only | **Red 3, 4 or 5 as named** | Flag flips publish (3); env holds credentials (5); production data writes may be irreversible (4). |

## Queued: ten threads, ordered by revenue (nearest dollar first)

1. **Funder page to finalist-ready (grant, $10,000).** Add the budget table, equipment location, operator, and a success measure as drafted copy from the application, each behind the flag; render the page at phone and desktop width and screenshot it. Revenue: the Verizon award. Green. Red 3 is only flipping the flag.
2. **Startup-credits entity pack.** Draft `docs/credits/ENTITY-FACTS.md`: legal name Satori Enterprises, Inc., site resetbiology.com, what is verified versus the open ownership question, and a reusable answer block for credit programs (cloud, AI, payments). Drafting is green; submitting an application is red 2, entering any account credentials is red 5. Revenue: infrastructure credits that lower cost to zero.
3. **Entity truth on the public pages.** Replace the "entity form deliberately unstated" comments in `/privacy` and `/terms` with a code-ready, flag-gated operator line once Jonathan confirms the Satori Enterprises link. Build both versions now; the flag decides. Red 3 at publish.
4. **Email capture to a working list.** PR #40 shipped the card off. Next: a local-only preview page with the card on, a double-opt-in copy draft, and a unit test that the card renders nothing when the flag is off. The newsletter sender is off-limits (rule 2). Revenue: owned audience for every other thread.
5. **Link-outs to What Am I Appreciating Now.** `EnhancedDashboard.tsx` already parks the Emotional Health tile pointing at `woden.whatamiappreciatingnow.com`. Build a shared `OutboundLink` component with a visible "leaves this site" label, one disclosure line, and a flagged "From the same builder" row on the free tools and the /about page. Public domain wording is Jonathan's call, so ship it flag-off. Revenue: cross-traffic to a second product.
6. **Free-tool landing pages.** One indexable page per free tool (breath, journal, nutrition, workout, vision, ear training), each with an honest one-paragraph description, a single email card, and a link to the co-op. Copy comes only from the existing site (rule 10). Revenue: search traffic into the list.
7. **Store outbound links, measured.** PR #39 moved checkout off-site. Add click counting on Visit-seller with a TTL-indexed collection from the first commit (CLAUDE.md Atlas rule) or, simpler, server logs only. Revenue: proof of referral volume to show sellers.
8. **Free-launch replay.** The October free-first stack (`harden/rb-free-lanes`, `card/rb-11`) never merged and is 540 commits behind. Port the surface-hiding as small flagged PRs onto current master, reading the old branches without touching them. Gated files (`schema.prisma`, `next.config.ts`) are left for seat review.
9. **Public-ready sweep.** Fix the Cloudflare Pages backup build on #44 from the repo config, run tsc and lint on master and list the existing errors the funder thread found, and add a smoke test per public route. Green.
10. **Weekly Reset report, member-facing preview.** PR #41 landed the report. Add a synthetic-fixture preview route behind a flag so Jonathan can read it without member data (rule 4). Revenue: retention, which supports the co-op.

## Red (named) and what I built up to the line

| Item | Which red | Built up to the line |
|---|---|---|
| Turning on `NEXT_PUBLIC_FUNDER_PAGE` | 3 | Page, footer link, docs, flag, noindex |
| Submitting any credit or grant application | 2 | Drafted answers and entity fact sheet (thread 2) |
| Putting login or card details into a program | 5, and 1 if it spends | Never started |
| Deleting remote branches from the triage | 4 | Table with merge, rebase or retire per branch |
| Flag flips for email capture or link-outs | 3 | Both built, off |
| Production Mongo, env, Vercel | 4 or 5 | Not touched (rule 2) |

Approval cards for the red items are in `approvals/` (funder flag, branch retirements, credits application, operator line).

## Source gaps (rule 10)

- Revenue band from the Verizon application: not in this repo or any thread. Needed as exact wording.
- Relationship between Satori Enterprises, Inc. and Reset Biology, and who owns the existing equipment: not in the repo; the `/privacy` and `/terms` comments say the link is unverified.
- Cloudflare Pages build logs: not readable from this session.
- Not verified: I did not render #44 or run any page this session.
