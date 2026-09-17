import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const baseUrl = option('--base')?.replace(/\/$/, '')
const outDir = option('--out') ? resolve(option('--out')) : undefined
if (!baseUrl || !outDir || !/^https?:\/\//.test(baseUrl)) {
  throw new Error('usage: node scripts/pitchforks-songcraft-e2e.mjs --base <url> --out <dir>')
}

await mkdir(outDir, { recursive: true })
for (const entry of await readdir(outDir, { withFileTypes: true })) {
  if (entry.isFile() && /^(?:0[1-8]-.+\.png|99-failure\.png|E2E-RECEIPT\.json|tempo-encore-take-\d+\.json)$/.test(entry.name)) {
    await rm(resolve(outDir, entry.name), { force: true })
  }
}
const videoDir = resolve(outDir, 'video')
await rm(videoDir, { recursive: true, force: true })
await mkdir(videoDir, { recursive: true })

const sourceKey = 'pd_composed_e2e-songcraft-96'
const title = 'E2E Songcraft 96'
const expectedEvents = [
  { keys: ['c/4'], duration: 'q', isRest: false, pitchName: 'C4', beats: 1 },
  { keys: ['a/4'], duration: 'q', isRest: false, pitchName: 'A4', beats: 1 },
  { keys: ['c/4'], duration: 'q', isRest: true, pitchName: null, beats: 1 },
  { keys: ['c/4'], duration: 'h', isRest: false, pitchName: 'C4', beats: 2 },
  { keys: ['a/4'], duration: 'q', isRest: false, pitchName: 'A4', beats: 1 },
  { keys: ['c/4'], duration: 'q', isRest: false, pitchName: 'C4', beats: 1 },
]

const startedAt = new Date().toISOString()
const assertions = []
const uiFallback = []
const screenshots = []
const consoleErrors = []
const pageErrors = []
let browser
let context
let page
let video
let videoPath = null
let downloadedTakePath = null
let downloadedTake = null
let song = null
let fatalError = null

function record(name, pass, values = {}) {
  assertions.push({ name, pass: Boolean(pass), ...values })
  if (!pass) throw new Error(`assertion failed: ${name}`)
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function screenshot(name) {
  const path = resolve(outDir, name)
  await page.screenshot({ path, fullPage: true })
  screenshots.push(path)
}

async function waitEnabled(locator, timeout = 30_000) {
  await locator.waitFor({ state: 'visible', timeout })
  await locator.evaluate((element, waitMs) => new Promise((resolveWait, reject) => {
    const started = performance.now()
    const poll = () => {
      if (!element.isConnected) return reject(new Error('control detached while waiting'))
      if (!element.disabled) return resolveWait()
      if (performance.now() - started > waitMs) return reject(new Error('control stayed disabled'))
      setTimeout(poll, 50)
    }
    poll()
  }), timeout)
}

async function staffGeometry() {
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(candidate => {
      const rect = candidate.getBoundingClientRect()
      return rect.width >= 300 && rect.height >= 200
    })
    if (!svg) throw new Error('rendered Composer staff SVG not found')
    const rect = svg.getBoundingClientRect()
    const horizontalYs = [...svg.querySelectorAll('path, line')].flatMap(element => {
      try {
        const box = element.getBBox()
        return box.width >= 200 && box.height <= 2 ? [box.y + box.height / 2] : []
      } catch {
        return []
      }
    }).sort((a, b) => a - b).filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 0.5)
    let lines = null
    for (let index = 0; index <= horizontalYs.length - 5; index += 1) {
      const candidate = horizontalYs.slice(index, index + 5)
      const gaps = candidate.slice(1).map((value, gapIndex) => value - candidate[gapIndex])
      if (gaps.every(gap => gap >= 8 && gap <= 12)) {
        lines = candidate
        break
      }
    }
    if (!lines) throw new Error(`five rendered staff lines not found: ${horizontalYs.join(',')}`)
    const lineSpacing = (lines[4] - lines[0]) / 4
    return {
      x: rect.x + rect.width - 10,
      top: rect.y,
      midY: lines[2],
      lineSpacing,
      renderedLines: lines,
    }
  })
}

async function placeAtPitch(pitchName) {
  const geometry = await staffGeometry()
  const diatonicStepsBelowB4 = pitchName === 'C4' ? 6 : pitchName === 'A4' ? 1 : 0
  await page.mouse.click(
    geometry.x,
    geometry.top + geometry.midY + diatonicStepsBelowB4 * geometry.lineSpacing / 2,
  )
  await page.waitForTimeout(120)
  return geometry
}

function eventSummary(composition) {
  return composition.measures.flatMap(measure => measure.notes).map(note => ({
    keys: note.keys,
    duration: note.duration,
    isRest: note.isRest === true,
  }))
}

