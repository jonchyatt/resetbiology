import {
  BASE_H, BASE_W, H, SPACE_SCALE, W, noteButtonRects,
} from '../../src/components/PitchDefender/retroBlasterEngine'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function near(actual: number, expected: number, label: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`)
}

function assertLayout(width: number, height: number, count: number): void {
  const rects = noteButtonRects(count, width, height)
  assert(rects.length === count, `${width}x${height}: wrong rect count`)
  const scale = height / BASE_H
  near(rects[0].y, 290 * scale, `${width}x${height}: y`)
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i]
    assert(rect.width > 0 && rect.height > 0, `${width}x${height}: degenerate rect ${i}`)
    assert(rect.x >= 0 && rect.x + rect.width <= width, `${width}x${height}: rect ${i} clips`)
    if (i > 0) assert(rect.x > rects[i - 1].x + rects[i - 1].width, `${width}x${height}: rect ${i} overlaps`)
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    assert(centerX >= rect.x && centerX <= rect.x + rect.width, `${width}x${height}: center X misses`)
    assert(centerY >= rect.y && centerY <= rect.y + rect.height, `${width}x${height}: center Y misses`)
  }
}

assert(W === 640 && H === 360, 'phase-2 canvas must be 640x360')
near(SPACE_SCALE, 1.125, 'space scale')
for (const count of [1, 4, 8]) assertLayout(BASE_W, BASE_H, count)
assertLayout(640, 360, 8)
console.log(`PASS R1.5a phase 2: shared note-button rectangles at ${BASE_W}x${BASE_H} and ${W}x${H}; SPACE_SCALE=${SPACE_SCALE}`)
