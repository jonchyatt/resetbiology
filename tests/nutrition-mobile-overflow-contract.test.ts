import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tracker = readFileSync(new URL('../src/components/Nutrition/NutritionTracker.tsx', import.meta.url), 'utf8')
const boundaryClass = 'className="grid grid-cols-1 gap-6 lg:grid-cols-3"'
const oldBoundaryClass = 'className="grid gap-6 lg:grid-cols-3"'

assert.equal(
  tracker.split(boundaryClass).length - 1,
  1,
  'the named lower tracker boundary must have exactly one explicit base one-column track',
)
assert.equal(
  tracker.split(oldBoundaryClass).length - 1,
  0,
  'the named lower tracker boundary must not retain the implicit base track',
)

const boundaryStart = tracker.indexOf(boundaryClass)
const historyStart = tracker.indexOf("{activeTab === 'history'", boundaryStart)
assert.ok(historyStart > boundaryStart, 'the lower tracker boundary must remain inside the Today view')

const lowerTrackerBoundary = tracker.slice(boundaryStart, historyStart)
const columnMarkers = [
  'Column 1 - Add Nutrition',
  "Column 2 - Today's Meals",
  'Column 3 - Macro Goals & Daily Snapshot',
]

for (const marker of columnMarkers) {
  assert.equal(
    lowerTrackerBoundary.split(marker).length - 1,
    1,
    `${marker} must remain exactly once under the named lower tracker boundary`,
  )
}

assert.doesNotMatch(
  tracker,
  /(?:overflow-x-hidden|overflow-x-clip|w-screen|min-w-screen|max-w-screen|(?:w|min-w|max-w)-\[[^\]]+\])/,
  'tracker must not use overflow clipping or fixed/arbitrary viewport-width workarounds',
)

console.log('nutrition mobile overflow contract: PASS')
