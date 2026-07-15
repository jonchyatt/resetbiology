import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [rawUrl, rawOutput, rawSha, rawZoomReceipt] = process.argv.slice(2)
const url = rawUrl || 'https://resetbiology.com/pitch-defender/retro-2?v=f0-red-326cf9a7'
const output = resolve(rawOutput || 'data/retro-blaster-rework/runtime-logs/f0-cabinet-truth')
const productSha = rawSha || '326cf9a7018511ae97cf3a316e7120aa082373ed'
const transport = 'http://127.0.0.1:9224'
const viewports = [
  { name: 'portrait-390x844', width: 390, height: 844 },
  { name: 'landscape-844x390', width: 844, height: 390 },
  { name: 'desktop-1280x800', width: 1280, height: 800 },
  { name: 'compact-640x400', width: 640, height: 400 },
]
const introOrder = ['C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5', 'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3']

mkdirSync(output, { recursive: true })

function noteFrequency(note) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note)
  if (!match) throw new Error('invalid note ' + note)
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const midi = (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0)
  return 440 * (2 ** ((midi - 69) / 12))
}

function normalize(value) {
  return String(value || '')
    .replace(/[→➜]/g, '->')
    .replace(/[·•]/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
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
  window.__f0SetActivity = (visibility, focused) => {
    forcedVisibility = visibility
    forcedFocus = focused
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(focused ? 'focus' : 'blur'))
  }
  window.__f0AutoBlurOnCeremony = false
  window.__f0DidAutoBlur = false
  new MutationObserver(() => {
    if (!window.__f0AutoBlurOnCeremony || !document.querySelector('[data-retro-ceremony]')) return
    window.__f0AutoBlurOnCeremony = false
    window.__f0DidAutoBlur = true
    window.__f0SetActivity('hidden', false)
  }).observe(document, { childList: true, subtree: true })

  window.__f0CanvasText = {}
  window.__f0CanvasRail = null
  const nativeFillText = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
    const label = String(text)
    if (
      label === 'PRE-FLIGHT' ||
      label === 'NEW SIGNAL' ||
      label.includes('REFERENCE') ||
      label.includes('SIGNAL PATH') ||
      label.includes('NOT SCORED')
    ) {
      const metrics = this.measureText(label)
      window.__f0CanvasText[label] = {
        text: label,
        x,
        y,
        font: this.font,
        fontPx: Number(this.font.match(/([\d.]+)px/)?.[1] || 0),
        ascent: metrics.actualBoundingBoxAscent,
        descent: metrics.actualBoundingBoxDescent,
        fillStyle: String(this.fillStyle),
      }
    }
    return maxWidth === undefined
      ? nativeFillText.call(this, text, x, y)
      : nativeFillText.call(this, text, x, y, maxWidth)
  }
  const nativeFillRect = CanvasRenderingContext2D.prototype.fillRect
  CanvasRenderingContext2D.prototype.fillRect = function(x, y, width, height) {
    if (y > 180 && width >= 100 && width <= 500 && height > 0 && height <= 5) {
      window.__f0CanvasRail = {
        x,
        y,
        width,
        height,
        fillStyle: String(this.fillStyle),
      }
    }
    return nativeFillRect.call(this, x, y, width, height)
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext
  let stateOwner = NativeAudioContext.prototype
  let stateDescriptor = Object.getOwnPropertyDescriptor(stateOwner, 'state')
  while (!stateDescriptor && stateOwner) {
    stateOwner = Object.getPrototypeOf(stateOwner)
    stateDescriptor = stateOwner ? Object.getOwnPropertyDescriptor(stateOwner, 'state') : null
  }
  window.__f0ForceSuspended = false
  if (stateOwner && stateDescriptor?.get) {
    Object.defineProperty(stateOwner, 'state', {
      ...stateDescriptor,
      get() {
        return window.__f0ForceSuspended ? 'suspended' : stateDescriptor.get.call(this)
      },
    })
  }

  const nativeCreateMediaStreamSource = NativeAudioContext.prototype.createMediaStreamSource
  const micProof = window.__f0MicProof = {
    sources: [],
    productContexts: [],
    matchingCalls: 0,
    gumCalls: 0,
  }
  NativeAudioContext.prototype.createMediaStreamSource = function(stream) {
    const sourceIndex = micProof.sources.findIndex(source => source.stream === stream)
    if (sourceIndex >= 0) {
      micProof.matchingCalls += 1
      micProof.productContexts.push(this)
      micProof.sources[sourceIndex].productContext = this
    }
    return nativeCreateMediaStreamSource.call(this, stream)
  }
  navigator.mediaDevices.getUserMedia = async () => {
    micProof.gumCalls += 1
    const sourceContext = new NativeAudioContext()
    const oscillator = sourceContext.createOscillator()
    const gain = sourceContext.createGain()
    const destination = sourceContext.createMediaStreamDestination()
    oscillator.type = 'sine'
    oscillator.frequency.value = 110
    gain.gain.value = 0
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start()
    await sourceContext.resume()
    const source = { sourceContext, oscillator, gain, destination, stream: destination.stream, productContext: null }
    micProof.sources.push(source)
    return source.stream
  }
  window.__f0MicStatus = () => ({
    gumCalls: micProof.gumCalls,
    matchingCalls: micProof.matchingCalls,
    sourceCount: micProof.sources.length,
    sourceContextStates: micProof.sources.map(source => source.sourceContext.state),
    sourceTrackStates: micProof.sources.map(source => source.stream.getAudioTracks()[0]?.readyState || 'missing'),
    productContextStates: micProof.productContexts.map(context => context.state),
  })
  window.__f0SetFrequency = frequency => {
    const source = micProof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.oscillator.frequency.setValueAtTime(frequency, source.sourceContext.currentTime)
  }
  window.__f0SetGain = value => {
    const source = micProof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.gain.gain.setValueAtTime(value, source.sourceContext.currentTime)
  }
}

