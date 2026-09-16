import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRainState } from '../src/components/PitchDefender/pitchforksRainEcology'
import {
  drawRainArchitecture,
  gutterWaterExtent,
  type RainGutterArt,
  type RainViewCanvasContext,
} from '../src/components/PitchDefender/pitchforksRainView'

const ASSETS = join(__dirname, '..', 'public', 'images', 'pitchforks')
const WORLDS = { dungeon: 'rain_gutter', 'village-gate': 'rain_gutter_village-gate', cathedral: 'rain_gutter_cathedral', 'bell-tower': 'rain_gutter_bell-tower' }
const GARGOYLE_MOUTHS_X = [401, 591]
// Exact bytes of the approved art (rebuild with build-rain-gutter.py and re-pin deliberately).
const PNG_SHA256: Record<string, string> = {
  'rain_gutter': '6C756FF434391695AC087B9D10F4943E98572D49A71EA6A31857C723E96D5508',
  'rain_gutter_village-gate': '98E02898D25F3DB1F4DF18D86D435B8040463C57311DABDCC372BCEC3D3DB3BF',
  'rain_gutter_cathedral': '528332766D381E2B2FF8F871678CE12E9D0CD4FE1D7BF1C60B397804BCAF2578',
  'rain_gutter_bell-tower': '18EDA31D22CB298EECD44BBBA143105F7485E845DA09819206A45ADD0161E7B3',
}
let passed = 0
const check = (ok: boolean, label: string) => { assert.ok(ok, label); passed += 1 }

function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function recorder() {
  const calls: unknown[][] = []
  const ctx = new Proxy({} as RainViewCanvasContext, {
    get: (_, key) => (...args: unknown[]) => { calls.push([key, ...args]) },
    set: (_, key, value) => { calls.push(['set', key, value]); return true },
  })
  return { ctx, calls }
}

const arts: Record<string, RainGutterArt> = {}
for (const [world, file] of Object.entries(WORLDS)) {
  const meta = JSON.parse(readFileSync(join(ASSETS, `${file}.json`), 'utf8'))
  const size = pngSize(join(ASSETS, `${file}.png`))
  check(meta.world === world, `${world}: metadata names its world`)
  check(size.width === meta.width && size.height === meta.height, `${world}: png size matches metadata (art and water cannot desync)`)
  check(createHash('sha256').update(readFileSync(join(ASSETS, `${file}.png`))).digest('hex').toUpperCase() === PNG_SHA256[file], `${world}: approved art bytes (blank or wrong art with matching size fails)`)
  check(meta.drawX >= 0 && meta.drawX + meta.width <= 720 && meta.drawY >= 0, `${world}: cistern stays on the 720 canvas`)
  const c = meta.channel
  check(c.x0 >= 0 && c.x1 <= meta.width && c.y0 >= 0 && c.y1 <= meta.height && c.x1 - c.x0 > 300 && c.y1 > c.y0, `${world}: channel sits inside the sprite`)
  check(meta.drawY + c.y0 >= 36, `${world}: channel opens below the cloud feed lip`)
  for (const mouth of GARGOYLE_MOUTHS_X) {
    check(mouth > meta.drawX + c.x0 && mouth < meta.drawX + c.x1, `${world}: gargoyle mouth ${mouth} is under the channel`)
  }
  check(meta.torchUnderlight === (world === 'dungeon'), `${world}: torch under-light only where torches exist`)
  arts[world] = { image: {} as CanvasImageSource, ...meta }
}

// The water is the charge meter: its width must be proportional to fill.
for (const art of Object.values(arts)) {
  const full = gutterWaterExtent(art, 1)!
  const fullWidth = full.right - full.left
  check(gutterWaterExtent(art, 0) === null, 'empty gutter draws no water')
  let lastWidth = 0
  for (const fill of [0.1, 0.25, 0.3, 0.5, 0.6, 0.75, 0.9, 1]) {
    const extent = gutterWaterExtent(art, fill)!
    const width = extent.right - extent.left
    check(Math.abs(width / fullWidth - fill) <= 2 / fullWidth, `water width tracks fill ${fill}`)
    check(width >= lastWidth, `water never shrinks as fill rises (${fill})`)
    lastWidth = width
  }
}

// Authored render path: art drawn at its metadata rect, under-light gated, reduced motion static.
for (const [world, art] of Object.entries(arts)) {
  const { ctx, calls } = recorder()
  drawRainArchitecture(ctx, { ...createRainState(), phase: 'gutter_fill', fill: 0.5 }, false, null, null, art)
  const images = calls.filter(row => row[0] === 'drawImage' && row[1] === art.image)
  check(images.length === 1 && images[0][2] === art.drawX && images[0][3] === art.drawY && images[0][4] === art.width && images[0][5] === art.height, `${world}: authored cistern drawn once at its metadata rect`)
  const lighter = calls.some(row => row[0] === 'set' && row[1] === 'globalCompositeOperation' && row[2] === 'lighter')
  check(lighter === art.torchUnderlight, `${world}: additive torch light matches metadata`)
  const still = (elapsedMs: number) => {
    const r = recorder()
    drawRainArchitecture(r.ctx, { ...createRainState(), phase: 'gutter_fill', fill: 0.7, elapsedMs }, true, null, null, art)
    return JSON.stringify(r.calls.map(row => row.map(value => (typeof value === 'object' ? 'obj' : value))))
  }
  check(still(0) === still(900), `${world}: reduced motion freezes water ripples`)
}

console.log(`pitchforks rain gutter art: ${passed}/${passed} PASS (metadata + render contract; visual approval is separate)`)
