# Verizon Small Business Digital Ready: website section

Applicant on the form: Satori Enterprises, Inc. Site on the form: resetbiology.com. Funder: LISC. Award: $10,000.

## Criteria (as given by Jonathan)
LISC reviews finalists for "accuracy, community impact, and proposed use of funds", with priority for under-resourced communities.

## Gap
The homepage said nothing about the use of funds, community impact, or who the work serves.

## Changes
- New page `/community/womens-health` (`app/community/womens-health/page.tsx`): who, who it is for, what is being built, how the grant would be used, what stays free.
- Quiet footer link "Community" under Explore (`src/components/Navigation/Footer.tsx`).
- Both are hidden unless `NEXT_PUBLIC_FUNDER_PAGE=on` (project rule 15). Page is `noindex`. Turning the flag on is Jonathan's call; this PR does not touch env.
- No prices, no sales, no outbound links. The "Join the co-op" button links to the existing one on `/order` (no new button).
- Copy rules applied: members buy for themselves and take responsibility for their own body; the co-op is member-owned and run by an independent licensed provider; Reset Biology connects and does not sell or fulfil.

## Facts used (only these, from Jonathan's application)
1. One-person anesthesia practice in Saint George, Utah, adding women's health services (Q30, Q6.5).
2. Women in the community, especially in perimenopause and after childbirth, have few affordable pelvic floor and reproductive health options; most care means travel to Salt Lake City or out of state (Q31).
3. Formation of the Southern Utah Peptides Co-op (Q28).
4. Zion direct care consultation vouchers to assist female health in aging (Q28).
5. Care offered locally through a direct-care co-op with transparent pricing; seed of a service line that can employ a second clinician within a year (Q31).
6. The $10,000 grant would buy a HIFEM chair and red-light therapy to treat free co-op members with perimenopausal symptoms of bladder and reproductive-organ prolapse (Q29, Q31).

The co-op wording ("member-owned co-op run by an independent licensed provider", "members buy for themselves and take responsibility for their own body") is the home page's existing copy, not the application.

## TODOs for Jonathan (shown on the page as amber boxes; remove each before publishing)
- Applicant name and Satori Enterprises link: waits on Jonathan's answer about who owns the existing equipment (equipment follows whoever's money buys it; data/grants/website-first-2026-10/CONSENSUS-satori-enterprises-site-2026-10-17.md in the jarvis repo).
- Community size: the page now states about 1,200 served a year, taken from the application (Q14.2). Confirm against the last S-corp return before the flag goes on. The revenue band is not in the repo and is not shown.
- Status and dates for co-op, vouchers, practice expansion; optional Zion Direct Care link.
- Budget lines, amounts, equipment location, operator, success measure.

## Not verified
Every sentence was checked against JON-APPLICATION-RECOVERED-2026-10-05.md (jarvis repo, data/grants/verizon-digital-ready/) on 2026-10-17. Not yet checked against tax records: the 1,200 figure and the revenue band.
