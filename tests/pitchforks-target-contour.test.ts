import assert from 'node:assert/strict'

import { derivePitchforksTargetContour } from '../src/components/PitchDefender/pitchforksTargetContour'

const makeFrame = (
  width: number,
  height: number,
  occupied: ReadonlyArray<readonly [number, number]>,
): Uint8ClampedArray => {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of occupied) rgba[(y * width + x) * 4 + 3] = 255
  return rgba
}

const pointTuples = (points: ReadonlyArray<{ x: number; y: number }>) =>
  points.map(({ x, y }) => [x, y])

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => {
  const result = derivePitchforksTargetContour(1, 1, makeFrame(1, 1, [[0, 0]]))
  assert.deepEqual(pointTuples(result.contour), [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ])
  assert.deepEqual(result.footSeam, [{ y: 0, xStart: 0, xEnd: 0 }])
})

check(() => {
  const result = derivePitchforksTargetContour(4, 4, makeFrame(4, 4, [
    [1, 1], [2, 1],
    [1, 2], [2, 2],
  ]))
  assert.deepEqual(pointTuples(result.contour), [
    [1, 0], [2, 0],
    [0, 1], [3, 1],
    [0, 2], [3, 2],
    [1, 3], [2, 3],
  ])
  assert.deepEqual(result.footSeam, [{ y: 2, xStart: 1, xEnd: 2 }])
})

check(() => {
  // The transparent center is an internal hole and is outlined by its four
  // occupied neighbors; diagonal pixels are never consulted as neighbors.
  const result = derivePitchforksTargetContour(3, 3, makeFrame(3, 3, [
    [0, 0], [1, 0], [2, 0],
    [0, 1],         [2, 1],
    [0, 2], [1, 2], [2, 2],
  ]))
  assert.equal(result.contour.length, 13)
  assert.ok(result.contour.some(point => point.x === 1 && point.y === 1))
  assert.deepEqual(result.footSeam, [{ y: 2, xStart: 0, xEnd: 2 }])
})

check(() => {
  const result = derivePitchforksTargetContour(2, 2, makeFrame(2, 2, [
    [0, 0], [1, 0],
    [0, 1], [1, 1],
  ]))
  assert.deepEqual(pointTuples(result.contour), [
    [0, -1], [1, -1],
    [-1, 0], [2, 0],
    [-1, 1], [2, 1],
    [0, 2], [1, 2],
  ])
  assert.ok(result.contour.every(({ x, y }) => x >= -1 && x <= 2 && y >= -1 && y <= 2))
})

check(() => {
  const result = derivePitchforksTargetContour(7, 3, makeFrame(7, 3, [
    [3, 1],
    [1, 2], [2, 2], [5, 2], [6, 2],
  ]))
  assert.deepEqual(result.footSeam, [
    { y: 2, xStart: 1, xEnd: 2 },
    { y: 2, xStart: 5, xEnd: 6 },
  ])
})

check(() => {
  const firstFrame = makeFrame(1, 1, [[0, 0]])
  const secondFrame = makeFrame(3, 2, [[2, 1]])
  const first = derivePitchforksTargetContour(1, 1, firstFrame)
  const second = derivePitchforksTargetContour(3, 2, secondFrame)
  assert.deepEqual(pointTuples(first.contour), [[0, -1], [-1, 0], [1, 0], [0, 1]])
  assert.deepEqual(pointTuples(second.contour), [[2, 0], [1, 1], [3, 1], [2, 2]])
  assert.deepEqual(first.footSeam, [{ y: 0, xStart: 0, xEnd: 0 }])
  assert.deepEqual(second.footSeam, [{ y: 1, xStart: 2, xEnd: 2 }])
})

check(() => {
  const frame = makeFrame(3, 2, [[1, 0], [0, 1]])
  const before = new Uint8ClampedArray(frame)
  const result = derivePitchforksTargetContour(3, 2, frame)
  assert.deepEqual(frame, before)
  assert.equal(result.contour.some(({ x, y }) => x === 1 && y === 0), false)
  assert.equal(result.contour.some(({ x, y }) => x === 0 && y === 1), false)
})

check(() => {
  assert.deepEqual(derivePitchforksTargetContour(4, 3, new Uint8ClampedArray(4 * 3 * 4)), {
    contour: [],
    footSeam: [],
  })
})

check(() => {
  assert.throws(() => derivePitchforksTargetContour(0, 1, new Uint8ClampedArray(0)), RangeError)
  assert.throws(() => derivePitchforksTargetContour(1.5, 1, new Uint8ClampedArray(4)), RangeError)
  assert.throws(() => derivePitchforksTargetContour(1, Number.NaN, new Uint8ClampedArray(4)), RangeError)
  assert.throws(() => derivePitchforksTargetContour(2, 2, new Uint8ClampedArray(3)), RangeError)
  assert.throws(() => derivePitchforksTargetContour(1, 1, [0, 0, 0, 255] as unknown as Uint8ClampedArray), TypeError)
  assert.throws(() => derivePitchforksTargetContour(1, 1, new Uint16Array(4) as unknown as Uint8ClampedArray), TypeError)
})

check(() => {
  const width = 5
  const height = 4
  const occupied: Array<readonly [number, number]> = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) occupied.push([x, y])
  }
  const result = derivePitchforksTargetContour(width, height, makeFrame(width, height, occupied))
  assert.equal(result.contour.length, 2 * width + 2 * height)
  assert.equal(new Set(result.contour.map(({ x, y }) => `${x},${y}`)).size, result.contour.length)
  assert.deepEqual(result.footSeam, [{ y: height - 1, xStart: 0, xEnd: width - 1 }])
})

console.log(`pitchforks target contour: ${checks}/${checks} PASS`)
