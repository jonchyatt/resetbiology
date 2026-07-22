import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isValidDayKey, shiftDayKey } from '../src/lib/localDay'
import { POST } from '../app/api/nutrition/copy-day/route'

const { createCopyDayPostHandler, validateCopyDayRequest } = POST.testContract

const read = (path: string) => readFileSync(path, 'utf8')

// The shared helper accepts only real Gregorian YYYY-MM-DD calendar dates.
for (const key of ['0001-01-01', '2024-02-29', '2026-07-22', '9999-12-31']) {
  assert.equal(isValidDayKey(key), true, `${key} should be a valid day key`)
}

for (const value of [
  null,
  20260722,
  '',
  '0000-01-01',
  '2026-7-22',
  '2026-07-2',
  '2026-00-10',
  '2026-13-10',
  '2026-02-29',
  '2024-02-30',
  '2026-04-31',
  '2026-07-00',
  '2026-07-22T00:00:00.000Z',
]) {
  assert.equal(isValidDayKey(value), false, `${String(value)} should be rejected`)
}

// Calendar arithmetic is timezone-free. DST dates are included because they
// are where elapsed-hour arithmetic commonly shifts a member onto the wrong day.
for (const [source, delta, expected] of [
  ['2026-03-01', -1, '2026-02-28'],
  ['2024-03-01', -1, '2024-02-29'],
  ['2024-02-28', 1, '2024-02-29'],
  ['2026-01-01', -1, '2025-12-31'],
  ['2025-12-31', 1, '2026-01-01'],
  ['2026-03-08', -1, '2026-03-07'],
  ['2026-03-08', 1, '2026-03-09'],
  ['2026-11-01', -1, '2026-10-31'],
  ['2026-11-01', 1, '2026-11-02'],
] as const) {
  assert.equal(shiftDayKey(source, delta), expected, `${source} shifted ${delta}`)
}

assert.throws(() => shiftDayKey('2026-02-29', -1), /Invalid day key/)
assert.throws(() => shiftDayKey('2026-07-22', 1.5), /integer/)
assert.throws(() => shiftDayKey('9999-12-31', 1), /out of range/)

const localDaySource = read('src/lib/localDay.ts')
const foodLogSource = read('app/api/foods/log/route.ts')
const trackerSource = read('src/components/Nutrition/NutritionTracker.tsx')
const routeSource = read('app/api/nutrition/copy-day/route.ts')
const edgeAuthSource = read('src/lib/auth0-edge.ts')

// One validator owns day-key truth; FoodLog cannot drift behind a private copy.
assert.match(localDaySource, /export function isValidDayKey/)
assert.match(localDaySource, /export function shiftDayKey/)
assert.match(foodLogSource, /import \{[^}]*isValidDayKey[^}]*\} from '@\/lib\/localDay'/)
assert.doesNotMatch(foodLogSource, /const DAY_KEY_RE|function isValidDayKey/)

// Cancel remains a true zero-request path. Today is captured once only after
// confirmation, Yesterday is derived from that same key, and both are sent.
const copyHandlerStart = trackerSource.indexOf('const copyPreviousDay = async () => {')
const copyHandlerEnd = trackerSource.indexOf('\n  const ', copyHandlerStart + 1)
assert.notEqual(copyHandlerStart, -1, 'copy handler must remain present')
const copyHandler = trackerSource.slice(copyHandlerStart, copyHandlerEnd)
const confirmIndex = copyHandler.indexOf('await toast.confirm')
const cancelIndex = copyHandler.indexOf('if (!ok) return')
const destinationIndex = copyHandler.indexOf('const destinationLocalDate = todayLocalKey()')
const sourceIndex = copyHandler.indexOf('const sourceLocalDate = shiftDayKey(destinationLocalDate, -1)')
const fetchIndex = copyHandler.indexOf("fetch('/api/nutrition/copy-day'")
assert.ok(confirmIndex >= 0 && confirmIndex < cancelIndex, 'confirmation must precede cancel return')
assert.ok(cancelIndex < destinationIndex && destinationIndex < sourceIndex && sourceIndex < fetchIndex,
  'browser days must be captured after confirmation and before the request')
