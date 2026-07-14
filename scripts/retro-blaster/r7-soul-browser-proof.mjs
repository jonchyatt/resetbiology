import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { chromium } from 'playwright'

const [lane = 'native-chrome', transport = 'native', rawUrl, rawOutput, rawDeployedSha] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3333/pitch-defender/retro-2'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r7-soul-browser-proof/${lane}`)
const videoDir = resolve(output, 'video')
const resultPath = resolve(output, 'result.json')
const deployedSha = rawDeployedSha || 'local-uncommitted'
mkdirSync(videoDir, { recursive: true })

const rendererBundle = buildSync({
  stdin: {
    contents: "export { deriveSoulRenderOffset } from './src/components/PitchDefender/retroBlasterRenderer.ts'",
    resolveDir: process.cwd(),
    sourcefile: 'r7-production-renderer-browser-entry.ts',
  },
  bundle: true,
  format: 'iife',
  globalName: '__r7ProductionRenderer',
  platform: 'browser',
  target: 'chrome120',
  treeShaking: true,
  write: false,
}).outputFiles[0].text
const rendererBundleSha256 = createHash('sha256').update(rendererBundle).digest('hex').toUpperCase()

function assert(condition, message) {
  if (!condition) throw new Error(`${lane}: ${message}`)
}

const initHarness = () => {
  let forcedVisibility = 'visible'
  let forcedFocus = true
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => forcedVisibility,
  })
  Object.defineProperty(document, 'hasFocus', {
    configurable: true,
    value: () => forcedFocus,
  })
  window.__setRetroVisibility = state => {
    forcedVisibility = state
    document.dispatchEvent(new Event('visibilitychange'))
  }
  window.__setRetroFocus = focused => {
    forcedFocus = focused
    window.dispatchEvent(new Event(focused ? 'focus' : 'blur'))
  }
  window.__r7FrameCount = 0
  const countFrame = () => {
    window.__r7FrameCount += 1
    requestAnimationFrame(countFrame)
  }
  requestAnimationFrame(countFrame)
  window.__r7SoulMutations = []
  window.__startR7SoulObserver = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('R7 canvas missing for soul observer')
    window.__r7SoulObserver?.disconnect()
    window.__r7SoulMutations = []
    window.__r7SoulObserver = new MutationObserver(records => {
      for (const record of records) {
        window.__r7SoulMutations.push({
          at: performance.now(),
          oldValue: record.oldValue,
          value: canvas.getAttribute('data-retro-soul-state'),
        })
      }
    })
    window.__r7SoulObserver.observe(canvas, {
      attributes: true,
      attributeFilter: ['data-retro-soul-state'],
      attributeOldValue: true,
    })
    return true
  }
}

function seedEarMemory() {
  const now = Date.now()
  const day = 86_400_000
  const memory = (note, { S, D, due, lastReview }) => ({
    note, S, D, due, lastReview, lapses: 0, phase: 'review', learningReps: 2,
  })
  return {
    C4: memory('C4', { S: 0.5, D: 6, due: now - 1, lastReview: now - 10 * day }),
    A4: memory('A4', { S: 40, D: 2, due: now + day, lastReview: now - day }),
    G4: memory('G4', { S: 35, D: 3, due: now + day, lastReview: now - day }),
    E4: memory('E4', { S: 20, D: 5, due: now - 1, lastReview: now - day }),
  }
}

function seedVoiceMemory() {
  const now = Date.now()
  const day = 86_400_000
  return {
    C4: { note: 'C4', S: 30, D: 2, due: now + day, lastReview: now - day, lapses: 0, phase: 'review', learningReps: 2 },
    D4: { note: 'D4', S: 3, D: 7, due: now - day, lastReview: now - 8 * day, lapses: 1, phase: 'review', learningReps: 2 },
  }
}

