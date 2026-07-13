import { registerHooks } from 'node:module'

// Node 24 strips TypeScript types natively. This resolver only supplies the
// extension that browser-bundler imports intentionally omit.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

const engine = await import(new URL('../../src/components/PitchDefender/retroBlasterEngine.ts', import.meta.url))

const INTRO_ORDER = [
  'C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5',
  'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3',
]
const UNLOCK_THRESHOLDS = {
  2: 5, 3: 7, 4: 10, 5: 13, 6: 16, 7: 20,
  8: 8, 9: 10, 10: 12, 11: 14, 12: 16, 13: 18, 14: 20,
}
const NOTE_HUES = { C4: 0, D4: 30, E4: 60, F4: 140, G4: 185 }
const C4 = 261.6255653005986
const WRONG = 369.9944227116344
const onPitch = { note: 'C4', frequency: C4, cents: 0, confidence: 1, isActive: true }
const wrongPitch = { note: 'F#4', frequency: WRONG, cents: 0, confidence: 1, isActive: true }
const silence = { note: 'C4', frequency: 0, cents: 0, confidence: 0, isActive: false }

function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function alien(note = 'C4', x = 120, y = 120) {
  return { x, y, note, hue: NOTE_HUES[note] ?? 0, alive: true, frame: 0, hitTimer: 0 }
}

function engineFixture(aliens = [alien()]) {
  const state = engine.createInitialState('easy', ['C4', 'D4', 'E4', 'F4'], 1000)
  state.aliens = aliens.map(a => ({ ...a }))
  state.activeIdx = state.aliens.length ? 0 : -1
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.alienCountThisWave = state.aliens.length
  state.nextSpawnAt = Number.POSITIVE_INFINITY
  state.lastProgressAt = state.clockMs
  return state
}

function engineStep(state, pitch, dtMs, extra = {}) {
  return engine.tick(state, {
    inputMode: 'mic', isListening: true, pitch, fsrs: {}, ...extra,
  }, dtMs, seededRng(424242))
}

// REFERENCE FIXTURE: instrumented copy of RetroBlaster.tsx lock arbitration
// and hit transitions. It is deliberately independent from the engine.
function noteClass(name) {
  return name.replace(/\d+$/, '')
}

function pickTargetForNote(aliens, answeredNote, playerX) {
  const targetClass = noteClass(answeredNote)
  let best = null
  let bestIdx = -1
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i]
    if (!a.alive || noteClass(a.note) !== targetClass) continue
    if (!best) { best = a; bestIdx = i; continue }
    const dy = a.y - best.y
    if (Math.abs(dy) > 4) {
      if (dy > 0) { best = a; bestIdx = i }
    } else if (Math.abs(a.x - playerX) < Math.abs(best.x - playerX)) {
      best = a; bestIdx = i
    }
  }
  return best ? { alien: best, index: bestIdx } : null
}

function foldedCents(detectedFreq, targetFreq) {
  let cents = 1200 * Math.log2(detectedFreq / targetFreq)
  while (cents > 600) cents -= 1200
  while (cents < -600) cents += 1200
  return cents
}

function noteFreq(note) {
  return note === 'C4' ? C4 : note === 'D4' ? 293.6647679174076 :
    note === 'E4' ? 329.6275569128699 : note === 'F4' ? 349.2282314330039 :
    note === 'G4' ? 391.99543598174927 : 440
}

function referenceFixture(aliens = [alien()]) {
  return {
    aliens: aliens.map(a => ({ ...a })), playerX: 240, activeIdx: aliens.length ? 0 : -1,
    score: 0, combo: 0, maxCombo: 0, cityHealth: 5,
    unlockedNotes: ['C4', 'D4', 'E4', 'F4'], consecutiveCorrect: 0,
    now: 1000, matchStart: 0, matchTargetIdx: -1, cooldownMs: 0,
    chargeProgress: 0, grades: [], fires: [], unlocks: [],
  }
}

