import assert from 'node:assert/strict'
import { createRainState, createTorchState } from '../src/components/PitchDefender/pitchforksRainEcology'
import { drawRainArchitecture, drawVillagerTorch, type RainViewCanvasContext } from '../src/components/PitchDefender/pitchforksRainView'

function recorder(options: { drawImage?: boolean } = {}) {
  const calls: unknown[][] = []
  const ctx = new Proxy({} as RainViewCanvasContext, {
    get: (_, key) => options.drawImage === false && key === 'drawImage'
      ? undefined
      : (...args: unknown[]) => { calls.push([key, ...args]) },
    set: (_, key, value) => { calls.push(['set', key, value]); return true },
  })
  return { ctx, calls }
}

function feedSegments(calls: unknown[][]) {
  const segments: { start: [number, number]; end: [number, number] }[] = []
  for (let i = 0; i < calls.length - 1; i += 1) {
    const move = calls[i]
    const line = calls[i + 1]
    if (move[0] !== 'moveTo' || line[0] !== 'lineTo') continue
    if (typeof move[1] !== 'number' || typeof move[2] !== 'number') continue
    if (typeof line[1] !== 'number' || typeof line[2] !== 'number') continue
    if (move[2] < 20 || move[2] > 35 || line[2] < move[2] + 4 || line[2] > move[2] + 6 || line[2] > 39) continue
    segments.push({ start: [move[1], move[2]], end: [line[1], line[2]] })
  }
  return segments
}

let checks = 0
for (const phase of ['charging', 'ready', 'gutter_fill', 'gargoyle_release', 'raining', 'cooldown'] as const) {
  const { ctx, calls } = recorder()
  const state = { ...createRainState(), phase, fill: phase === 'gutter_fill' ? 0.5 : 1 }
  const before = JSON.stringify(state)
  drawRainArchitecture(ctx, state, false)
  assert.equal(JSON.stringify(state), before, 'renderer cannot mutate environmental state')
  assert.equal(calls[0][0], 'save')
  assert.equal(calls.at(-1)?.[0], 'restore')
  const spoutStarts = calls.filter(row => row[0] === 'moveTo' && row[2] === 81)
  assert.equal(spoutStarts.length > 0, phase === 'gargoyle_release' || phase === 'raining')
  checks++
}

const gargoyleArt = {} as CanvasImageSource
const artRender = recorder()
drawRainArchitecture(artRender.ctx, { ...createRainState(), phase: 'ready' }, false, gargoyleArt)
assert.deepEqual(
  artRender.calls.filter(row => row[0] === 'drawImage'),
  [
    ['drawImage', gargoyleArt, 370, 44, 64, 48],
    ['drawImage', gargoyleArt, 560, 44, 64, 48],
  ],
  'gargoyle art mouth aperture stays on the existing world-space anchors',
)
checks++

const artFallback = recorder({ drawImage: false })
drawRainArchitecture(artFallback.ctx, { ...createRainState(), phase: 'ready' }, false, gargoyleArt)
assert.equal(artFallback.calls.some(row => row[0] === 'drawImage'), false, 'missing drawImage keeps the procedural fallback')
checks++

const rainCloudArt = {} as CanvasImageSource
for (const phase of ['charging', 'ready', 'gutter_fill', 'gargoyle_release', 'raining', 'cooldown'] as const) {
  const { ctx, calls } = recorder()
  drawRainArchitecture(ctx, { ...createRainState(), phase, fill: phase === 'gutter_fill' ? 0.5 : 1 }, false, null, rainCloudArt)
  const cloudImages = calls.filter(row => row[0] === 'drawImage' && row[1] === rainCloudArt)
  const expected = phase === 'gutter_fill' || phase === 'gargoyle_release' || phase === 'raining'
    ? [['drawImage', rainCloudArt, 460, -20, 128, 43]]
    : []
  assert.deepEqual(cloudImages, expected, `native rain cloud art is phase-gated (${phase})`)
  checks++
}

const cloudFallback = recorder()
drawRainArchitecture(cloudFallback.ctx, { ...createRainState(), phase: 'raining' }, false)
assert.equal(cloudFallback.calls.some(row => row[0] === 'drawImage'), false, 'omitting rain cloud art keeps the procedural fallback')
assert.equal(cloudFallback.calls.some(row => row[0] === 'ellipse' && row[1] === 516 && row[2] === 18), true, 'procedural cloud fallback still draws the cloud body')
checks++

