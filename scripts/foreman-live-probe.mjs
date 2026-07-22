/**
 * Live probes for foreman run 2026-07-15-adf3 (tester bypass + GaborAcuityEngine), on prod.
 * Usage: node scripts/foreman-live-probe.mjs <chromium|webkit> <tester|gabor> <cookiesJson> <outDir>
 * Gabor ground truth comes from canvas PIXELS: stripe orientation = direction of min
 * luminance change; Michelson contrast = (max-min)/(max+min) — no DOM trust.
 */
import fs from 'node:fs'
import path from 'node:path'
const [,, browserName = 'chromium', scenario = 'tester', cookiesPath, outDir] = process.argv
const pw = await import('@playwright/test')
const engine = browserName === 'webkit' ? pw.webkit : pw.chromium
const BASE = 'https://resetbiology.com'
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`) }
fs.mkdirSync(outDir, { recursive: true })
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'))
const browser = await engine.launch({ headless: true })
const context = await browser.newContext({ ...pw.devices['iPhone 13'], recordVideo: { dir: outDir } })
await context.addCookies(cookies.map(c => ({ ...c, expires: c.expires > 0 ? Math.round(c.expires) : undefined })))
const page = await context.newPage()
page.setDefaultTimeout(30000)
const pageErrors = []
page.on('pageerror', e => pageErrors.push(String(e)))
let step = 0
const shot = async (n) => { step++; await page.screenshot({ path: path.join(outDir, `${String(step).padStart(2, '0')}-${n}.png`) }) }
const api = (method, url, body) => page.evaluate(async ({ method, url, body }) => {
  const isVisionProgram = new URL(url, location.origin).pathname === '/api/vision/program'
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const requestUrl = isVisionProgram && method === 'GET'
    ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams({ localDate, timeZone }).toString()}`
    : url
  const requestBody = isVisionProgram ? { localDate, timeZone, ...(body || {}) } : body
  const r = await fetch(requestUrl, { method, headers: { 'Content-Type': 'application/json' }, body: requestBody ? JSON.stringify(requestBody) : undefined })
  const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status } }
}, { method, url, body })

// pixel truth: orientation (0|45|90|135 → button aria) + Michelson contrast of the gabor canvas
const readPatch = () => page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')]
  const cv = canvases[canvases.length - 1]
  if (!cv) return null
  const ctx = cv.getContext('2d')
  const w = cv.width, h = cv.height
  const d = ctx.getImageData(0, 0, w, h).data
  const lum = (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3
  const dirs = { 0: [0, 1], 90: [1, 0], 45: [1, -1 / Math.SQRT2 * Math.SQRT2], 135: [1, 1] } // screen-space step per angle's STRIPE direction
  // stripe direction for theta: perpendicular to (cosT, sinT) in y-down = (-sinT, cosT); sample |Δlum| along each candidate stripe direction
  const cand = [
    { ang: 0, vx: 0, vy: 1 },          // vertical stripes: constant along y
    { ang: 90, vx: 1, vy: 0 },         // horizontal stripes: constant along x
    { ang: 45, vx: 1, vy: -1 },        // "/" rising: constant along up-right
    { ang: 135, vx: 1, vy: 1 },        // "\" falling: constant along down-right
  ]
  let best = null
  for (const c of cand) {
    const n = Math.hypot(c.vx, c.vy); const ux = c.vx / n, uy = c.vy / n
    let acc = 0, cnt = 0
    for (let t = -R; t < R; t += 2) { const a = lum(cx + ux * t, cy + uy * t), b = lum(cx + ux * (t + 2), cy + uy * (t + 2)); acc += Math.abs(a - b); cnt++ }
    const mean = acc / cnt
    if (!best || mean < best.mean) best = { ang: c.ang, mean }
  }
  let mx = 0, mn = 255
  for (let t = -R; t < R; t += 1) for (const [ux, uy] of [[1, 0], [0, 1]]) { const L = lum(cx + ux * t, cy + uy * t); if (L > mx) mx = L; if (L < mn) mn = L }
  const contrast = (mx - mn) / Math.max(1, mx + mn)
  return { ang: best.ang, contrast: Math.round(contrast * 1000) / 10 }
})
const ARIA = { 0: 'Vertical', 90: 'Horizontal', 45: 'Diagonal rising /', 135: 'Diagonal falling \\' }

