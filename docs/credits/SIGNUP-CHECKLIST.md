# Credits sign-up checklist (for a local browser worker)

Dated 2026-10-17. Jonathan approved the credits sign-up on 2026-10-17 (free credit is green). **Not yet run.** The cloud thread that wrote this has no browser or computer-use tools, so no sign-up was attempted and no receipt exists. Source facts: `docs/credits/ENTITY-FACTS.md`.

Rules for the worker: use only the values below; any `GAP` stays blank until Jonathan supplies it (rule 10, never invent). Stop at any payment-card field (red 1) or any step that asks to sign a binding agreement beyond the program's standard terms (red 2) and report it. Never paste credentials into chat or the repo (red 5 applies to third parties, not to Jonathan typing his own login locally).

URLs below are from memory and **not verified**; confirm each on load and record the final URL in the receipt.

## Values available

| Field | Value | Status |
|---|---|---|
| Company / site | Reset Biology, resetbiology.com | verified |
| Legal entity | Satori Enterprises, Inc. | unverified (d/b/a link open) |
| One-line description | see ENTITY-FACTS §4 | ready |
| Problem / use of credits | see ENTITY-FACTS §4 | ready |
| Funding | Satori Living Foundation funds free access | verified text; amount GAP |
| Contact email | jonchyatt@gmail.com | from session context; confirm he wants it used |
| Incorporation state, EIN, formation date, address | GAP |
| Founder names and titles | GAP |
| Members, monthly active, monthly spend | GAP |
| Cap table / outside funding | GAP |

## Programs (from ENTITY-FACTS §3)

| # | Program | Likely URL (unverified) | Fields usually asked | Fillable now | Gaps |
|---|---|---|---|---|---|
| 1 | Vercel for Startups | vercel.com/startups | company, site, stage, funding, team size, account email | company, site, description | stage, funding, team |
| 2 | MongoDB for Startups | mongodb.com/startups | company, site, incorporation, funding, Atlas org id | company, site, description | incorporation, funding, Atlas org id (seat only) |
| 3 | Auth0 startup program | auth0.com/startups | company, site, funding, tenant domain | company, site, tenant `dev-4n4ucz3too5e3w5j.us.auth0.com` (from CLAUDE.md) | funding, incorporation |
| 4 | Resend startup program | resend.com | company, site, use case | all except spend | spend |
| 5 | OpenAI startup credits | openai.com (search "startup credits") | company, site, funding, use case, org id | use case (gpt-4o-mini, whisper-1, tts-1) | funding, org id |

Skip Stripe (no credit target) and Cloudflare (no verified need).

## Steps

1. Open each URL in the local browser already signed in to Jonathan's own account; screenshot the landing page.
2. Read the form. List every required field. If one is a GAP, leave it, finish the rest, and record it.
3. Fill from the table. Paste description blocks from ENTITY-FACTS §4 verbatim.
4. Stop before Submit if any GAP is required, a card is requested, or eligibility asks for a claim not in the table. Otherwise submit.
5. Save a receipt per program in `docs/credits/RECEIPTS.md`: date, final URL, fields sent, confirmation text or number, screenshot path. Failures count: record the exact error.
6. Do not commit screenshots containing account ids or emails.

## Eligibility risk to flag

Most programs ask for an incorporated entity and often a funding status. Until the Satori Enterprises link and incorporation facts are confirmed, forms may be rejected or misstated. Closing that GAP first raises the success rate.