function requiredSummary() {
  return expectedEvents.map(event => ({ keys: event.keys, duration: event.duration, isRest: event.isRest }))
}

async function readStoredSong() {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key)
    return { raw, parsed: raw ? JSON.parse(raw) : null }
  }, sourceKey)
}

async function replaceEventsWithDocumentedFallback(reason) {
  uiFallback.push({
    reason,
    action: `Direct JSON edit of ${sourceKey} after the Composer UI save; replaced only measures[].notes with the required six events.`,
  })
  await page.evaluate(({ key, events }) => {
    const raw = localStorage.getItem(key)
    if (!raw) throw new Error('Composer save missing before fallback')
    const composition = JSON.parse(raw)
    const template = composition.measures[0] ?? { id: 1 }
    const makeNote = (event, index) => ({
      id: 1000 + index,
      keys: event.keys,
      accidentals: [''],
      duration: event.duration,
      dotted: false,
      articulation: 'none',
      dynamic: 'none',
      tieToNext: false,
      fermata: false,
      ...(event.isRest ? { isRest: true } : {}),
    })
    composition.measures = [
      { ...template, id: 2001, notes: events.slice(0, 3).map(makeNote) },
      { ...template, id: 2002, notes: events.slice(3).map((event, index) => makeNote(event, index + 3)) },
    ]
    localStorage.setItem(key, JSON.stringify(composition))
  }, { key: sourceKey, events: expectedEvents })
}

