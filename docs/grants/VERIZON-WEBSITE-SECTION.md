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
1. One-person anesthesia practice in Saint George, Utah, adding women's health.
2. Formation of the Southern Utah Peptides Co-op.
3. Zion direct care consultation vouchers for women's health in aging.
4. Grant would buy a HIFEM device and red-light therapy for free co-op members with perimenopausal pelvic-floor symptoms.

## TODOs for Jonathan (shown on the page as amber boxes; remove each before publishing)
- Applicant name and Satori Enterprises link (unverified elsewhere on the site).
- Community size and under-resourced reach (no figure supplied).
- Status and dates for co-op, vouchers, practice expansion; optional Zion Direct Care link.
- Budget lines, amounts, equipment location, operator, success measure.

## Not verified
Page was typechecked and rendered; facts were not checked against the application itself.