const browser = await chromium.connectOverCDP(transport, { timeout: 60_000 })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
})
const page = await context.newPage()
await page.addInitScript(initHarness)

const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

async function resetApp() {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_blaster_color_hints', '0')
    localStorage.setItem('retro_difficulty', 'easy')
  })
  await page.reload({ waitUntil: 'networkidle' })
}

async function freshEarGame() {
  await resetApp()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness][data-readiness-lane="ear"]').waitFor()
  await page.waitForFunction(() => ['awaiting-ear', 'audio-error'].includes(
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status'),
  ))
  if (await page.locator('[data-retro-readiness]').getAttribute('data-readiness-status') === 'audio-error') {
    await page.getByRole('button', { name: 'RETRY AUDIO' }).click()
    await page.waitForFunction(() =>
      document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear')
  }
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 15_000 })
}

async function freshVoiceGame() {
  await resetApp()
  await page.getByRole('button', { name: 'MICROPHONE' }).click()
  await page.getByRole('button', { name: 'EASY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness][data-readiness-lane="voice"]').waitFor()
  await page.waitForFunction(() => (
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-voice' &&
    window.__f0MicStatus?.().gumCalls === 1 &&
    window.__f0MicStatus?.().matchingCalls === 1
  ), null, { timeout: 15_000 })
  const readiness = await readinessSnapshot()
  await page.evaluate(() => {
    window.__f0SetFrequency(110)
    window.__f0SetGain(0.55)
  })
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 15_000 })
  await page.evaluate(() => window.__f0SetGain(0))
  return readiness
}

async function readinessSnapshot() {
  return page.evaluate(() => {
    const root = document.querySelector('[data-retro-readiness]')
    const unit = root?.querySelector('[data-retro-cabinet-unit]') ||
      root?.querySelector('.retro-readiness-meta span:first-child')
    return {
      lane: root?.getAttribute('data-readiness-lane') || null,
      status: root?.getAttribute('data-readiness-status') || null,
      unit: unit?.textContent?.replace(/\s+/g, ' ').trim() || null,
      fullText: root?.textContent?.replace(/\s+/g, ' ').trim() || null,
    }
  })
}

async function substrateSnapshot(name) {
  return page.evaluate(viewportName => {
    const canvas = document.querySelector('canvas')
    const rect = canvas?.getBoundingClientRect()
    return {
      name: viewportName,
      innerWidth,
      innerHeight,
      devicePixelRatio,
      visualViewport: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        scale: window.visualViewport.scale,
        offsetLeft: window.visualViewport.offsetLeft,
        offsetTop: window.visualViewport.offsetTop,
      } : null,
      zoom: document.documentElement.clientWidth ? innerWidth / document.documentElement.clientWidth : null,
      canvasRect: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      } : null,
      canvasSource: canvas ? { width: canvas.width, height: canvas.height } : null,
      sourceToCssY: rect && canvas ? rect.height / canvas.height : null,
    }
  }, name)
}

