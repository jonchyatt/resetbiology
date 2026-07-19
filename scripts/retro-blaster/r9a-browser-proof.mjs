import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [rawUrl, rawOutput, rawSha] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3336/pitch-defender/retro-2?v=840efc3b'
const output = resolve(rawOutput || 'data/retro-blaster-rework/runtime-logs/r9a-local-840efc3b/r9a')
const videoDir = resolve(output, 'video')
const productSha = rawSha || '840efc3b91111cda7657f33aad92f8019b90d3f4'
const transport = 'http://127.0.0.1:9224'
const POLICY_KEY = 'retro_blaster_curriculum_v1'
const LOCK_NAME = 'retro-blaster-curriculum-v1'
const ORDER_KEY = 'retro_blaster_curriculum_r9a_test_order'
const INTRO_ORDER = ['C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5', 'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3']
const EXPECTED_HASHES = {
  shell: '579F1990C42DB09F61F77141B47357EC8310D4047FA4B6D08AA91594F0A4E317',
  engine: '201C37698C81277184BC38DC73BAB7E3372EF22A43949E07BFE2B607DD598A0E',
  policy: 'C0E50DA7B72D570350F2B6A7DFF2F9C160955184257B0626D563296071CF31E5',
}
const SOURCE_PATHS = {
  shell: 'src/components/PitchDefender/RetroBlasterII.tsx',
  engine: 'src/components/PitchDefender/retroBlasterEngine.ts',
  policy: 'src/components/PitchDefender/retroBlasterCurriculum.ts',
}

mkdirSync(videoDir, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(resolve(path))).digest('hex').toUpperCase()
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function policy(notes, extension = {}) {
  return JSON.stringify({ ...extension, revision: 1, unlockedNotes: notes })
}

