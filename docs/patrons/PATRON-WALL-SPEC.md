# Patron wall: spec and what is built (2026-10-17)

Source gap (rule 10): no patron, sponsor or donor content, tier names or payment path exists in the repo. Everything below marked "Jonathan decides" is a placeholder, not a decision.

## Built (flag off)
- `/patrons`: 404 unless `NEXT_PUBLIC_RB_PATRON_WALL=on`. `preview` shows synthetic names with a "not real people" banner and works only outside production. Always `noindex`.
- `src/config/patrons.ts`: `PATRONS` is empty. An entry renders only with `consented: true`; the filter runs in the page and again in the component.
- `tests/patron-wall.test.tsx`: empty state, consent filter, sample banner, and that no real patron is committed.

## Jonathan decides
1. Tier names and thresholds (placeholders: Founding patrons, Supporters).
2. How a patron pays. No payment link is built. Any link is red 1 (moves money); Stripe setup is the seat's.
3. How consent is collected and kept (written, per name).
4. Whether a name can be removed on request, and how fast.

## Red lines
- Adding a real name: red 3 (publishes under the Reset Biology name). Card: `approvals/2026-10-17-patron-wall-flag-on.md`.
- Payment link or checkout: red 1.