function referenceHit(gs, answeredNote, latencyMs = 2000) {
  const pick = pickTargetForNote(gs.aliens, answeredNote, gs.playerX)
  if (pick) {
    const { alien: target } = pick
    gs.grades.push({ note: target.note, correct: true, latencyMs })
    gs.fires.push(gs.now - 1000)
    gs.playerX = target.x + 12
    gs.combo++
    gs.maxCombo = Math.max(gs.maxCombo, gs.combo)
    const mult = gs.combo >= 10 ? 3 : gs.combo >= 5 ? 2 : 1
    gs.score += 100 * mult
    gs.consecutiveCorrect++
    const poolSize = gs.unlockedNotes.length
    const threshold = UNLOCK_THRESHOLDS[poolSize]
    if (threshold && gs.consecutiveCorrect >= threshold && poolSize < INTRO_ORDER.length) {
      const newNote = INTRO_ORDER[poolSize]
      gs.unlockedNotes = [...gs.unlockedNotes, newNote]
      gs.consecutiveCorrect = 0
      gs.unlocks.push(newNote)
    }
    return pick.index
  }
  gs.combo = 0
  gs.consecutiveCorrect = 0
  gs.cityHealth = Math.max(0, gs.cityHealth - 1)
  return -1
}

function referenceMicStep(gs, pitch, dtMs) {
  gs.now += dtMs
  gs.cooldownMs = Math.max(0, gs.cooldownMs - dtMs)
  if (gs.cooldownMs === 0 && gs.matchStart === -1) gs.matchStart = 0

  if (pitch?.isActive && pitch.confidence >= 0.75 && pitch.frequency > 0) {
    let bestIdx = -1
    let bestCentsOff = Infinity
    for (let i = 0; i < gs.aliens.length; i++) {
      const a = gs.aliens[i]
      if (!a.alive) continue
      const cents = foldedCents(pitch.frequency, noteFreq(a.note))
      if (Math.abs(cents) < Math.abs(bestCentsOff)) {
        bestCentsOff = cents
        bestIdx = i
      }
    }

    if (bestIdx >= 0 && Math.abs(bestCentsOff) <= 70) {
      if (gs.matchStart === -1) {
        // post-fire cooldown — do nothing
      } else if (gs.matchTargetIdx !== bestIdx) {
        gs.matchTargetIdx = bestIdx
        gs.matchStart = gs.now
      } else if (gs.matchStart === 0) {
        gs.matchStart = gs.now
        gs.matchTargetIdx = bestIdx
      }
      if (gs.matchStart > 0) gs.activeIdx = bestIdx
      if (gs.matchStart > 0) {
        const held = gs.now - gs.matchStart
        const progress = Math.min(1, held / 300)
        gs.chargeProgress = progress * 300
        if (progress >= 1) {
          const target = gs.aliens[bestIdx]
          gs.matchStart = -1
          gs.matchTargetIdx = -1
          gs.cooldownMs = 600
          gs.chargeProgress = 0
          referenceHit(gs, target.note)
        }
      }
    } else if (gs.matchStart > 0) {
      gs.matchStart = 0
      gs.matchTargetIdx = -1
      gs.chargeProgress = 0
    }
  }
  // Silent or low confidence: preserve the in-progress lock.
}

function runMicTrace(steps) {
  let actual = engineFixture()
  const expected = referenceFixture()
  const actualFires = []
  const actualGrades = []
  for (const [dtMs, pitch] of steps) {
    referenceMicStep(expected, pitch, dtMs)
    const result = engineStep(actual, pitch, dtMs)
    actual = result.state
    for (const event of result.events) {
      if (event.kind === 'grade') {
        actualFires.push(actual.clockMs - 1000)
        actualGrades.push({ note: event.note, correct: event.correct, latencyMs: event.latencyMs })
      }
    }
  }
  return {
    reference: { fires: expected.fires, grades: expected.grades },
    engine: { fires: actualFires, grades: actualGrades },
  }
}

