import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.argv[2] ?? 'http://127.0.0.1:3333/pitch-defender/retro-2'
const OUT = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/r3b-browser-proof')
mkdirSync(OUT, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function installAudioCounters(context) {
  await context.addInitScript(() => {
    let forcedVisibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => forcedVisibility,
    })
    window.__setRetroVisibility = state => {
      forcedVisibility = state
      document.dispatchEvent(new Event('visibilitychange'))
    }

    const NativeAudioContext = window.AudioContext || window.webkitAudioContext
    if (!NativeAudioContext) return
    const receipt = { contexts: [], resumeCalls: 0, startCalls: 0 }
    class InstrumentedAudioContext extends NativeAudioContext {
      constructor(...args) {
        super(...args)
        receipt.contexts.push(this)
      }
      resume() {
        receipt.resumeCalls++
        return super.resume()
      }
      createBufferSource() {
        const node = super.createBufferSource()
        const nativeStart = node.start.bind(node)
        node.start = (...args) => {
          receipt.startCalls++
          return nativeStart(...args)
        }
        return node
      }
    }
    window.AudioContext = InstrumentedAudioContext
    window.webkitAudioContext = InstrumentedAudioContext
    window.__retroAudioReceipt = receipt
  })
}

async function formationState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      formation: JSON.parse(canvas?.dataset.retroFormationState ?? '{"directorClockMs":0,"ships":[]}'),
      logical: canvas ? { width: canvas.width, height: canvas.height } : null,
      css: rect ? { width: rect.width, height: rect.height } : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visibility: document.visibilityState,
      crt: {
        enabled: Boolean(document.querySelector('[data-retro-crt-overlay]')),
        button: Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('CRT'))?.textContent?.trim() ?? null,
      },
      cabinetPresent: Boolean(document.querySelector('[data-retro-cabinet]')),
    }
  })
}

async function startGame(page) {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_difficulty', 'true')
    localStorage.removeItem('retro_blaster_color_hints')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'TRUE PLAY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-cabinet]').waitFor()
}

async function activeKey(page) {
  return page.evaluate(() => {
    const match = Array.from(document.querySelectorAll('span')).find(element => (
      /^[CDEFGAB]=[1-8]$/.test(element.textContent?.trim() ?? '')
      && Number.parseInt(getComputedStyle(element).fontWeight, 10) >= 700
    ))
    return match?.textContent?.trim().split('=')[1] ?? null
  })
}

function validateCollective(samples, name) {
  const firstIds = samples[0].formation.ships.filter(ship => ship.alive).map(ship => ship.visualId)
  assert(firstIds.length >= 3, `${name}: fewer than three live ships`)
  for (const sample of samples) {
    const alive = sample.formation.ships.filter(ship => ship.alive)
    assert(alive.every(ship => !ship.entering), `${name}: sample contains entering ship`)
    assert(JSON.stringify(alive.map(ship => ship.visualId)) === JSON.stringify(firstIds), `${name}: identities changed while sampling breath`)
    const dx = alive.map(ship => ship.x - ship.formationX)
    const dy = alive.map(ship => ship.y - ship.formationY)
    assert(Math.max(...dx) - Math.min(...dx) < 0.01, `${name}: ships do not share one horizontal breath phase`)
    assert(Math.max(...dy) - Math.min(...dy) < 0.01, `${name}: ships do not share one vertical breath phase`)
    assert(dx.every(value => Math.abs(value) <= 2.26), `${name}: horizontal breath exceeds bound`)
    assert(dy.every(value => Math.abs(value) <= 3.39), `${name}: vertical breath exceeds bound`)
  }
  const yOffsets = samples.map(sample => sample.formation.ships.find(ship => ship.alive).y -
    sample.formation.ships.find(ship => ship.alive).formationY)
  assert(Math.max(...yOffsets) - Math.min(...yOffsets) > 0.5, `${name}: formation did not visibly breathe`)
}