assert.equal((copyHandler.match(/todayLocalKey\(\)/g) || []).length, 1, 'Today must be captured exactly once')
assert.match(copyHandler, /body: JSON\.stringify\(\{ daysAgo: 1, sourceLocalDate, destinationLocalDate \}\)/)

for (const retained of [
  'setCopyingDay(true)',
  'setCopyingDay(false)',
  'refreshAll()',
  "toast.success(`Copied ${data.count} meal${data.count === 1 ? '' : 's'} from yesterday`)",
  "toast.error(`Couldn't copy: ${data.error || 'try again'}`)",
  "toast.error('Failed to copy meals')",
]) {
  assert.ok(copyHandler.includes(retained), `copy flow must retain: ${retained}`)
}
assert.match(trackerSource, /disabled=\{copyingDay\}/)
assert.match(trackerSource, /\{copyingDay \? 'Copying\.\.\.' : 'Copy Yesterday'\}/)

// Cancel and Confirm both restore keyboard focus to the exact Copy Yesterday
// trigger via a page-local ref + next-frame null-safe focus helper. The
// shared confirm primitive (Toast.tsx) is never touched for this.
assert.match(trackerSource, /const copyTriggerRef = useRef<HTMLButtonElement \| null>\(null\)/,
  'a page-local button ref must exist for the Copy Yesterday trigger')
assert.match(trackerSource,
  /const focusCopyTrigger = \(\) => \{\s*window\.requestAnimationFrame\(\(\) => \{\s*copyTriggerRef\.current\?\.focus\(\)\s*\}\)\s*\}/,
  'the restoration helper must be a next-frame null-safe focus call')
assert.match(trackerSource, /ref=\{copyTriggerRef\}\s+onClick=\{copyPreviousDay\}/,
  'the ref must be attached to the exact Copy Yesterday trigger button')
assert.match(trackerSource, /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300/,
  'the trigger must keep an explicit page-local focus-visible ring using the existing primary ring idiom')

const cancelFocusIndex = copyHandler.indexOf('if (!ok) return focusCopyTrigger()')
assert.ok(cancelFocusIndex >= 0 && cancelFocusIndex < destinationIndex,
  'Cancel must restore focus before returning and before any date/request work begins')

const pendingClearIndex = copyHandler.lastIndexOf('setCopyingDay(false)')
const confirmFocusIndex = copyHandler.indexOf('focusCopyTrigger()', pendingClearIndex)
assert.ok(pendingClearIndex >= 0 && confirmFocusIndex > pendingClearIndex,
  'Confirm must restore focus only after pending state is cleared, never while the trigger is disabled')

// The endpoint uses database-free session inspection. Authentication happens
// before JSON parsing; complete validation happens before database imports.
assert.match(routeSource, /import \{ auth0Edge \} from '@\/lib\/auth0-edge'/)
assert.match(routeSource, /import \{ isValidDayKey, shiftDayKey \} from '@\/lib\/localDay'/)
assert.doesNotMatch(routeSource, /^import .*getUserFromSession/m)
assert.doesNotMatch(routeSource, /^import .*prisma/m)
assert.doesNotMatch(edgeAuthSource, /prisma|getUserFromSession|beforeSessionSaved/)

const authIndex = routeSource.indexOf('await dependencies.getSession()')
const parseIndex = routeSource.indexOf('await req.json()')
const validateIndex = routeSource.indexOf('validateCopyDayRequest(body)')
const rejectIndex = routeSource.indexOf("error: 'Invalid copy-day request'", validateIndex)
const databaseLoadIndex = routeSource.indexOf('await dependencies.loadDatabase()')
const userImportIndex = routeSource.indexOf("import('@/lib/getUserFromSession')")
const prismaImportIndex = routeSource.indexOf("import('@/lib/prisma')")
assert.ok(authIndex >= 0 && authIndex < parseIndex, 'authentication must happen before parsing')
assert.ok(parseIndex < validateIndex && validateIndex < rejectIndex,
  'parsing and validation must precede the invalid-request response')
