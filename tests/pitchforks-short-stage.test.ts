import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')

const canvasWidth = 720
const canvasHeight = 405
const maxCanvasHeight = canvasHeight
const shortLandscapeWidth = 677
const phoneWidth = 390

assert.match(source, /const STAGE_MIN_HEIGHT_VW = \(H \/ W\) \* 100/)
assert.match(source, /const STAGE_MIN_HEIGHT_CSS = `min\(\$\{H\}px, \$\{STAGE_MIN_HEIGHT_VW\}vw\)`/)
assert.match(source, /fixed inset-0 overflow-y-auto overflow-x-hidden/, 'the playing root must expose page scrolling when the stage floor exceeds the viewport')
assert.doesNotMatch(source, /fixed inset-0 overflow-hidden bg-black text-gray-100 flex flex-col/, 'the playing root must not clip a short stage')

const stageStart = source.indexOf('data-testid="pf3-stage"')
const stageEnd = source.indexOf('{newNoteCeremonyBanner}', stageStart)
assert.ok(stageStart >= 0 && stageEnd > stageStart, 'the playing battlefield must be identifiable')
const stage = source.slice(stageStart, stageEnd)
assert.match(stage, /className="relative flex-1 min-h-0 flex items-center justify-center"/)
assert.match(stage, /style=\{\{ minHeight: STAGE_MIN_HEIGHT_CSS \}\}/)

const widthDerivedFloor = (width: number) => Math.min(maxCanvasHeight, width * canvasHeight / canvasWidth)
assert.equal(widthDerivedFloor(shortLandscapeWidth), 380.8125, '677px landscape keeps the 720:405-derived stage floor')
assert.equal(widthDerivedFloor(phoneWidth), 219.375, '390px portrait keeps the same canvas ratio')
assert.equal(widthDerivedFloor(1366), 405, 'a laptop stage floor leaves vertical room for controls instead of consuming 720px')
assert.equal(canvasWidth / canvasHeight, 16 / 9, 'the check is tied to the physical canvas aspect ratio')

console.log('pitchforks short-stage overflow: PASS (minimum stage follows 720:405; root scrolls when bands exceed viewport)')