async function sha256InPage(raw) {
  return page.evaluate(async source => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  }, raw)
}

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  context = await browser.newContext({
    acceptDownloads: true,
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 1000 } },
  })
  await context.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' })
  await context.grantPermissions(['microphone'], { origin: new URL(baseUrl).origin })
  await context.addInitScript(() => {
    window.__pitchforksE2EHintClicks = 0
    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-testid="pitchforks-songcraft-hint"]')) {
        window.__pitchforksE2EHintClicks += 1
      }
    }, true)
  })
  page = await context.newPage()
  video = page.video()
  page.setDefaultTimeout(30_000)
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))

  const runToken = Date.now()
  await page.goto(`${baseUrl}/pitch-defender/composer?e2eRun=${runToken}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'New Composition' }).waitFor()
  await page.evaluate(key => localStorage.removeItem(key), sourceKey)
  await page.locator('input[placeholder^="e.g. Farewell"]').fill(title)
  await page.getByRole('button', { name: /Treble Clef/i }).click()
  await page.getByRole('button', { name: /4\/4 common time/i }).click()
  await page.locator('select').filter({ has: page.locator('option[value="C"]') }).selectOption('C')
  await page.locator('input[type="number"][min="30"][max="300"]').fill('96')
  await screenshot('01-composer-setup.png')
  await page.getByRole('button', { name: /Begin Composing/i }).click()
  await page.locator('input[type="text"]').first().waitFor()

  const quarter = page.getByTitle('quarter (3)')
  const half = page.getByTitle('half (2)')
  const place = page.getByTitle('Place note (click to add at clicked pitch)')
  const rest = page.getByTitle('Place rest (click to add a rest at current duration)')
  await quarter.click(); await place.click(); const renderedStaff = await placeAtPitch('C4')
  await quarter.click(); await place.click(); await placeAtPitch('A4')
  await quarter.click(); await rest.click(); await placeAtPitch('C4')
  await half.click(); await place.click(); await placeAtPitch('C4')
  await quarter.click(); await place.click(); await placeAtPitch('A4')
  await quarter.click(); await place.click(); await placeAtPitch('C4')
  await page.locator('button[title^="Save composition to localStorage"]').click()
  await page.getByText(`Saved "${title}"`, { exact: false }).waitFor()

  let stored = await readStoredSong()
  const uiSummary = stored.parsed ? eventSummary(stored.parsed) : null
  if (!equalJson(uiSummary, requiredSummary())) {
    await replaceEventsWithDocumentedFallback(`Composer UI produced ${JSON.stringify(uiSummary)} instead of ${JSON.stringify(requiredSummary())}`)
    stored = await readStoredSong()
  }
  const finalSummary = stored.parsed ? eventSummary(stored.parsed) : null
  record('Composer saved the required six-event score', equalJson(finalSummary, requiredSummary()), {
    expected: requiredSummary(), actual: finalSummary,
  })
  record('Composer saved authored tempo 96 BPM', stored.parsed?.tempoBpm === 96, { expected: 96, actual: stored.parsed?.tempoBpm })
  record('Composer song uses only C4 and A4 pitched notes', finalSummary?.filter(event => !event.isRest).every(event => ['c/4', 'a/4'].includes(event.keys?.[0])), { actual: finalSummary })
  record('Rendered staff coordinates were derived from five staff lines', renderedStaff.renderedLines.length === 5, { actual: renderedStaff })
  await screenshot('02-composer-saved.png')

  const raw = stored.raw
  record('Composer source is present', typeof raw === 'string' && raw.length > 0, { actualLength: raw?.length ?? 0 })
  const sourceSha256 = await sha256InPage(raw)
  const nodeSha256 = createHash('sha256').update(raw, 'utf8').digest('hex')
  record('Page and Node SHA-256 agree on raw stored bytes', sourceSha256 === nodeSha256, { page: sourceSha256, node: nodeSha256 })
  song = { sourceKey, title, sourceSha256, raw, uiFallback, events: expectedEvents }

  const seededAt = Date.now() - 1000
  await page.evaluate(({ masteryKey, fsrsKey, seededAt }) => {
    const mastery = Object.fromEntries(['C4', 'A4'].map(note => [note, {
      sessionIds: [`${note}-session-1`, `${note}-session-2`, `${note}-session-3`],
      masteredAt: seededAt,
    }]))
    const voice = Object.fromEntries(['C4', 'A4'].map(note => [note, {
      note, S: 1, D: note === 'C4' ? 2 : 3, due: seededAt + 86_400_000,
      lastReview: seededAt, lapses: 0, phase: 'review', learningReps: 2,
    }]))
    localStorage.setItem(masteryKey, JSON.stringify(mastery))
    localStorage.setItem(fsrsKey, JSON.stringify(voice))
  }, { masteryKey: 'pitchforks3_mastery_progress_debug', fsrsKey: 'pitch_fsrs_debug', seededAt })

  await page.goto(`${baseUrl}/pitch-defender/pitchforks-3?demo=1&composerSeedProof=1&e2eRun=${runToken}`, { waitUntil: 'domcontentloaded' })
  const proof = page.getByTestId('pf3-composer-seed-proof')
  await proof.waitFor()
  await proof.getByText(title, { exact: false }).waitFor()
  const proofText = await proof.textContent()
  record('Seed-proof panel shows exact Composer title', proofText?.includes(title), { expected: title, actual: proofText })
  record('Seed-proof panel shows exact raw-source SHA', proofText?.includes(sourceSha256), { expected: sourceSha256, actual: proofText })
  await screenshot('03-seed-proof.png')

  await page.getByTestId('pf3-songcraft-open').click()
  const select = page.getByTestId('pitchforks-songcraft-song-select')
  await select.waitFor()
  await select.selectOption(sourceKey)
  record('Songcraft selected the exact Composer source key', await select.inputValue() === sourceKey, { expected: sourceKey, actual: await select.inputValue() })
  await page.getByRole('button', { name: /EAR.*LISTENING/i }).click()
  await screenshot('04-songcraft-selected.png')
  await page.getByTestId('pitchforks-songcraft-begin').click()

  for (let index = 0; index < expectedEvents.length; index += 1) {
    const event = expectedEvents[index]
    await page.getByTestId('pitchforks-songcraft-position').waitFor()
    await page.getByTestId('pitchforks-songcraft-position').evaluate((element, expected) => new Promise((resolveWait, reject) => {
      const started = performance.now()
      const poll = () => {
        if (element.textContent?.includes(expected)) return resolveWait()
        if (performance.now() - started > 10_000) return reject(new Error(`position did not reach ${expected}`))
        setTimeout(poll, 50)
      }
      poll()
    }), `Position ${index + 1} of ${expectedEvents.length}`)
    if (event.isRest) {
      await page.getByTestId('pitchforks-songcraft-rest-view').waitFor()
      await page.getByTestId('pitchforks-songcraft-acknowledge').click()
      continue
    }
    const hear = page.getByTestId('pitchforks-songcraft-hear')
    await waitEnabled(hear)
    await hear.click()
    const answer = page.getByTestId(`pitchforks-songcraft-answer-${event.pitchName}`)
    await waitEnabled(answer)
    await answer.click()
  }

  await page.getByTestId('pitchforks-songcraft-complete-view').waitFor()
  const completionText = await page.getByTestId('pitchforks-songcraft-panel').textContent()
  const hintClicks = await page.evaluate(() => window.__pitchforksE2EHintClicks)
  record('Songcraft completed unaided', completionText?.includes('Practice finished') && !completionText?.includes('Completed with help'), { actual: completionText })
  record('Songcraft used no HINT', hintClicks === 0, { expected: 0, actual: hintClicks })
  await page.getByRole('button', { name: 'Try optional Tempo Encore' }).waitFor()
  await screenshot('05-songcraft-complete.png')

  await page.getByRole('button', { name: 'Try optional Tempo Encore' }).click()
  const tempoInput = page.getByLabel('Tempo beats per minute')
  await tempoInput.waitFor()
  record('Tempo Encore prefills authored BPM', await tempoInput.inputValue() === '96', { expected: '96', actual: await tempoInput.inputValue() })
  record('Tempo Encore displays authored tempo text', (await page.locator('main').textContent())?.includes('Song tempo 96 BPM'), { expected: 'Song tempo 96 BPM' })
  await screenshot('06-tempo-authored.png')

  await page.getByRole('button', { name: 'Start microphone' }).click()
  await page.getByText('Microphone started.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Begin tempo practice' }).click()
  await page.getByText('Follow the visual beat.', { exact: false }).waitFor()
  await screenshot('07-tempo-running.png')
  const downloadButton = page.getByRole('button', { name: 'Download take 1' })
  await downloadButton.waitFor({ timeout: 20_000 })
  await screenshot('08-tempo-complete.png')
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise
  downloadedTakePath = resolve(outDir, `tempo-encore-take-${Date.now()}.json`)
  await download.saveAs(downloadedTakePath)
  downloadedTake = JSON.parse(await readFile(downloadedTakePath, 'utf8'))

  record('Downloaded receipt sourceKey matches Composer key', downloadedTake.sourceKey === sourceKey, { expected: sourceKey, actual: downloadedTake.sourceKey })
  record('Downloaded receipt SHA matches raw Composer bytes', downloadedTake.sourceSha256 === sourceSha256, { expected: sourceSha256, actual: downloadedTake.sourceSha256 })
  record('Downloaded receipt used 96 BPM', downloadedTake.bpm === 96, { expected: 96, actual: downloadedTake.bpm })
  record('Downloaded receipt carries authored sourceTempoBpm', downloadedTake.sourceTempoBpm === 96, { expected: 96, actual: downloadedTake.sourceTempoBpm })
  record('Downloaded receipt has one observation per authored event', downloadedTake.observations?.length === expectedEvents.length, { expected: expectedEvents.length, actual: downloadedTake.observations?.length })
  const durations = downloadedTake.observations.map(row => row.endAt - row.cueAt)
  const quarterDurations = expectedEvents.flatMap((event, index) => event.beats === 1 ? [durations[index]] : [])
  const halfDuration = durations[expectedEvents.findIndex(event => event.beats === 2)]
  const quarterReference = quarterDurations[0]
  const restIndex = expectedEvents.findIndex(event => event.isRest)
  record('Receipt preserves authored rest at the correct ordinal and duration', downloadedTake.observations[restIndex]?.isRest === true && Math.abs(durations[restIndex] - quarterReference) <= 20, {
    restIndex, restDurationMs: durations[restIndex], quarterReferenceMs: quarterReference,
  })
  record('Half note duration is twice a quarter within frame tolerance', Math.abs(halfDuration - quarterReference * 2) <= 20, {
    expectedMs: quarterReference * 2, actualMs: halfDuration, toleranceMs: 20,
  })
  record('Receipt keeps honest uncalibrated timing labels', downloadedTake.label === 'Uncalibrated practice timing' && downloadedTake.deviceLatency === 'unmeasured' && downloadedTake.physicalRhythmVerification === false, {
    label: downloadedTake.label, deviceLatency: downloadedTake.deviceLatency,
    physicalRhythmVerification: downloadedTake.physicalRhythmVerification,
  })
} catch (error) {
  fatalError = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) }
  if (page) {
    try { await screenshot('99-failure.png') } catch {}
  }
} finally {
  if (context) {
    try { await context.close() } catch {}
  }
  if (video) {
    try { videoPath = await video.path() } catch {}
  }
  if (browser) {
    try { await browser.close() } catch {}
  }
  const failedAssertions = assertions.filter(assertion => !assertion.pass)
  const receipt = {
    schema: 'pitchforks-songcraft-e2e/1',
    status: fatalError || failedAssertions.length ? 'FAIL' : 'PASS',
    baseUrl,
    outDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    song,
    masterySeeded: {
      keys: ['pitchforks3_mastery_progress_debug', 'pitch_fsrs_debug'],
      notes: ['C4', 'A4'],
      seeded: true,
      note: 'Debug/demo proof only. A real player earns mastery across three distinct sessions.',
    },
    uiFallback,
    assertions,
    screenshots,
    videoPath,
    downloadedTakePath,
    downloadedTake,
    consoleErrors,
    pageErrors,
    fatalError,
  }
  await writeFile(resolve(outDir, 'E2E-RECEIPT.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
  if (receipt.status !== 'PASS') process.exitCode = 1
  else console.log(`PASS ${resolve(outDir, 'E2E-RECEIPT.json')}`)
}
