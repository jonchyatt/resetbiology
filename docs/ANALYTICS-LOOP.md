# Analytics loop (first-party, server logs only)

Status: spec plus tally script. Nothing here changes the running site.

## Why this shape

- `package.json` has no analytics package, and adding one is a red 5 question (hands visitor data to a third party), so none is added.
- Mongo is not used. Any new log collection needs a TTL index from its first commit (CLAUDE.md Atlas rule); host logs already expire on their own.
- Revenue question this answers: how many people clicked through to a seller (proof of referral volume for sellers) and how many viewed each free-tool page (search traffic into the email list).

## Events

One JSON object per line, written with `console.log(JSON.stringify(...))`, no member id, no email, no IP, no cookie.

| event | key field | written by | status |
|---|---|---|---|
| `store_click` | `sellerKey` (a key in `src/config/sellerLinks.ts`) | `app/api/store/click/route.ts` in PR #54, flag `NEXT_PUBLIC_RB_STORE_CLICKS` | open PR, off |
| `tool_view` | `slug` (a slug in `src/config/toolPages.ts`) | not written yet; add to `/tools/[slug]` (PR #52) after #52 merges | spec only |

Every line also carries `at` (ISO time). The tally ignores any event not in this table, so the log cannot be filled with arbitrary text.

## Weekly run

1. Export the last week of production logs from the host dashboard (Jonathan's local seat; this repo never touches Vercel).
2. `node scripts/analytics/tally-logs.mjs exported-logs.txt > weekly.md`
   (or pipe the export on stdin). Accepts bare JSON lines, a host wrapper with a `message` string, or text before the JSON.
3. Read the table: weeks start Monday UTC, rows are week, event, key, count, newest week first. The last line reports how many lines were not tallied.

## Limits (stated, not hidden)

- Counts clicks and views, not people. A click is not a sale.
- Host log retention caps how far back a tally can go; save each `weekly.md` to keep history.
- Bots can inflate `tool_view`. Treat it as a trend, not a total.
- The script and its test use a synthetic fixture only (`tests/fixtures/analytics-logs.synthetic.txt`). It has not been run on real production logs.

## Check

`npx tsx tests/analytics-tally.test.ts`