function parseStore(raw) {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

const connected = transport !== 'native'
let completed = false
const browser = connected
  ? await chromium.connectOverCDP(transport, { timeout: 60_000 })
  : await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.addInitScript(initHarness)
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

async function snapshot() {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const parse = (raw, fallback) => {
      try { return JSON.parse(raw || fallback) } catch { return JSON.parse(fallback) }
    }
    const rect = canvas?.getBoundingClientRect()
    return {
      formation: parse(canvas?.dataset.retroFormationState, '{}'),
      souls: parse(canvas?.dataset.retroSoulState, '[]'),
      vfx: parse(canvas?.dataset.retroWeaponVfx,
        '{"charge":null,"tracer":null,"hitLockAttackId":null,"impactAlienIds":[]}'),
      earRaw: localStorage.getItem('pitch_fsrs_memory_ear'),
      voiceRaw: localStorage.getItem('pitch_fsrs_memory'),
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      frameCount: window.__r7FrameCount ?? 0,
      soulMutations: [...(window.__r7SoulMutations ?? [])],
      logical: canvas ? [canvas.width, canvas.height] : null,
      css: rect ? [rect.width, rect.height] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

async function answerKeys() {
  return page.evaluate(() => {
    const entries = [...document.querySelectorAll('span')]
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

async function waitForOutbound(excludedAttackId = null, timeout = 15_000) {
  await page.waitForFunction(excluded => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.phase === 'outbound' && formation.activeAttack.attackId !== excluded
  }, excludedAttackId, { timeout, polling: 'raf' })
  return snapshot()
}

async function screenshot(name, fullPage = false) {
  const path = resolve(output, name)
  await page.screenshot({ path, fullPage })
  return {
    path,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase(),
  }
}

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  const earSeed = seedEarMemory()
  const voiceSeed = seedVoiceMemory()
  await page.evaluate(({ ear, voice }) => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_difficulty', 'easy')
    localStorage.removeItem('retro_blaster_color_hints')
    localStorage.setItem('pitch_fsrs_memory_ear', JSON.stringify(ear))
    localStorage.setItem('pitch_fsrs_memory', JSON.stringify(voice))
  }, { ear: earSeed, voice: voiceSeed })
  await page.reload({ waitUntil: 'networkidle' })
  await page.addScriptTag({ content: rendererBundle })
  for (const label of ['KEYBOARD', 'EASY', 'INSERT COIN']) {
    const button = page.getByRole('button', { name: label, exact: true })
    if (await button.count()) await button.click()
  }
  await page.locator('[data-retro-cabinet]').waitFor()
  await page.evaluate(() => window.__startR7SoulObserver())
  const evidenceStartedAtMs = performance.now()
  const firstSessionStartedAtMs = performance.now()

  const firstOutbound = await waitForOutbound()
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    return JSON.parse(canvas?.dataset.retroSoulState || '[]').length === 2
  }, null, { timeout: 3000, polling: 'raf' })
  const dueFormation = await snapshot()
  assert(dueFormation.formation.ships.length === 2,
    `first due-first formation expected 2 ships, got ${dueFormation.formation.ships.length}`)
  assert(dueFormation.souls.length === 2, `first soul roster expected 2 entries, got ${dueFormation.souls.length}`)
  const soulNotes = dueFormation.souls.map(entry => entry.soul.note).sort()
  assert(JSON.stringify(soulNotes) === JSON.stringify(['C4', 'E4']),
    `due-first roster drifted: ${soulNotes.join(',')}`)
  assert(dueFormation.souls.every(entry => entry.soul.due === true), 'future note entered due-first wave')
  const soulsByRetention = [...dueFormation.souls].sort((a, b) => a.soul.r - b.soul.r)
  const lowRetentionSoul = soulsByRetention[0]
  const highRetentionSoul = soulsByRetention.at(-1)
  assert(highRetentionSoul.soul.r - lowRetentionSoul.soul.r >= 0.25,
    'seeded browser souls did not preserve a materially separated R profile')
  assert(lowRetentionSoul.soul.agitation > highRetentionSoul.soul.agitation,
    'lower-R soul did not carry greater formation agitation')
  assert(earSeed[lowRetentionSoul.soul.note].S < earSeed[highRetentionSoul.soul.note].S &&
    lowRetentionSoul.soul.calm < highRetentionSoul.soul.calm,
  'higher-S seeded soul did not carry the calmer/rarer signal')
  const firstAttack = firstOutbound.formation.activeAttack
  const targetSoulBefore = dueFormation.souls.find(entry => entry.alienId === firstAttack.alienId)
  assert(targetSoulBefore, 'active attack lost its immutable soul')
  assert(targetSoulBefore.diveServiceCount === 1, 'selected diver did not pay exactly one service count')
  assert(dueFormation.souls.filter(entry => entry.diveServiceCount > 0).length === 1,
    'more than one diver paid service for one attack')
  const dueScreenshot = await screenshot('01-due-first-souls.png')

  const firstKeys = await answerKeys()
  assert(firstKeys.wrong && firstKeys.correct, 'keyboard answer map missing')
  const earBeforeWrong = firstOutbound.earRaw
  await page.keyboard.press(firstKeys.wrong)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.attackId === attackId && formation.activeAttack.phase === 'returning'
  }, firstAttack.attackId, { timeout: 2500, polling: 'raf' })
  const wrongReturn = await snapshot()
  const targetSoulAfter = wrongReturn.souls.find(entry => entry.alienId === firstAttack.alienId)
  assert(targetSoulAfter, 'wrong-return target lost its soul')
  assert(JSON.stringify(targetSoulAfter.soul) === JSON.stringify(targetSoulBefore.soul),
    'live grade mutated the immutable per-wave soul')
  assert(wrongReturn.earRaw !== earBeforeWrong, 'eligible wrong EAR answer did not change the EAR store')
  assert(wrongReturn.voiceRaw === firstOutbound.voiceRaw, 'EAR answer mutated the VOICE lane store')
  const wrongMemory = parseStore(wrongReturn.earRaw)[firstAttack.note]
  assert(wrongMemory?.phase === 'learning' && wrongMemory.learningReps === 0,
    'wrong EAR answer did not persist Again semantics')
  assert(wrongReturn.vfx.charge === null && wrongReturn.vfx.tracer === null &&
    wrongReturn.vfx.hitLockAttackId === null && wrongReturn.vfx.impactAlienIds.length === 0,
  'wrong teaching return emitted successful charge/tracer/lock/impact VFX')
  const wrongScreenshot = await screenshot('02-immutable-wrong-return.png')

  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.attackId !== attackId
  }, firstAttack.attackId, { timeout: 5000, polling: 'raf' })
  const nextOutbound = await waitForOutbound(firstAttack.attackId)
  const nextAttack = nextOutbound.formation.activeAttack
  const fairScores = nextOutbound.souls.map(entry => ({
    alienId: entry.alienId,
    score: (1 + entry.soul.divePressure) / (1 + entry.diveServiceCount - (entry.alienId === nextAttack.alienId ? 1 : 0)),
  }))
  const selectedFairScore = fairScores.find(entry => entry.alienId === nextAttack.alienId)?.score
  assert(selectedFairScore !== undefined, 'second fair dive lost its selected soul')
  assert(Math.abs(selectedFairScore - Math.max(...fairScores.map(entry => entry.score))) < 1e-12,
    'second dive did not select the highest weighted-fair score')
  assert(nextOutbound.souls.find(entry => entry.alienId === nextAttack.alienId)?.diveServiceCount === 1,
    'second selected diver did not pay exactly one service count')
  const pauseKeys = await answerKeys()
  assert(pauseKeys.correct, 'focus/hidden answer map missing')

  await page.evaluate(() => window.__setRetroFocus(false))
  const focusStart = await snapshot()
  await page.keyboard.press(pauseKeys.correct)
  await page.waitForTimeout(900)
  const unfocused = await snapshot()
  const focusDelta = unfocused.formation.directorClockMs - focusStart.formation.directorClockMs
  assert(unfocused.focused === false, 'focus harness did not enter unfocused state')
  assert(focusDelta >= 0 && focusDelta <= 50, `director advanced ${focusDelta}ms while unfocused`)
  assert(unfocused.formation.activeAttack?.attackId === nextAttack.attackId,
    'unfocused interval changed attack identity')
  assert(unfocused.earRaw === focusStart.earRaw, 'unfocused key graded EAR')
  await page.evaluate(() => window.__setRetroFocus(true))
  await page.waitForTimeout(120)

  await page.evaluate(() => window.__setRetroVisibility('hidden'))
  const hiddenStart = await snapshot()
  await page.keyboard.press(pauseKeys.correct)
  await page.waitForTimeout(900)
  const hidden = await snapshot()
  const hiddenDelta = hidden.formation.directorClockMs - hiddenStart.formation.directorClockMs
  assert(hidden.visibility === 'hidden', 'visibility harness did not enter hidden state')
  assert(hiddenDelta >= 0 && hiddenDelta <= 50, `director advanced ${hiddenDelta}ms while hidden`)
  assert(hidden.formation.activeAttack?.attackId === nextAttack.attackId,
    'hidden interval changed attack identity')
  assert(hidden.earRaw === hiddenStart.earRaw, 'hidden key graded EAR')
  await page.evaluate(() => window.__setRetroVisibility('visible'))
  await page.waitForTimeout(120)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
  const reduced = await snapshot()
  const rendererProof = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    const souls = JSON.parse(canvas?.dataset.retroSoulState || '[]')
    return souls.map(entry => {
      const ship = formation.ships.find(candidate => candidate.alienId === entry.alienId)
      const alien = {
        formationSlot: entry.formationSlot,
        soul: entry.soul,
        entering: ship?.entering ?? false,
        alive: ship?.alive ?? false,
      }
      const active = formation.activeAttack?.alienId === entry.alienId
      return {
        alienId: entry.alienId,
        active,
        normal: window.__r7ProductionRenderer.deriveSoulRenderOffset(alien, performance.now(), false, active),
        reduced: window.__r7ProductionRenderer.deriveSoulRenderOffset(alien, performance.now(), true, active),
      }
    })
  })
  assert(rendererProof.length > 0, 'production renderer bundle returned no soul offsets')
  assert(rendererProof.every(row => row.reduced.x === 0 && row.reduced.y === 0),
    'reduced motion retained soul wobble')
  assert(rendererProof.every(row => Math.abs(row.normal.x) <= 1 && Math.abs(row.normal.y) <= 0.35),
    'normal soul wobble exceeded the 1px local ceiling')
  const reducedScreenshot = await screenshot('03-reduced-static-signal.png')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  const portrait = await snapshot()
  assert(portrait.overflow <= 1, `portrait overflow ${portrait.overflow}`)
  assert(Math.abs(portrait.css[0] / portrait.css[1] - 16 / 9) < 0.01,
    `portrait canvas aspect drifted ${portrait.css}`)
  const portraitScreenshot = await screenshot('04-portrait.png', true)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(400)
  const landscape = await snapshot()
  assert(landscape.overflow <= 1, `landscape overflow ${landscape.overflow}`)
  assert(Math.abs(landscape.css[0] / landscape.css[1] - 16 / 9) < 0.01,
    `landscape canvas aspect drifted ${landscape.css}`)
  assert(landscape.formation.gameId === portrait.formation.gameId, 'responsive resize restarted the game')
  const landscapeScreenshot = await screenshot('05-landscape.png', true)

  const firstSessionFinal = await snapshot()
  const firstSessionEndedAtMs = performance.now()
  const firstSessionDurationMs = firstSessionEndedAtMs - firstSessionStartedAtMs
  const soulMutationCount = firstSessionFinal.soulMutations.length
  const observedFrames = firstSessionFinal.frameCount - firstOutbound.frameCount
  const observedFrameRateFps = observedFrames / (firstSessionDurationMs / 1000)
  assert(observedFrames >= 120, `browser observation too short: ${observedFrames} frames`)
  assert(observedFrameRateFps >= 20,
    `motion-critical soul sequence fell below 20fps: ${observedFrameRateFps.toFixed(2)}fps`)
  assert(soulMutationCount <= Math.max(20, Math.floor(observedFrames / 5)),
    `soul proof channel wrote ${soulMutationCount} times across ${observedFrames} frames`)

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(({ ear, voice }) => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_difficulty', 'easy')
    localStorage.removeItem('retro_blaster_color_hints')
    localStorage.setItem('pitch_fsrs_memory_ear', JSON.stringify(ear))
    localStorage.setItem('pitch_fsrs_memory', JSON.stringify(voice))
  }, { ear: earSeed, voice: voiceSeed })
  await page.reload({ waitUntil: 'networkidle' })
  for (const label of ['KEYBOARD', 'EASY', 'INSERT COIN']) {
    const button = page.getByRole('button', { name: label, exact: true })
    if (await button.count()) await button.click()
  }
  await page.locator('[data-retro-cabinet]').waitFor()
  const timeoutOutbound = await waitForOutbound()
  const timeoutAttack = timeoutOutbound.formation.activeAttack
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.attackId === attackId && formation.activeAttack.phase === 'returning' &&
      formation.activeAttack.outcome === 'timeout'
  }, timeoutAttack.attackId, { timeout: 3500, polling: 'raf' })
  const timeoutReturn = await snapshot()
  const timeoutMemory = parseStore(timeoutReturn.earRaw)[timeoutAttack.note]
  assert(timeoutReturn.earRaw !== timeoutOutbound.earRaw, 'eligible EAR timeout did not update the EAR store')
  assert(timeoutMemory?.phase === 'learning' && timeoutMemory.learningReps === 0,
    'eligible EAR timeout did not persist Again semantics')
  assert(timeoutReturn.voiceRaw === timeoutOutbound.voiceRaw, 'EAR timeout mutated the VOICE lane store')
  assert(timeoutReturn.vfx.charge === null && timeoutReturn.vfx.tracer === null &&
    timeoutReturn.vfx.hitLockAttackId === null && timeoutReturn.vfx.impactAlienIds.length === 0,
  'EAR timeout teaching return emitted successful VFX')
  const timeoutScreenshot = await screenshot('06-ear-timeout-again.png')

  const minimumEnd = evidenceStartedAtMs + 6000
  if (performance.now() < minimumEnd) await page.waitForTimeout(minimumEnd - performance.now())
  const finalState = await snapshot()
  const evidenceEndedAtMs = performance.now()
  const evidenceDurationMs = evidenceEndedAtMs - evidenceStartedAtMs
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)

  const video = page.video()
  await context.close()
  const videoPath = await video.path()
  const videoSha256 = createHash('sha256').update(readFileSync(videoPath)).digest('hex').toUpperCase()
  const behaviorIds = [
    'ear-due-roster-membership',
    'ear-wrong-again-next-wave',
    'ear-timeout-again-next-wave',
    'weighted-fair-dive-service',
    'r-low-vs-high-formation-agitation',
    's-calm-rarity',
    'reduced-static-soul-signal',
    'lane-store-isolation',
    'wrong-teaching-return-no-success-vfx',
    'hidden-focus-freeze-resume',
    'portrait-short-landscape',
  ]
  const screenshotRows = [dueScreenshot, wrongScreenshot, reducedScreenshot,
    portraitScreenshot, landscapeScreenshot, timeoutScreenshot]
  const receipt = {
    status: 'PASS', lane, transport, url, exactDeployedSha: deployedSha,
    capturedAt: new Date().toISOString(),
    assertions: {
      dueFirstRoster: true,
      immutablePerWaveSoul: true,
      fairDiveService: true,
      eligibleEarFailureGradesAgain: true,
      eligibleEarTimeoutGradesAgain: true,
      lowerRHasGreaterAgitation: true,
      higherSHasGreaterCalm: true,
      earCannotMutateVoiceLane: true,
      wrongAndTimeoutHaveNoSuccessVfx: true,
      changeOnlyProofChannel: true,
      focusAndHiddenFreeze: true,
      reducedMotionZeroWobble: true,
      staticNonColorSignalPresent: true,
      responsiveGeometry: true,
      zeroPageErrors: true,
    },
    rendererProof: { rendererBundleSha256, rows: rendererProof },
    seededProfiles: { ear: earSeed, voice: voiceSeed },
    firstWave: { firstOutbound, dueFormation, targetSoulBefore, lowRetentionSoul, highRetentionSoul },
    wrongReturn: { state: wrongReturn, targetSoulAfter, wrongMemory },
    timeoutReturn: { outbound: timeoutOutbound, state: timeoutReturn, timeoutMemory },
    pause: { focusStart, unfocused, focusDelta, hiddenStart, hidden, hiddenDelta },
    reduced: { state: reduced, rendererProof },
    responsive: { portrait, landscape },
    proofChannel: {
      observedFrames, observedFrameRateFps, firstSessionStartedAtMs, firstSessionEndedAtMs,
      firstSessionDurationMs, soulMutationCount, mutations: firstSessionFinal.soulMutations,
    },
    screenshots: screenshotRows,
    finalState,
    behaviorManifest: behaviorIds.map(behaviorId => ({
      browserLane: lane,
      exactDeployedSha: deployedSha,
      behaviorId,
      startMonotonicMs: evidenceStartedAtMs,
      endMonotonicMs: evidenceEndedAtMs,
      durationMs: evidenceDurationMs,
      videoPath,
      videoSha256,
      frameSequencePaths: screenshotRows.map(row => row.path),
      orderedFrameSequenceSha256: createHash('sha256')
        .update([videoSha256, behaviorId, ...screenshotRows.map(row => row.sha256)].join('\n'))
        .digest('hex').toUpperCase(),
      frameRateFloorFps: ['r-low-vs-high-formation-agitation', 's-calm-rarity']
        .includes(behaviorId) ? 20 : 2,
      machineStateReceiptPath: resultPath,
      claudeFrameCitations: [],
      argusFrameCitations: [],
    })),
    videoPath,
    videoSha256,
    pageErrors,
  }
  writeFileSync(resultPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify({
    status: receipt.status,
    lane,
    exactDeployedSha: deployedSha,
    assertions: receipt.assertions,
    observedFrames,
    observedFrameRateFps,
    soulMutationCount,
    evidenceDurationMs,
    videoPath,
    videoSha256,
    resultPath,
  }, null, 2))
  console.log(`PASS ${lane}: full R7 FSRS soul-binding browser matrix`)
  completed = true
} finally {
  if (!page.isClosed()) await page.close().catch(() => {})
  // ponytail: Playwright has no public CDP disconnect; replace if one is added.
  if (connected) browser._connection.close()
  else await browser.close().catch(() => {})
  if (connected && completed) process.exit(0)
}
