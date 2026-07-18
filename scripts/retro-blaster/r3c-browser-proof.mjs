import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://127.0.0.1:3333/pitch-defender/retro-2'
const OUT = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/r3c-browser-proof')
const SAMPLE_MS = 50
mkdirSync(OUT, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function installVisibilityHarness(context) {
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

async function snapshot(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      formation: JSON.parse(canvas?.dataset.retroFormationState ?? '{"directorClockMs":0,"ships":[]}'),
      renderSources: JSON.parse(canvas?.dataset.retroRenderSources ?? '{}'),
      logical: canvas ? [canvas.width, canvas.height] : null,
      css: rect ? [rect.width, rect.height] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visibility: document.visibilityState,
      gameOver: document.body.textContent?.includes('GAME OVER') ?? false,
    }
  })
}

async function waitForPhase(page, phase, excludedAttackId = null, timeout = 12000) {
  await page.waitForFunction(({ phase, excludedAttackId }) => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.phase === phase && state.activeAttack.attackId !== excludedAttackId
  }, { phase, excludedAttackId }, { timeout })
  return snapshot(page)
}

async function answerKeys(page) {
  return page.evaluate(() => {
    const entries = Array.from(document.querySelectorAll('span'))
      .filter(element => /^[CDEFGAB]=[1-8]$/.test(element.textContent?.trim() ?? ''))
      .map(element => ({
        key: element.textContent.trim().split('=')[1],
        active: Number.parseInt(getComputedStyle(element).fontWeight, 10) >= 700,
      }))
    return {
      correct: entries.find(entry => entry.active)?.key ?? null,
      wrong: entries.find(entry => !entry.active)?.key ?? null,
    }
  })
}

async function captureFlight(page, attackId, stopAtT, directory, milestones) {
  const samples = []
  const pending = new Set(milestones)
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const state = await snapshot(page)
    const attack = state.formation.activeAttack
    if (!attack || attack.attackId !== attackId) break
    samples.push({ capturedAt: Date.now(), ...state })
    for (const milestone of [...pending]) {
      if (attack.outboundT >= milestone) {
        await page.screenshot({ path: resolve(directory, `outbound-${String(milestone).replace('.', '-')}.png`) })
        pending.delete(milestone)
      }
    }
    if (attack.phase === 'outbound' && attack.outboundT >= stopAtT) break
    await page.waitForTimeout(SAMPLE_MS)
  }
  return samples
}

function assertFlightSamples(samples, label, expectedMilestones) {
  assert(samples.length >= 6, `${label}: sparse trajectory (${samples.length} samples)`)
  const attackIds = new Set(samples.map(sample => sample.formation.activeAttack?.attackId).filter(Boolean))
  assert(attackIds.size === 1, `${label}: attack identity changed during flight`)
  const maxT = Math.max(...samples.map(sample => sample.formation.activeAttack?.outboundT ?? 0))
  for (const milestone of expectedMilestones) {
    assert(samples.some(sample => Math.abs((sample.formation.activeAttack?.outboundT ?? -1) - milestone) <= 0.12),
      `${label}: no sample near K=${milestone}`)
  }
  assert(maxT >= Math.max(...expectedMilestones), `${label}: outbound trace ended at ${maxT}`)
  const targetId = samples[0].formation.activeAttack.alienId
  assert(samples.every(sample => sample.formation.ships.filter(ship => ship.flightState !== 'formation').length === 1),
    `${label}: more than one non-formation ship`)
  assert(samples.every(sample => sample.formation.ships.some(ship => ship.alienId === targetId)),
    `${label}: attacked alien identity disappeared`)
}

