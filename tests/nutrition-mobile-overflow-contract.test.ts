import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tracker = readFileSync(new URL('../src/components/Nutrition/NutritionTracker.tsx', import.meta.url), 'utf8')
const quickAdd = readFileSync(new URL('../src/components/Nutrition/FoodQuickAdd.tsx', import.meta.url), 'utf8')
const boundaryClass = 'className="grid grid-cols-1 gap-6 lg:grid-cols-3"'
const oldBoundaryClass = 'className="grid gap-6 lg:grid-cols-3"'
const responsiveHeaderClass = 'className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"'
const oldForcedRowClass = 'className="mb-4 flex items-center justify-between gap-4"'

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

assert.equal(
  quickAdd.split(responsiveHeaderClass).length - 1,
  1,
  'the Log Nutrition header must stack at the base breakpoint and return to a row at sm',
)
assert.equal(
  quickAdd.split(oldForcedRowClass).length - 1,
  0,
  'the Log Nutrition header must not force all controls into one mobile row',
)

const headerStart = quickAdd.indexOf(responsiveHeaderClass)
const headerEnd = quickAdd.indexOf('{/* Search Input - Only show on Search tab */}', headerStart)
assert.ok(headerStart >= 0 && headerEnd > headerStart, 'the responsive Log Nutrition header must remain bounded')

const header = quickAdd.slice(headerStart, headerEnd)
const orderedCapabilities = [
  'Log Nutrition',
  'setShowCameraModal(true)',
  "setActiveTab('search')",
  "setActiveTab('favorites')",
]

let previousCapability = -1
for (const capability of orderedCapabilities) {
  assert.equal(header.split(capability).length - 1, 1, `${capability} must remain exactly once in the responsive header`)
  const capabilityIndex = header.indexOf(capability)
  assert.ok(capabilityIndex > previousCapability, `${capability} must preserve Camera to Search to Favorites keyboard order`)
  previousCapability = capabilityIndex
}

const prohibitedMask = /(?:overflow-x-hidden|overflow-x-clip|w-screen|min-w-screen|max-w-screen|(?:w|min-w|max-w)-\[[^\]]+\])/
for (const [name, source] of [['tracker', tracker], ['quick add', quickAdd]] as const) {
  assert.doesNotMatch(
    source,
    prohibitedMask,
    `${name} must not use overflow clipping or fixed/arbitrary viewport-width workarounds`,
  )
}

console.log('nutrition mobile overflow contract: PASS')
