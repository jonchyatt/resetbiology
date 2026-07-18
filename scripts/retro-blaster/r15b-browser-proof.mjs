import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.argv[2] ?? 'http://127.0.0.1:3333/pitch-defender/retro-2'
const OUT = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/r15b-browser-proof')
mkdirSync(OUT, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertExactSources(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`)
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

async function waitForActiveKey(page, timeoutMs = 4000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const key = await activeKey(page)
    if (key) return key
    await page.waitForTimeout(100)
  }
  throw new Error('No active alien key became visible')
}

async function capture(browser, name, viewport, proveResize) {
  const dir = resolve(OUT, name)
  mkdirSync(resolve(dir, 'video'), { recursive: true })
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    recordVideo: { dir: resolve(dir, 'video'), size: viewport },
  })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  const networkErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400) networkErrors.push({ status: response.status(), url: response.url() })
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.removeItem('retro_blaster_crt')
    localStorage.removeItem('retro_blaster_color_hints')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'TRUE PLAY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-cabinet]').waitFor()

  const startedAt = Date.now()
  await page.waitForTimeout(4700)
  const initial = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      logical: canvas ? { width: canvas.width, height: canvas.height } : null,
      css: rect ? { width: rect.width, height: rect.height } : null,
      colorButton: document.querySelector('[data-retro-color-hints]')?.textContent?.trim(),
      storedColorHints: localStorage.getItem('retro_blaster_color_hints'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visualKinds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-kinds'),
      visualIds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-ids'),
      renderSources: JSON.parse(canvas?.dataset.retroRenderSources ?? '{}'),
    }
  })
  assert(initial.logical?.width === 640 && initial.logical?.height === 360, `${name}: canvas is not 640x360`)
  assert(Math.abs(initial.css.width / initial.css.height - 16 / 9) < 0.01, `${name}: canvas aspect drifted`)
  assert(initial.colorButton === 'COLOR HINTS ON', `${name}: color hints did not default ON`)
  assert(initial.overflow <= 1, `${name}: horizontal overflow ${initial.overflow}px`)
  assert(initial.visualKinds === '0,1,2', `${name}: first roster sequence was ${initial.visualKinds}, expected 0,1,2`)
  assert(initial.visualIds === '1:0,1:1,1:2', `${name}: first roster ids were ${initial.visualIds}`)
  assertExactSources(initial.renderSources, {
    '1:0': 'kind-atlas',
    '1:1': 'kind-atlas',
    '1:2': 'kind-atlas',
  }, `${name}: initial render-source map drifted`)
  await page.screenshot({ path: resolve(dir, '01-scout-twin-chord-hints-on.png') })

  await page.getByRole('button', { name: 'COLOR HINTS ON' }).click()
  await page.waitForTimeout(150)
  const hintsOff = await page.evaluate(() => ({
    label: document.querySelector('[data-retro-color-hints]')?.textContent?.trim(),
    stored: localStorage.getItem('retro_blaster_color_hints'),
  }))
  assert(hintsOff.label === 'COLOR HINTS OFF' && hintsOff.stored === '0', `${name}: color hints OFF did not persist`)
  await page.screenshot({ path: resolve(dir, '02-scout-twin-chord-hints-off.png') })

  const key = await waitForActiveKey(page)
  await page.keyboard.press(key)
  await page.waitForTimeout(1400)
  const afterHit = await page.evaluate(() => ({
    visualKinds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-kinds'),
    visualIds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-ids'),
    renderSources: JSON.parse(document.querySelector('canvas')?.dataset.retroRenderSources ?? '{}'),
  }))
  assert(afterHit.visualKinds === '1,2,3', `${name}: post-hit roster was ${afterHit.visualKinds}, expected 1,2,3`)
  assert(afterHit.visualIds === '1:1,1:2,1:3', `${name}: post-hit identity continuity failed (${afterHit.visualIds})`)
  assertExactSources(afterHit.renderSources, {
    '1:0': 'kind-atlas',
    '1:1': 'kind-atlas',
    '1:2': 'kind-atlas',
    '1:3': 'kind-atlas',
  }, `${name}: post-hit render-source map drifted`)
  await page.screenshot({ path: resolve(dir, '03-twin-chord-captain-hints-off.png') })

  await page.getByRole('button', { name: 'COLOR HINTS OFF' }).click()
  await page.waitForTimeout(150)
  assert(await page.getByRole('button', { name: 'COLOR HINTS ON' }).getAttribute('aria-pressed') === 'true', `${name}: color hints ON did not restore`)
  await page.screenshot({ path: resolve(dir, '04-twin-chord-captain-hints-on.png') })

  let resized = null
  if (proveResize) {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.waitForTimeout(250)
    resized = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return {
        logical: canvas ? `${canvas.width}x${canvas.height}` : null,
        colorHints: document.querySelector('[data-retro-color-hints]')?.textContent?.trim(),
        visualIds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-ids'),
      }
    })
    assert(resized.logical === '640x360' && resized.colorHints === 'COLOR HINTS ON'
      && resized.visualIds === afterHit.visualIds, `${name}: live resize reset game identity/options`)
    await page.screenshot({ path: resolve(dir, '05-live-landscape-resize.png') })
  }

  const captureWindowMs = Date.now() - startedAt
  assert(captureWindowMs >= 6000, `${name}: continuous roster capture is shorter than 6s`)
  const result = { name, url: page.url(), viewport, initial, hintsOff, afterHit, resized, captureWindowMs, pageErrors, consoleErrors, networkErrors }
  assert(pageErrors.length === 0, `${name}: page errors: ${pageErrors.join('; ')}`)
  const spriteErrors = networkErrors.filter(error => error.url.includes('/sprites/'))
  assert(spriteErrors.length === 0, `${name}: sprite load errors: ${JSON.stringify(spriteErrors)}`)
  writeFileSync(resolve(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  const video = page.video()
  await context.close()
  result.videoPath = await video.path()
  writeFileSync(resolve(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function captureFailureFallback(browser, name, failedIds, expectedSources) {
  const dir = resolve(OUT, name)
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => localStorage.setItem('retro_tutorial_seen', '1'))
  const page = await context.newPage()
  const requestCounts = new Map()
  const pageErrors = []
  const atlasFailureLogs = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Sprite atlas failed for')) {
      atlasFailureLogs.push(message.text())
    }
  })
  await page.route('**/sprites/*-atlas.*', async route => {
    const url = route.request().url()
    const shouldFail = failedIds.some(id => url.includes(`/sprites/${id}-atlas.`))
    if (!shouldFail) return route.continue()
    requestCounts.set(url, (requestCounts.get(url) ?? 0) + 1)
    return route.abort('failed')
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'TRUE PLAY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.waitForTimeout(4700)
  const initialState = await page.evaluate(() => ({
    visualKinds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-kinds'),
    sources: JSON.parse(document.querySelector('canvas')?.dataset.retroRenderSources ?? '{}'),
  }))
  assert(initialState.visualKinds === '0,1,2', `${name}: engine roster disappeared during atlas failure`)

  const key = await waitForActiveKey(page)
  await page.keyboard.press(key)
  await page.waitForTimeout(1400)
  const state = await page.evaluate(() => ({
    visualKinds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-kinds'),
    visualIds: document.querySelector('[data-retro-roster-state]')?.getAttribute('data-visual-ids'),
    sources: JSON.parse(document.querySelector('canvas')?.dataset.retroRenderSources ?? '{}'),
  }))
  assert(state.visualKinds === '1,2,3', `${name}: Captain fallback was not observed (${state.visualKinds})`)
  assert(state.visualIds === '1:1,1:2,1:3', `${name}: fallback identity continuity failed (${state.visualIds})`)
  assertExactSources(state.sources, expectedSources, `${name}: fallback sources drifted`)
  assert([...requestCounts.values()].every(count => count === 1), `${name}: atlas retry storm ${JSON.stringify([...requestCounts])}`)
  assert(requestCounts.size === failedIds.length * 2, `${name}: failure injection missed an atlas request`)
  for (const id of failedIds) {
    const logs = atlasFailureLogs.filter(message => message.includes(`/sprites/${id}-atlas.json`))
    assert(logs.length === 1, `${name}: expected one failure log for ${id}, observed ${logs.length}`)
  }
  assert(atlasFailureLogs.length === failedIds.length, `${name}: unexpected atlas failure log cardinality ${atlasFailureLogs.length}`)
  assert(pageErrors.length === 0, `${name}: page errors ${pageErrors.join('; ')}`)
  await page.screenshot({ path: resolve(dir, 'fallback.png') })
  const result = { name, failedIds, initialState, state, requestCounts: Object.fromEntries(requestCounts), atlasFailureLogs, pageErrors }
  writeFileSync(resolve(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  await context.close()
  return result
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
})
try {
  const results = [
    await capture(browser, 'desktop-1280x800', { width: 1280, height: 800 }, true),
    await capture(browser, 'phone-390x844', { width: 390, height: 844 }, false),
  ]
  const fallbacks = [
    await captureFailureFallback(
      browser,
      'custom-atlases-failed',
      ['enemy-twin-interceptor', 'enemy-chord-carrier', 'enemy-choir-captain'],
      { '1:0': 'kind-atlas', '1:1': 'scout-atlas', '1:2': 'scout-atlas', '1:3': 'scout-atlas' },
    ),
    await captureFailureFallback(
      browser,
      'all-atlases-failed',
      ['enemy-scout', 'enemy-twin-interceptor', 'enemy-chord-carrier', 'enemy-choir-captain'],
      { '1:0': 'procedural', '1:1': 'procedural', '1:2': 'procedural', '1:3': 'procedural' },
    ),
  ]
  console.log(JSON.stringify({ results, fallbacks }, null, 2))
  console.log('PASS R1.5b browser proof: asserted exact 0/1/2→1/2/3 roster, color hints, resize identity, scout/procedural fallback, no retry storm')
} finally {
  await browser.close()
}