async function genuineZoomSnapshot() {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.bringToFront()
  await page.keyboard.press('Control+0')
  await page.waitForTimeout(180)
  const before = await substrateSnapshot('zoom-before-100-percent')
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press('Control+Equal')
    await page.waitForTimeout(100)
  }
  const during = await substrateSnapshot('zoom-during-200-percent')
  const computedZoom = during.innerWidth > 0 ? before.innerWidth / during.innerWidth : null
  await page.screenshot({ path: resolve(output, '00-genuine-browser-zoom-200.png'), fullPage: true })
  await page.keyboard.press('Control+0')
  await page.waitForTimeout(180)
  const after = await substrateSnapshot('zoom-after-reset-100-percent')
  return {
    method: 'Helium browser keyboard accelerator Control+Equal x5; no DSF or page-scale emulation',
    before,
    during,
    after,
    computedZoom,
  }
}

async function gameSnapshot(label) {
  return page.evaluate(snapshotLabel => {
    const canvas = document.querySelector('canvas')
    const cabinet = document.querySelector('[data-retro-cabinet]')
    const rail = document.querySelector('[data-retro-instruction-rail]') || cabinet?.previousElementSibling
    const instruction = document.querySelector('[data-retro-instruction]') || rail?.firstElementChild
    const fallbackHelper = [...(rail?.children || [])].find(node =>
      (node.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase().startsWith('ACTIVE ALIEN'))
    const helper = document.querySelector('[data-retro-helper]') || fallbackHelper
    const unit = document.querySelector('[data-retro-cabinet-unit]') ||
      cabinet?.firstElementChild?.lastElementChild
    let formation = {}
    try { formation = JSON.parse(canvas?.dataset.retroFormationState || '{}') } catch {}
    const attack = formation.activeAttack
    const responseOpen = attack?.phase === 'outbound' &&
      attack.outcome === null && attack.demandAtMs !== null
    const colorToRgb = value => {
      const probe = new OffscreenCanvas(1, 1)
      const context = probe.getContext('2d', { willReadFrequently: true })
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    const contrast = (foreground, background) => {
      const channel = value => {
        const normalized = value / 255
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
      }
      const luminance = color => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
      const fore = luminance(colorToRgb(foreground))
      const back = luminance(colorToRgb(background))
      return (Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05)
    }
    const styleMetric = (element, backing) => {
      if (!element) return null
      const style = getComputedStyle(element)
      const backingStyle = backing ? getComputedStyle(backing) : null
      const parseAlpha = value => {
        const color = String(value || '')
        if (color === 'transparent') return 0
        if (color.includes('/')) return Number(color.split('/').at(-1).replace(')', '').trim())
        const channels = color.match(/[\d.]+/g) || []
        return color.startsWith('rgba') && channels.length >= 4 ? Number(channels[3]) : color.startsWith('rgb') ? 1 : 0
      }
      return {
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: backingStyle?.backgroundColor || style.backgroundColor,
        backgroundAlpha: parseAlpha(backingStyle?.backgroundColor || style.backgroundColor),
        contrast: contrast(style.color, backingStyle?.backgroundColor || style.backgroundColor),
        display: style.display,
        visibility: style.visibility,
      }
    }
    return {
      label: snapshotLabel,
      laneHook: document.querySelector('[data-retro-active-lane]')?.getAttribute('data-retro-active-lane') || null,
      formation: {
        phase: formation.phase || null,
        wave: formation.wave ?? null,
        attack: attack ? {
          attackId: attack.attackId,
          note: attack.note,
          phase: attack.phase,
          outcome: attack.outcome,
          demandAtMs: attack.demandAtMs,
        } : null,
        responseOpen,
      },
      instruction: instruction?.textContent?.replace(/\s+/g, ' ').trim() || null,
      helper: helper?.textContent?.replace(/\s+/g, ' ').trim() || null,
      unit: unit?.textContent?.replace(/\s+/g, ' ').trim() || null,
      instructionHook: Boolean(document.querySelector('[data-retro-instruction]')),
      helperHook: Boolean(document.querySelector('[data-retro-helper]')),
      unitHook: Boolean(document.querySelector('[data-retro-cabinet-unit]')),
      instructionRailHook: Boolean(document.querySelector('[data-retro-instruction-rail]')),
      instructionMetric: styleMetric(instruction, rail),
      helperMetric: styleMetric(helper, rail),
      vocalMeter: Boolean(document.querySelector('[data-retro-vocal-meter]')),
    }
  }, label)
}

async function waitForResponseOpen() {
  await page.waitForFunction(() => {
    try {
      const attack = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack
      return attack?.phase === 'outbound' && attack.outcome === null && attack.demandAtMs !== null
    } catch {
      return false
    }
  }, null, { timeout: 15_000, polling: 'raf' })
}

async function waitForStandby() {
  await page.waitForFunction(() => {
    try {
      const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      const attack = formation.activeAttack
      return formation.phase === 'playing' && !(
        attack?.phase === 'outbound' && attack.outcome === null && attack.demandAtMs !== null
      )
    } catch {
      return false
    }
  }, null, { timeout: 15_000, polling: 'raf' })
}

async function answerUntilCeremony() {
  const deadline = Date.now() + 180_000
  let correctAnswers = 0
  while (Date.now() < deadline) {
    const formation = await page.evaluate(() => {
      try { return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}') } catch { return {} }
    })
    if (formation.phase === 'ceremony') return correctAnswers
    const attack = formation.activeAttack
    if (attack?.phase === 'outbound') {
      const keyIndex = introOrder.indexOf(attack.note)
      if (keyIndex < 0 || keyIndex >= 9) throw new Error('no direct gameplay key for ' + attack.note)
      await page.keyboard.press(String(keyIndex + 1))
      await page.waitForFunction(attackId => {
        try {
          const active = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack
          return !active || active.attackId !== attackId || active.phase !== 'outbound'
        } catch {
          return false
        }
      }, attack.attackId, { timeout: 5000 })
      correctAnswers += 1
      if (correctAnswers === 9) {
        await page.evaluate(() => {
          window.__f0ForceSuspended = true
          window.__f0AutoBlurOnCeremony = true
        })
      }
      continue
    }
    await page.waitForTimeout(30)
  }
  throw new Error('timed out earning first NEW SIGNAL')
}

async function ceremonySnapshot(name) {
  return page.evaluate(viewportName => {
    const canvas = document.querySelector('canvas')
    const canvasRect = canvas?.getBoundingClientRect()
    const region = document.querySelector('[data-retro-ceremony]')
    const shelf = document.querySelector('[data-retro-ceremony-shelf]')
    const status = region?.querySelector('[role="status"]')
    const actionsRoot = region?.querySelector('.retro-new-signal-actions')
    const actions = [...(region?.querySelectorAll('button') || [])]
    const colorToRgb = value => {
      const probe = new OffscreenCanvas(1, 1)
      const context = probe.getContext('2d', { willReadFrequently: true })
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    const contrast = (foreground, background) => {
      const channel = value => {
        const normalized = value / 255
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
      }
      const luminance = color => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
      const fore = luminance(colorToRgb(foreground))
      const back = luminance(colorToRgb(background))
      return (Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05)
    }
    const rectObject = element => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      }
    }
    const parseAlpha = value => {
      const color = String(value || '')
      if (color === 'transparent') return 0
      if (color.includes('/')) return Number(color.split('/').at(-1).replace(')', '').trim())
      const channels = color.match(/[\d.]+/g) || []
      return color.startsWith('rgba') && channels.length >= 4 ? Number(channels[3]) : color.startsWith('rgb') ? 1 : 0
    }
    const textMetric = (element, backing) => {
      if (!element) return null
      const style = getComputedStyle(element)
      const backingStyle = backing ? getComputedStyle(backing) : null
      const backgroundColor = backingStyle?.backgroundColor || style.backgroundColor
      return {
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor,
        backgroundAlpha: parseAlpha(backgroundColor),
        contrast: contrast(style.color, backgroundColor),
        position: style.position,
      }
    }
    const scaleY = canvasRect && canvas ? canvasRect.height / canvas.height : 0
    const draws = Object.values(window.__f0CanvasText || {})
    const notScored = draws.find(draw => draw.text.includes('NOT SCORED')) || null
    const dynamicCanvas = draws.filter(draw =>
      ['REFERENCE TONE DISPATCHED', 'SIGNAL PATH NOT READY', 'REFERENCE SIGNAL PENDING'].includes(draw.text))
    const staticCanvas = draws.find(draw => draw.text === 'REFERENCE INTRODUCTION') || null
    const drawRect = draw => draw && canvasRect ? {
      top: canvasRect.top + (draw.y - draw.ascent) * scaleY,
      bottom: canvasRect.top + (draw.y + draw.descent) * scaleY,
      effectiveGlyphHeight: (draw.ascent + draw.descent) * scaleY,
    } : null
    const rail = window.__f0CanvasRail
    const railRect = rail && canvasRect ? {
      top: canvasRect.top + rail.y * scaleY,
      bottom: canvasRect.top + (rail.y + rail.height) * scaleY,
    } : null
    const shelfStyle = shelf ? getComputedStyle(shelf) : null
    const statusRect = rectObject(status)
    const actionRects = actions.map(action => ({
      text: action.textContent?.replace(/\s+/g, ' ').trim() || null,
      rect: rectObject(action),
      metric: textMetric(action),
    }))
    return {
      name: viewportName,
      viewport: {
        innerWidth,
        innerHeight,
        devicePixelRatio,
        visualViewport: window.visualViewport ? {
          width: window.visualViewport.width,
          height: window.visualViewport.height,
          scale: window.visualViewport.scale,
        } : null,
      },
      canvasRect: rectObject(canvas),
      sourceToCssY: scaleY,
      regionRect: rectObject(region),
      shelf: {
        present: Boolean(shelf),
        rect: rectObject(shelf),
        backgroundColor: shelfStyle?.backgroundColor || null,
        backgroundAlpha: shelfStyle ? parseAlpha(shelfStyle.backgroundColor) : null,
        heightPercentOfCanvas: shelf && canvasRect ? shelf.getBoundingClientRect().height / canvasRect.height * 100 : null,
      },
      status: {
        text: status?.textContent?.replace(/\s+/g, ' ').trim() || null,
        rect: statusRect,
        metric: textMetric(status, shelf),
      },
      actions: actionRects,
      actionsFlexWrap: actionsRoot ? getComputedStyle(actionsRoot).flexWrap : null,
      actionRows: new Set(actionRects.map(action => Math.round(action.rect?.top || 0))).size,
      liveRegionCount: region?.querySelectorAll('[aria-live]').length || 0,
      readinessStatusCount: document.querySelectorAll('[data-retro-readiness] [role="status"]').length,
      srCopy: document.getElementById('new-signal-copy')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      canvas: {
        draws,
        dynamicCanvas,
        staticCanvas,
        notScored,
        notScoredRect: drawRect(notScored),
        notScoredContrast: notScored ? contrast(notScored.fillStyle, '#030c19') : null,
        rail,
        railRect,
      },
      clearance: {
        statusToActions: statusRect && actionRects.length
          ? Math.min(...actionRects.map(action => action.rect.top)) - statusRect.bottom
          : null,
        notScoredToShelf: shelf && drawRect(notScored)
          ? shelf.getBoundingClientRect().top - drawRect(notScored).bottom
          : null,
        railToShelf: shelf && railRect
          ? shelf.getBoundingClientRect().top - railRect.bottom
          : null,
      },
    }
  }, name)
}

const checks = []
function check(id, pass, actual, expected) {
  checks.push({ id, pass: Boolean(pass), actual, expected })
}

try {
  await freshEarGame()

  const substrate = []
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(180)
    substrate.push(await substrateSnapshot(viewport.name))
    await page.screenshot({ path: resolve(output, '00-substrate-' + viewport.name + '.png'), fullPage: true })
  }
  const embeddedZoomProbe = await genuineZoomSnapshot()
  const externalZoomPath = rawZoomReceipt ? resolve(rawZoomReceipt) : null
  const genuineZoom = embeddedZoomProbe.computedZoom >= 1.95 && embeddedZoomProbe.computedZoom <= 2.05
    ? embeddedZoomProbe
    : externalZoomPath && existsSync(externalZoomPath)
      ? { ...JSON.parse(readFileSync(externalZoomPath, 'utf8')), embeddedZoomProbe }
      : embeddedZoomProbe
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(120)

  await waitForStandby()
  const earStandby = await gameSnapshot('ear-standby')
  await waitForResponseOpen()
  const earResponse = await gameSnapshot('ear-response-open')

  const voiceReadiness = await freshVoiceGame()
  await waitForStandby()
  const voiceStandby = await gameSnapshot('voice-standby')
  await waitForResponseOpen()
  const voiceAttack = await page.evaluate(() =>
    JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack)
  await page.evaluate(frequency => {
    window.__f0SetFrequency(frequency)
    window.__f0SetGain(0.55)
  }, noteFrequency(voiceAttack.note))
  await page.waitForFunction(() => Boolean(document.querySelector('[data-retro-vocal-meter]')), null, {
    timeout: 2500,
    polling: 'raf',
  })
  const voiceResponse = await gameSnapshot('voice-response-open-live-meter')
  await page.screenshot({ path: resolve(output, '01-voice-response-open-live-meter.png'), fullPage: true })
  await page.evaluate(() => window.__f0SetGain(0))

  await freshEarGame()
  const correctAnswers = await answerUntilCeremony()
  await page.waitForFunction(() => window.__f0DidAutoBlur === true, null, { timeout: 5000 })
  await page.evaluate(() => window.__f0SetActivity('visible', true))
  await page.waitForFunction(() => {
    try {
      return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
        .introductionCeremony?.toneStatus === 'blocked'
    } catch {
      return false
    }
  }, null, { timeout: 5000 })

  const ceremony = []
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(180)
    ceremony.push(await ceremonySnapshot(viewport.name))
    await page.screenshot({ path: resolve(output, '02-ceremony-blocked-' + viewport.name + '.png'), fullPage: true })
  }

  const earStandbyExpected = 'STAND BY -> LISTEN FOR THE NEXT TARGET SIGNAL'
  const earResponseExpected = 'LISTEN FOR THE NOTE -> PRESS THE MATCHING KEY (OR TAP ITS BUTTON)'
  const voiceStandbyExpected = 'VOICE CANNON ARMED -> WAIT FOR THE TARGET SIGNAL'
  const voiceResponseExpected = 'SING OR HUM THE TARGET NOTE -> HOLD IT STEADY TO FIRE'
  check('substrate-four-live-canvas-rects', substrate.length === 4 && substrate.every(row =>
    row.canvasRect?.width > 0 && row.canvasRect?.height > 0 && row.sourceToCssY > 0), substrate, 'four live viewport/canvas rows')
  check('genuine-browser-zoom-200', genuineZoom.computedZoom >= 1.95 && genuineZoom.computedZoom <= 2.05 &&
    genuineZoom.after.innerWidth === genuineZoom.before.innerWidth, genuineZoom, 'real browser zoom 200% and reset to 100%')
  check('voice-readiness-unit', normalize(voiceReadiness.unit) === 'VOICE DEFENSE UNIT', voiceReadiness.unit, 'VOICE DEFENSE UNIT')
  check('ear-standby-copy', normalize(earStandby.instruction) === earStandbyExpected, earStandby.instruction, earStandbyExpected)
  check('ear-standby-helper-absent', earStandby.helper === null, earStandby.helper, null)
  check('ear-response-copy', normalize(earResponse.instruction) === earResponseExpected, earResponse.instruction, earResponseExpected)
  check('ear-response-helper', normalize(earResponse.helper) === 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE NOTE',
    earResponse.helper, 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE NOTE')
  check('voice-standby-copy', normalize(voiceStandby.instruction) === voiceStandbyExpected,
    voiceStandby.instruction, voiceStandbyExpected)
  check('voice-standby-helper-absent', voiceStandby.helper === null, voiceStandby.helper, null)
  check('voice-response-copy', normalize(voiceResponse.instruction) === voiceResponseExpected,
    voiceResponse.instruction, voiceResponseExpected)
  check('voice-response-helper', normalize(voiceResponse.helper) === 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE REFERENCE',
    voiceResponse.helper, 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE REFERENCE')
  check('voice-cabinet-unit', normalize(voiceResponse.unit) === 'VOICE DEFENSE UNIT', voiceResponse.unit, 'VOICE DEFENSE UNIT')
  check('voice-meter-protected', voiceResponse.vocalMeter, voiceResponse.vocalMeter, true)
  check('stable-gameplay-hooks', [earStandby, earResponse, voiceStandby, voiceResponse].every(row =>
    row.instructionHook && row.unitHook && row.laneHook), {
    earStandby,
    earResponse,
    voiceStandby,
    voiceResponse,
  }, 'lane/instruction/unit hooks in all states')
  check('opaque-instruction-rail', [earStandby, earResponse, voiceStandby, voiceResponse].every(row =>
    row.instructionRailHook && row.instructionMetric?.backgroundAlpha === 1), {
    earStandby: earStandby.instructionMetric,
    earResponse: earResponse.instructionMetric,
    voiceStandby: voiceStandby.instructionMetric,
    voiceResponse: voiceResponse.instructionMetric,
  }, 'opaque rail alpha 1')
  check('load-bearing-dom-size', [
    earStandby.instructionMetric,
    earResponse.instructionMetric,
    earResponse.helperMetric,
    voiceStandby.instructionMetric,
    voiceResponse.instructionMetric,
    voiceResponse.helperMetric,
  ].every(metric => metric?.fontSize >= 12), {
    earStandby: earStandby.instructionMetric,
    earResponse: earResponse.instructionMetric,
    earHelper: earResponse.helperMetric,
    voiceStandby: voiceStandby.instructionMetric,
    voiceResponse: voiceResponse.instructionMetric,
    voiceHelper: voiceResponse.helperMetric,
  }, 'all present load-bearing DOM text >=12px')
  check('load-bearing-dom-contrast', [
    earStandby.instructionMetric,
    earResponse.instructionMetric,
    earResponse.helperMetric,
    voiceStandby.instructionMetric,
    voiceResponse.instructionMetric,
    voiceResponse.helperMetric,
  ].every(metric => metric?.contrast >= 4.5), {
    earStandby: earStandby.instructionMetric?.contrast,
    earResponse: earResponse.instructionMetric?.contrast,
    earHelper: earResponse.helperMetric?.contrast,
    voiceStandby: voiceStandby.instructionMetric?.contrast,
    voiceResponse: voiceResponse.instructionMetric?.contrast,
    voiceHelper: voiceResponse.helperMetric?.contrast,
  }, 'all load-bearing DOM text >=4.5:1')

  for (const row of ceremony) {
    const prefix = 'ceremony-' + row.name + '-'
    check(prefix + 'opaque-shelf', row.shelf.present && row.shelf.backgroundAlpha === 1, row.shelf, 'present, alpha 1')
    check(prefix + 'single-live-region', row.liveRegionCount === 1 && row.readinessStatusCount === 0, {
      liveRegionCount: row.liveRegionCount,
      readinessStatusCount: row.readinessStatusCount,
    }, 'one ceremony live region; readiness status absent')
    check(prefix + 'truthful-static-sr', normalize(row.srCopy) === 'REFERENCE INTRODUCTION. NOT SCORED.',
      row.srCopy, 'REFERENCE INTRODUCTION. NOT SCORED.')
    check(prefix + 'status-copy', normalize(row.status.text) === 'SIGNAL PATH NOT READY - RETRY SIGNAL.',
      row.status.text, 'SIGNAL PATH NOT READY - RETRY SIGNAL.')
    check(prefix + 'no-dynamic-canvas-status', row.canvas.dynamicCanvas.length === 0,
      row.canvas.dynamicCanvas, 'no dynamic canvas status')
    check(prefix + 'static-canvas-identity', Boolean(row.canvas.staticCanvas),
      row.canvas.staticCanvas, 'REFERENCE INTRODUCTION')
    check(prefix + 'not-scored-copy', normalize(row.canvas.notScored?.text) === 'INTRODUCTION ONLY - NOT SCORED',
      row.canvas.notScored?.text, 'INTRODUCTION ONLY - NOT SCORED')
    check(prefix + 'not-scored-glyph-floor', row.canvas.notScoredRect?.effectiveGlyphHeight >= 12,
      row.canvas.notScoredRect?.effectiveGlyphHeight, '>=12 CSS px')
    check(prefix + 'not-scored-contrast', row.canvas.notScoredContrast >= 4.5,
      row.canvas.notScoredContrast, '>=4.5:1')
    check(prefix + 'status-size', row.status.metric?.fontSize >= 12, row.status.metric, '>=12 CSS px')
    check(prefix + 'status-contrast', row.status.metric?.contrast >= 4.5, row.status.metric?.contrast, '>=4.5:1')
    check(prefix + 'status-action-clearance', row.clearance.statusToActions >= 4,
      row.clearance.statusToActions, '>=4 CSS px')
    check(prefix + 'actions-44-and-12', row.actions.length === 3 && row.actions.every(action =>
      action.rect?.width >= 44 && action.rect?.height >= 44 && action.metric?.fontSize >= 12),
    row.actions, 'three actions, each >=44x44 with >=12px text')
    check(prefix + 'actions-contrast', row.actions.length === 3 && row.actions.every(action =>
      action.metric?.contrast >= 4.5), row.actions.map(action => ({ text: action.text, contrast: action.metric?.contrast })),
    'all action text >=4.5:1')
    check(prefix + 'actions-single-row', row.actionRows === 1 && row.actionsFlexWrap === 'nowrap', {
      actionRows: row.actionRows,
      flexWrap: row.actionsFlexWrap,
    }, 'one row, nowrap')
    check(prefix + 'rail-above-shelf', row.clearance.railToShelf !== null && row.clearance.railToShelf >= 12,
      row.clearance.railToShelf, '>= one 12px effective line')
    check(prefix + 'not-scored-above-shelf', row.clearance.notScoredToShelf !== null && row.clearance.notScoredToShelf >= 12,
      row.clearance.notScoredToShelf, '>= one 12px effective line')
    check(prefix + 'shelf-height-recorded', row.shelf.heightPercentOfCanvas !== null &&
      row.shelf.heightPercentOfCanvas <= 42, row.shelf.heightPercentOfCanvas, '<=42% HOLD metric')
  }

  const failures = checks.filter(row => !row.pass)
  const result = {
    fixture: 'F0 Cabinet Truth',
    status: failures.length === 0 ? 'GREEN' : 'RED',
    expectedBase: productSha,
    url,
    browserLane: 'helium-hawkeye-only',
    transport,
    geometrySubstrateFirst: substrate,
    genuineBrowserZoom: genuineZoom,
    evidence: {
      earStandby,
      earResponse,
      voiceReadiness,
      voiceStandby,
      voiceResponse,
      correctAnswersToCeremony: correctAnswers,
      ceremony,
    },
    checks,
    summary: {
      total: checks.length,
      passed: checks.length - failures.length,
      failed: failures.length,
      failureIds: failures.map(row => row.id),
      pageErrors,
    },
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  writeFileSync(resolve(output, 'README.md'), [
    '# F0 Cabinet Truth fixture',
    '',
    '- Status: **' + result.status + '**',
    '- Exact product base: ' + productSha,
    '- Browser: Helium Hawkeye only on port 9224',
    '- Checks: ' + result.summary.passed + '/' + result.summary.total + ' passed',
    '- Page errors: ' + pageErrors.length,
    '',
    'The first receipt block in result.json is the four-viewport live canvas geometry substrate, captured before any F0 product edit.',
    '',
  ].join('\n'))
  console.log(result.status + ' F0 Cabinet Truth: ' + result.summary.passed + '/' + result.summary.total +
    ' checks; ' + result.summary.failed + ' expected/current failures; ' + pageErrors.length + ' page errors')
} catch (error) {
  const failure = {
    fixture: 'F0 Cabinet Truth',
    status: 'INFRASTRUCTURE-FAIL',
    expectedBase: productSha,
    url,
    browserLane: 'helium-hawkeye-only',
    transport,
    error: error instanceof Error ? error.stack : String(error),
    pageErrors,
  }
  writeFileSync(resolve(output, 'infrastructure-failure.json'), JSON.stringify(failure, null, 2) + '\n')
  console.error(failure.error)
  process.exitCode = 1
} finally {
  await page.close().catch(() => {})
  await context.close().catch(() => {})
  // CDP browser ownership stays with Hawkeye; terminate only this proof runner.
  process.exit(process.exitCode || 0)
}