try {
  await page.goto(`${BASE}/vision-training`, { waitUntil: 'commit', timeout: 60000 })
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)

  if (scenario === 'tester') {
    const pre = await api('GET', '/api/vision/program')
    ok('isTester=true for drmccrna (allowlist)', pre.json?.isTester === true, `isTester=${pre.json?.isTester}`)
    if (pre.json?.enrolled) { await api('PATCH', '/api/vision/program', { action: 'reset_program' }) }
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
    await page.getByRole('button', { name: /Start 12-Week Program/ }).first().tap()
    await page.getByText('Baseline Day').first().waitFor()
    await page.getByRole('button', { name: /Start Session/ }).first().tap(); await page.waitForTimeout(1200)
    const warm = page.getByRole('button', { name: /Skip warm-up/ }).first()
    if (await warm.isVisible().catch(() => false)) await warm.tap()
    await page.getByRole('button', { name: /Continue to Exercises/ }).first().tap()
    await page.getByRole('button', { name: /Start Guided Session/ }).first().tap()
    const begin = page.getByRole('button', { name: 'Begin Session' }).first(); await begin.waitFor(); await begin.tap()
    for (let ex = 0; ex < 2; ex++) {
      const st = page.getByRole('button', { name: /^Start$/ }).first(); await st.waitFor({ timeout: 45000 }); await st.tap()
      await page.waitForTimeout(8000)
      const fin = page.getByRole('button', { name: /^Finish$/ }).first(); await fin.waitFor({ timeout: 20000 }); await fin.tap()
      await page.waitForTimeout(2500)
    }
    await page.getByRole('button', { name: /Skip check/ }).first().tap()
    await page.getByRole('button', { name: /Log & Finish|Log and Finish/ }).first().tap(); await page.waitForTimeout(2000)
    const comp = page.getByRole('button', { name: /Complete Today's Session/ }).first(); await comp.waitFor(); await comp.tap(); await page.waitForTimeout(3000)
    const btn = page.getByRole('button', { name: /TESTER · Jump to next session/ }).first()
    ok('TESTER button on Session-Complete card', await btn.isVisible().catch(() => false))
    await shot('tester-button')
    await btn.tap(); await page.waitForTimeout(3000)
    const after = await api('GET', '/api/vision/program')
    ok('advance_day → Week1 Day2 (trainable)', after.json?.todaySession?.week === 1 && after.json?.todaySession?.day === 2 && !after.json?.todaySession?.completed, `w=${after.json?.todaySession?.week} d=${after.json?.todaySession?.day}`)
    const dbl = await api('PATCH', '/api/vision/program', { action: 'advance_day' })
    ok('immediate re-advance → 409 guard', dbl.status === 409, `status=${dbl.status}`)
    const rst = await api('PATCH', '/api/vision/program', { action: 'reset_test_cursor' })
    const post = await api('GET', '/api/vision/program')
    ok('reset_test_cursor → back to real today (Day1 completed)', rst.status === 200 && post.json?.todaySession?.day === 1 && post.json?.todaySession?.completed === true, `d=${post.json?.todaySession?.day} completed=${post.json?.todaySession?.completed}`)
    await shot('after-reset-cursor')
  }

  if (scenario === 'gabor') {
    // Focus Training tab hosts QuickPractice? Gabor lives in exercise surfaces — use Vision Library tab
    await page.locator('button:visible').filter({ hasText: 'Vision Library' }).first().tap(); await page.waitForTimeout(2000)
    // the exercise card itself is the launch affordance (QuickPractice onSelect) —
    // tap the card's clickable element containing the exact title; never a generic Start
    // (a generic /^Start$/ fallback previously launched the PRE-EXISTING GaborTraining hero)
    const card = page.locator('button:visible, [class*=cursor-pointer]:visible').filter({ hasText: 'Gabor Contrast Trainer' }).last()
    await card.scrollIntoViewIfNeeded(); await card.tap(); await page.waitForTimeout(2000)
    ok('intro shows stop-rule, nothing auto-running', await page.getByText(/Stop immediately|stop now/i).first().isVisible().catch(() => false))
    await shot('gabor-intro')
    await page.getByRole('button', { name: /^Start$/ }).first().tap(); await page.waitForTimeout(1500)
    const contrasts = []
    let answered = 0
    for (let trial = 0; trial < 8; trial++) {
      await page.waitForTimeout(700)
      const patch = await readPatch()
      if (!patch) break
      contrasts.push(patch.contrast)
      const btnA = page.getByRole('button', { name: ARIA[patch.ang], exact: true }).first()
      if (!(await btnA.isVisible().catch(() => false))) break
      await btnA.tap(); answered++
      await page.waitForTimeout(900)
    }
    ok('answered ≥6 pixel-derived trials (glyph pairing holds live)', answered >= 6, `answered=${answered}`)
    const head = contrasts.slice(0, 2).reduce((a, b) => a + b, 0) / 2
    const tail = contrasts.slice(-2).reduce((a, b) => a + b, 0) / 2
    ok('staircase descends on correct answers (pixel contrast drops)', contrasts.length >= 6 && tail < head, `contrasts=${contrasts.join(',')}`)
    await shot('gabor-mid-staircase')
    // abort mid-trial: X → back out, nothing persisted (QuickPractice keeps results local; assert no crash + list restored)
    await page.getByRole('button', { name: /Exit exercise|Exit/ }).first().tap(); await page.waitForTimeout(1500)
    ok('abort mid-trial returns to library cleanly', await page.getByText(/Gabor Contrast Trainer/).first().isVisible().catch(() => false))
    await shot('gabor-aborted-back')
  }
  ok('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join('|'))
} catch (err) {
  ok('PROBE ABORTED', false, String(err).slice(0, 250)); await shot('failure')
} finally {
  await context.close(); await browser.close()
  const passN = results.filter(r => r.pass).length
  console.log(`=== ${browserName}/${scenario}: ${passN}/${results.length} PASS ===`)
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ browserName, scenario, results, pageErrors }, null, 2))
  process.exit(results.every(r => r.pass) ? 0 : 1)
}
