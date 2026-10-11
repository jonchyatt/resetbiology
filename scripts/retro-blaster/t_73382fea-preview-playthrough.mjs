import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'https://resetbiology.com/pitch-defender/retro-2'
const output = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/t_73382fea-playthrough')
mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function clickStartChoice(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.waitForTimeout(300)
}

async function snapshot(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      formation: JSON.parse(canvas?.dataset.retroFormationState ?? '{}'),
      logical: canvas ? [canvas.width, canvas.height] : null,
      css: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

async function waitForAttackPhase(page, phase, excludedAttackId = null) {
  await page.waitForFunction(({ phase, excludedAttackId }) => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.phase === phase && state.activeAttack.attackId !== excludedAttackId
  }, { phase, excludedAttackId }, { timeout: 20_000 })
  return snapshot(page)
}

async function answerKeys(page) {
  return page.evaluate(() => {
    const prompt = document.body.innerText.match(/ANSWER NOW\s*→\s*PRESS\s+[CDEFGAB]\s*\[([1-8])\]/)
    const available = [...document.querySelectorAll('button')]
      .map(element => element.textContent?.trim() ?? '')
      .map(text => text.match(/^[CDEFGAB]=([1-8])$/)?.[1] ?? null)
      .filter(Boolean)
    const correct = prompt?.[1] ?? null
    return {
      correct,
      wrong: available.find(key => key !== correct) ?? null,
    }
  })
}

async function captureDive(page, attackId, label) {
  const samples = []
  const deadline = Date.now() + 4_000
  while (Date.now() < deadline) {
    const state = await snapshot(page)
    const attack = state.formation.activeAttack
    if (!attack || attack.attackId !== attackId || attack.phase !== 'outbound') break
    const target = state.formation.ships.find(ship => ship.alienId === attack.alienId)
    samples.push({
      phase: attack.phase,
      outboundT: attack.outboundT,
      x: target?.x ?? null,
      y: target?.y ?? null,
      formationX: target?.formationX ?? null,
      formationY: target?.formationY ?? null,
    })
    if (attack.outboundT >= 0.72) break
    await page.waitForTimeout(50)
  }
  assert(samples.length >= 6, `${label}: expected at least six flight samples, got ${samples.length}`)
  assert(Math.max(...samples.map(sample => sample.outboundT)) >= 0.6, `${label}: dive did not reach the lower attack lane`)
  assert(samples.some(sample => sample.x !== sample.formationX && sample.y !== sample.formationY), `${label}: ship never broke formation`)
  return samples
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: resolve(output, 'video'), size: { width: 1280, height: 800 } },
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(url, { waitUntil: 'networkidle' })
  await clickStartChoice(page, 'KEYS / TAP')
  await clickStartChoice(page, 'ARCADE / TRUE PLAY')
  await clickStartChoice(page, 'INSERT COIN - START')
  await clickStartChoice(page, 'BEGIN PRE-FLIGHT')
  await clickStartChoice(page, 'PLAY TEST NOTE C')
  await clickStartChoice(page, 'YES, I HEARD IT')
  await page.keyboard.press('1')

  await page.getByRole('button', { name: 'PLAY C SIGNAL' }).waitFor()
  await page.getByRole('button', { name: 'PLAY C SIGNAL' }).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('1')

  const paceButton = page.getByRole('button', { name: /FIND MY PACE/ })
  await paceButton.waitFor()
  await paceButton.click()
  // The task proves combat, not placement timing. Use the product's explicit
  // non-grading escape hatch so the recording remains deterministic in CI.
  await page.getByRole('button', { name: 'START AT CADET' }).click()
  await page.getByRole('button', { name: 'LAUNCH FIRST C/A WAVE' }).click()
  await page.locator('[data-retro-cabinet]').waitFor()

  const initial = await snapshot(page)
  assert(JSON.stringify(initial.logical) === JSON.stringify([640, 360]), `logical canvas drifted: ${initial.logical}`)
  assert(initial.overflow <= 1, `horizontal overflow: ${initial.overflow}`)
  await page.screenshot({ path: resolve(output, '01-formation.png') })

  const firstTelegraph = await waitForAttackPhase(page, 'telegraph')
  const firstAttackId = firstTelegraph.formation.activeAttack.attackId
  await page.screenshot({ path: resolve(output, '02-telegraph.png') })
  await waitForAttackPhase(page, 'outbound')
  const firstDive = await captureDive(page, firstAttackId, 'first dive')
  await page.screenshot({ path: resolve(output, '03-curved-dive.png') })
  const firstKeys = await answerKeys(page)
  assert(firstKeys.correct, 'first correct key missing')
  await page.keyboard.press(firstKeys.correct)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId !== attackId
  }, firstAttackId, { timeout: 5_000 })
  await page.screenshot({ path: resolve(output, '04-direct-hit.png') })

  const secondTelegraph = await waitForAttackPhase(page, 'telegraph', firstAttackId)
  const secondAttackId = secondTelegraph.formation.activeAttack.attackId
  await waitForAttackPhase(page, 'outbound', firstAttackId)
  const secondDive = await captureDive(page, secondAttackId, 'second dive')
  const secondKeys = await answerKeys(page)
  assert(secondKeys.wrong, 'second wrong key missing')
  await page.keyboard.press(secondKeys.wrong)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId === attackId && state.activeAttack.phase === 'returning'
  }, secondAttackId)
  await page.screenshot({ path: resolve(output, '05-return-to-formation.png') })
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId !== attackId
  }, secondAttackId, { timeout: 5_000 })

  const final = await snapshot(page)
  const video = page.video()
  await page.waitForTimeout(6_200)
  await context.close()
  const videoPath = await video.path()
  const videoSha256 = createHash('sha256').update(readFileSync(videoPath)).digest('hex').toUpperCase()
  await browser.close()

  const result = {
    schema: 'retro-blaster-t_73382fea-playthrough/v1',
    status: 'PASS',
    url,
    capturedAt: new Date().toISOString(),
    initial,
    first: { attackId: firstAttackId, samples: firstDive },
    second: { attackId: secondAttackId, samples: secondDive },
    final,
    pageErrors,
    videoPath,
    videoSha256,
  }
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
}

await run()