async function advanceToBottomRowDive(page, excludedAttackId, directory) {
  let answeredAttackCount = 0
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const state = await snapshot(page)
    assert(!state.gameOver, `game ended before a bottom-row dive could be captured after ${answeredAttackCount} acknowledged answers`)
    const attack = state.formation.activeAttack
    if (!attack || attack.attackId === excludedAttackId || attack.phase !== 'outbound') {
      await page.waitForTimeout(25)
      continue
    }

    const target = state.formation.ships.find(ship => ship.alienId === attack.alienId)
    assert(target, `active attack ${attack.attackId} lost its target`)
    if (target.slot >= 10) {
      const samples = await captureFlight(page, attack.attackId, 0.94, directory, [0, 0.28, 0.40, 0.90])
      assertFlightSamples(samples, 'bottom-row shallow dive', [0, 0.28, 0.40, 0.90])
      const keys = await answerKeys(page)
      assert(keys.correct, 'bottom-row correct answer key missing')
      await page.keyboard.press(keys.correct)
      await page.waitForFunction(attackId => {
        const canvas = document.querySelector('canvas')
        const formation = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
        return formation.activeAttack?.attackId !== attackId || formation.activeAttack.phase === 'hit-locked'
      }, attack.attackId, { timeout: 1500 })
      await page.screenshot({ path: resolve(directory, '11-bottom-row-impact.png') })
      return { attackId: attack.attackId, target, samples, answeredAttackCount }
    }

    const keys = await answerKeys(page)
    assert(keys.correct, `correct answer key missing for ${attack.attackId}`)
    await page.keyboard.press(keys.correct)
    await page.waitForFunction(attackId => {
      const canvas = document.querySelector('canvas')
      const formation = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
      return formation.activeAttack?.attackId !== attackId || formation.activeAttack.phase !== 'outbound'
    }, attack.attackId, { timeout: 1500 })
    answeredAttackCount += 1
  }

  throw new Error('timed out before the first bottom-row authored dive')
}

