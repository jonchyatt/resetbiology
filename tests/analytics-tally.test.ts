import { readFileSync } from 'fs'
// @ts-expect-error plain .mjs script, no type declarations
import { tallyLines, renderMarkdown, weekStart } from '../scripts/analytics/tally-logs.mjs'

let failed = false
function check(label: string, pass: boolean) {
  if (pass) console.log(`[PASS] ${label}`)
  else { failed = true; console.error(`[FAIL] ${label}`) }
}

const lines = readFileSync(__dirname + '/fixtures/analytics-logs.synthetic.txt', 'utf8').split('\n')
const { rows, skipped } = tallyLines(lines)
const find = (week: string, event: string, key: string) =>
  rows.find((r: { week: string; event: string; key: string }) => r.week === week && r.event === event && r.key === key)?.count

check('Sunday 23:59 UTC lands in the earlier Monday week', find('2026-10-12', 'store_click', 'Seller A') === 2)
check('Monday 00:00 UTC starts a new week', find('2026-10-19', 'store_click', 'Seller B | pipe') === 1)
check('wrapped message and prefixed lines both count', find('2026-10-19', 'tool_view', 'breath') === 2)
check('unknown event, missing time and junk are skipped', skipped === 3)
check('weekStart rejects a bad date', weekStart('nope') === null)
const md = renderMarkdown({ rows, skipped })
check('pipe in a key is escaped', md.includes('Seller B \\| pipe'))
check('empty input renders a zero row', renderMarkdown(tallyLines([])).includes('| none | | | 0 |'))
if (failed) process.exit(1)
