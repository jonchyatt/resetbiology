import assert from 'node:assert/strict'

import {
  getPitchforksThunderheadCaptionRect,
  getPitchforksThunderheadPathPosition,
  PITCHFORKS_THUNDERHEAD_CAPTION_HEIGHT,
  PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS,
  PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y,
} from '../src/components/PitchDefender/pitchforksThunderheadPath'

type Rect = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

const BANK_START = Object.freeze({ x: 128, y: 88 })
// The stored-cloud placement is intentionally eight pixels left of the old
// bank anchor so its measured envelope cannot touch the original left bell.
const CLEARANCE_BANK_START = Object.freeze({ x: 120, y: 88 })
const TARGET_XS = [400, 600] as const
const WORLD_WIDTH = 720
const WORLD_RIGHT_MARGIN = 4

const OBSTACLES: ReadonlyArray<readonly [string, Rect]> = [
  ['rightbell swept', { left: 241.23, top: 19.01, width: 66.48, height: 62.8 }],
  ['left gargoyle', { left: 370, top: 44, width: 64, height: 48 }],
  ['right gargoyle', { left: 560, top: 44, width: 64, height: 48 }],
  ['gutter', { left: 300, top: 37.5, width: 390, height: 44.5 }],
  ['Frank reaction', { left: 50.16, top: 180.48, width: 103.68, height: 170 }],
  ['health', { left: 61, top: 188, width: 62, height: 4 }],
]

const LEFT_BELL_OBSTACLE: readonly [string, Rect] = [
  'left bell conservative measured bound',
  { left: 180, top: 24, width: 45, height: 54 },
]

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const approx = (actual: number, expected: number, epsilon = 1e-9) =>
  Math.abs(actual - expected) <= epsilon

const cloudBounds = (core: { x: number; y: number }): Rect => ({
  left: core.x + PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.left,
  top: core.y + PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.top,
  width: PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.width,
  height: PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.height,
})

const intersects = (left: Rect, right: Rect): boolean =>
  left.left < right.left + right.width
  && left.left + left.width > right.left
  && left.top < right.top + right.height
  && left.top + left.height > right.top

check(() => {
  const malformed: ReadonlyArray<readonly [unknown, unknown, unknown]> = [
    [null, 400, 0],
    [[], 400, 0],
    [{ x: Number.NaN, y: 88 }, 400, 0],
    [{ x: 128, y: Number.POSITIVE_INFINITY }, 400, 0],
    [{ x: 128, y: 88 }, Number.NaN, 0],
    [{ x: 128, y: 88 }, Number.POSITIVE_INFINITY, 0],
    [{ x: 128, y: 88 }, 400, Number.NaN],
    [{ x: 128, y: 88 }, 400, Number.NEGATIVE_INFINITY],
  ]
  for (const [start, targetX, progress] of malformed) {
    assert.equal(
      getPitchforksThunderheadPathPosition(
        start as never,
        targetX as number,
        progress as number,
      ),
      null,
    )
  }
})

check(() => {
  for (const targetX of TARGET_XS) {
    assert.deepEqual(getPitchforksThunderheadPathPosition(BANK_START, targetX, 0), BANK_START)
    assert.deepEqual(
      getPitchforksThunderheadPathPosition(BANK_START, targetX, 1),
      { x: targetX, y: PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y },
    )
    assert.equal(Object.isFrozen(getPitchforksThunderheadPathPosition(BANK_START, targetX, 0)), true)
    assert.equal(Object.isFrozen(getPitchforksThunderheadPathPosition(BANK_START, targetX, 1)), true)
  }
})

check(() => {
  for (const targetX of TARGET_XS) {
    const breakpoint = getPitchforksThunderheadPathPosition(BANK_START, targetX, 0.25)
    assert.deepEqual(breakpoint, { x: BANK_START.x, y: PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y })

    const justBefore = getPitchforksThunderheadPathPosition(BANK_START, targetX, 0.25 - 1e-9)
    const justAfter = getPitchforksThunderheadPathPosition(BANK_START, targetX, 0.25 + 1e-9)
    assert.ok(justBefore !== null && justAfter !== null)
    assert.ok(approx(justBefore.x, BANK_START.x))
    assert.ok(approx(justBefore.y, PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y, 1e-6))
    assert.ok(approx(justAfter.x, BANK_START.x, 1e-6))
    assert.ok(approx(justAfter.y, PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y))
  }
})

check(() => {
  for (const targetX of TARGET_XS) {
    assert.deepEqual(
      getPitchforksThunderheadPathPosition(BANK_START, targetX, -5),
      BANK_START,
    )
    assert.deepEqual(
      getPitchforksThunderheadPathPosition(BANK_START, targetX, 5),
      { x: targetX, y: PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y },
    )
  }
})

