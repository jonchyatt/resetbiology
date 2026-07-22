import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tracker = readFileSync(new URL('../src/components/Nutrition/NutritionTracker.tsx', import.meta.url), 'utf8')
const itemRoute = readFileSync(new URL('../app/api/nutrition/entries/[id]/route.ts', import.meta.url), 'utf8')

const handlerMatch = tracker.match(/const handleDeleteEntry = async \(entryId: string\) => \{([\s\S]*?)\n  \}/)
assert.ok(handlerMatch, 'tracker must define one shared delete handler')
const handler = handlerMatch[1]

assert.doesNotMatch(tracker, /\/api\/foods\/log\?id=/, 'legacy query-string delete URL must be absent')
assert.match(handler, /\/api\/nutrition\/entries\/\$\{encodeURIComponent\(entryId\)\}/, 'delete must use the encoded owned item endpoint')
assert.match(handler, /if \(!ok\) return/, 'cancellation must return before delete work')
assert.ok(handler.indexOf('if (!ok) return') < handler.indexOf('await fetch('), 'cancellation must occur before fetch')
assert.ok(handler.indexOf('if (!ok) return') < handler.indexOf('toast.success'), 'cancellation must occur before success toast')
assert.ok(handler.indexOf('if (!ok) return') < handler.indexOf('toast.error'), 'cancellation must occur before failure toast')
assert.match(handler, /if \(res\.ok && data\.success === true\)/, 'delete success must require HTTP and payload success')
assert.match(handler, /await res\.json\(\)/, 'delete must parse the item route response')
assert.equal((handler.match(/toast\.success\('Entry deleted'\)/g) ?? []).length, 1, 'success path must emit one deletion toast')
assert.equal((handler.match(/refreshAll\(\)/g) ?? []).length, 1, 'only the success path may refresh data')
assert.equal((handler.match(/toast\.error\('Failed to delete entry'\)/g) ?? []).length, 2, 'server and network failure paths must each emit one failure toast')
assert.match(handler, /if \(res\.ok && data\.success === true\) \{\s*refreshAll\(\)\s*toast\.success\('Entry deleted'\)\s*\} else \{\s*toast\.error\('Failed to delete entry'\)/, 'non-success responses must not refresh or show a success toast')
assert.match(handler, /catch \(error\) \{\s*console\.error\('Error deleting food:', error\)\s*toast\.error\('Failed to delete entry'\)/, 'network rejection must produce one failure toast')
assert.doesNotMatch(handler, /setRecentLogs\(|\.filter\(/, 'delete must not optimistically remove local rows')

const controls = tracker.match(/onClick=\{\(\) => handleDeleteEntry\((?:food|entry)\.id\)\}/g) ?? []
assert.equal(controls.length, 2, 'Today and History delete controls must call the same handler')
assert.doesNotMatch(tracker, /const (?:deleteFood|handleDeleteHistoryEntry)\s*=/, 'duplicate delete handlers must be absent')

const deleteRouteMatch = itemRoute.match(/export async function DELETE\([\s\S]*$/)
assert.ok(deleteRouteMatch, 'item route must export DELETE')
const deleteRoute = deleteRouteMatch[0]
assert.match(deleteRoute, /prisma\.foodLog\.findFirst\([\s\S]*?userId:\s*user\.id/, 'item route DELETE must check ownership')
assert.match(deleteRoute, /prisma\.foodLog\.delete\(/, 'item route DELETE must remove the owned entry')
assert.match(deleteRoute, /success:\s*true/, 'item route DELETE must return success true')

console.log('nutrition delete contract: PASS')