assert.ok(rejectIndex < databaseLoadIndex, 'every rejected request must return before the database loader runs')
assert.ok(databaseLoadIndex < userImportIndex && databaseLoadIndex < prismaImportIndex,
  'the production database loader must own both dynamic imports')

// The accepted contract is deliberately narrow: one numeric integer day, two
// valid keys, and source exactly one calendar day before destination.
assert.match(routeSource, /typeof daysAgo !== 'number'/)
assert.match(routeSource, /!Number\.isInteger\(daysAgo\)/)
assert.match(routeSource, /daysAgo !== 1/)
assert.match(routeSource, /!isValidDayKey\(sourceLocalDate\) \|\| !isValidDayKey\(destinationLocalDate\)/)
assert.match(routeSource, /sourceLocalDate !== shiftDayKey\(destinationLocalDate, -1\)/)

// The server clock may timestamp the copies, but never discovers either date.
assert.doesNotMatch(routeSource, /setDate\(|getFullYear\(|getMonth\(|getDate\(|targetLocalDate|todayLocalDate/)
assert.equal((routeSource.match(/new Date\(\)/g) || []).length, 1, 'server time is only the copied timestamp/local-time source')
const queryIndex = routeSource.indexOf('await database.findMeals(userId, sourceLocalDate)')
const nowIndex = routeSource.indexOf('const now = dependencies.now()')
assert.ok(queryIndex > databaseLoadIndex && nowIndex > queryIndex, 'clock use must follow validation and source lookup')
assert.match(routeSource, /findMeals\(userId, sourceLocalDate\)/)
assert.match(routeSource, /createMeal\(userId, meal, now, destinationLocalDate, todayLocalTime\)/)
assert.match(routeSource, /localDate: sourceLocalDate/)
assert.match(routeSource, /localDate: destinationLocalDate/)

for (const field of ['source', 'sourceId', 'itemName', 'brand', 'quantity', 'unit', 'gramWeight', 'nutrients', 'mealType']) {
  assert.match(routeSource, new RegExp(`${field}: meal\\.${field}`), `${field} must remain copied`)
}
assert.match(routeSource, /loggedAt,\s*localDate: destinationLocalDate,\s*localTime,/)
assert.match(routeSource, /count: copiedMeals\.length/)
assert.match(routeSource, /message: `Copied \$\{copiedMeals\.length\} meals from \$\{daysAgo\} day\(s\) ago`/)

async function runBehavioralRouteFixtures() {
  const validBody = {
    daysAgo: 1,
    sourceLocalDate: '2026-07-21',
    destinationLocalDate: '2026-07-22',
  }

  assert.deepEqual(validateCopyDayRequest(validBody), validBody)
  for (const invalidBody of [
    null,
    {},
    { ...validBody, daysAgo: '1' },
    { ...validBody, daysAgo: 1.5 },
    { ...validBody, daysAgo: 2 },
    { ...validBody, sourceLocalDate: '2026-07-20' },
    { ...validBody, sourceLocalDate: '2026-02-29' },
    { ...validBody, destinationLocalDate: '2026-02-30' },
    { ...validBody, sourceLocalDate: '0001-01-01', destinationLocalDate: '0001-01-01' },
  ]) {
    assert.equal(validateCopyDayRequest(invalidBody), null)
  }

  const request = (json: () => Promise<unknown>) => ({ json } as any)

  let unauthenticatedParseCalls = 0
  let unauthenticatedDatabaseLoads = 0
  const unauthenticated = createCopyDayPostHandler({
    getSession: async () => null,
    loadDatabase: async () => {
      unauthenticatedDatabaseLoads += 1
      throw new Error('database must not load')
    },
    now: () => new Date('2026-07-22T12:00:00.000Z'),
  })
  const unauthenticatedResponse = await unauthenticated(request(async () => {
    unauthenticatedParseCalls += 1
    return validBody
  }))
  assert.equal(unauthenticatedResponse.status, 401)
  assert.equal(unauthenticatedParseCalls, 0, 'unauthenticated input must not be parsed')
  assert.equal(unauthenticatedDatabaseLoads, 0, 'unauthenticated input must not load the database')

  const rejectedBodies: Array<unknown | Error> = [
    new SyntaxError('malformed JSON'),
    {},
    { ...validBody, daysAgo: '1' },
    { ...validBody, daysAgo: 1.5 },
    { ...validBody, daysAgo: 2 },
    { ...validBody, sourceLocalDate: '2026-07-20' },
    { ...validBody, sourceLocalDate: '2026-02-29' },
    { ...validBody, destinationLocalDate: '2026-02-30' },
    { ...validBody, sourceLocalDate: '0001-01-01', destinationLocalDate: '0001-01-01' },
  ]

  for (const rejectedBody of rejectedBodies) {
    let databaseLoads = 0
    const handler = createCopyDayPostHandler({
      getSession: async () => ({ user: { sub: 'auth0|test' } }),
      loadDatabase: async () => {
        databaseLoads += 1
        throw new Error('database must not load')
      },
      now: () => new Date('2026-07-22T12:00:00.000Z'),
    })
    const response = await handler(request(async () => {
      if (rejectedBody instanceof Error) throw rejectedBody
      return rejectedBody
    }))
    assert.equal(response.status, 400, `rejected body should return 400: ${String(rejectedBody)}`)
    assert.equal(databaseLoads, 0, 'rejected input must make zero database-loader calls')
  }

  const fixedNow = new Date(2026, 6, 22, 12, 34, 56)
  const meal = {
    source: 'manual',
    sourceId: null,
    itemName: 'Greek yogurt',
    brand: 'Test brand',
    quantity: 1,
    unit: 'cup',
    gramWeight: 227,
    nutrients: { kcal: 140, protein_g: 25 },
    mealType: 'breakfast',
  }
  const findCalls: unknown[][] = []
  const createCalls: unknown[][] = []
  let acceptedDatabaseLoads = 0
  const accepted = createCopyDayPostHandler({
    getSession: async () => ({ user: { sub: 'auth0|test' } }),
    loadDatabase: async () => {
      acceptedDatabaseLoads += 1
      return {
        getUserId: async () => 'member-123',
        findMeals: async (...args) => {
          findCalls.push(args)
          return [meal]
        },
        createMeal: async (...args) => {
          createCalls.push(args)
          return { id: 'copy-1' }
        },
      }
    },
    now: () => fixedNow,
  })

  const acceptedResponse = await accepted(request(async () => validBody))
  assert.equal(acceptedResponse.status, 200)
  assert.deepEqual(await acceptedResponse.json(), {
    ok: true,
    count: 1,
    message: 'Copied 1 meals from 1 day(s) ago',
  })
  assert.equal(acceptedDatabaseLoads, 1)
  assert.deepEqual(findCalls, [['member-123', '2026-07-21']], 'query must use the exact source key')
  assert.equal(createCalls.length, 1)
  assert.equal(createCalls[0][0], 'member-123')
  assert.deepEqual(createCalls[0][1], meal, 'the complete meal must reach the copy write')
  assert.equal(createCalls[0][2], fixedNow)
  assert.equal(createCalls[0][3], '2026-07-22', 'write must use the exact destination key')
  assert.equal(createCalls[0][4], '12:34:56', 'existing server-local time behavior must remain')
}

runBehavioralRouteFixtures()
  .then(() => console.log('Nutrition copy-day member-local contract passed.'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
