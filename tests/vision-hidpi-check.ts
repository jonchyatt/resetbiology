import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  __resetGaborCacheForTest,
  drawGaborPatch,
  fitCanvasToElement,
  normalizeGaborPhase,
} from '../src/lib/vision/canvasKit'

type ImageSnapshot = { width: number; height: number; data: Uint8ClampedArray }

class FakeContext {
  readonly drawCalls: Array<{ tile: FakeCanvas; x: number; y: number; width: number; height: number }> = []
  readonly transforms: Array<[number, number, number, number, number, number]> = []
  globalCompositeOperation: GlobalCompositeOperation = 'source-over'
  imageData: ImageSnapshot | undefined
  private transform = { a: 1, d: 1 }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.transform = { a, d }
    this.transforms.push([a, b, c, d, e, f])
  }

  getTransform() {
    return { a: this.transform.a, d: this.transform.d }
  }

  createImageData(width: number, height: number) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData
  }

  putImageData(image: ImageData) {
    this.imageData = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }
  }

  drawImage(tile: FakeCanvas, x: number, y: number, width: number, height: number) {
    this.drawCalls.push({ tile, x, y, width, height })
  }
}

class FakeCanvas {
  private _width = 0
  private _height = 0
  readonly ctx = new FakeContext()
  readonly widthWrites: number[] = []
  readonly heightWrites: number[] = []
  cssWrites = 0
  rect: { width: number; height: number }
  readonly style: Record<string, unknown>

  constructor(width = 0, height = 0) {
    this.rect = { width, height }
    this.style = new Proxy({}, { set: () => { this.cssWrites += 1; return true } })
  }

  get width() { return this._width }
  set width(value: number) { this._width = value; this.widthWrites.push(value) }
  get height() { return this._height }
  set height(value: number) { this._height = value; this.heightWrites.push(value) }
  getBoundingClientRect() { return { ...this.rect } as DOMRect }
  getContext() { return this.ctx as unknown as CanvasRenderingContext2D }
}

const createdTiles: FakeCanvas[] = []
let dpr = 1

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { get devicePixelRatio() { return dpr } },
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    createElement(name: string) {
      assert.equal(name, 'canvas')
      const tile = new FakeCanvas()
      createdTiles.push(tile)
      return tile as unknown as HTMLCanvasElement
    },
  },
})

function fingerprint(data: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  for (const byte of data) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function pixel(snapshot: ImageSnapshot, x: number, y: number): number[] {
  const start = (y * snapshot.width + x) * 4
  return [...snapshot.data.slice(start, start + 4)]
}

function legacyOpaqueReference(opts: {
  size: number
  orientation: number
  frequency: number
  contrast: number
  sigma: number
  phase: number
}): Uint8ClampedArray {
  const data = new Uint8ClampedArray(opts.size * opts.size * 4)
  const half = opts.size / 2
  const theta = (opts.orientation * Math.PI) / 180
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)
  const phaseRad = (opts.phase * Math.PI) / 180
  const normalizedFreq = (2 * Math.PI * opts.frequency) / opts.size

  for (let y = 0; y < opts.size; y++) {
    for (let x = 0; x < opts.size; x++) {
      const xc = x - half
      const yc = y - half
      const xPrime = xc * cosTheta + yc * sinTheta
      const yPrime = -xc * sinTheta + yc * cosTheta
      const gaussian = Math.exp(-(xPrime * xPrime + yPrime * yPrime) / (2 * opts.sigma * opts.sigma))
      const pixelValue = Math.max(0, Math.min(255, Math.round(128 + gaussian * Math.cos(normalizedFreq * xPrime + phaseRad) * opts.contrast * 127)))
      const index = (y * opts.size + x) * 4
      data[index] = pixelValue
      data[index + 1] = pixelValue
      data[index + 2] = pixelValue
      data[index + 3] = 255
    }
  }

  return data
}

function drawAt(dprValue: number, opts: Parameters<typeof drawGaborPatch>[3], reset = true) {
  if (reset) __resetGaborCacheForTest()
  dpr = dprValue
  const canvas = new FakeCanvas(80, 80)
  fitCanvasToElement(canvas as unknown as HTMLCanvasElement)
  drawGaborPatch(canvas.ctx as unknown as CanvasRenderingContext2D, 31.5, 37.25, opts)
  const call = canvas.ctx.drawCalls.at(-1)!
  return { canvas, call, tile: call.tile, image: call.tile.ctx.imageData! }
}

