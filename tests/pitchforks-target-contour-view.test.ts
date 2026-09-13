import assert from 'node:assert/strict'

import {
  drawPitchforksTargetContour,
  type PitchforksTargetContourDescriptor,
} from '../src/components/PitchDefender/pitchforksTargetContourView'

type DrawCall = readonly [x: number, y: number, width: number, height: number, fillStyle: unknown]

type ExtractionOptions = {
  readonly alpha?: readonly number[]
  readonly fail?: boolean
}

class MockExtractionContext {
  imageSmoothingEnabled = true
  drawImageCalls: unknown[][] = []
  getImageDataCalls: unknown[][] = []

  constructor(private readonly options: ExtractionOptions) {}

  drawImage(...args: unknown[]): void {
    this.drawImageCalls.push(args)
  }

  getImageData(...args: unknown[]): { data: Uint8ClampedArray } {
    this.getImageDataCalls.push(args)
    if (this.options.fail) throw new Error('mock extraction failure')
    return { data: Uint8ClampedArray.from(this.options.alpha ?? [255, 0, 0, 255]) }
  }
}

class MockCanvas {
  width = 0
  height = 0
  readonly context: MockExtractionContext

  constructor(options: ExtractionOptions) {
    this.context = new MockExtractionContext(options)
  }

  getContext(kind: string): MockExtractionContext | null {
    return kind === '2d' ? this.context : null
  }
}

class MockMainContext {
  fillStyle: unknown = 'caller-fill'
  readonly fillRectCalls: DrawCall[] = []
  readonly lifecycle: string[] = []
  private savedFillStyle: unknown = this.fillStyle

  save(): void {
    this.lifecycle.push('save')
    this.savedFillStyle = this.fillStyle
  }

  restore(): void {
    this.lifecycle.push('restore')
    this.fillStyle = this.savedFillStyle
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.fillRectCalls.push([x, y, width, height, this.fillStyle])
  }
}

type MockDocument = {
  createElement: (kind: string) => MockCanvas
}

const installDocument = (factory: () => MockCanvas): void => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (kind: string) => {
      assert.equal(kind, 'canvas')
      return factory()
    } } satisfies MockDocument,
  })
}

const removeDocument = (): void => {
  Reflect.deleteProperty(globalThis, 'document')
}

const image = (): HTMLImageElement => ({ } as HTMLImageElement)

const descriptor = (
  overrides: Partial<PitchforksTargetContourDescriptor> = {},
): PitchforksTargetContourDescriptor => ({
  image: image(),
  sourceX: 0,
  sourceY: 0,
  sourceWidth: 1,
  sourceHeight: 1,
  destinationX: 10,
  destinationY: 20,
  scale: 2,
  ...overrides,
})

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => {
  const extraction = new MockCanvas({ alpha: [0, 0, 0, 255] })
  let createCount = 0
  installDocument(() => {
    createCount += 1
    return extraction
  })
  const ctx = new MockMainContext()
  const target = descriptor()

  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), true)
  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), true)
  assert.equal(createCount, 1, 'same image/frame reuses native alpha geometry')
  assert.equal(extraction.context.drawImageCalls.length, 1)
  assert.equal(extraction.context.getImageDataCalls.length, 1)
  assert.equal(extraction.context.imageSmoothingEnabled, false)
  assert.deepEqual(extraction.context.drawImageCalls[0], [
    target.image,
    0, 0, 1, 1,
    0, 0, 1, 1,
  ])
  assert.equal(ctx.fillRectCalls.length, 10, 'each draw paints four contour pixels and one seam')
})

check(() => {
  let createCount = 0
  installDocument(() => {
    createCount += 1
    return new MockCanvas({
      alpha: createCount === 1
        ? [255, 0, 0, 255]
        : [255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    })
  })
  const ctx = new MockMainContext()
  const targetImage = image()

  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, descriptor({ image: targetImage })), true)
  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, descriptor({
    image: targetImage,
    sourceX: 4,
    sourceY: 5,
    sourceWidth: 2,
    sourceHeight: 2,
  })), true)
  assert.equal(createCount, 2, 'a changed frame rectangle receives independent native geometry')
})

check(() => {
  const extraction = new MockCanvas({ alpha: [0, 0, 0, 255] })
  installDocument(() => extraction)
  const ctx = new MockMainContext()
  const target = descriptor({ destinationX: 10.25, destinationY: 20.25, scale: 2 })

  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), true)
  assert.deepEqual(ctx.fillRectCalls, [
    [10, 18, 2, 2, '#f1f5f9'],
    [8, 20, 2, 2, '#f1f5f9'],
    [12, 20, 2, 2, '#f1f5f9'],
    [10, 22, 2, 2, '#f1f5f9'],
    [10, 22, 2, 2, '#1e293b'],
  ])
  assert.ok(ctx.fillRectCalls.every(([, , width, height]) => [width, height].every(Number.isInteger)))
})

check(() => {
  const extraction = new MockCanvas({ alpha: [0, 0, 0, 255] })
  installDocument(() => extraction)
  const ctx = new MockMainContext()
  ctx.fillStyle = '#caller-owned'
  const target = descriptor()

  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), true)
  assert.deepEqual(ctx.lifecycle, ['save', 'restore'])
  assert.equal(ctx.fillStyle, '#caller-owned', 'canvas state is restored after drawing')
})

check(() => {
  removeDocument()
  const ctx = new MockMainContext()
  const target = descriptor()

  assert.doesNotThrow(() => {
    assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), false)
  })
  assert.equal(ctx.lifecycle.length, 0, 'SSR path does not touch the destination context')

  // The failed frame is memoized; installing a document later does not cause
  // a render loop to retry the same unavailable frame.
  let createCount = 0
  installDocument(() => {
    createCount += 1
    return new MockCanvas({ alpha: [255, 0, 0, 0] })
  })
  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), false)
  assert.equal(createCount, 0)
})

check(() => {
  let createCount = 0
  installDocument(() => {
    createCount += 1
    return new MockCanvas({ fail: true })
  })
  const ctx = new MockMainContext()
  const target = descriptor({ image: image() })

  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), false)
  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, target), false)
  assert.equal(createCount, 1, 'extraction failures are cached per image/frame')
  assert.deepEqual(ctx.lifecycle, [])
})

check(() => {
  removeDocument()
  const ctx = new MockMainContext()
  assert.equal(drawPitchforksTargetContour(ctx as unknown as CanvasRenderingContext2D, {
    ...descriptor(),
    image: null as unknown as HTMLImageElement,
  }), false)
  assert.equal(drawPitchforksTargetContour(null as unknown as CanvasRenderingContext2D, descriptor()), false)
})

removeDocument()
console.log(`pitchforks target contour view: ${checks}/${checks} PASS (harness only)`)
