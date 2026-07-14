import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [name, endpoint, url = 'https://resetbiology.com/pitch-defender/retro-2', outputRoot = 'data/retro-blaster-rework/runtime-logs/r3c-hawkeye-fleet'] = process.argv.slice(2)
if (!name || !endpoint) throw new Error('usage: node r3c-hawkeye-fleet-proof.mjs NAME CDP_ENDPOINT [URL] [OUTPUT_ROOT]')

const output = resolve(outputRoot, name)
mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`${name}: ${message}`)
}

const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
const pageErrors = []
let nextId = 1
let originalStores = null

await new Promise((resolveOpen, reject) => {
  const timeout = setTimeout(() => reject(new Error(`${name}: target WebSocket open timed out`)), 5000)
  ws.onopen = () => { clearTimeout(timeout); resolveOpen() }
  ws.onerror = error => { clearTimeout(timeout); reject(error) }
})

ws.onmessage = event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params?.exceptionDetails?.text ?? 'Runtime.exceptionThrown')
  }
  if (!message.id) return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error(message.error.message))
  else waiter.resolve(message.result)
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${name}: ${method} timed out`))
    }, 12_000)
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolveMessage(value) },
      reject: error => { clearTimeout(timeout); reject(error) },
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(`${name}: evaluation failed: ${result.exceptionDetails.text}`)
  return result.result?.value
}

async function waitFor(expression, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await new Promise(resolveWait => setTimeout(resolveWait, 40))
  }
  throw new Error(`${name}: timed out waiting for ${label}`)
}

async function waitWall(ms) {
  await new Promise(resolveWait => setTimeout(resolveWait, ms))
}

async function pressKey(key) {
  const digit = /^[1-8]$/.test(key)
  const params = digit
    ? { key, code: `Digit${key}`, windowsVirtualKeyCode: 48 + Number(key) }
    : { key, code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`, windowsVirtualKeyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0) }
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...params })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params })
}

const stateExpression = `(() => {
  const canvas = document.querySelector('canvas');
  const rect = canvas?.getBoundingClientRect();
  const audio = window.__r3cAudio ?? {};
  return {
    formation: JSON.parse(canvas?.dataset.retroFormationState ?? '{}'),
    renderSources: JSON.parse(canvas?.dataset.retroRenderSources ?? '{}'),
    cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
    logical: canvas ? [canvas.width, canvas.height] : null,
    css: rect ? [rect.width, rect.height] : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    visibility: document.visibilityState,
    earRaw: localStorage.getItem('pitch_fsrs_memory_ear'),
    voiceRaw: localStorage.getItem('pitch_fsrs_memory'),
    audio: {
      contextCount: audio.contexts?.length ?? 0,
      states: audio.contexts?.map(context => context.state) ?? [],
      resumeCalls: audio.resumeCalls ?? 0,
      startCalls: audio.startCalls ?? 0,
    },
  };
})()`

const answerKeysExpression = `(() => {
  const entries = [...document.querySelectorAll('span')]
    .filter(element => /^[CDEFGAB]=[1-8]$/.test(element.textContent?.trim() ?? ''))
    .map(element => ({
      key: element.textContent.trim().split('=')[1],
      active: Number.parseInt(getComputedStyle(element).fontWeight, 10) >= 700,
    }));
  return { correct: entries.find(entry => entry.active)?.key ?? null, wrong: entries.find(entry => !entry.active)?.key ?? null };
})()`

async function snapshot() {
  return evaluate(stateExpression)
}

async function screenshot(fileName) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(resolve(output, fileName), Buffer.from(result.data, 'base64'))
}