async function proveDesktop(browser) {
  const dir = resolve(OUT, 'desktop-1280x800')
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: resolve(dir, 'video'), size: { width: 1280, height: 800 } },
  })
  await installVisibilityHarness(context)
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await startGame(page)

  const initial = await snapshot(page)
  assert(JSON.stringify(initial.logical) === JSON.stringify([640, 360]), `logical canvas drifted: ${initial.logical}`)
  assert(initial.overflow <= 1, `desktop horizontal overflow ${initial.overflow}`)

  const telegraph = await waitForPhase(page, 'telegraph')
  const firstAttackId = telegraph.formation.activeAttack.attackId
  await page.screenshot({ path: resolve(dir, '01-telegraph.png') })
  await waitForPhase(page, 'outbound')
  const correctFlight = await captureFlight(page, firstAttackId, 0.94, dir, [0.28, 0.40, 0.90])
  assertFlightSamples(correctFlight, 'correct dive', [0.28, 0.40, 0.90])
  const correctKeys = await answerKeys(page)
  assert(correctKeys.correct, 'correct answer key missing')
  await page.keyboard.press(correctKeys.correct)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId !== attackId || state.activeAttack.phase === 'hit-locked'
  }, firstAttackId, { timeout: 1500 })
  const postCorrect = await snapshot(page)
  assert(['hit-locked', undefined].includes(postCorrect.formation.activeAttack?.phase),
    `correct answer did not enter hit lock: ${postCorrect.formation.activeAttack?.phase}`)
  await page.screenshot({ path: resolve(dir, '05-correct-impact.png') })
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId !== attackId
  }, firstAttackId, { timeout: 4000 })

  const second = await waitForPhase(page, 'outbound', firstAttackId)
  const secondAttackId = second.formation.activeAttack.attackId
  const wrongFlight = await captureFlight(page, secondAttackId, 0.58, dir, [0.28, 0.40])
  assertFlightSamples(wrongFlight, 'wrong dive', [0.28, 0.40])
  const wrongKeys = await answerKeys(page)
  assert(wrongKeys.wrong, 'wrong answer key missing')
  await page.keyboard.press(wrongKeys.wrong)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId === attackId && state.activeAttack.phase === 'returning'
  }, secondAttackId)
  await page.screenshot({ path: resolve(dir, '08-wrong-return.png') })
  const returning = []
  while (true) {
    const state = await snapshot(page)
    if (state.formation.activeAttack?.attackId !== secondAttackId) break
    returning.push(state)
    await page.waitForTimeout(SAMPLE_MS)
  }
  assert(returning.length >= 12, `return trace too short: ${returning.length}`)
  assert(returning.every(state => state.formation.activeAttack.phase === 'returning'), 'return trace changed phase')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await waitForPhase(page, 'outbound', secondAttackId)
  const reducedAttackId = reduced.formation.activeAttack.attackId
  const reducedTargetId = reduced.formation.activeAttack.alienId
  const reducedA = await snapshot(page)
  await page.waitForTimeout(350)
  const reducedB = await snapshot(page)
  for (const state of [reducedA, reducedB]) {
    const target = state.formation.ships.find(ship => ship.alienId === reducedTargetId)
    assert(Math.abs(target.x - target.formationX) < 0.01 && Math.abs(target.y - target.formationY) < 0.01,
      'reduced-motion dive translated the attacked ship')
  }
  assert(reducedB.formation.activeAttack.outboundT > reducedA.formation.activeAttack.outboundT,
    'reduced-motion semantics stopped the director')
  const reducedKeys = await answerKeys(page)
  await page.keyboard.press(reducedKeys.correct)
  await page.screenshot({ path: resolve(dir, '09-reduced-static-dive.png') })

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const state = JSON.parse(canvas?.dataset.retroFormationState ?? '{}')
    return state.activeAttack?.attackId !== attackId
  }, reducedAttackId, { timeout: 4000 })
  const pauseAttack = await waitForPhase(page, 'outbound', reducedAttackId)
  const beforeHidden = await snapshot(page)
  await page.evaluate(() => window.__setRetroVisibility('hidden'))
  await page.waitForTimeout(1200)
  const hidden = await snapshot(page)
  await page.evaluate(() => window.__setRetroVisibility('visible'))
  await page.waitForTimeout(120)
  const resumed = await snapshot(page)
  const hiddenDelta = hidden.formation.directorClockMs - beforeHidden.formation.directorClockMs
  assert(hidden.visibility === 'hidden', 'visibility harness did not report hidden')
  assert(hiddenDelta >= 0 && hiddenDelta <= 50, `director advanced ${hiddenDelta}ms while hidden`)
  assert(resumed.formation.activeAttack?.attackId === pauseAttack.formation.activeAttack.attackId,
    'pause changed active attack identity')
  const pauseKeys = await answerKeys(page)
  if (pauseKeys.correct) await page.keyboard.press(pauseKeys.correct)
  await page.screenshot({ path: resolve(dir, '10-post-pause.png') })
  const bottomRow = await advanceToBottomRowDive(page, pauseAttack.formation.activeAttack.attackId, dir)
  await page.waitForTimeout(6200)

  const final = await snapshot(page)
  assert(Object.keys(final.renderSources).length > 0, 'renderer source latches missing')
  assert(Object.values(final.renderSources).every(source => ['kind-atlas', 'scout-atlas', 'procedural'].includes(source)),
    `unknown renderer source: ${JSON.stringify(final.renderSources)}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)
  const video = page.video()
  await context.close()
  const videoPath = await video.path()
  const videoSha256 = createHash('sha256').update(readFileSync(videoPath)).digest('hex').toUpperCase()
  return {
    initial,
    correct: { attackId: firstAttackId, samples: correctFlight },
    wrong: { attackId: secondAttackId, outboundSamples: wrongFlight, returnSamples: returning },
    reduced: { attackId: reducedAttackId, first: reducedA, second: reducedB },
    pause: { beforeHidden, hidden, resumed, hiddenDelta },
    bottomRow,
    final,
    pageErrors,
    videoPath,
    videoSha256,
  }
}

async function provePhone(browser) {
  const dir = resolve(OUT, 'phone-390x844')
  mkdirSync(dir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await startGame(page)
  const outbound = await waitForPhase(page, 'outbound')
  const state = await snapshot(page)
  assert(state.overflow <= 1, `phone overflow ${state.overflow}`)
  assert(JSON.stringify(state.logical) === JSON.stringify([640, 360]), `phone logical canvas drifted: ${state.logical}`)
  assert(Math.abs(state.css[0] / state.css[1] - 16 / 9) < 0.01, `phone aspect drifted: ${state.css}`)
  const keys = await answerKeys(page)
  assert(keys.correct, 'phone correct key missing')
  await page.keyboard.press(keys.correct)
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(dir, '01-phone-authored-dive.png'), fullPage: true })
  await context.close()
  return { attackId: outbound.formation.activeAttack.attackId, state }
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
try {
  const result = {
    url: URL,
    capturedAt: new Date().toISOString(),
    sampleMs: SAMPLE_MS,
    desktop: await proveDesktop(browser),
    phone: await provePhone(browser),
  }
  writeFileSync(resolve(OUT, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  console.log('PASS R3c browser proof: authored correct/wrong/reduced/pause dives + desktop/phone')
} finally {
  await browser.close()
}