const cloudFallbackWithoutDrawImage = recorder({ drawImage: false })
drawRainArchitecture(cloudFallbackWithoutDrawImage.ctx, { ...createRainState(), phase: 'gutter_fill' }, false, null, rainCloudArt)
assert.equal(cloudFallbackWithoutDrawImage.calls.some(row => row[0] === 'drawImage'), false, 'missing drawImage keeps the procedural cloud fallback')
assert.equal(cloudFallbackWithoutDrawImage.calls.some(row => row[0] === 'ellipse' && row[1] === 516 && row[2] === 18), true, 'procedural fallback covers unavailable native image drawing')
assert.ok(feedSegments(cloudFallbackWithoutDrawImage.calls).length >= 6, 'procedural fallback leaves a readable cloud-to-gutter feed')
checks++

for (const phase of ['charging', 'ready', 'gutter_fill', 'gargoyle_release', 'raining', 'cooldown'] as const) {
  const { ctx, calls } = recorder()
  drawRainArchitecture(ctx, { ...createRainState(), phase, elapsedMs: 0 }, false)
  const feed = feedSegments(calls)
  const active = phase === 'gutter_fill' || phase === 'gargoyle_release' || phase === 'raining'
  assert.equal(feed.length > 0, active, `cloud-to-gutter feed is phase-gated (${phase})`)
  for (const segment of feed) {
    assert.ok(segment.start[0] >= 480 && segment.start[0] <= 567, 'feed origins stay inside cloud alpha x bounds')
    assert.ok(segment.start[1] >= 20 && segment.start[1] <= 35, 'feed drops start at the cloud alpha bottom or below')
    assert.ok(segment.end[0] >= 480 && segment.end[0] <= 567, 'feed endpoints stay inside cloud x bounds')
    assert.ok(segment.end[1] <= 39, 'feed drops end at or above the gutter lip')
    assert.ok(segment.end[1] - segment.start[1] >= 4 && segment.end[1] - segment.start[1] <= 6, 'feed drops stay short and separated')
  }
  checks++
}

const movingFeed = recorder()
const laterFeed = recorder()
drawRainArchitecture(movingFeed.ctx, { ...createRainState(), phase: 'gutter_fill', elapsedMs: 0 }, false)
drawRainArchitecture(laterFeed.ctx, { ...createRainState(), phase: 'gutter_fill', elapsedMs: 400 }, false)
assert.notDeepEqual(
  feedSegments(movingFeed.calls).map(segment => segment.start[1]),
  feedSegments(laterFeed.calls).map(segment => segment.start[1]),
  'normal clock advances the feed drops vertically',
)
checks++

const staticFeed = recorder()
const staticLaterFeed = recorder()
drawRainArchitecture(staticFeed.ctx, { ...createRainState(), phase: 'gutter_fill', elapsedMs: 10 }, true)
drawRainArchitecture(staticLaterFeed.ctx, { ...createRainState(), phase: 'gutter_fill', elapsedMs: 800 }, true)
assert.deepEqual(staticFeed.calls, staticLaterFeed.calls, 'reduced motion keeps feed drops static across clocks')
checks++

for (const phase of ['lit', 'holding', 'steaming', 'wet', 'spent'] as const) {
  const { ctx, calls } = recorder()
  drawVillagerTorch(ctx, { ...createTorchState(), phase }, 200, 250, false)
  const flame = calls.some(row => row[0] === 'set' && row[2] === '#e8a838')
  assert.equal(flame, phase === 'lit' || phase === 'holding')
  assert.equal(calls.at(-1)?.[0], 'restore')
  checks++
}

const first = recorder(), second = recorder()
drawRainArchitecture(first.ctx, { ...createRainState(), phase: 'raining', elapsedMs: 10 }, true)
drawRainArchitecture(second.ctx, { ...createRainState(), phase: 'raining', elapsedMs: 800 }, true)
assert.deepEqual(first.calls, second.calls, 'reduced motion is static despite elapsed time')
checks++

const invalid = recorder()
drawVillagerTorch(invalid.ctx, createTorchState(), NaN, 0, false)
assert.equal(invalid.calls.length, 0)
checks++
console.log(`pitchforks rain drawing contracts: ${checks}/${checks} PASS (harness only)`)
