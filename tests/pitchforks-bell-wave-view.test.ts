import assert from 'node:assert/strict'

import {
  drawPitchforksBellWave,
  type PitchforksBellWaveCanvasContext,
  type PitchforksBellWaveViewInput,
} from '../src/components/PitchDefender/pitchforksBellWaveView'

type Call = Readonly<{ op: string; args: readonly unknown[] }>

class RecordingContext implements PitchforksBellWaveCanvasContext {
  readonly calls: Call[] = []
  globalAlpha = 0.73
  lineWidth = 7
  strokeStyle: CanvasRenderingContext2D['strokeStyle'] = '#caller-owned'
  private saved: { globalAlpha: number; lineWidth: number; strokeStyle: CanvasRenderingContext2D['strokeStyle'] } | null = null

  private record(op: string, ...args: unknown[]): void {
    this.calls.push({ op, args })
  }

  save(): void {
    this.record('save')
    this.saved = { globalAlpha: this.globalAlpha, lineWidth: this.lineWidth, strokeStyle: this.strokeStyle }
  }

  restore(): void {
    this.record('restore')
    if (this.saved) {
      this.globalAlpha = this.saved.globalAlpha
      this.lineWidth = this.saved.lineWidth
      this.strokeStyle = this.saved.strokeStyle
    }
  }

  beginPath(): void { this.record('beginPath') }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.record('arc', x, y, radius, startAngle, endAngle)
  }

  stroke(): void { this.record('stroke') }
}

const baseInput = (overrides: Partial<PitchforksBellWaveViewInput> = {}): PitchforksBellWaveViewInput => ({
  active: true,
  originX: 401.5,
  originY: 81.25,
  radius: 96,
  progress: 0.65,
  reducedMotion: false,
  ...overrides,
})

const arcs = (ctx: RecordingContext): readonly Call[] => ctx.calls.filter(call => call.op === 'arc')
const arcRadius = (call: Call | undefined): number => call?.args[2] as number

let checks = 0
const check = (fn: () => void): void => {
  fn()
  checks += 1
}

check(() => {
  const ctx = new RecordingContext()
  const input = Object.freeze(baseInput())
  drawPitchforksBellWave(ctx, input)
  assert.equal(arcs(ctx).length, 3, 'active motion draws a bounded three-ring wave')
  assert.equal(ctx.calls.filter(call => call.op === 'stroke').length, 3)
  assert.deepEqual(arcs(ctx).map(call => call.args.slice(0, 2)), [
    [input.originX, input.originY],
    [input.originX, input.originY],
    [input.originX, input.originY],
  ])
  assert.ok(arcRadius(arcs(ctx)[0]) < arcRadius(arcs(ctx)[1]))
  assert.ok(arcRadius(arcs(ctx)[1]) < arcRadius(arcs(ctx)[2]))
  assert.equal(arcRadius(arcs(ctx).at(-1)), input.radius, 'leading front is at the caller supplied contact radius')
  assert.deepEqual(ctx.calls.slice(0, 2).map(call => call.op), ['save', 'beginPath'])
  assert.equal(ctx.calls.at(-1)?.op, 'restore')
})

check(() => {
  const first = new RecordingContext()
  const second = new RecordingContext()
  drawPitchforksBellWave(first, baseInput({ progress: 0 }))
  drawPitchforksBellWave(second, baseInput({ progress: 1 }))
  for (const ctx of [first, second]) {
    assert.ok(arcs(ctx).length <= 3)
    assert.equal(ctx.calls.filter(call => call.op === 'stroke').length, arcs(ctx).length)
  }
})

check(() => {
  const moving = new RecordingContext()
  const reduced = new RecordingContext()
  const input = baseInput({ radius: 113.5, progress: 0.22 })
  drawPitchforksBellWave(moving, input)
  drawPitchforksBellWave(reduced, { ...input, reducedMotion: true })
  assert.equal(arcs(reduced).length, 1, 'reduced motion removes decorative trails')
  assert.equal(arcRadius(arcs(moving).at(-1)), arcRadius(arcs(reduced)[0]))
  assert.equal(arcRadius(arcs(reduced)[0]), input.radius, 'reduced motion keeps the same leading edge')
})

check(() => {
  const ctx = new RecordingContext()
  const before = { alpha: ctx.globalAlpha, lineWidth: ctx.lineWidth, strokeStyle: ctx.strokeStyle }
  drawPitchforksBellWave(ctx, baseInput())
  assert.deepEqual(
    { alpha: ctx.globalAlpha, lineWidth: ctx.lineWidth, strokeStyle: ctx.strokeStyle },
    before,
    'caller canvas state is restored, including alpha',
  )
  assert.deepEqual(ctx.calls.filter(call => call.op === 'save' || call.op === 'restore').map(call => call.op), ['save', 'restore'])
})

check(() => {
  const invalidInputs: unknown[] = [
    null,
    undefined,
    baseInput({ active: false }),
    baseInput({ originX: Number.NaN }),
    baseInput({ originY: Number.POSITIVE_INFINITY }),
    baseInput({ originX: -1 }),
    baseInput({ originY: -1 }),
    baseInput({ radius: Number.NaN }),
    baseInput({ radius: -1 }),
    baseInput({ progress: Number.POSITIVE_INFINITY }),
    baseInput({ progress: -0.01 }),
    baseInput({ reducedMotion: 'yes' as unknown as boolean }),
  ]
  for (const input of invalidInputs) {
    const ctx = new RecordingContext()
    assert.doesNotThrow(() => drawPitchforksBellWave(ctx, input as PitchforksBellWaveViewInput))
    assert.deepEqual(ctx.calls, [], 'invalid or inactive input is a true no-op')
  }
})

check(() => {
  const first = new RecordingContext()
  const second = new RecordingContext()
  const input = baseInput({ originX: 212, originY: 47, radius: 42, progress: 0.4 })
  drawPitchforksBellWave(first, input)
  drawPitchforksBellWave(second, input)
  assert.deepEqual(first.calls, second.calls, 'same supplied inputs produce the same canvas trace')
  const strokeStyles = first.calls
    .filter(call => call.op === 'strokeStyle')
    .map(call => call.args[0])
  void strokeStyles
  assert.ok(first.calls.length < 20, 'wave primitive count stays small and bounded')
})

console.log(`pitchforks Bell sound-wave view: ${checks}/${checks} PASS (harness only)`)