function runHitTrace() {
  const aliens = Array.from({ length: 10 }, (_, i) => alien('C4', 80 + i * 20, 100 + i * 5))
  aliens.push(alien('D4', 240, 90))
  const ref = referenceFixture(aliens)
  let actual = engineFixture(aliens)
  const referenceTransitions = []
  const engineTransitions = []
  const referenceGrades = []
  const engineGrades = []
  const referenceUnlocks = []
  const engineUnlocks = []

  for (let i = 0; i < 10; i++) {
    const refIdx = referenceHit(ref, 'C4')
    referenceGrades.push(ref.grades.at(-1))
    if (ref.unlocks.length > referenceUnlocks.length) referenceUnlocks.push(ref.unlocks.at(-1))
    referenceTransitions.push([ref.score, ref.combo, ref.cityHealth])
    ref.aliens[refIdx].alive = false

    const result = engine.tick(actual, {
      inputMode: 'click', isListening: false, pitch: null,
      answeredNote: 'C4', latencyMs: 2000, fsrs: {},
    }, 0, seededRng(7))
    actual = result.state
    const grade = result.events.find(e => e.kind === 'grade')
    if (grade) engineGrades.push({ note: grade.note, correct: grade.correct, latencyMs: grade.latencyMs })
    const unlocked = result.events.find(e => e.kind === 'unlock')
    if (unlocked) engineUnlocks.push(unlocked.note)
    engineTransitions.push([actual.score, actual.combo, actual.cityHealth])
    const idx = actual.lasers.at(-1).targetIdx
    actual.aliens[idx].alive = false
    actual.lasers = []
    actual.answerCooldownMs = 0
  }

  referenceHit(ref, 'B4')
  referenceTransitions.push([ref.score, ref.combo, ref.cityHealth])
  const wrong = engine.tick(actual, {
    inputMode: 'click', isListening: false, pitch: null,
    answeredNote: 'B4', latencyMs: 2000, fsrs: {},
  }, 0, seededRng(7))
  actual = wrong.state
  engineTransitions.push([actual.score, actual.combo, actual.cityHealth])

  return {
    reference: { transitions: referenceTransitions, grades: referenceGrades, unlocks: referenceUnlocks },
    engine: { transitions: engineTransitions, grades: engineGrades, unlocks: engineUnlocks },
  }
}

function runEscapeTrace() {
  const reference = { shields: 5, combo: 4, sfx: [] }
  const escaping = alien('C4', 120, engine.PLAYER_Y - 10)
  if (escaping.alive && escaping.y >= engine.PLAYER_Y - 10) {
    escaping.alive = false
    reference.shields = Math.max(0, reference.shields - 1)
    reference.combo = 0
    reference.sfx.push('wrong')
  }

  const state = engineFixture([alien('C4', 120, engine.PLAYER_Y - 10)])
  state.combo = 4
  state.spawnQueue = ['D4']
  const result = engine.tick(state, {
    inputMode: 'click', isListening: false, pitch: null, fsrs: {},
  }, 0, seededRng(11))
  return {
    reference,
    engine: {
      shields: result.state.cityHealth,
      combo: result.state.combo,
      sfx: result.events.filter(e => e.kind === 'sfx').map(e => e.name),
    },
  }
}