function run() {
  const canvas = new FakeCanvas(100.25, 50.5)
  for (const [ratio, backingWidth, backingHeight] of [[1, 100, 51], [2, 201, 101], [3, 301, 152]] as const) {
    dpr = ratio
    assert.deepEqual(
      fitCanvasToElement(canvas as unknown as HTMLCanvasElement),
      { width: 100.25, height: 50.5, dpr: ratio },
      `DPR ${ratio} must preserve fractional logical geometry`,
    )
    assert.equal(canvas.width, backingWidth)
    assert.equal(canvas.height, backingHeight)
  }
  assert.equal(canvas.cssWrites, 0, 'fitting must never write CSS layout')

  const transformAtThree = canvas.ctx.transforms.at(-1)!
  assert.deepEqual(transformAtThree, [301 / 100.25, 0, 0, 152 / 50.5, 0, 0], 'fit must reset, never accumulate scale')
  dpr = 3.75
  fitCanvasToElement(canvas as unknown as HTMLCanvasElement)
  assert.equal(canvas.width, 376, 'DPR is the actual uncapped browser value')
  assert.equal(canvas.height, 189)
  assert.deepEqual(canvas.ctx.transforms.at(-1), [376 / 100.25, 0, 0, 189 / 50.5, 0, 0])

  const dprOnlyWrites = canvas.widthWrites.length
  dpr = 3
  fitCanvasToElement(canvas as unknown as HTMLCanvasElement)
  assert.equal(canvas.widthWrites.length, dprOnlyWrites + 1, 'DPR-only changes must rebuild the backing store')
  canvas.rect = { width: 101.25, height: 51.5 }
  fitCanvasToElement(canvas as unknown as HTMLCanvasElement)
  assert.equal(canvas.width, 304)
  assert.equal(canvas.height, 155)
  assert.deepEqual(canvas.ctx.transforms.at(-1), [304 / 101.25, 0, 0, 155 / 51.5, 0, 0], 'resize must use a fresh transform')
  assert.equal(canvas.cssWrites, 0)

  const dprOne = drawAt(1, { size: 40, orientation: 33, frequency: 4.5, contrast: 0.6, phase: 0 })
  const dprTwo = drawAt(2, { size: 40, orientation: 33, frequency: 4.5, contrast: 0.6, phase: 0 }, false)
  assert.equal(dprOne.tile.width, 40)
  assert.equal(dprTwo.tile.width, 80, 'Gabor raster must be generated at backing-pixel resolution')
  assert.deepEqual(
    [dprOne.call.x, dprOne.call.y, dprOne.call.width, dprOne.call.height],
    [dprTwo.call.x, dprTwo.call.y, dprTwo.call.width, dprTwo.call.height],
    'DPR must not alter destination geometry',
  )
  for (const [x, y] of [[0, 0], [5, 7], [20, 20], [31, 9]]) {
    assert.deepEqual(pixel(dprOne.image, x, y), pixel(dprTwo.image, x * 2, y * 2), 'normalized Gabor cycles must survive DPR')
  }
  assert.equal(fingerprint(dprOne.image.data), '3c570cfd', 'shared transparent Gabor pixels changed')

  for (const legacyOpts of [
    { size: 25, orientation: 0, frequency: 4, contrast: 1, sigma: 6.25, phase: 0 },
    { size: 40, orientation: 33, frequency: 4.5, contrast: 0.6, sigma: 10, phase: 27 },
    { size: 45, orientation: 90, frequency: 6, contrast: 0.2, sigma: 11.25, phase: 180 },
  ]) {
    const legacy = drawAt(1, { ...legacyOpts, rasterMode: 'legacy-opaque' })
    assert.deepEqual(legacy.image.data, legacyOpaqueReference(legacyOpts), `legacy DPR1 pixels must match the original ${legacyOpts.size}px raster`)
    for (let index = 3; index < legacy.image.data.length; index += 4) assert.equal(legacy.image.data[index], 255, 'legacy rasters must remain opaque')
  }

  __resetGaborCacheForTest()
  const modeCanvas = new FakeCanvas(80, 80)
  dpr = 1
  fitCanvasToElement(modeCanvas as unknown as HTMLCanvasElement)
  const beforeModes = createdTiles.length
  const modeOpts = { size: 40, orientation: 20, frequency: 4, contrast: 0.7, phase: 10 }
  drawGaborPatch(modeCanvas.ctx as unknown as CanvasRenderingContext2D, 40, 40, modeOpts)
  const sharedTile = modeCanvas.ctx.drawCalls.at(-1)!.tile
  drawGaborPatch(modeCanvas.ctx as unknown as CanvasRenderingContext2D, 40, 40, { ...modeOpts, rasterMode: 'legacy-opaque' })
  const legacyTile = modeCanvas.ctx.drawCalls.at(-1)!.tile
  assert.equal(createdTiles.length - beforeModes, 2, 'shared and legacy raster modes must never alias in cache')
  assert.deepEqual(sharedTile.ctx.imageData!.data.filter((_, index) => index % 4 !== 3), legacyTile.ctx.imageData!.data.filter((_, index) => index % 4 !== 3), 'raster modes share RGB calculation')
  assert.notEqual(sharedTile.ctx.imageData!.data[3], legacyTile.ctx.imageData!.data[3], 'raster mode changes alpha semantics')

  __resetGaborCacheForTest()
  dpr = 1
  const rasterCanvas = new FakeCanvas(100, 100)
  fitCanvasToElement(rasterCanvas as unknown as HTMLCanvasElement)
  const rasterCtx = rasterCanvas.ctx as unknown as CanvasRenderingContext2D
  const beforeVariants = createdTiles.length
  const base = { size: 40.1, orientation: 15, frequency: 4, contrast: 0.5, sigma: 10, phase: 3, compositingMode: 'source-over' as const }
  const variants = [
    base,
    { ...base, size: 40.2 },
    { ...base, orientation: 15.01 },
    { ...base, frequency: 4.01 },
    { ...base, contrast: 0.5001 },
    { ...base, sigma: 10.01 },
    { ...base, phase: 3.01 },
    { ...base, compositingMode: 'multiply' as const },
  ]
  for (const opts of variants) drawGaborPatch(rasterCtx, 50, 50, opts)
  assert.equal(createdTiles.length - beforeVariants, variants.length, 'adjacent therapeutic values must not alias in the default cache')
  assert.notDeepEqual(
    createdTiles[beforeVariants].ctx.imageData!.data,
    createdTiles[beforeVariants + 2].ctx.imageData!.data,
    'orientation must affect the raster',
  )
  assert.notDeepEqual(
    createdTiles[beforeVariants].ctx.imageData!.data,
    createdTiles[beforeVariants + 3].ctx.imageData!.data,
    'frequency must affect the raster',
  )
  assert.notDeepEqual(
    createdTiles[beforeVariants].ctx.imageData!.data,
    createdTiles[beforeVariants + 4].ctx.imageData!.data,
    'contrast must affect the raster',
  )

  __resetGaborCacheForTest()
  const beforeAnimation = createdTiles.length
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 7, phaseQuantizationDegrees: 20 })
  const animationTile = rasterCanvas.ctx.drawCalls.at(-1)!.tile
  const animationPixels = new Uint8ClampedArray(animationTile.ctx.imageData!.data)
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 9, phaseQuantizationDegrees: 20 })
  assert.equal(createdTiles.length - beforeAnimation, 1, 'Pursuit-style animation may share its explicit phase bucket')
  assert.equal(normalizeGaborPhase(7, 20), 0)
  __resetGaborCacheForTest()
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 0 })
  assert.deepEqual(animationPixels, rasterCanvas.ctx.drawCalls.at(-1)!.tile.ctx.imageData!.data, 'first animation lookup must rasterize the normalized phase')
  const beforeExactPhase = createdTiles.length
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 7 })
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 8 })
  assert.equal(createdTiles.length - beforeExactPhase, 2, 'threshold calls must retain exact phases')

  __resetGaborCacheForTest()
  const beforeEviction = createdTiles.length
  for (let phase = 0; phase <= 64; phase++) {
    drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase })
  }
  const firstEvicted = createdTiles[beforeEviction]
  assert.equal(firstEvicted.width, 0, '64-entry cache must release the evicted backing canvas')
  assert.equal(firstEvicted.height, 0)
  drawGaborPatch(rasterCtx, 50, 50, { size: 40, orientation: 0, frequency: 4, contrast: 0.5, phase: 0 })
  assert.equal(createdTiles.length - beforeEviction, 66, 'evicted entries must no longer be cache hits')

  for (const [name, logicalWidth, logicalHeight] of [
    ['GaborPatch', 100, 100],
    ['GuidedExercise', 400, 300],
  ] as const) {
    const therapeuticCanvas = new FakeCanvas(logicalWidth, logicalHeight)
    for (const ratio of [1, 2, 3] as const) {
      dpr = ratio
      assert.deepEqual(
        fitCanvasToElement(therapeuticCanvas as unknown as HTMLCanvasElement),
        { width: logicalWidth, height: logicalHeight, dpr: ratio },
        `${name} must preserve its logical CSS geometry at DPR ${ratio}`,
      )
      assert.equal(therapeuticCanvas.width, logicalWidth * ratio, `${name} backing width must follow DPR`)
      assert.equal(therapeuticCanvas.height, logicalHeight * ratio, `${name} backing height must follow DPR`)
    }
    assert.equal(therapeuticCanvas.cssWrites, 0, `${name} DPR fitting must not alter CSS geometry`)
  }

  const pursuit = readFileSync('src/components/Vision/Engines/PursuitEngine.tsx', 'utf8')
  const gaborAcuity = readFileSync('src/components/Vision/Engines/GaborAcuityEngine.tsx', 'utf8')
  const canvasKit = readFileSync('src/lib/vision/canvasKit.ts', 'utf8')
  const gaborPatch = readFileSync('src/components/Vision/Training/GaborPatch.tsx', 'utf8')
  const guidedExercise = readFileSync('src/components/Vision/Training/GuidedExercise.tsx', 'utf8')
  assert.match(pursuit, /phaseQuantizationDegrees:\s*20/)
  assert.doesNotMatch(gaborAcuity, /phaseQuantizationDegrees/)
  assert.match(canvasKit, /rasterMode\?: 'shared-transparent' \| 'legacy-opaque'/)
  assert.match(canvasKit, /rasterMode: opts\.rasterMode \?\? 'shared-transparent'/)
  assert.match(canvasKit, /o\.rasterMode === 'legacy-opaque' \? 255/)

  for (const [name, source] of [['GaborPatch', gaborPatch], ['GuidedExercise', guidedExercise]] as const) {
    assert.doesNotMatch(source, /createImageData|tempCanvas|document\.createElement\('canvas'\)/, `${name} must not own a private Gabor rasterizer`)
    assert.match(source, /fitCanvasToElement/, `${name} must use the shared DPR fitter`)
    assert.match(source, /draw(?:Shared)?GaborPatch/, `${name} must use the shared Gabor drawer`)
    assert.match(source, /ResizeObserver/, `${name} must react to element resize`)
    assert.match(source, /removeEventListener\('resize'/, `${name} must clean its DPR listener`)
    assert.match(source, /disconnect\(\)/, `${name} must clean its resize observer`)
    assert.match(source, /cancelAnimationFrame/, `${name} must clean its animation frame`)
    assert.match(source, /phaseQuantizationDegrees: 20/, `${name} animation bucketing must be explicit`)
  }
  assert.match(gaborPatch, /width=\{size\}/)
  assert.match(gaborPatch, /height=\{size\}/)
  assert.match(gaborPatch, /style=\{\{ backgroundColor, width: size, height: size \}\}/)
  assert.match(guidedExercise, /ctx\.scale\(width \/ 400, height \/ 300\)/)
  assert.doesNotMatch(guidedExercise, /width=\{400\}|height=\{300\}/, 'GuidedExercise must not retain a CSS-resolution backing store')

  console.log('vision-hidpi-check: PASS')
}

run()
