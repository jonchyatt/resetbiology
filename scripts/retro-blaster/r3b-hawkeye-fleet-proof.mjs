import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [name, endpoint, url = 'https://resetbiology.com/pitch-defender/retro-2', outputRoot = 'data/retro-blaster-rework/runtime-logs/r3b-hawkeye-fleet'] = process.argv.slice(2)
if (!name || !endpoint) throw new Error('usage: node r3b-hawkeye-fleet-proof.mjs NAME CDP_ENDPOINT [URL] [OUTPUT_ROOT]')

const output = resolve(outputRoot, name)
mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`${name}: ${message}`)
}

function state(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const cabinet = document.querySelector('[data-retro-cabinet]')
    const formation = JSON.parse(canvas?.dataset.retroFormationState ?? '{"directorClockMs":0,"ships":[]}')
    return {
      formation,
      cabinet: Boolean(cabinet),
      logical: canvas ? [canvas.width, canvas.height] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      crt: {
        enabled: Boolean(document.querySelector('[data-retro-crt-overlay]')),
        button: Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('CRT'))?.textContent?.trim() ?? null,
      },
    }
  })
}

const browser = await chromium.connectOverCDP(endpoint)
const context = browser.contexts()[0]
assert(context, 'CDP browser has no default context')
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))

try {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url, { waitUntil: 'networkidle' })
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
  await page.waitForTimeout(4700)

  const before = await state(page)
  assert(before.cabinet, 'cabinet missing')
  assert(JSON.stringify(before.logical) === JSON.stringify([640, 360]), `logical canvas drifted: ${before.logical}`)
  assert(before.overflow <= 1, `horizontal overflow ${before.overflow}`)
  const alive = before.formation.ships.filter(ship => ship.alive && !ship.entering)
  assert(alive.length >= 3, `formation has ${alive.length} settled ships`)
  const dx = alive.map(ship => ship.x - ship.formationX)
  const dy = alive.map(ship => ship.y - ship.formationY)
  assert(Math.max(...dx) - Math.min(...dx) < 0.01, 'horizontal formation phase diverged')
  assert(Math.max(...dy) - Math.min(...dy) < 0.01, 'vertical formation phase diverged')
  await page.screenshot({ path: resolve(output, '01-formation.png') })

  const key = await page.evaluate(() => {
    const match = Array.from(document.querySelectorAll('span')).find(element => (
      /^[CDEFGAB]=[1-8]$/.test(element.textContent?.trim() ?? '')
      && Number.parseInt(getComputedStyle(element).fontWeight, 10) >= 700
    ))
    return match?.textContent?.trim().split('=')[1] ?? null
  })
  assert(key, 'active answer key missing')
  await page.keyboard.press(key)
  await page.waitForTimeout(1500)

  const after = await state(page)
  assert(after.formation.ships.find(ship => ship.slot === 0)?.alive === false, 'slot zero did not persist as a hole')
  assert(after.cabinet, 'cabinet disappeared after answer')
  assert(JSON.stringify(after.crt) === JSON.stringify(before.crt), `answer changed CRT state: ${JSON.stringify(before.crt)} -> ${JSON.stringify(after.crt)}`)
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`)
  await page.screenshot({ path: resolve(output, '02-stable-hole.png') })

  const receipt = {
    name,
    endpoint,
    browser: browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    url: page.url(),
    capturedAt: new Date().toISOString(),
    before,
    after,
    errors,
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt, null, 2))
  console.log(`PASS ${name}: hosted R3b formation + stable-hole receipt`)
} finally {
  await page.close()
  // ponytail: this is a borrowed Hawkeye process. Disconnect the local
  // Playwright transport; Browser.close() would terminate the shared browser.
  browser._connection.close()
}

process.exit(0)
