import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { localDayKey } from '../src/lib/localDay'

const writers = [
  {
    name: 'FoodQuickAdd',
    source: readFileSync(new URL('../src/components/Nutrition/FoodQuickAdd.tsx', import.meta.url), 'utf8'),
    successCapabilities: [
      'setStatus("success")',
      'onLogged({',
      'new CustomEvent("nutrition:log-success"',
      'setStatus("error")',
    ],
  },
  {
    name: 'RecentFoods',
    source: readFileSync(new URL('../src/components/Nutrition/RecentFoods.tsx', import.meta.url), 'utf8'),
    successCapabilities: [
      'onQuickAddSuccess?.()',
      'toast.success(`Re-logged ${item.itemName}`)',
      "toast.error(err?.message || 'Failed to re-log food')",
      'setReloggingId(null)',
    ],
  },
] as const

for (const writer of writers) {
  assert.match(
    writer.source,
    /import \{ localDayKey \} from ['"]@\/lib\/localDay['"];/,
    `${writer.name} must import the shared local-day authority`,
  )
  assert.equal(
    (writer.source.match(/const now = new Date\(\)/g) ?? []).length,
    1,
    `${writer.name} must capture the logging instant exactly once`,
  )
  assert.match(writer.source, /loggedAt: now\.toISOString\(\)/, `${writer.name} must timestamp from the captured instant`)
  assert.match(writer.source, /localDate: localDayKey\(now\)/, `${writer.name} must resolve the day from that same instant`)
  assert.match(
    writer.source,
    /localTime: `\$\{hours\}:\$\{minutes\}:\$\{seconds\}`/,
    `${writer.name} must preserve the existing local-time representation`,
  )
  for (const part of ['hours', 'minutes', 'seconds']) {
    assert.ok(writer.source.includes(`const ${part} = String(now.get`), `${writer.name} ${part} must derive from the captured instant`)
  }
  assert.doesNotMatch(
    writer.source,
    /getFullYear\(\)|getMonth\(\)|getDate\(\)|`\$\{year\}-\$\{month\}-\$\{day\}`/,
    `${writer.name} must not rebuild the calendar day privately`,
  )
  assert.match(
    writer.source,
    /fetch\(['"]\/api\/foods\/log['"], \{/,
    `${writer.name} must continue posting through the FoodLog route`,
  )
  assert.match(writer.source, /method: ['"]POST['"]/, `${writer.name} must preserve the POST request`)

  for (const capability of writer.successCapabilities) {
    assert.ok(writer.source.includes(capability), `${writer.name} must preserve ${capability}`)
  }
}

const midnightFixtures = [
  { label: 'UTC before midnight', instant: '2026-07-15T23:30:00.000Z', timeZone: 'UTC', expected: '2026-07-15' },
  { label: 'UTC after midnight', instant: '2026-07-16T00:30:00.000Z', timeZone: 'UTC', expected: '2026-07-16' },
  { label: 'EST before midnight', instant: '2026-01-16T04:30:00.000Z', timeZone: 'America/New_York', expected: '2026-01-15' },
  { label: 'EST after midnight', instant: '2026-01-16T05:30:00.000Z', timeZone: 'America/New_York', expected: '2026-01-16' },
  { label: 'EDT before midnight', instant: '2026-07-16T03:30:00.000Z', timeZone: 'America/New_York', expected: '2026-07-15' },
  { label: 'EDT after midnight', instant: '2026-07-16T04:30:00.000Z', timeZone: 'America/New_York', expected: '2026-07-16' },
  { label: 'MST before midnight', instant: '2026-01-16T06:30:00.000Z', timeZone: 'America/Phoenix', expected: '2026-01-15' },
  { label: 'MST after midnight', instant: '2026-01-16T07:30:00.000Z', timeZone: 'America/Phoenix', expected: '2026-01-16' },
] as const

for (const fixture of midnightFixtures) {
  const now = new Date(fixture.instant)
  assert.equal(localDayKey(now, fixture.timeZone), fixture.expected, fixture.label)
  assert.equal(now.toISOString(), fixture.instant, `${fixture.label}: day resolution must not mutate the captured instant`)
}

console.log('nutrition client local-day writers contract: PASS')
