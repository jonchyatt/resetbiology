// Passwordless login to resetbiology.com as jonchyatt@gmail.com; OTP read via gws gmail.
// Saves storage-state cookies to argv[2]. Usage: node scripts/rb-login-jon.mjs <outCookiesJson>
import { execSync } from 'node:child_process'
import fs from 'node:fs'
const out = process.argv[2]
const pw = await import('@playwright/test')
const b = await pw.chromium.launch({ headless: true })
const ctx = await b.newContext({ ...pw.devices['iPhone 13'] })
const page = await ctx.newPage()
page.setDefaultTimeout(45000)
const t0 = Date.now()
await page.goto('https://resetbiology.com/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
console.log('login page:', page.url())
const email = page.locator('input[type="email"], input[name="username"], input[name="email"]').first()
await email.waitFor()
await email.fill('jonchyatt@gmail.com')
await page.getByRole('button', { name: /continue|send|log in|submit/i }).first().click()
console.log('email submitted; waiting for OTP email...')
// poll gmail for the newest OTP (message newer than t0)
let code = null
for (let i = 0; i < 24 && !code; i++) {
  await page.waitForTimeout(5000)
  try {
    const listRaw = execSync(`gws gmail users messages list --params "{\\"userId\\":\\"me\\",\\"q\\":\\"newer_than:1h from:resetbiology.com\\",\\"maxResults\\":3}"`, { encoding: 'utf8', timeout: 30000 })
    const list = JSON.parse(listRaw.slice(listRaw.indexOf('{')))
    for (const m of list.messages || []) {
      const msgRaw = execSync(`gws gmail users messages get --params "{\\"userId\\":\\"me\\",\\"id\\":\\"${m.id}\\",\\"format\\":\\"full\\"}"`, { encoding: 'utf8', timeout: 30000 })
      const msg = JSON.parse(msgRaw.slice(msgRaw.indexOf('{')))
      if (Number(msg.internalDate) < t0) continue
      const bodyData = JSON.stringify(msg)
      const mCode = bodyData.match(/\b(\d{6})\b/)
      if (mCode) { code = mCode[1]; break }
    }
  } catch (e) { console.log('gmail poll err (retrying):', String(e).slice(0, 120)) }
}
if (!code) { console.log('NO-OTP-FOUND'); await b.close(); process.exit(1) }
console.log('OTP received')
const codeInput = page.locator('input[type="text"], input[name="code"], input[inputmode="numeric"]').first()
await codeInput.waitFor()
await codeInput.fill(code)
await page.getByRole('button', { name: /continue|verify|submit|log in/i }).first().click()
// ride the whole redirect chain out: wait until we are ON resetbiology.com and network settles
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000)
  const u = page.url()
  if (u.includes('resetbiology.com') && !u.includes('auth0')) break
  if (i === 29) { await page.screenshot({ path: out + '.stuck.png' }); console.log('STUCK-AT:', u) }
}
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.goto('https://resetbiology.com/vision-training', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(3000)
const who = await page.evaluate(() => fetch('/auth/profile').then(r => r.ok ? r.json() : { s: r.status }))
console.log('logged in as:', who?.name || JSON.stringify(who).slice(0, 100))
const cookies = (await ctx.cookies()).filter(c => c.domain.includes('resetbiology'))
fs.writeFileSync(out, JSON.stringify(cookies, null, 2))
console.log(`saved ${cookies.length} cookies → ${out}`)
await b.close()
process.exit(who?.name === 'jonchyatt@gmail.com' ? 0 : 1)
