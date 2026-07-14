import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [name, endpoint, url = 'https://resetbiology.com/pitch-defender/retro-2', outputRoot = 'data/retro-blaster-rework/runtime-logs/r3c-hawkeye-fleet'] = process.argv.slice(2)
if (!name || !endpoint) throw new Error('usage: node r3c-hawkeye-fleet-proof.mjs NAME CDP_ENDPOINT [URL] [OUTPUT_ROOT]')
const output = resolve(outputRoot, name)
mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`${name}: ${message}`)
}

async function state(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      formation: JSON.parse(canvas?.dataset.retroFormationState ?? '{}'),
      renderSources: JSON.parse(canvas?.dataset.retroRenderSources ?? '{}'),
      cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
      logical: canvas ? [canvas.width, canvas.height] : null,
      css: rect ? [rect.width, rect.height] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
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
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return value.activeAttack?.phase === 'outbound' && value.activeAttack.outboundT >= 0.4
  }, undefined, { timeout: 12000 })

  const before = await state(page)
  const attack = before.formation.activeAttack
  assert(before.cabinet, 'cabinet missing')
  assert(JSON.stringify(before.logical) === JSON.stringify([640, 360]), `logical canvas drifted: ${before.logical}`)
  assert(before.overflow <= 1, `horizontal overflow ${before.overflow}`)
  assert(attack?.phase === 'outbound', `expected outbound attack, got ${attack?.phase}`)
  assert(before.formation.ships.filter(ship => ship.flightState !== 'formation').length === 1,
    'one-diver invariant failed')
  assert(before.formation.ships.some(ship => ship.alienId === attack.alienId), 'attacked alien ID missing')
  assert(Object.keys(before.renderSources).length > 0, 'renderer source latches missing')
  await page.screenshot({ path: resolve(output, '01-outbound.png') })

  const key = await activeKey(page)
  assert(key, 'active answer key missing')
  await page.keyboard.press(key)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return value.activeAttack?.attackId !== attackId
  }, attack.attackId, { timeout: 4000 })
  const after = await state(page)
  assert(after.formation.ships.find(ship => ship.alienId === attack.alienId)?.alive === false,
    'correct authored attack did not remove its bound alien')
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`)
  await page.screenshot({ path: resolve(output, '02-impact.png') })

  const receipt = {
    name,
    endpoint,
    browser: browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    url: page.url(),
    capturedAt: new Date().toISOString(),
    attackId: attack.attackId,
    alienId: attack.alienId,
    before,
    after,
    errors,
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt, null, 2))
  console.log(`PASS ${name}: hosted R3c authored dive receipt`)
} finally {
  await page.close()
  browser._connection.close()
}

process.exit(0)
