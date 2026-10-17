# Browser render pass, 2026-10-17

Each open PR with a flagged page was checked out, `npx prisma generate`, `next dev` with that PR's flag on and no `.env`, then Chromium (Playwright) at 390px and 1280px, full-page. Screenshots are in `docs/render-pass/` (`<pr>-<route>-<width>.png`, palette-reduced to save space). The round "N" bubble in the corner is the Next dev indicator, not the site.

Checked for: horizontal page scroll (`scrollWidth > clientWidth`), console errors, status and redirect target. No PR code was changed.

| PR | Route(s) | Flag | 390 / 1280 scroll | Console errors | Result |
|---|---|---|---|---|---|
| #51 (merged, checked on master) | /about | `NEXT_PUBLIC_RB_SAME_BUILDER=true` + `_URL=https://example.com/` | none | none | OK |
| #52 tool pages | /tools/breath, /tools/journal, /tools/nope | `NEXT_PUBLIC_RB_TOOL_PAGES=true` | none | none (404 for unknown slug is expected) | OK |
| #53 operator line | /privacy, /terms | `NEXT_PUBLIC_OPERATOR_LINE=on` | none | none | OK. "Reset Biology is operated by Satori Enterprises, Inc." appears in the HTML of both pages. |
| #55 free launch | /get-started, /breath, /store, /modules | `NEXT_PUBLIC_FREE_LAUNCH=on` | none | none, except /modules | **Bug on /modules** |
| #57 report preview | /dev/reset-report-preview | `NEXT_PUBLIC_RB_REPORT_PREVIEW=1` | none (page); table scrolls inside its card | none | Minor layout note |
| #60 patron wall | /patrons | `NEXT_PUBLIC_RB_PATRON_WALL=preview` | none | none | OK. Shows the "Sample names" warning banner. |
| #61 funder strip | /community/womens-health | `NEXT_PUBLIC_FUNDER_PAGE=on` | none | none | OK |

## Findings

### #55 free launch: /modules redirect loop (real bug)
`/modules` returns `ERR_TOO_MANY_REDIRECTS` with the flag on. `decideFreeLaunch` sends `/modules` to `/audio`, and `next.config.ts` has a permanent redirect `/audio` to `/modules`. There is no `app/audio` route. Hidden routes (/breath, /store) redirect cleanly to /get-started.
Follow-up for #55: redirect `/modules` to `/get-started` (or remove the `/audio` rule in `next.config.ts` and give it a real target). `next.config.ts` redirects are a seat-read path, so Jonathan's local seat should read that diff.

### #57 report preview: table clips at 390px
The "Recorded activity" table is wider than the card on a phone. The Details column is cut off ("250 mcp, morning" runs past the edge) and cells wrap to three or four lines. The page itself does not scroll sideways, so the table is scrolling inside its container with no visible cue. Follow-up: add a scroll hint or a stacked row layout under `sm`.

### Notes, no action needed
- #61: the At-a-glance strip stacks to one column at 390 and reads fine. The TODO callouts are visible by design until Jonathan fills them.
- #60: preview mode shows synthetic names only, as intended. `flag=on` with real names was not rendered because `PATRONS` is empty.
- Every page showed a `/favicon.ico` 500 in the dev log ("conflicting public file and page file"). It is on master, not caused by these PRs, and does not show in the browser console. Worth a separate look before launch.
- Not covered: flag-off behaviour (covered by each PR's own test), logged-in pages, and production builds. All runs were `next dev` with no database.