check(() => {
  // Every millisecond-equivalent normalized sample is checked, with the
  // quarter-point breakpoint explicitly included even though it is sampled.
  for (const targetX of TARGET_XS) {
    for (let step = 0; step <= 1000; step += 1) {
      const progress = step / 1000
      const point = getPitchforksThunderheadPathPosition(BANK_START, targetX, progress)
      assert.ok(point !== null, `finite path sample at ${progress}`)

      const expected = progress <= 0.25
        ? {
            x: BANK_START.x,
            y: BANK_START.y
              + (PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y - BANK_START.y) * (progress / 0.25),
          }
        : {
            x: BANK_START.x + (targetX - BANK_START.x) * ((progress - 0.25) / 0.75),
            y: PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y,
          }
      assert.ok(approx(point.x, expected.x), `x path sample at ${targetX}/${progress}`)
      assert.ok(approx(point.y, expected.y), `y path sample at ${targetX}/${progress}`)
      assert.ok(point.y >= BANK_START.y && point.y <= PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y)
    }

    const explicitBreakpoint = getPitchforksThunderheadPathPosition(BANK_START, targetX, 0.25)
    assert.deepEqual(explicitBreakpoint, {
      x: BANK_START.x,
      y: PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y,
    })
  }
})

check(() => {
  const invalidCaptionInputs: ReadonlyArray<readonly [unknown, unknown, unknown]> = [
    [null, 72, WORLD_WIDTH],
    [{ x: Number.NaN, y: 88 }, 72, WORLD_WIDTH],
    [{ x: 128, y: 88 }, Number.NaN, WORLD_WIDTH],
    [{ x: 128, y: 88 }, 0, WORLD_WIDTH],
    [{ x: 128, y: 88 }, 72, Number.NaN],
    [{ x: 128, y: 88 }, 72, 0],
  ]
  for (const [core, width, worldWidth] of invalidCaptionInputs) {
    assert.equal(
      getPitchforksThunderheadCaptionRect(
        core as never,
        width as number,
        worldWidth as number,
      ),
      null,
    )
  }
})

check(() => {
  for (const width of [72, 86, 100]) {
    const preferred = getPitchforksThunderheadCaptionRect(BANK_START, width)
    assert.deepEqual(preferred, {
      left: BANK_START.x + 64,
      top: BANK_START.y + 16,
      width,
      height: PITCHFORKS_THUNDERHEAD_CAPTION_HEIGHT,
    })
    assert.equal(Object.isFrozen(preferred), true)

    const fallback = getPitchforksThunderheadCaptionRect({ x: 600, y: 149 }, width)
    assert.deepEqual(fallback, {
      left: 600 - 64 - width,
      top: 149 + 16,
      width,
      height: PITCHFORKS_THUNDERHEAD_CAPTION_HEIGHT,
    })
    assert.ok((fallback?.left ?? 0) >= WORLD_RIGHT_MARGIN)
    assert.ok((fallback?.left ?? 0) + width <= WORLD_WIDTH - WORLD_RIGHT_MARGIN)
  }

  // Both sides are impossible for this measured world, so missing layout is
  // explicit rather than a clipped or invented caption.
  assert.equal(getPitchforksThunderheadCaptionRect({ x: 360, y: 149 }, 700), null)
})

check(() => {
  // Cloud envelope and caption are checked independently against every
  // supplied collision rectangle. The original 128px bank anchor is retained
  // above for the exact path contract; clearance uses the separately measured
  // stored-cloud anchor at 120px so the conservative left-bell bound is also
  // covered. No universal left-bell claim is inferred beyond that rectangle.
  for (const targetX of TARGET_XS) {
    for (let step = 0; step <= 1000; step += 1) {
      const progress = step / 1000
      const point = getPitchforksThunderheadPathPosition(CLEARANCE_BANK_START, targetX, progress)
      assert.ok(point !== null)
      const cloud = cloudBounds(point)
      for (const [name, obstacle] of [...OBSTACLES, LEFT_BELL_OBSTACLE]) {
        assert.equal(intersects(cloud, obstacle), false, `cloud intersects ${name} at ${targetX}/${progress}`)
      }
    }
  }
})

check(() => {
  for (const targetX of TARGET_XS) {
    for (const width of [72, 86, 100]) {
      for (let step = 0; step <= 1000; step += 1) {
        const progress = step / 1000
        const point = getPitchforksThunderheadPathPosition(CLEARANCE_BANK_START, targetX, progress)
        assert.ok(point !== null)
        const caption = getPitchforksThunderheadCaptionRect(point, width)
        assert.ok(caption !== null, `caption fits at ${targetX}/${progress}/${width}`)
        assert.equal(caption.height, 32)
        assert.equal(caption.top, point.y + 16)
        assert.ok(caption.left >= WORLD_RIGHT_MARGIN)
        assert.ok(caption.left + caption.width <= WORLD_WIDTH - WORLD_RIGHT_MARGIN)
        assert.equal(intersects(cloudBounds(point), caption), false, 'caption stays below cloud')
        for (const [name, obstacle] of [...OBSTACLES, LEFT_BELL_OBSTACLE]) {
          assert.equal(intersects(caption, obstacle), false, `caption intersects ${name} at ${targetX}/${progress}/${width}`)
        }
      }
    }
  }
})

console.log(`pitchforks Thunderhead path geometry: ${checks}/${checks} PASS`)