const initHarness = () => {
  let forcedVisibility = 'visible'
  let forcedFocus = true
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => forcedVisibility })
  Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => forcedFocus })
  window.__r9aSetActivity = (visibility, focused) => {
    forcedVisibility = visibility
    forcedFocus = focused
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(focused ? 'focus' : 'blur'))
  }

  const now = () => performance.now()
  const trace = window.__r9aTrace = {
    frame: 0,
    storageWrites: [],
    storageFailures: [],
    ceremonies: [],
  }
  window.__r9aResetTrace = () => {
    trace.storageWrites = []
    trace.storageFailures = []
    trace.ceremonies = []
  }
  const frame = () => {
    trace.frame += 1
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.__r9aFailPolicyWrites = false
  const nativeSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function(key, value) {
    if (String(key) === 'retro_blaster_curriculum_v1' && window.__r9aFailPolicyWrites) {
      trace.storageFailures.push({ atMs: now(), frame: trace.frame, key: String(key), value: String(value) })
      throw new DOMException('R9a deterministic quota failure', 'QuotaExceededError')
    }
    trace.storageWrites.push({ atMs: now(), frame: trace.frame, key: String(key), value: String(value) })
    return nativeSetItem.call(this, key, value)
  }

  const installCeremonyObserver = () => {
    if (!document.documentElement) return
    new MutationObserver(() => {
      const ceremony = document.querySelector('[data-retro-ceremony]')
      if (!ceremony || trace.ceremonies.some(row => row.id === ceremony.getAttribute('data-ceremony-id'))) return
      trace.ceremonies.push({
        atMs: now(),
        frame: trace.frame,
        id: ceremony.getAttribute('data-ceremony-id'),
        note: ceremony.getAttribute('data-ceremony-note'),
      })
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.documentElement) installCeremonyObserver()
  else addEventListener('DOMContentLoaded', installCeremonyObserver, { once: true })

  window.__r9aAudio = { contexts: [], resumeCalls: 0, bufferStarts: 0, oscillatorStarts: 0, error: null }
  try {
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext
    if (NativeAudioContext) {
      const nativeResume = NativeAudioContext.prototype.resume
      NativeAudioContext.prototype.resume = function(...args) {
        window.__r9aAudio.resumeCalls += 1
        return nativeResume.apply(this, args)
      }
      function TrackedAudioContext(...args) {
        const context = Reflect.construct(NativeAudioContext, args, NativeAudioContext)
        window.__r9aAudio.contexts.push(context)
        return context
      }
      TrackedAudioContext.prototype = NativeAudioContext.prototype
      Object.setPrototypeOf(TrackedAudioContext, NativeAudioContext)
      window.AudioContext = TrackedAudioContext
      if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext
    }
    const nativeBufferStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function(...args) {
      window.__r9aAudio.bufferStarts += 1
      return nativeBufferStart.apply(this, args)
    }
    const nativeOscillatorStart = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function(...args) {
      window.__r9aAudio.oscillatorStarts += 1
      return nativeOscillatorStart.apply(this, args)
    }
    window.__r9aSuspendAudio = async () => {
      await Promise.all(window.__r9aAudio.contexts.map(context => context.suspend()))
      return window.__r9aAudio.contexts.map(context => context.state)
    }
    window.__r9aAudioSnapshot = () => ({
      contextCount: window.__r9aAudio.contexts.length,
      contextStates: window.__r9aAudio.contexts.map(context => context.state),
      resumeCalls: window.__r9aAudio.resumeCalls,
      bufferStarts: window.__r9aAudio.bufferStarts,
      oscillatorStarts: window.__r9aAudio.oscillatorStarts,
      error: window.__r9aAudio.error,
    })
  } catch (error) {
    window.__r9aAudio.error = String(error)
  }
}

const rows = []
const pageErrors = []
const activeHolds = new Map()
let context
let browser
let main
let auxiliary
let originalPolicyRaw = null
let originalOrderRaw = null
let cleanup = null
let verdict = 'FAIL'

function row(id, contract, evidence) {
  rows.push({ id, contract, verdict: 'PASS', evidence })
  console.log(`PASS ${id}: ${contract}`)
}

function watchPage(page, label) {
  page.on('pageerror', error => pageErrors.push({ page: label, message: error.message }))
}

async function stableSegment(page, startedAtMs, minimumMs = 6000) {
  const elapsed = await page.evaluate(start => performance.now() - start, startedAtMs)
  if (elapsed < minimumMs) await page.waitForTimeout(minimumMs - elapsed + 20)
  return page.evaluate(start => ({
    startedAtMs: start,
    endedAtMs: performance.now(),
    durationMs: performance.now() - start,
    frame: window.__r9aTrace?.frame ?? null,
  }), startedAtMs)
}

async function screenshot(page, name, fullPage = true) {
  await page.bringToFront()
  await page.waitForTimeout(80)
  await page.screenshot({ path: resolve(output, name), fullPage })
}

async function setKnownStorage(page, { policyRaw = null, earRaw = null, voiceRaw = null } = {}) {
  await page.evaluate(({ policyKey, policyRaw, earRaw, voiceRaw }) => {
    const assign = (key, value) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)
    assign(policyKey, policyRaw)
    assign('pitch_fsrs_memory_ear', earRaw)
    assign('pitch_fsrs_memory', voiceRaw)
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_difficulty', 'true')
    localStorage.setItem('retro_blaster_color_hints', '0')
    localStorage.removeItem('retro_crt')
  }, { policyKey: POLICY_KEY, policyRaw, earRaw, voiceRaw })
}

async function freshMenu(page, options = {}) {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  assert(response?.status() === 200, `route returned ${response?.status()}`)
  await setKnownStorage(page, options)
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  await page.evaluate(() => window.__r9aResetTrace?.())
}

async function selectEar(page) {
  const keyboard = page.getByRole('button', { name: 'KEYBOARD' })
  if (await keyboard.count()) await keyboard.click()
  const easy = page.getByRole('button', { name: 'EASY' })
  if (await easy.count()) await easy.click()
}

async function enterEarReadiness(page) {
  await selectEar(page)
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness][data-readiness-lane="ear"]').waitFor({ timeout: 20_000 })
}

async function waitEarReady(page) {
  try {
    await page.waitForFunction(() => document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear', null, { timeout: 15_000 })
  } catch {
    const retry = page.getByRole('button', { name: 'RETRY AUDIO' })
    if (await retry.count()) await retry.click()
    await page.waitForFunction(() => document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear', null, { timeout: 15_000 })
  }
}

async function passEarReadiness(page) {
  await waitEarReady(page)
  await page.getByRole('button', { name: 'C, key 1' }).click()
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 15_000 })
}