async function proveDesktop(browser) {
  const dir = resolve(OUT, 'desktop-1280x800')
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: resolve(dir, 'video'), size: { width: 1280, height: 800 } },
  })
  await installAudioCounters(context)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await startGame(page)
  await page.waitForTimeout(4700)

  const samples = []
  for (let index = 0; index < 5; index++) {
    samples.push(await formationState(page))
    await page.waitForTimeout(450)
  }
  validateCollective(samples, 'desktop')
  assert(samples[0].logical?.width === 640 && samples[0].logical?.height === 360, 'desktop logical canvas drifted')
  assert(samples[0].overflow <= 1, `desktop overflow ${samples[0].overflow}`)
  await page.screenshot({ path: resolve(dir, '01-formation-breath.png') })

  const key = await activeKey(page)
  assert(key, 'desktop active key missing')
  await page.keyboard.press(key)
  await page.waitForTimeout(1500)
  const hole = await formationState(page)
  const aliveSlots = hole.formation.ships.filter(ship => ship.alive).map(ship => ship.slot)
  assert(JSON.stringify(aliveSlots) === JSON.stringify([1, 2, 3]), `stable hole failed: ${aliveSlots}`)
  assert(hole.formation.ships.find(ship => ship.slot === 0)?.alive === false, 'dead slot zero disappeared or revived')
  assert(hole.cabinetPresent, 'cabinet disappeared after keyboard answer')
  assert(hole.crt.enabled === samples[0].crt.enabled && hole.crt.button === samples[0].crt.button,
    `keyboard answer changed CRT state: ${JSON.stringify(samples[0].crt)} -> ${JSON.stringify(hole.crt)}`)
  await page.screenshot({ path: resolve(dir, '02-stable-hole-captain.png') })

  const prePause = await formationState(page)
  await page.evaluate(() => window.__setRetroVisibility('hidden'))
  assert((await formationState(page)).visibility === 'hidden', 'visibility harness did not enter hidden state')
  await page.waitForTimeout(1600)
  const hiddenPause = await formationState(page)
  await page.evaluate(() => window.__setRetroVisibility('visible'))
  await page.waitForTimeout(200)
  const postPause = await formationState(page)
  const hiddenDelta = hiddenPause.formation.directorClockMs - prePause.formation.directorClockMs
  const directorDelta = postPause.formation.directorClockMs - prePause.formation.directorClockMs
  assert(hiddenDelta >= 0 && hiddenDelta <= 50, `director advanced ${hiddenDelta}ms while hidden`)
  assert(directorDelta >= 0 && directorDelta <= 350, `director caught up ${directorDelta}ms after hidden freeze`)
  assert(JSON.stringify(postPause.formation.ships.map(ship => [ship.visualId, ship.slot, ship.alive])) ===
    JSON.stringify(prePause.formation.ships.map(ship => [ship.visualId, ship.slot, ship.alive])), 'pause changed formation identity')

  const audioBefore = await page.evaluate(async () => {
    const receipt = window.__retroAudioReceipt
    await Promise.all(receipt.contexts.map(context => context.suspend()))
    return { resumeCalls: receipt.resumeCalls, startCalls: receipt.startCalls, states: receipt.contexts.map(context => context.state) }
  })
  await page.getByRole('button', { name: /PLAY NOTE/ }).click()
  await page.waitForTimeout(400)
  const audioAfter = await page.evaluate(() => {
    const receipt = window.__retroAudioReceipt
    return { resumeCalls: receipt.resumeCalls, startCalls: receipt.startCalls, states: receipt.contexts.map(context => context.state) }
  })
  assert(audioBefore.states.every(state => state === 'suspended'), `audio precondition failed: ${audioBefore.states}`)
  assert(audioAfter.resumeCalls > audioBefore.resumeCalls, 'AudioContext resume was not called after restore')
  assert(audioAfter.startCalls > audioBefore.startCalls, 'demand replay did not start a buffer source after restore')
  assert(audioAfter.states.some(state => state === 'running'), `audio context did not recover: ${audioAfter.states}`)
  await page.screenshot({ path: resolve(dir, '03-post-resume-audio-recovered.png') })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
  const reducedA = await formationState(page)
  await page.waitForTimeout(700)
  const reducedB = await formationState(page)
  for (const state of [reducedA, reducedB]) {
    assert(state.formation.ships.filter(ship => ship.alive).every(ship =>
      Math.abs(ship.x - ship.formationX) < 0.01 && Math.abs(ship.y - ship.formationY) < 0.01),
    'reduced motion did not pin formation anchors')
  }
  assert(JSON.stringify(reducedA.formation.ships.map(ship => [ship.visualId, ship.slot, ship.alive])) ===
    JSON.stringify(reducedB.formation.ships.map(ship => [ship.visualId, ship.slot, ship.alive])), 'reduced motion changed semantics')
  await page.screenshot({ path: resolve(dir, '04-reduced-motion-anchors.png') })

  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(250)
  const resized = await formationState(page)
  assert(resized.logical?.width === 640 && resized.logical?.height === 360, 'resize changed logical geometry')
  assert(Math.abs(resized.css.width / resized.css.height - 16 / 9) < 0.01,
    `resize distorted canvas aspect: ${resized.css.width}x${resized.css.height}`)
  assert(resized.overflow <= 1, `resize overflow ${resized.overflow}`)
  await page.screenshot({ path: resolve(dir, '05-landscape-resize.png') })

  const video = page.video()
  await context.close()
  return {
    samples,
    hole,
    pause: { prePause, hiddenPause, postPause, hiddenDelta, directorDelta },
    audio: { before: audioBefore, after: audioAfter },
    reduced: { first: reducedA, second: reducedB },
    resized,
    errors,
    videoPath: await video?.path(),
  }
}

async function provePhone(browser) {
  const dir = resolve(OUT, 'phone-390x844')
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: resolve(dir, 'video'), size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await startGame(page)
  await page.waitForTimeout(4700)
  const samples = []
  for (let index = 0; index < 4; index++) {
    samples.push(await formationState(page))
    await page.waitForTimeout(500)
  }
  validateCollective(samples, 'phone')
  assert(samples[0].overflow <= 1, `phone overflow ${samples[0].overflow}`)
  assert(Math.abs(samples[0].css.width / samples[0].css.height - 16 / 9) < 0.01, 'phone aspect drifted')
  await page.screenshot({ path: resolve(dir, '01-phone-formation.png'), fullPage: true })
  const video = page.video()
  await context.close()
  return { samples, videoPath: await video?.path() }
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
try {
  const result = {
    url: URL,
    capturedAt: new Date().toISOString(),
    desktop: await proveDesktop(browser),
    phone: await provePhone(browser),
  }
  writeFileSync(resolve(OUT, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  console.log('PASS R3b browser proof: collective formation, stable hole, pause, audio, reduced motion, resize, phone')
} finally {
  await browser.close()
}
