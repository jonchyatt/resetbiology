# Free-launch replay (backlog item 8)

Source (read only): `harden/rb-free-lanes-20261006` and `card/rb-15-restyled-free-candidate`, commits `325e5b08` and `a43b9c25`. Neither branch was touched.

## Ported here (flag `NEXT_PUBLIC_FREE_LAUNCH=on`, default off)
- `src/lib/freeLaunch.ts`: hidden route families redirect to `/get-started` (`/store`, `/order`, `/product`, `/pricing`, `/subscription`, `/affiliates`, `/cellular-peptide`, `/education`, `/breath`); `/modules` redirects to `/audio`; the two OpenAI-keyed routes (`/api/foods/analyze-image`, `/api/voice/chat`) return 404.
- `middleware.ts` calls it first. With the flag off, behavior is unchanged.
- `tests/free-launch-gate.test.ts` (run with `npx tsx`).

## Deliberately not ported (follow-up PRs, one per surface)
- `src/lib/auth0.ts`: the old commit removes the 6-month grant and sets `subscriptionExpiry = null` for new users. That changes member creation; seat review, and it should be flag-gated.
- `Header.tsx` / `app/page.tsx` launch nav and homepage, `FoodQuickAdd.tsx` camera removal (1,000-line rewrite on the old base), Librarian lead capture, `/breath` ProtectedRoute swap, `/affiliates` coming-soon page, `@vercel/analytics`.
- `cff8b0f7` expert/voice routing through Workers AI (needs new env; seat).

## Seat notes
- Turning the flag on is a publish (red 3): Jonathan's seat only.
- `/education` and `/breath` are hidden by the final boundary commit; confirm that is still wanted.
- Verified: the test ran and passed (`npx tsx`). Not run: `tsc`, `next build`, or the page in a browser (no dependencies installed).