function shuffle(arr, seed) {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 0x100000000
    const j = Math.floor((s / 0x100000000) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function referenceQueue(wave, pool, count) {
  const must = count >= pool.length ? [...pool] : []
  const remaining = Math.max(0, count - must.length)
  const weights = pool.map(() => 1.2)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const sampled = []
  let rng = wave * 1000003 + 17
  for (let i = 0; i < remaining; i++) {
    rng = (rng * 1664525 + 1013904223) % 0x100000000
    const target = (rng / 0x100000000) * totalWeight
    let acc = 0
    let chosen = pool[0]
    for (let j = 0; j < pool.length; j++) {
      acc += weights[j]
      if (target <= acc) { chosen = pool[j]; break }
    }
    sampled.push(chosen)
  }
  const combined = shuffle([...must, ...sampled], wave * 104729)
  for (let i = 2; i < combined.length; i++) {
    if (combined[i] === combined[i - 1] && combined[i] === combined[i - 2]) {
      const alt = pool.find(p => p !== combined[i])
      if (alt) combined[i] = alt
    }
  }
  return combined
}

function referencePickSpawnX(aliens, laneOrderSeed) {
  const lanes = [480 * 0.14, 480 * 0.30, 480 * 0.46, 480 * 0.62, 480 * 0.86]
  const order = shuffle([0, 1, 2, 3, 4], laneOrderSeed)
  let bestLane = -1
  let bestY = -Infinity
  for (const i of order) {
    const lx = lanes[i]
    let topY = 320
    for (const a of aliens) {
      if (!a.alive) continue
      if (Math.abs(a.x + 12 - lx) < 24 && a.y < topY) topY = a.y
    }
    if (topY < 70 + 18 + 16) continue
    if (topY > bestY) { bestY = topY; bestLane = i }
  }
  return bestLane < 0 ? null : Math.floor(lanes[bestLane] - 12)
}

function runSpawnTrace() {
  const pool = ['C4', 'D4', 'E4', 'F4']
  const queue = referenceQueue(1, pool, 2)
  const refAliens = []
  const refSpawns = []
  for (let i = 0; i < queue.length; i++) {
    const x = referencePickSpawnX(refAliens, 31 + i)
    refAliens.push(alien(queue[i], x, 70))
    refSpawns.push({ note: queue[i], x })
  }

  let state = engine.createInitialState('easy', pool, 1000)
  state.waveIntroTimer = 0
  engine.buildWaveQueue(state, {})
  const engineQueue = [...state.spawnQueue]
  const engineSpawns = []
  for (const dt of [600, 1100]) {
    const result = engine.tick(state, {
      inputMode: 'click', isListening: false, pitch: null, fsrs: {},
    }, dt, seededRng(12345))
    state = result.state
    for (const event of result.events) {
      if (event.kind === 'spawn') {
        const legacyCenterX = (event.x + engine.ALIEN_W / 2) * (480 / engine.W)
        engineSpawns.push({ note: event.note, x: Math.round(legacyCenterX - 12) })
      }
    }
  }
  return {
    reference: { queue, spawns: refSpawns },
    engine: { queue: engineQueue, spawns: engineSpawns },
  }
}

const traces = [
  ['t1 clean hold @300ms', () => runMicTrace([[0, onPitch], [100, onPitch], [100, onPitch], [100, onPitch]])],
  ['t2 silence flicker preserved', () => runMicTrace([[0, onPitch], [100, onPitch], [100, silence], [100, onPitch]])],
  ['t3 confident wrong resets', () => runMicTrace([[0, onPitch], [150, onPitch], [0, wrongPitch], [0, onPitch], [100, onPitch], [100, onPitch], [100, onPitch]])],
  ['t4 600ms post-fire cooldown', () => runMicTrace([[0, onPitch], [100, onPitch], [100, onPitch], [100, onPitch], [599, onPitch], [1, onPitch], [100, onPitch], [100, onPitch], [100, onPitch]])],
  ['t5 click hit/wrong transitions', runHitTrace],
  ['t6 alien escape shield loss', runEscapeTrace],
  ['t7 seeded full-wave spawn order (normalized geometry)', runSpawnTrace],
]

const rows = []
let failed = false
for (const [trace, run] of traces) {
  try {
    const value = run()
    const reference = JSON.stringify(value.reference)
    const actual = JSON.stringify(value.engine)
    const pass = reference === actual
    if (!pass) failed = true
    rows.push({ trace, reference, engine: actual, result: pass ? 'PASS' : 'FAIL' })
  } catch (error) {
    failed = true
    rows.push({ trace, reference: 'completed', engine: error instanceof Error ? error.message : String(error), result: 'FAIL' })
  }
}

const widths = {
  trace: Math.max('TRACE'.length, ...rows.map(r => r.trace.length)),
  reference: Math.max('REFERENCE'.length, ...rows.map(r => r.reference.length)),
  engine: Math.max('ENGINE'.length, ...rows.map(r => r.engine.length)),
  result: 6,
}
const line = `+-${'-'.repeat(widths.trace)}-+-${'-'.repeat(widths.reference)}-+-${'-'.repeat(widths.engine)}-+-${'-'.repeat(widths.result)}-+`
console.log(line)
console.log(`| ${'TRACE'.padEnd(widths.trace)} | ${'REFERENCE'.padEnd(widths.reference)} | ${'ENGINE'.padEnd(widths.engine)} | ${'RESULT'.padEnd(widths.result)} |`)
console.log(line)
for (const row of rows) {
  console.log(`| ${row.trace.padEnd(widths.trace)} | ${row.reference.padEnd(widths.reference)} | ${row.engine.padEnd(widths.engine)} | ${row.result.padEnd(widths.result)} |`)
}
console.log(line)
console.log(failed ? 'R0 PARITY: FAIL' : 'R0 PARITY: ALL PASS')
if (failed) process.exitCode = 1
