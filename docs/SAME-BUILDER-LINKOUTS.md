# "From the same builder" link-outs (flag off)

Backlog item 5. A small row on /about and the free tool pages (breath, nutrition, peptides, journal, modules) linking to What Am I Appreciating Now.

- Flag: `NEXT_PUBLIC_RB_SAME_BUILDER=true` AND `NEXT_PUBLIC_RB_SAME_BUILDER_URL=https://...` must both be set. Either missing, or a non-https URL, renders nothing. No domain is hardcoded: the public domain is Jonathan's call.
- Every link goes through `OutboundLink`: opens in a new tab with `noopener noreferrer` and a visible "(leaves this site)" label. The row adds a disclosure line: separate site, own terms and privacy, nothing shared.
- Turning it on is red 3 (publishes a link under the Reset Biology name); the seat flips it.
- Test: `npx tsx tests/same-builder-flag.test.tsx` (flag logic, row renders empty when off, link label).
- Not verified: I did not render the pages in a browser; the Emotional Health tile in `EnhancedDashboard.tsx` stays parked and untouched.
