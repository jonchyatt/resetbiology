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

  const pursuit = readFileSync('src/components/Vision/Engines/PursuitEngine.tsx', 'utf8')
  const gaborAcuity = readFileSync('src/components/Vision/Engines/GaborAcuityEngine.tsx', 'utf8')
  assert.match(pursuit, /phaseQuantizationDegrees:\s*20/)
  assert.doesNotMatch(gaborAcuity, /phaseQuantizationDegrees/)

  console.log('vision-hidpi-check: PASS')
}

run()
