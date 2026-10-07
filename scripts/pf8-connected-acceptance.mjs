import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.argv[2] ?? process.env.PF8_BASE_URL ?? 'http://127.0.0.1:3228'
const outputPath = resolve(process.argv[3] ?? process.env.PF8_ACCEPTANCE_JSON ?? 'receipts/pf8/PF8-CONNECTED-ACCEPTANCE.json')

async function inspect(viewport) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport })
    const versionResponse = await page.request.get(`${baseUrl}/version`)
    assert.equal(versionResponse.status(), 200, '/version must return HTTP 200')
    const version = await versionResponse.json()
    assert.match(version.buildSha, /^[0-9a-f]{40}$/i, '/version must expose a full SHA')

    await page.goto(`${baseUrl}/pitch-defender/pitchforks-3?pfdebug=1`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('pf3-menu').waitFor({ timeout: 60_000 })
    await page.getByTestId('pf3-input-buttons').click()
    await page.getByTestId('pf3-adventure-first').waitFor()
    await page.waitForFunction(() => Boolean(window.__pitchforksAudioDebug))
    await page.evaluate(() => window.scrollTo(0, 0))

    const pageState = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="pf3-continue-adventure"]')
      const marker = document.querySelector('[data-testid="pf3-build-identity"]')
      const adventure = document.querySelector('[data-testid="pf3-adventure-first"]')
      const debug = window.__pitchforksAudioDebug
      return {
        buttonViewportY: button?.getBoundingClientRect().top ?? null,
        buttonText: button?.textContent?.trim() ?? null,
        adventureText: adventure?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        pageBuildMarker: marker?.textContent?.trim() ?? null,
        diagnosticCapacity: debug?.capacity ?? null,
        diagnosticEventCount: debug?.events().length ?? null,
      }
    })

    assert.notEqual(pageState.buttonViewportY, null, 'Continue/Start Adventure button must render')
    assert.ok(pageState.buttonViewportY >= 0 && pageState.buttonViewportY < viewport.height, 'Continue/Start Adventure must be in the first viewport')
    assert.match(pageState.buttonText ?? '', /START ADVENTURE|CONTINUE ADVENTURE/)
    assert.match(pageState.adventureText ?? '', /Listen & Tap · recognition practice/)
    assert.equal(pageState.pageBuildMarker, `build ${version.buildSha}`, 'page build marker must equal /version SHA')
    assert.equal(pageState.diagnosticCapacity, 4096, 'audio diagnostics must use the declared bounded capacity')
    assert.ok((pageState.diagnosticEventCount ?? Infinity) <= pageState.diagnosticCapacity, 'audio diagnostics must never exceed capacity')

    return { viewport, ...pageState, versionSha: version.buildSha }
  } finally {
    await browser.close()
  }
}

const phone = await inspect({ width: 390, height: 844 })
const desktop = await inspect({ width: 1440, height: 900 })
assert.equal(phone.versionSha, desktop.versionSha, 'phone and desktop must expose one build identity')

const receipt = {
  task: 'PF-8',
  baseUrl,
  pageSha: phone.versionSha,
  versionSha: phone.versionSha,
  firstScreenButtonY: phone.buttonViewportY,
  selectedLane: 'Listen & Tap',
  diagnosticBufferBound: phone.diagnosticCapacity,
  phone,
  desktop,
}
await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt))
