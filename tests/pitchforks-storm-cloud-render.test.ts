import assert from 'node:assert/strict'

import {
  type StormHeartCanvasContext,
  type StormHeartImage,
  drawStormHeart,
} from '../src/components/PitchDefender/pitchforksStormHeart'

type Call = Readonly<{ op: string; args: readonly unknown[] }>

type RecordingContext = StormHeartCanvasContext & Readonly<{ calls: Call[] }>

function createRecordingContext(options: Readonly<{ throwOnDrawImage?: boolean; initialGlobalAlpha?: number }> = {}): RecordingContext {
  const calls: Call[] = []
  const record = (op: string, ...args: unknown[]) => calls.push({ op, args })
  let fillStyle: CanvasRenderingContext2D['fillStyle'] = ''
  let strokeStyle: CanvasRenderingContext2D['strokeStyle'] = ''
  let lineWidth = 1
  let lineJoin: CanvasRenderingContext2D['lineJoin'] = 'miter'
  let globalAlpha = options.initialGlobalAlpha ?? 1
  let imageSmoothingEnabled = true
  const stateStack: Array<Readonly<{ globalAlpha: number; imageSmoothingEnabled: boolean }>> = []

  return {
    calls,
    beginPath: () => record('beginPath'),
    drawImage: (...args: unknown[]) => {
      record('drawImage', ...args)
      if (options.throwOnDrawImage) throw new Error('image is not decoded')
    },
    ellipse: (...args: number[]) => record('ellipse', ...args),
    fill: () => record('fill'),
    lineTo: (...args: number[]) => record('lineTo', ...args),
    moveTo: (...args: number[]) => record('moveTo', ...args),
    restore: () => {
      const previous = stateStack.pop()
      if (previous) {
        globalAlpha = previous.globalAlpha
        imageSmoothingEnabled = previous.imageSmoothingEnabled
      }
      record('restore')
    },
    save: () => {
      stateStack.push({ globalAlpha, imageSmoothingEnabled })
      record('save')
    },
    stroke: () => record('stroke'),
    get fillStyle() { return fillStyle },
    set fillStyle(value: CanvasRenderingContext2D['fillStyle']) {
      fillStyle = value
      record('fillStyle', value)
    },
    get globalAlpha() { return globalAlpha },
    set globalAlpha(value: number) {
      globalAlpha = value
      record('globalAlpha', value)
    },
    get imageSmoothingEnabled() { return imageSmoothingEnabled },
    set imageSmoothingEnabled(value: boolean) {
      imageSmoothingEnabled = value
      record('imageSmoothingEnabled', value)
    },
    get lineJoin() { return lineJoin },
    set lineJoin(value: CanvasRenderingContext2D['lineJoin']) {
      lineJoin = value
      record('lineJoin', value)
    },
    get lineWidth() { return lineWidth },
    set lineWidth(value: number) {
      lineWidth = value
      record('lineWidth', value)
    },
    get strokeStyle() { return strokeStyle },
    set strokeStyle(value: CanvasRenderingContext2D['strokeStyle']) {
      strokeStyle = value
      record('strokeStyle', value)
    },
  } as RecordingContext
}

const image = { id: 'storm-heart-nano' } as unknown as StormHeartImage
const drawableStates = ['dormant', 'gather-1', 'gather-2', 'gather-3', 'spent'] as const

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

check(() => {
  for (const state of drawableStates) {
    const ctx = createRecordingContext()
    drawStormHeart(ctx, state, 128, 91, image)
    const sprite = ctx.calls.find(call => call.op === 'drawImage')
    assert.ok(sprite, `${state} should draw the optional Storm Heart sprite`)
    assert.equal(sprite.args[0], image)
    assert.deepEqual(sprite.args.slice(1), [56.75, 52.25, 140, 80])
    assert.equal(ctx.calls.filter(call => call.op === 'save').length, 1)
    assert.equal(ctx.calls.filter(call => call.op === 'restore').length, 1)
    assert.equal(ctx.calls.some(call => call.op === 'imageSmoothingEnabled' && call.args[0] === false), true)
    assert.equal(ctx.globalAlpha, 1)
    assert.equal(ctx.imageSmoothingEnabled, true)

    const ellipseCount = ctx.calls.filter(call => call.op === 'ellipse').length
    assert.equal(
      ellipseCount,
      state === 'dormant' || state === 'spent' ? 0 : 2,
      `${state} keeps only the existing internal charge core when the sprite is present`,
    )
    if (state === 'gather-3') {
      assert.equal(ctx.calls.some(call => call.op === 'lineWidth' && call.args[0] === 8), false)
      assert.equal(ctx.calls.some(call => call.op === 'lineWidth' && call.args[0] === 1.5), true)
      assert.equal(ctx.calls.some(call => call.op === 'ellipse' && call.args[2] === 4.2 && call.args[3] === 4.2), true)
    }
  }
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'gather-3', 200, 100, image)
  const sprite = ctx.calls.find(call => call.op === 'drawImage')
  assert.deepEqual(sprite?.args.slice(1), [128.75, 61.25, 140, 80])
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'gather-3', 128, 91)
  assert.equal(ctx.calls.some(call => call.op === 'drawImage'), false)
  assert.ok(ctx.calls.filter(call => call.op === 'ellipse').length > 2)
  assert.equal(ctx.calls.some(call => call.op === 'strokeStyle' && String(call.args[0]).includes('92, 218, 245')), true)
})

check(() => {
  const ctx = createRecordingContext({ initialGlobalAlpha: 0.5 })
  drawStormHeart(ctx, 'spent', 128, 91, image)
  assert.equal(ctx.calls.some(call => call.op === 'globalAlpha' && call.args[0] === 0.31), true)
  assert.equal(ctx.globalAlpha, 0.5)
  assert.equal(ctx.imageSmoothingEnabled, true)
})

check(() => {
  const ctx = createRecordingContext({ throwOnDrawImage: true })
  assert.doesNotThrow(() => drawStormHeart(ctx, 'dormant', 128, 91, image))
  assert.ok(ctx.calls.some(call => call.op === 'ellipse'))
  assert.equal(ctx.imageSmoothingEnabled, true)
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'listen', 128, 91, image)
  drawStormHeart(ctx, 'dormant', Number.NaN, 91, image)
  drawStormHeart(ctx, 'dormant', 128, Number.POSITIVE_INFINITY, image)
  drawStormHeart(ctx, 'unknown' as never, 128, 91, image)
  assert.deepEqual(ctx.calls, [])
})

console.log(`pitchforks Storm Heart cloud asset rendering: ${checks}/${checks} PASS`)