async function readinessControls(page) {
  return page.evaluate(() => ({
    roster: [...document.querySelectorAll('.retro-readiness-grid button')].map(button => ({
      label: button.getAttribute('aria-label'),
      text: button.textContent?.trim(),
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
    })),
    lane: document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-lane'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
}

async function dispatchReadinessKey(page, key) {
  return page.evaluate(key => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    const dispatchResult = window.dispatchEvent(event)
    return {
      dispatchResult,
      defaultPrevented: event.defaultPrevented,
      readiness: Boolean(document.querySelector('[data-retro-readiness]')),
      controls: document.querySelectorAll('.retro-readiness-grid button').length,
    }
  }, key)
}

async function waitForOutbound(page, priorAttackId = null, timeout = 30_000) {
  await page.waitForFunction(prior => {
    try {
      const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      const attack = formation.activeAttack
      return formation.phase === 'playing' && attack?.phase === 'outbound' && attack.outcome === null &&
        attack.demandAtMs !== null && attack.attackId !== prior
    } catch { return false }
  }, priorAttackId, { timeout, polling: 'raf' })
  return page.evaluate(() => JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}'))
}

async function answerCorrect(page, priorAttackId = null) {
  const formation = await waitForOutbound(page, priorAttackId)
  const attack = formation.activeAttack
  const button = page.locator(`[data-retro-response-button][data-note="${attack.note}"]`)
  await button.waitFor({ state: 'visible', timeout: 5000 })
  await button.click()
  await page.waitForFunction(id => {
    try {
      const state = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      return state.activeAttack?.attackId !== id || state.activeAttack?.outcome === 'correct' || state.phase === 'ceremony'
    } catch { return false }
  }, attack.attackId, { timeout: 5000, polling: 'raf' })
  return attack
}

async function answerUntil(page, predicate, maximum = 30) {
  const answers = []
  let prior = null
  for (let index = 0; index < maximum; index++) {
    if (await predicate()) return answers
    const attack = await answerCorrect(page, prior)
    prior = attack.attackId
    answers.push({ attackId: attack.attackId, note: attack.note })
    if (await predicate()) return answers
  }
  throw new Error(`predicate not reached after ${maximum} correct answers`)
}

async function policySnapshot(page) {
  return page.evaluate(async ({ lockName, policyKey, orderKey }) => navigator.locks.request(
    lockName,
    { mode: 'exclusive' },
    () => ({ policyRaw: localStorage.getItem(policyKey), orderRaw: localStorage.getItem(orderKey) }),
  ), { lockName: LOCK_NAME, policyKey: POLICY_KEY, orderKey: ORDER_KEY })
}

async function holdLock(page, label) {
  await page.evaluate(({ lockName, label }) => {
    window.__r9aHolds ??= {}
    const hold = {}
    hold.promise = navigator.locks.request(lockName, { mode: 'exclusive' }, () => new Promise(resolve => {
      hold.release = resolve
    }))
    window.__r9aHolds[label] = hold
  }, { lockName: LOCK_NAME, label })
  await page.waitForFunction(label => typeof window.__r9aHolds?.[label]?.release === 'function', label)
  activeHolds.set(label, page)
}

async function releaseLock(page, label) {
  if (page.isClosed()) {
    activeHolds.delete(label)
    return
  }
  await page.evaluate(async label => {
    const hold = window.__r9aHolds?.[label]
    if (!hold) return
    hold.release?.()
    await hold.promise
    delete window.__r9aHolds[label]
  }, label)
  activeHolds.delete(label)
}

async function waitPendingLocks(page, minimum, timeout = 5000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const count = await page.evaluate(async lockName => {
      const state = await navigator.locks.query()
      return state.pending.filter(lock => lock.name === lockName).length
    }, LOCK_NAME)
    if (count >= minimum) return count
    await page.waitForTimeout(20)
  }
  throw new Error(`expected at least ${minimum} pending ${LOCK_NAME} requests`)
}

async function setTrialBaseline(page) {
  await page.evaluate(async ({ lockName, policyKey, orderKey, raw }) => navigator.locks.request(lockName, () => {
    localStorage.setItem(policyKey, raw)
    localStorage.setItem(orderKey, JSON.stringify([]))
  }), { lockName: LOCK_NAME, policyKey: POLICY_KEY, orderKey: ORDER_KEY, raw: policy(['C4', 'A4']) })
}

async function startTrialWriter(page, token, label, candidate) {
  await page.evaluate(({ token, label, candidate, intro, lockName, policyKey, orderKey }) => {
    window.__r9aTrials ??= {}
    window.__r9aTrials[token] = navigator.locks.request(lockName, { mode: 'exclusive' }, () => {
      const parsed = JSON.parse(localStorage.getItem(policyKey) || '{"revision":1,"unlockedNotes":["C4","A4"]}')
      const included = new Set([...(parsed.unlockedNotes || []), ...candidate])
      const unlockedNotes = intro.filter(note => included.has(note))
      const order = JSON.parse(localStorage.getItem(orderKey) || '[]')
      order.push(label)
      localStorage.setItem(orderKey, JSON.stringify(order))
      localStorage.setItem(policyKey, JSON.stringify({ ...parsed, revision: 1, unlockedNotes }))
      return { label, unlockedNotes }
    })
  }, { token, label, candidate, intro: INTRO_ORDER, lockName: LOCK_NAME, policyKey: POLICY_KEY, orderKey: ORDER_KEY })
}

async function finishTrialWriter(page, token) {
  return page.evaluate(async token => {
    const result = await window.__r9aTrials[token]
    delete window.__r9aTrials[token]
    return result
  }, token)
}

async function runWebLockTrials(pageA, pageB) {
  const orders = { AB: 0, BA: 0 }
  for (let trial = 0; trial < 100; trial++) {
    const expected = trial < 50 ? ['A', 'B'] : ['B', 'A']
    const pages = expected[0] === 'A' ? [pageA, pageB] : [pageB, pageA]
    const labels = expected
    await setTrialBaseline(auxiliary)
    const holdLabel = `trial-${trial}`
    await holdLock(auxiliary, holdLabel)
    const firstToken = `${trial}-${labels[0]}`
    const secondToken = `${trial}-${labels[1]}`
    await startTrialWriter(pages[0], firstToken, labels[0], labels[0] === 'A' ? ['C4', 'A4', 'G4'] : ['C4', 'A4', 'E4'])
    await waitPendingLocks(auxiliary, 1)
    await startTrialWriter(pages[1], secondToken, labels[1], labels[1] === 'A' ? ['C4', 'A4', 'G4'] : ['C4', 'A4', 'E4'])
    await waitPendingLocks(auxiliary, 2)
    await releaseLock(auxiliary, holdLabel)
    await Promise.all([finishTrialWriter(pages[0], firstToken), finishTrialWriter(pages[1], secondToken)])
    const actual = await auxiliary.evaluate(({ policyKey, orderKey }) => ({
      record: JSON.parse(localStorage.getItem(policyKey) || '{}'),
      order: JSON.parse(localStorage.getItem(orderKey) || '[]'),
    }), { policyKey: POLICY_KEY, orderKey: ORDER_KEY })
    assert(JSON.stringify(actual.order) === JSON.stringify(expected),
      `trial ${trial} acquisition order ${JSON.stringify(actual.order)} != ${JSON.stringify(expected)}`)
    assert(JSON.stringify(actual.record.unlockedNotes) === JSON.stringify(['C4', 'A4', 'G4', 'E4']),
      `trial ${trial} lost the monotonic union: ${JSON.stringify(actual.record)}`)
    orders[expected.join('')] += 1
  }
  return orders
}

async function delayedInitialScenario(name, action) {
  const page = await context.newPage()
  watchPage(page, `delayed-${name}`)
  await freshMenu(page, { policyRaw: null })
  await holdLock(auxiliary, `delayed-${name}`)
  const startedAtMs = await page.evaluate(() => performance.now())
  await enterEarReadiness(page)
  await waitPendingLocks(auxiliary, 1)
  const before = await page.evaluate(key => ({
    policyRaw: localStorage.getItem(key),
    readiness: Boolean(document.querySelector('[data-retro-readiness]')),
  }), POLICY_KEY)
  assert(before.policyRaw === null && before.readiness, `${name}: delayed migration baseline is wrong`)
  const evidence = await action(page)
  await releaseLock(auxiliary, `delayed-${name}`)
  await auxiliary.waitForTimeout(250)
  const after = page.isClosed() ? { closed: true, policyRaw: await auxiliary.evaluate(key => localStorage.getItem(key), POLICY_KEY) } :
    await page.evaluate(key => ({
      closed: false,
      policyRaw: localStorage.getItem(key),
      menu: [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'INSERT COIN'),
      readiness: Boolean(document.querySelector('[data-retro-readiness]')),
      cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
      href: location.href,
    }), POLICY_KEY)
  let segment = null
  if (!page.isClosed()) segment = await stableSegment(page, startedAtMs)
  if (!page.isClosed()) await page.close()
  return { before, evidence, after, segment }
}

async function restoreExactStorage() {
  for (const [label, page] of [...activeHolds.entries()]) {
    try { await releaseLock(page, label) } catch {}
  }
  let page = auxiliary
  if (!page || page.isClosed()) {
    page = await context.newPage()
    watchPage(page, 'cleanup')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  }
  cleanup = await page.evaluate(async ({ lockName, policyKey, orderKey, policyRaw, orderRaw }) => navigator.locks.request(
    lockName,
    { mode: 'exclusive' },
    () => {
      const restore = (key, raw) => raw === null ? localStorage.removeItem(key) : localStorage.setItem(key, raw)
      restore(policyKey, policyRaw)
      restore(orderKey, orderRaw)
      return {
        policyRaw: localStorage.getItem(policyKey),
        orderRaw: localStorage.getItem(orderKey),
      }
    },
  ), { lockName: LOCK_NAME, policyKey: POLICY_KEY, orderKey: ORDER_KEY, policyRaw: originalPolicyRaw, orderRaw: originalOrderRaw })
  cleanup.exactPolicy = cleanup.policyRaw === originalPolicyRaw
  cleanup.exactOrder = cleanup.orderRaw === originalOrderRaw
  cleanup.zeroTestResidue = cleanup.exactPolicy && cleanup.exactOrder
  assert(cleanup.zeroTestResidue, `cleanup bytes drifted: ${JSON.stringify(cleanup)}`)
  return cleanup
}

try {
  const sourceHashes = Object.fromEntries(Object.entries(SOURCE_PATHS).map(([key, path]) => [key, sha256(path)]))
  assert(git('rev-parse', 'HEAD') === productSha, `HEAD is ${git('rev-parse', 'HEAD')}, expected ${productSha}`)
  assert(git('rev-parse', 'origin/master') === '2a773d5903d4558cee4c3b3c09a11659908cf575', 'origin/master base drifted')
  for (const [key, expected] of Object.entries(EXPECTED_HASHES)) {
    assert(sourceHashes[key] === expected, `${key} source hash ${sourceHashes[key]} != ${expected}`)
  }

  browser = await chromium.connectOverCDP(transport, { timeout: 60_000 })
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  })
  await context.addInitScript(initHarness)
  main = await context.newPage()
  auxiliary = await context.newPage()
  watchPage(main, 'main')
  watchPage(auxiliary, 'auxiliary')
  const [mainResponse, auxiliaryResponse] = await Promise.all([
    main.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }),
    auxiliary.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }),
  ])
  assert(mainResponse?.status() === 200 && auxiliaryResponse?.status() === 200, 'candidate route did not return 200 in both pages')
  const initial = await policySnapshot(auxiliary)
  originalPolicyRaw = initial.policyRaw
  originalOrderRaw = initial.orderRaw
  row('R9A-H01', 'exact candidate/server/route identity', {
    productSha,
    originMaster: git('rev-parse', 'origin/master'),
    url,
    statuses: [mainResponse.status(), auxiliaryResponse.status()],
    title: await main.title(),
    sourceHashes,
    browserLane: 'existing-helium-hawkeye-only',
    transport,
  })
  row('R9A-H02-SNAPSHOT', 'curriculum bytes snapshotted under the exact exclusive lock', {
    lockName: LOCK_NAME,
    policyKey: POLICY_KEY,
    policyRaw: originalPolicyRaw,
    orderRaw: originalOrderRaw,
  })

  const webLockStartedAt = await main.evaluate(() => performance.now())
  const webLockOrders = await runWebLockTrials(main, auxiliary)
  const webLockSegment = await stableSegment(main, webLockStartedAt)
  assert(webLockOrders.AB === 50 && webLockOrders.BA === 50, `forced-order coverage drifted: ${JSON.stringify(webLockOrders)}`)
  row('R9A-H03', 'two genuine Helium pages preserve the monotonic union in 100 forced Web Lock trials', {
    trials: 100,
    acquisitionOrders: webLockOrders,
    finalUnion: ['C4', 'A4', 'G4', 'E4'],
    segment: webLockSegment,
  })

  const normal = await delayedInitialScenario('normal', async page => {
    await passEarReadiness(page)
    return { gameplayReachedWhileWritePending: true }
  })
  assert(normal.after.cabinet && JSON.parse(normal.after.policyRaw).unlockedNotes.join(',') === 'C4,A4',
    `normal delayed migration did not commit inside gameplay: ${JSON.stringify(normal.after)}`)

  const cancelled = await delayedInitialScenario('cancel', async page => {
    await page.getByRole('button', { name: 'BACK TO MENU' }).click()
    await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
    return { cancelledToMenu: true }
  })
  assert(cancelled.after.menu && cancelled.after.policyRaw === null && !cancelled.after.readiness && !cancelled.after.cabinet,
    `cancelled migration resurrected: ${JSON.stringify(cancelled.after)}`)

  const quit = await delayedInitialScenario('quit', async page => {
    await passEarReadiness(page)
    await page.getByRole('button', { name: 'QUIT' }).click()
    await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
    return { quitToMenu: true }
  })
  assert(quit.after.menu && quit.after.policyRaw === null && !quit.after.cabinet,
    `QUIT migration resurrected: ${JSON.stringify(quit.after)}`)

  const routed = await delayedInitialScenario('route', async page => {
    const pushed = await page.evaluate(() => {
      if (!window.next?.router?.push) return false
      window.next.router.push('/pitch-defender')
      return true
    })
    assert(pushed, 'Next App Router was unavailable for route-exit proof')
    await page.waitForURL(current => current.pathname === '/pitch-defender', { timeout: 30_000 })
    return { routedTo: page.url() }
  })
  assert(routed.after.policyRaw === null && routed.after.href.endsWith('/pitch-defender') && !routed.after.readiness && !routed.after.cabinet,
    `route exit resurrected migration UI: ${JSON.stringify(routed.after)}`)

  const teardown = await delayedInitialScenario('teardown', async page => {
    await page.close()
    return { pageClosed: true }
  })
  assert(teardown.after.closed && teardown.after.policyRaw === null,
    `teardown allowed a late migration write: ${JSON.stringify(teardown.after)}`)
  row('R9A-H04', 'delayed initial migration survives gameplay and aborts across cancel, QUIT, route exit, and teardown', {
    normal, cancelled, quit, routed, teardown,
  })

  const controlRows = []
  for (const [name, notes, expectedCount, inertKeys] of [
    ['fresh-2', ['C4', 'A4'], 2, ['3', '4']],
    ['restored-3', ['C4', 'A4', 'G4'], 3, ['4']],
    ['restored-4', ['C4', 'A4', 'G4', 'E4'], 4, []],
    ['restored-6-cap', ['C4', 'A4', 'G4', 'E4', 'D4', 'F4'], 4, []],
  ]) {
    await freshMenu(main, { policyRaw: policy(notes) })
    await enterEarReadiness(main)
    const controls = await readinessControls(main)
    assert(controls.lane === 'ear' && controls.roster.length === expectedCount,
      `${name}: saw ${controls.roster.length} controls, expected ${expectedCount}`)
    assert(controls.roster.every(control => control.width >= 44 && control.height >= 44), `${name}: sub-44px control`)
    const keyReceipts = []
    for (const key of inertKeys) {
      const receipt = await dispatchReadinessKey(main, key)
      assert(receipt.dispatchResult && !receipt.defaultPrevented && receipt.readiness && receipt.controls === expectedCount,
        `${name}: absent key ${key} was not inert: ${JSON.stringify(receipt)}`)
      keyReceipts.push({ key, ...receipt })
    }
    controlRows.push({ name, notes, expectedCount, controls, keyReceipts })
    await main.getByRole('button', { name: 'BACK TO MENU' }).click()
  }
  row('R9A-H05', 'EAR RADIO CHECK exposes the exact 2/3/4 control matrix and absent keys stay inert', { controlRows })

  await freshMenu(main, { policyRaw: policy(['C4', 'A4']) })
  await enterEarReadiness(main)
  await passEarReadiness(main)
  await main.evaluate(() => window.__r9aResetTrace?.())
  const unlockStartedAt = await main.evaluate(() => performance.now())
  const answers = await answerUntil(main, async () => await main.locator('[data-retro-ceremony]').count() > 0, 24)
  await main.locator('[data-retro-ceremony]').waitFor({ timeout: 20_000 })
  const unlockReceipt = await main.evaluate(policyKey => ({
    policyRaw: localStorage.getItem(policyKey),
    trace: window.__r9aTrace,
    ceremonyNote: document.querySelector('[data-retro-ceremony]')?.getAttribute('data-ceremony-note'),
    status: document.querySelector('[data-retro-curriculum-status]')?.getAttribute('data-retro-curriculum-status') || null,
  }), POLICY_KEY)
  const policyWrite = unlockReceipt.trace.storageWrites.find(write => write.key === POLICY_KEY && write.value.includes('G4'))
  const ceremonyPaint = unlockReceipt.trace.ceremonies.find(ceremony => ceremony.note === 'G4')
  assert(policyWrite && ceremonyPaint && policyWrite.atMs < ceremonyPaint.atMs,
    `durable policy did not precede NEW SIGNAL paint: ${JSON.stringify({ policyWrite, ceremonyPaint })}`)
  assert(JSON.parse(unlockReceipt.policyRaw).unlockedNotes.join(',') === 'C4,A4,G4',
    `first uncovered unlock is not G4: ${unlockReceipt.policyRaw}`)
  await screenshot(main, '06-first-uncovered-new-signal.png')
  const unlockSegment = await stableSegment(main, unlockStartedAt)
  await main.reload({ waitUntil: 'networkidle', timeout: 60_000 })
  await main.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  await enterEarReadiness(main)
  const reloadControls = await readinessControls(main)
  assert(reloadControls.roster.length === 3 && reloadControls.roster.map(row => row.label).join('|') === 'C, key 1|A, key 2|G, key 3',
    `reload lost first-uncovered roster: ${JSON.stringify(reloadControls)}`)
  row('R9A-H06', 'first-uncovered G4 is durable before one NEW SIGNAL and survives reload', {
    answers,
    policyWrite,
    ceremonyPaint,
    policyRaw: unlockReceipt.policyRaw,
    reloadControls,
    segment: unlockSegment,
  })
  await main.getByRole('button', { name: 'BACK TO MENU' }).click()

  await freshMenu(main, { policyRaw: policy(['C4', 'A4']) })
  await enterEarReadiness(main)
  await passEarReadiness(main)
  await main.evaluate(() => {
    window.__r9aResetTrace?.()
    window.__r9aFailPolicyWrites = true
  })
  const failedStartedAt = await main.evaluate(() => performance.now())
  const failedAnswers = await answerUntil(main, async () => await main.locator('[data-retro-curriculum-status="save-paused"]').count() > 0, 12)
  const blocked = await main.evaluate(policyKey => ({
    policyRaw: localStorage.getItem(policyKey),
    status: document.querySelector('[data-retro-curriculum-status]')?.textContent?.trim() || null,
    cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
    failureCount: window.__r9aTrace.storageFailures.length,
  }), POLICY_KEY)
  assert(blocked.cabinet && blocked.failureCount >= 1 && blocked.status?.includes('KEEP PLAYING') &&
    JSON.parse(blocked.policyRaw).unlockedNotes.join(',') === 'C4,A4',
  `failed-write state was not non-modal/fail-closed: ${JSON.stringify(blocked)}`)
  await main.evaluate(() => { window.__r9aFailPolicyWrites = false })
  const recoveryAttack = await answerCorrect(main)
  await main.waitForFunction(policyKey => {
    const status = document.querySelector('[data-retro-curriculum-status]')
    const raw = localStorage.getItem(policyKey)
    try { return !status && JSON.parse(raw || '{}').unlockedNotes?.includes('G4') } catch { return false }
  }, POLICY_KEY, { timeout: 10_000, polling: 'raf' })
  const recovered = await main.evaluate(policyKey => ({
    policyRaw: localStorage.getItem(policyKey),
    status: document.querySelector('[data-retro-curriculum-status]')?.textContent?.trim() || null,
    cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
    writes: window.__r9aTrace.storageWrites.filter(write => write.key === policyKey),
  }), POLICY_KEY)
  assert(recovered.cabinet && recovered.status === null && JSON.parse(recovered.policyRaw).unlockedNotes.includes('G4'),
    `later success did not clear save-paused state: ${JSON.stringify(recovered)}`)
  await screenshot(main, '07-failed-write-recovered.png')
  const failedSegment = await stableSegment(main, failedStartedAt)
  row('R9A-H07', 'failed curriculum write is non-modal and a later unlock retry clears the status', {
    failedAnswers,
    blocked,
    recoveryAttack,
    recovered,
    segment: failedSegment,
  })

  await freshMenu(main, { policyRaw: policy(['C4', 'A4']) })
  await enterEarReadiness(main)
  await passEarReadiness(main)
  const replayStartedAt = await main.evaluate(() => performance.now())
  const replayAttack = (await waitForOutbound(main)).activeAttack
  const beforeSuspend = await main.evaluate(() => window.__r9aAudioSnapshot())
  assert(beforeSuspend.contextCount >= 1 && beforeSuspend.error === null, `audio instrumentation unavailable: ${JSON.stringify(beforeSuspend)}`)
  const suspendedStates = await main.evaluate(() => window.__r9aSuspendAudio())
  assert(suspendedStates.every(state => state === 'suspended'), `audio did not suspend: ${JSON.stringify(suspendedStates)}`)
  const suspended = await main.evaluate(() => window.__r9aAudioSnapshot())
  await main.keyboard.press('Space')
  await main.waitForFunction(before => {
    const audio = window.__r9aAudioSnapshot()
    return audio.resumeCalls > before.resumeCalls && audio.bufferStarts === before.bufferStarts + 1 &&
      audio.contextStates.some(state => state === 'running')
  }, suspended, { timeout: 5000, polling: 'raf' })
  const resumed = await main.evaluate(() => window.__r9aAudioSnapshot())
  assert(resumed.contextCount === suspended.contextCount && resumed.bufferStarts === suspended.bufferStarts + 1,
    `manual replay duplicated ownership/source: ${JSON.stringify({ suspended, resumed })}`)
  const replaySegment = await stableSegment(main, replayStartedAt)
  row('R9A-H09', 'manual player replay resumes suspended audio and starts exactly one piano source', {
    replayAttack,
    beforeSuspend,
    suspended,
    resumed,
    segment: replaySegment,
  })

  const responsive = []
  for (const [name, width, height] of [
    ['desktop-1280x800', 1280, 800],
    ['portrait-390x844', 390, 844],
    ['landscape-844x390', 844, 390],
    ['compact-640x400', 640, 400],
  ]) {
    await main.setViewportSize({ width, height })
    await main.waitForTimeout(100)
    const state = await main.evaluate(() => ({
      viewport: [innerWidth, innerHeight],
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      colorHintsLabel: [...document.querySelectorAll('button')].find(button => button.textContent?.includes('COLOR HINTS'))?.textContent?.trim() || null,
      responseButtons: [...document.querySelectorAll('[data-retro-response-button]')].map(button => {
        const rect = button.getBoundingClientRect()
        return { note: button.getAttribute('data-note'), width: rect.width, height: rect.height, left: rect.left, right: rect.right }
      }),
    }))
    assert(state.overflow <= 1 && state.reducedMotion && state.colorHintsLabel === 'COLOR HINTS OFF',
      `${name} accessibility/layout drift: ${JSON.stringify(state)}`)
    assert(state.responseButtons.every(button => button.width >= 44 && button.height >= 44 && button.left >= -1 && button.right <= width + 1),
      `${name} response control escaped or shrank: ${JSON.stringify(state.responseButtons)}`)
    responsive.push({ name, ...state })
    await screenshot(main, `11-${name}.png`)
  }
  await main.setViewportSize({ width: 1280, height: 800 })
  row('R9A-H11-LOCAL', 'candidate retains responsive, reduced-motion, color-off, and temporal coverage', {
    responsive,
    sustainedSegments: rows.flatMap(item => item.evidence?.segment ? [{ id: item.id, ...item.evidence.segment }] : []),
    inheritedGenuineZoom: 'required from exact-candidate R8c runner before release',
  })

  assert(pageErrors.length === 0, `page errors: ${JSON.stringify(pageErrors)}`)
  const restored = await restoreExactStorage()
  row('R9A-H02-RESTORE', 'exact pre-proof curriculum bytes restored with zero test residue', restored)
  verdict = 'PASS'
} catch (error) {
  rows.push({
    id: 'R9A-FAIL',
    contract: 'runner failure',
    verdict: 'FAIL',
    error: String(error?.stack || error),
  })
  console.error(String(error?.stack || error))
  process.exitCode = 1
} finally {
  if (context) {
    if (!cleanup) {
      try { await restoreExactStorage() } catch (error) {
        rows.push({ id: 'R9A-CLEANUP-FAIL', verdict: 'FAIL', error: String(error?.stack || error) })
        process.exitCode = 1
      }
    }
    if (pageErrors.length > 0) {
      rows.push({ id: 'R9A-PAGE-ERRORS', verdict: 'FAIL', evidence: pageErrors })
      verdict = 'FAIL'
      process.exitCode = 1
    }
  }
  const result = {
    verdict: process.exitCode ? 'FAIL' : verdict,
    schema: 'retro-blaster-r9a-helium/v1',
    browserLane: 'existing-helium-hawkeye-only',
    transport,
    url,
    productSha,
    pageErrors,
    cleanup,
    rows,
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  if (context) {
    let timer
    const closed = await Promise.race([
      context.close().then(() => true),
      new Promise(resolveClose => { timer = setTimeout(() => resolveClose(false), 15_000) }),
    ])
    clearTimeout(timer)
    if (!closed) console.error('R9a proof context close timed out; disconnecting only')
  }
  if (result.verdict === 'PASS') console.log(`PASS R9a Helium: ${rows.filter(item => item.verdict === 'PASS').length} named rows; 0 page errors; exact storage restored`)
  else console.error('R9a proof failed; Helium browser process remains running')
  process.exit(process.exitCode ?? 0)
}