function storeEntry(raw, note) {
  try { return JSON.parse(raw ?? '{}')[note] ?? null } catch { return null }
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    let forcedVisibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => forcedVisibility });
    window.__setRetroVisibility = state => {
      forcedVisibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.__r3cAudio = { contexts: [], resumeCalls: 0, startCalls: 0 };
    try {
      const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
      if (NativeAudioContext) {
        const nativeResume = NativeAudioContext.prototype.resume;
        NativeAudioContext.prototype.resume = function(...args) {
          window.__r3cAudio.resumeCalls += 1;
          return nativeResume.apply(this, args);
        };
        function TrackedAudioContext(...args) {
          const context = Reflect.construct(NativeAudioContext, args, NativeAudioContext);
          window.__r3cAudio.contexts.push(context);
          return context;
        }
        TrackedAudioContext.prototype = NativeAudioContext.prototype;
        Object.setPrototypeOf(TrackedAudioContext, NativeAudioContext);
        window.AudioContext = TrackedAudioContext;
        if (window.webkitAudioContext) window.webkitAudioContext = TrackedAudioContext;
      }
      const wrapStart = prototype => {
        if (!prototype?.start) return;
        const nativeStart = prototype.start;
        prototype.start = function(...args) {
          window.__r3cAudio.startCalls += 1;
          return nativeStart.apply(this, args);
        };
      };
      wrapStart(window.AudioBufferSourceNode?.prototype);
      wrapStart(window.OscillatorNode?.prototype);
      window.__suspendR3cAudio = async () => {
        await Promise.all(window.__r3cAudio.contexts.map(context => context.suspend()));
        return window.__r3cAudio.contexts.map(context => context.state);
      };
    } catch (error) {
      window.__r3cAudio.instrumentationError = String(error);
    }
  })()` })
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url })
  await waitFor(`document.readyState === 'complete'`, 'initial page load')
  originalStores = await evaluate(`({
    ear: localStorage.getItem('pitch_fsrs_memory_ear'),
    voice: localStorage.getItem('pitch_fsrs_memory'),
  })`)
  await evaluate(`(() => {
    localStorage.setItem('retro_tutorial_seen', '1');
    localStorage.setItem('retro_difficulty', 'true');
    localStorage.removeItem('retro_blaster_color_hints');
    localStorage.removeItem('pitch_fsrs_memory_ear');
    localStorage.removeItem('pitch_fsrs_memory');
    return true;
  })()`)
  await send('Page.reload', { ignoreCache: false })
  await waitFor(`document.readyState === 'complete' && [...document.querySelectorAll('button')].some(button => button.textContent?.includes('INSERT COIN'))`, 'menu')

  for (const label of ['KEYBOARD', 'TRUE PLAY', 'INSERT COIN']) {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === ${JSON.stringify(label)});
      button?.click();
      return Boolean(button);
    })()`)
    assert(clicked, `${label} button missing`)
  }
  await waitFor(`Boolean(document.querySelector('[data-retro-cabinet]'))`, 'cabinet')
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.phase === 'telegraph';
  })()`, 'telegraph')

  const telegraph = await snapshot()
  const firstAttack = telegraph.formation.activeAttack
  const firstKeys = await evaluate(answerKeysExpression)
  assert(firstKeys.correct && firstKeys.wrong, 'telegraph answer keys missing')
  assert(telegraph.formation.requiredAnswerEventsMs.length === 0, 'demand emitted during telegraph')
  await pressKey(firstKeys.correct)
  await waitWall(100)
  const preDemandDiscard = await snapshot()
  assert(preDemandDiscard.formation.activeAttack?.attackId === firstAttack.attackId, 'pre-demand key changed attack identity')
  assert(preDemandDiscard.formation.activeAttack?.outcome === null, 'pre-demand key resolved attack')
  assert(preDemandDiscard.earRaw === null, 'pre-demand key graded EAR')

  const beforeHidden = await snapshot()
  await evaluate(`window.__setRetroVisibility('hidden')`)
  await pressKey(firstKeys.correct)
  await waitWall(800)
  const hidden = await snapshot()
  const hiddenDelta = hidden.formation.directorClockMs - beforeHidden.formation.directorClockMs
  assert(hidden.visibility === 'hidden', 'visibility harness did not enter hidden')
  assert(hiddenDelta >= 0 && hiddenDelta <= 50, `director advanced ${hiddenDelta}ms while hidden`)
  assert(hidden.formation.activeAttack?.attackId === firstAttack.attackId, 'hidden interval changed attack identity')
  assert(hidden.formation.activeAttack?.outcome === null, 'hidden key resolved attack')
  assert(hidden.earRaw === null, 'hidden key graded EAR')
  await evaluate(`window.__setRetroVisibility('visible')`)
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId === ${JSON.stringify(firstAttack.attackId)} && value.activeAttack.phase === 'outbound' && value.activeAttack.outboundT >= 0.2;
  })()`, 'first outbound')

  const outbound = await snapshot()
  assert(outbound.formation.requiredAnswerEventsMs.length === 1, 'first attack did not emit exactly one demand')
  assert(outbound.formation.ships.filter(ship => ship.flightState !== 'formation').length === 1, 'one-diver invariant failed')
  assert(outbound.formation.ships.some(ship => ship.alienId === firstAttack.alienId), 'attacked alien ID missing')
  assert(Object.keys(outbound.renderSources).length > 0, 'renderer source latches missing')
  await screenshot('01-outbound-after-pause.png')

  await waitFor(`(window.__r3cAudio?.contexts?.length ?? 0) > 0`, 'audio context')
  await evaluate(`window.__suspendR3cAudio()`)
  const audioSuspended = await snapshot()
  assert(audioSuspended.audio.states.every(state => state === 'suspended'), `audio did not suspend: ${audioSuspended.audio.states}`)
  await pressKey(' ')
  await waitWall(250)
  const audioRecovered = await snapshot()
  assert(audioRecovered.audio.resumeCalls > audioSuspended.audio.resumeCalls, 'manual replay did not resume AudioContext')
  assert(audioRecovered.audio.startCalls > audioSuspended.audio.startCalls, 'manual replay did not start a demand tone')
  assert(audioRecovered.audio.states.some(state => state === 'running'), `audio did not recover: ${audioRecovered.audio.states}`)

  await pressKey(firstKeys.wrong)
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId === ${JSON.stringify(firstAttack.attackId)} && value.activeAttack.phase === 'returning';
  })()`, 'wrong return')
  const wrongReturn = await snapshot()
  assert(wrongReturn.earRaw === null, 'wrong answer graded EAR')
  await screenshot('02-wrong-return.png')
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId !== ${JSON.stringify(firstAttack.attackId)};
  })()`, 'wrong return completion', 5000)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await waitWall(100)
  const returned = await snapshot()
  const returnedAlien = returned.formation.ships.find(ship => ship.alienId === firstAttack.alienId)
  assert(returnedAlien?.alive === true, 'wrong-return alien did not survive')
  assert(returnedAlien.x === returnedAlien.formationX && returnedAlien.y === returnedAlien.formationY,
    `returned alien missed exact anchor: ${returnedAlien.x},${returnedAlien.y}`)

  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId !== ${JSON.stringify(firstAttack.attackId)} && value.activeAttack?.phase === 'outbound';
  })()`, 'reduced outbound')
  const reducedA = await snapshot()
  const secondAttack = reducedA.formation.activeAttack
  const reducedTargetA = reducedA.formation.ships.find(ship => ship.alienId === secondAttack.alienId)
  await waitWall(350)
  const reducedB = await snapshot()
  const reducedTargetB = reducedB.formation.ships.find(ship => ship.alienId === secondAttack.alienId)
  assert(reducedB.formation.activeAttack?.attackId === secondAttack.attackId, 'reduced attack identity changed')
  assert(reducedB.formation.activeAttack.outboundT > reducedA.formation.activeAttack.outboundT, 'reduced semantic time stopped')
  for (const targetState of [reducedTargetA, reducedTargetB]) {
    assert(targetState.x === targetState.formationX && targetState.y === targetState.formationY,
      'reduced-motion target translated')
  }

  const secondKeys = await evaluate(answerKeysExpression)
  assert(secondKeys.correct, 'reduced correct answer key missing')
  const gradeNote = secondAttack.note
  await pressKey(secondKeys.correct)
  await pressKey(secondKeys.correct)
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId !== ${JSON.stringify(secondAttack.attackId)} || value.activeAttack.phase === 'hit-locked';
  })()`, 'correct hit lock')
  const hitLocked = await snapshot()
  const gradedEntry = storeEntry(hitLocked.earRaw, gradeNote)
  assert(gradedEntry?.lastReview > 0, `correct key did not grade ${gradeNote} in EAR`)
  await waitFor(`(() => {
    const canvas = document.querySelector('canvas');
    const value = JSON.parse(canvas?.dataset.retroFormationState ?? '{}');
    return value.activeAttack?.attackId !== ${JSON.stringify(secondAttack.attackId)};
  })()`, 'correct terminal completion', 5000)
  const terminal = await snapshot()
  await pressKey(secondKeys.correct)
  await waitWall(200)
  const duplicateTerminal = await snapshot()
  assert(duplicateTerminal.earRaw === terminal.earRaw, 'post-terminal duplicate key graded twice')
  assert(terminal.formation.ships.find(ship => ship.alienId === secondAttack.alienId)?.alive === false,
    'correct terminal did not remove bound alien')
  await screenshot('03-reduced-correct-terminal.png')

  const desktopGameId = terminal.formation.gameId
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await waitWall(150)
  const phone = await snapshot()
  assert(phone.formation.gameId === desktopGameId, 'phone resize restarted the game')
  assert(phone.overflow <= 1, `phone overflow ${phone.overflow}`)
  assert(Math.abs(phone.css[0] / phone.css[1] - 16 / 9) < 0.01, `phone aspect drifted: ${phone.css}`)
  await screenshot('04-phone-390x844.png')
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: false })
  await waitWall(150)
  const landscape = await snapshot()
  assert(landscape.formation.gameId === desktopGameId, 'landscape resize restarted the game')
  assert(landscape.overflow <= 1, `landscape overflow ${landscape.overflow}`)
  assert(Math.abs(landscape.css[0] / landscape.css[1] - 16 / 9) < 0.01, `landscape aspect drifted: ${landscape.css}`)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)
  await screenshot('05-landscape-844x390.png')

  const version = await (await fetch(`${endpoint}/json/version`)).json()
  const receipt = {
    name, endpoint, browser: version.Browser, transport: 'raw-target-cdp', url,
    capturedAt: new Date().toISOString(),
    assertions: {
      routeAndGeometry: true,
      oneDiverAndImmutableBinding: true,
      exactlyOneDemand: true,
      preDemandInputDiscard: true,
      pausedInputDiscard: true,
      pauseFreeze: true,
      audioContextRecovery: true,
      exactWrongReturn: true,
      reducedMotionSemanticParity: true,
      terminalIdempotence: true,
      resizeOrientation: true,
      zeroOverflowAndErrors: true,
    },
    pause: { beforeHidden, hidden, hiddenDelta },
    audio: { suspended: audioSuspended.audio, recovered: audioRecovered.audio },
    wrongReturn: { attackId: firstAttack.attackId, alienId: firstAttack.alienId, returning: wrongReturn, returned },
    reduced: { attackId: secondAttack.attackId, alienId: secondAttack.alienId, first: reducedA, second: reducedB },
    terminal: { note: gradeNote, gradedEntry, state: terminal, duplicateState: duplicateTerminal },
    responsive: { phone, landscape },
    pageErrors,
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt, null, 2))
  console.log(`PASS ${name}: full hosted R3c Hawkeye matrix`)
} finally {
  if (originalStores) {
    await evaluate(`(() => {
      const restore = (key, value) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
      restore('pitch_fsrs_memory_ear', ${JSON.stringify(originalStores.ear)});
      restore('pitch_fsrs_memory', ${JSON.stringify(originalStores.voice)});
      return true;
    })()`).catch(() => {})
  }
  ws.close()
  await fetch(`${endpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => {})
}
