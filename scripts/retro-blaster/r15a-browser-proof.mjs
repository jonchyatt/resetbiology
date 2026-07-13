import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.argv[2] ?? 'http://127.0.0.1:3333/pitch-defender/retro-2'
const OUT = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/r15a-browser-proof')
mkdirSync(OUT, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function capture(browser, name, viewport) {
  const dir = resolve(OUT, name)
  mkdirSync(resolve(dir, 'video'), { recursive: true })
  const context = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    recordVideo: { dir: resolve(dir, 'video'), size: viewport },
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.removeItem('retro_blaster_crt')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'EASY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-cabinet]').waitFor()
  await page.waitForTimeout(2200)

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const cabinet = document.querySelector('[data-retro-cabinet]')
    const canvasRect = canvas?.getBoundingClientRect()
    return {
      innerWidth,
      innerHeight,
      logical: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasRect: canvasRect ? { width: canvasRect.width, height: canvasRect.height } : null,
      crt: Boolean(document.querySelector('[data-retro-crt-overlay]')),
      crtButton: Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('CRT'))?.textContent?.trim(),
      cabinetBorder: cabinet ? getComputedStyle(cabinet).borderTopWidth : null,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  assert(initial.logical?.width === 640 && initial.logical?.height === 360, `${name}: canvas is not 640x360`)
  assert(Math.abs((initial.canvasRect.width / initial.canvasRect.height) - (16 / 9)) < 0.01, `${name}: CSS canvas is stretched`)
  assert(initial.horizontalOverflow <= 1, `${name}: horizontal overflow ${initial.horizontalOverflow}px`)
  if (viewport.width < 768) {
    assert(!initial.crt && initial.crtButton === 'CRT OFF', `${name}: phone CRT did not default OFF`)
    assert(initial.cabinetBorder === '0px', `${name}: phone retained desktop bezel border`)
  } else {
    assert(initial.crt && initial.crtButton === 'CRT ON', `${name}: desktop CRT did not default ON`)
    assert(initial.cabinetBorder !== '0px', `${name}: desktop bezel is absent`)
  }
  await page.screenshot({ path: resolve(dir, '01-initial.png') })

  const beforeToggle = initial.crt
  await page.getByRole('button', { name: /CRT (ON|OFF)/ }).click()
  await page.waitForTimeout(100)
  const afterToggle = await page.evaluate(() => ({
    crt: Boolean(document.querySelector('[data-retro-crt-overlay]')),
    stored: localStorage.getItem('retro_blaster_crt'),
  }))
  assert(afterToggle.crt !== beforeToggle, `${name}: CRT did not toggle`)
  assert(afterToggle.stored === (afterToggle.crt ? '1' : '0'), `${name}: CRT preference did not persist`)

  const marker = Date.now()
  let key = 1
  while (Date.now() - marker < 6500) {
    await page.keyboard.press(String(key))
    key = key % 4 + 1
    await page.waitForTimeout(650)
  }
  await page.screenshot({ path: resolve(dir, '02-gameplay.png') })
  const videoPath = await page.video().path()
  const result = { name, url: page.url(), viewport, initial, afterToggle, captureWindowMs: Date.now() - marker, pageErrors, videoPath }
  assert(result.captureWindowMs >= 6000, `${name}: video evidence shorter than 6s`)
  assert(pageErrors.length === 0, `${name}: page errors: ${pageErrors.join('; ')}`)
  writeFileSync(resolve(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  await context.close()
  return result
}

const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL ?? 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
})
try {
  const results = []
  results.push(await capture(browser, 'desktop-1280x800', { width: 1280, height: 800 }))
  results.push(await capture(browser, 'phone-390x844', { width: 390, height: 844 }))
  console.log(JSON.stringify(results, null, 2))
  console.log('PASS R1.5a browser proof: desktop + phone, 640x360, CRT defaults/toggle, bezel, aspect, overflow, >=6s video')
} finally {
  await browser.close()
}
