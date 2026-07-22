// FLW declare-complete HIGH receipt: after SnellenQuickCheck mount-scroll settles,
// Start AND the abort X must be unobstructed (elementFromPoint hit-test, not just
// boundingRect), X tap must return to Step 1, and abort must persist nothing.
// Usage: node scripts/abort-visibility-probe.mjs <chromium|webkit> <cookiesJson> <shotPath>
import fs from 'node:fs'
const [,, browserName = 'chromium', cookiesPath, shotPath] = process.argv
const pw = await import('@playwright/test')
const engine = browserName === 'webkit' ? pw.webkit : pw.chromium
const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'))
const browser = await engine.launch({ headless: true })
const ctx = await browser.newContext({ ...pw.devices['iPhone 13'] })
await ctx.addCookies(cookies.map(c => ({ ...c, expires: c.expires > 0 ? Math.round(c.expires) : undefined })))
const page = await ctx.newPage()
page.setDefaultTimeout(25000)
const visionProgramApi = (method, body) => page.evaluate(async ({ method, body }) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const url = method === 'GET'
    ? `/api/vision/program?${new URLSearchParams({ localDate, timeZone }).toString()}`
    : '/api/vision/program'
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify({ localDate, timeZone, ...(body || {}) }),
  })
  return r.json()
}, { method, body })
await page.goto('https://resetbiology.com/vision-training', { waitUntil: 'commit', timeout: 60000 })
await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await visionProgramApi('PATCH', { action: 'reset_program' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /Start 12-Week Program/ }).first().tap()
await page.getByText('Baseline Day').first().waitFor()
await page.getByRole('button', { name: /Start Session/ }).first().tap()
await page.waitForTimeout(1200)
const warm = page.getByRole('button', { name: /Skip warm-up/ }).first()
if (await warm.isVisible().catch(() => false)) await warm.tap()
await page.getByRole('button', { name: /Measure now/ }).first().tap()
await page.waitForTimeout(1000)
const hit = await page.evaluate(() => {
  const test = (el) => {
    if (!el) return { found: false }
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const top = document.elementFromPoint(cx, cy)
    return { found: true, inView: r.top >= 0 && r.bottom <= innerHeight, unobstructed: el === top || el.contains(top), topEl: top ? `${top.tagName}.${String(top.className).slice(0, 40)}` : null, cy: Math.round(cy) }
  }
  const btns = [...document.querySelectorAll('button')]
  return {
    scrollY: Math.round(scrollY), vh: innerHeight,
    x: test(btns.find(b => b.getAttribute('aria-label') === 'Exit measurement')),
    start: test(btns.find(b => b.textContent.trim() === 'Start')),
  }
})
if (shotPath) await page.screenshot({ path: shotPath })
// tap the X for real → must land back on Step 1 with nothing persisted
await page.getByRole('button', { name: 'Exit measurement' }).tap()
await page.getByText('Step 1: Snellen Baseline').first().waitFor()
const after = await visionProgramApi('GET')
const abortClean = after?.enrollment?.currentNearSnellen == null && after?.enrollment?.initialNearSnellen == null
console.log(JSON.stringify({ browserName, ...hit, xTapReturnsToStep1: true, abortZeroPersistence: abortClean }))
await browser.close()
process.exit(hit.x.unobstructed && hit.x.inView && hit.start.unobstructed && hit.start.inView && abortClean ? 0 : 1)
