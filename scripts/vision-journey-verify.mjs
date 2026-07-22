/**
 * rb-vision-interactive fix-package acceptance — LIVE journey verification.
 * Drives Week-1-Day-1 on resetbiology.com as drmccrna (cookie-injected), recording video.
 *
 * Usage: node scripts/vision-journey-verify.mjs <chromium|webkit> <run1|run2> <cookiesJson> <outDir>
 *   run1 = happy path: guided measure (near all-correct, far flubbed at line 3) → confirm →
 *          DB assert → guided session → proof COMPLETE → report → complete day → persistence assert
 *   run2 = abort paths: old-trainer intro/exit, quick-check abort (nothing persisted),
 *          guided session with proof SKIP → report renders → complete day
 * Resets the drmccrna program at the start of each run (test account, self-owned data).
 */
import fs from 'node:fs'
import path from 'node:path'

const [,, browserName = 'chromium', runName = 'run1', cookiesPath, outDir] = process.argv
const pw = await import('@playwright/test')
const { devices } = pw
const engine = browserName === 'webkit' ? pw.webkit : pw.chromium

const BASE = 'https://resetbiology.com'
const shots = []
let step = 0
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`)
}

fs.mkdirSync(outDir, { recursive: true })
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'))

const browser = await engine.launch({ headless: true })
const context = await browser.newContext({
  ...devices['iPhone 13'],
  recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
})
await context.addCookies(cookies.map(c => ({ ...c, expires: c.expires > 0 ? Math.round(c.expires) : undefined })))
const page = await context.newPage()
page.setDefaultTimeout(20000)
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e)))

const shot = async (name) => {
  step++
  const p = path.join(outDir, `${String(step).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: p })
  shots.push(p)
}
const api = async (method, url, body) => {
  return await page.evaluate(async ({ method, url, body }) => {
    const isVisionProgram = new URL(url, location.origin).pathname === '/api/vision/program'
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const requestUrl = isVisionProgram && method === 'GET'
      ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams({ localDate, timeZone }).toString()}`
      : url
    const requestBody = isVisionProgram ? { localDate, timeZone, ...(body || {}) } : body
    const r = await fetch(requestUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    })
    const t = await r.text()
    try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, text: t.slice(0, 300) } }
  }, { method, url, body })
}
const tapText = async (text, exact = false) => {
  const loc = exact ? page.getByText(text, { exact: true }).first() : page.getByText(text).first()
  await loc.scrollIntoViewIfNeeded()
  await loc.tap()
}
const tapButton = async (re) => {
  const loc = page.getByRole('button', { name: re }).first()
  await loc.scrollIntoViewIfNeeded()
  await loc.tap()
}

// Answer the current tumbling-E round. correct=true taps the true direction, else a wrong one.
const answerRound = async (correct = true) => {
  const deg = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('.bg-white svg')]
    const svg = svgs[svgs.length - 1]
    if (!svg) return null
    const m = (svg.style.transform || '').match(/rotate\((\d+)deg\)/)
    return m ? Number(m[1]) : 0
  })
  if (deg === null) throw new Error('no tumbling-E svg found')
  const byDeg = { 0: 'Right', 90: 'Down', 180: 'Left', 270: 'Up' }
  const truth = byDeg[deg % 360] || 'Right'
  const wrong = truth === 'Up' ? 'Down' : 'Up'
  await page.getByRole('button', { name: new RegExp(`^${correct ? truth : wrong}$`) }).first().tap()
  await page.waitForTimeout(650) // feedback debounce (300-500ms) + state settle
}

// Complete one leg: pass `passLines` fully-correct lines, then flub the next line (3 wrong of 4+) unless passLines >= 7.
const runLeg = async (passLines) => {
  for (let line = 0; line < Math.min(passLines, 7); line++) {
    const count = await page.getByText(/^Line \d\/7$/).textContent().then(t => Number(t.match(/Line (\d)/)[1])).catch(() => line + 1)
    const letters = [3, 4, 5, 5, 6, 7, 8][count - 1]
    for (let i = 0; i < letters; i++) await answerRound(true)
  }
  if (passLines < 7) {
    const count = await page.getByText(/^Line \d\/7$/).textContent().then(t => Number(t.match(/Line (\d)/)[1]))
    const letters = [3, 4, 5, 5, 6, 7, 8][count - 1]
    for (let i = 0; i < letters; i++) await answerRound(false)
  }
  await page.getByRole('button', { name: /Continue/ }).first().waitFor()
}

try {
  // ---- setup: land authed, reset program, enroll fresh ----
  await page.goto(`${BASE}/vision-training`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const who = await api('GET', '/api/vision/program')
  ok('authenticated API access', who.status === 200, `status=${who.status}`)
  if (who.json?.enrolled) {
    const reset = await api('PATCH', '/api/vision/program', { action: 'reset_program' })
    ok('reset_program for fresh run', reset.status === 200, JSON.stringify(reset.json || reset.text))
  }
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Start 12-Week Program/ }).first().waitFor({ timeout: 25000 })
  await shot('pre-enroll')
  await tapButton(/Start 12-Week Program/)
  await page.getByText('Baseline Day').first().waitFor({ timeout: 25000 })
  ok('enrolled → Day 1 Baseline Day', true)
  await shot('day1-presession')

  if (runName === 'run2') {
    // ---- old-trainer safety courtesies (pre-session "Open Trainer") ----
    await tapText('Open Trainer')
    await page.waitForTimeout(1500)
    const introVisible = await page.getByText(/How to Train:|Distance Progression/).first().isVisible().catch(() => false)
    const timerRunning = await page.getByText(/0:0[2-9]|0:1\d/).first().isVisible().catch(() => false)
    ok('old trainer opens on intro (no auto-start)', introVisible && !timerRunning, `intro=${introVisible} timer=${timerRunning}`)
    await shot('old-trainer-intro')
    await page.getByRole('button', { name: /^Start$|Start Training/ }).first().tap()
    await page.waitForTimeout(1200)
    await shot('old-trainer-running')
    await page.getByRole('button', { name: /Exit/ }).first().tap()
    await page.waitForTimeout(1200)
    // Chunk A: Exit must return to the LESSON (pre-session view), not trainer settings
    const backAtLesson = await page.getByRole('button', { name: /Start Session/ }).first().isVisible().catch(() => false)
    ok('old trainer Exit returns to lesson (Chunk A)', backAtLesson)
    await shot('old-trainer-exit-back-at-lesson')
  }

  // ---- start session, skip warm-up ----
  await tapButton(/Start Session/)
  await page.waitForTimeout(1500)
  const warm = await page.getByRole('button', { name: /Skip warm-up/ }).first().isVisible().catch(() => false)
  if (warm) { await tapButton(/Skip warm-up/); await page.waitForTimeout(1200) }
  await page.getByText('Step 1: Snellen Baseline').first().waitFor()
  await shot('step1-baseline')

  // ---- guided quick check ----
  await tapButton(/Measure now/)
  await page.getByText(/Stop immediately if you feel pain/).first().waitFor()
  const noAutoRun = !(await page.getByText(/^Line \d\/7$/).first().isVisible().catch(() => false))
  ok('quick check opens on stop-rule intro, nothing auto-started', noAutoRun)
  await shot('quickcheck-intro-stoprule')

  if (runName === 'run2') {
    // abort mid-leg: nothing persists, dropdowns intact
    await page.getByRole('button', { name: /^Start$/ }).first().tap()
    await page.getByText(/^Line \d\/7$/).first().waitFor()
    await answerRound(true); await answerRound(true)
    await page.getByRole('button', { name: 'Exit measurement' }).tap()
    await page.getByText('Step 1: Snellen Baseline').first().waitFor()
    const after = await api('GET', '/api/vision/program')
    const e = after.json?.enrollment || {}
    ok('quick-check abort → zero persistence (Argus M)', e.currentNearSnellen == null && e.initialNearSnellen == null, `near=${e.currentNearSnellen}`)
    await shot('quickcheck-aborted-step1-intact')
  } else {
    // run1 happy path: near = all 7 lines correct (20/15), far = pass 2 lines then flub (20/50)
    await page.getByRole('button', { name: /^Start$/ }).first().tap()
    await page.getByText(/^Line \d\/7$/).first().waitFor()
    await shot('quickcheck-near-line1')
    await runLeg(7)
    await shot('quickcheck-near-result')
    await page.getByRole('button', { name: /Continue/ }).first().tap()
    await page.getByText(/Reposition for far vision/).waitFor()
    ok('reposition interstitial between legs (Argus L)', true)
    await shot('quickcheck-reposition')
    await page.getByRole('button', { name: /Ready — Continue|Ready/ }).first().tap()
    await page.getByText(/^Line \d\/7$/).first().waitFor()
    await runLeg(2)
    await shot('quickcheck-far-result')
    await page.getByRole('button', { name: /Continue/ }).first().tap()
    await page.getByText(/Your self-measured reading/).waitFor()
    const confirmTxt = await page.textContent('body')
    ok('confirm state shows near 20/15 + far 20/50 + proxy language (FLW M/§4.9)',
      confirmTxt.includes('20/15') && confirmTxt.includes('20/50') && confirmTxt.includes('Training-performance proxy'))
    await shot('quickcheck-confirm')
    await page.getByRole('button', { name: /Use these/ }).tap()
    await page.getByText('Step 1: Snellen Baseline').first().waitFor()
    await page.waitForTimeout(1500)
    const post = await api('GET', '/api/vision/program')
    const en = post.json?.enrollment || {}
    ok('DB: current near/far persisted', en.currentNearSnellen === '20/15' && en.currentFarSnellen === '20/50', `near=${en.currentNearSnellen} far=${en.currentFarSnellen}`)
    ok('DB: initial near/far seeded (additive update_baselines)', en.initialNearSnellen === '20/15' && en.initialFarSnellen === '20/50', `inear=${en.initialNearSnellen} ifar=${en.initialFarSnellen}`)
    const nearSel = await page.locator('select').first().inputValue().catch(() => '')
    ok('dropdowns prefilled from measure', nearSel === '20/15', `near select=${nearSel}`)
    await shot('step1-prefilled')
  }

  // ---- guided session: two engines early-finished, then proof stage ----
  await tapButton(/Continue to Exercises/)
  await page.getByRole('button', { name: /Start Guided Session/ }).first().waitFor()
  await tapButton(/Start Guided Session/)
  const begin = page.getByRole('button', { name: 'Begin Session' }).first()
  await begin.waitFor({ timeout: 20000 })
  await begin.tap()
  for (let ex = 0; ex < 2; ex++) {
    // engine mounts idle ("Ready when you are") — tap its Start, wait past the
    // 5s threshold that reveals Finish, early-finish. 45s waitFor rides out the
    // interlude between engines (auto-advances, no skip affordance).
    const engStart = page.getByRole('button', { name: /^Start$/ }).first()
    await engStart.waitFor({ timeout: 45000 })
    await engStart.tap()
    await page.waitForTimeout(8000)
    const finish = page.getByRole('button', { name: /^Finish$/ }).first()
    await finish.waitFor({ timeout: 20000 })
    await finish.tap()
    await page.waitForTimeout(2500)
  }
  // ---- proof stage (W0.5) ----
  await page.getByText(/quick vision check|Skip check|self-check/i).first().waitFor({ timeout: 30000 })
  await shot('proof-stage')
  const skipVisible = await page.getByRole('button', { name: /Skip check/ }).first().isVisible().catch(() => false)
  ok('proof stage reached with visible Skip (amendment 8)', skipVisible)

  if (runName === 'run2') {
    await page.getByRole('button', { name: /Skip check/ }).tap()
    await page.getByText(/Session score|Log & Finish|what you just did/i).first().waitFor({ timeout: 20000 })
    ok('proof SKIP → report renders (Argus L)', true)
    await shot('report-after-skip')
  } else {
    const startProof = page.getByRole('button', { name: /^Start$/ }).first()
    await startProof.waitFor()
    await startProof.tap()
    await page.getByText(/^Line \d\/7$/).first().waitFor()
    await runLeg(3) // pass 3 lines → 20/40, then flub line 4
    await page.getByRole('button', { name: /Continue/ }).first().tap()
    await page.getByText(/Your self-measured reading/).waitFor()
    await page.getByRole('button', { name: /Use these/ }).tap()
    await page.getByText(/Session score|Log & Finish|what you just did/i).first().waitFor({ timeout: 20000 })
    ok('proof COMPLETE → report renders', true)
    await shot('report-after-proof')
  }

  // ---- log & finish, complete day, persistence ----
  await tapButton(/Log & Finish|Log and Finish/)
  await page.waitForTimeout(2000)
  const completeBtn = page.getByRole('button', { name: /Complete Today's Session/ }).first()
  await completeBtn.waitFor({ timeout: 20000 })
  await completeBtn.tap()
  await page.waitForTimeout(3000)
  const fin = await api('GET', '/api/vision/program')
  ok('day completed + persisted', fin.json?.todaySession?.completed === true && fin.json?.enrollment?.sessionsCompleted === 1,
    `completed=${fin.json?.todaySession?.completed} sessions=${fin.json?.enrollment?.sessionsCompleted}`)
  await shot('day-complete')

  if (runName === 'run1') {
    const prog = await api('GET', '/api/vision/progress')
    const progStr = JSON.stringify(prog.json || {})
    ok('proof result persisted inside engineResults (FLW H3)', progStr.includes('snellen-proof') || progStr.includes('nearSnellenLine'),
      `progress len=${progStr.length}`)
  }

  ok('zero page errors across journey', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
} catch (err) {
  ok('JOURNEY ABORTED', false, String(err).slice(0, 300))
  await shot('failure-state')
} finally {
  await context.close() // flushes video
  await browser.close()
  const video = fs.readdirSync(outDir).find(f => f.endsWith('.webm'))
  const passCount = results.filter(r => r.pass).length
  console.log(`\n=== ${browserName}/${runName}: ${passCount}/${results.length} PASS · video=${video || 'NONE'} · shots=${shots.length} ===`)
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ browserName, runName, results, pageErrors }, null, 2))
  process.exit(results.every(r => r.pass) ? 0 : 1)
}
