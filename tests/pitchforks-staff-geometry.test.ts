import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

/**
 * Evaluate the product's own staff helpers and renderer in memory. Keeping the
 * extraction here means this regression test exercises the exact source
 * geometry/render calls without adding test-only exports to the client component.
 */
function sourceBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker)
  assert.ok(start >= 0, `source marker missing: ${startMarker}`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(end > start, `source marker missing: ${endMarker}`)
  return source.slice(start, end)
}

const staffSource = [
  sourceBetween('function colorForCents', 'function drawForkAccuracyRibbon'),
  sourceBetween('function clamp', 'function hueForNote'),
  sourceBetween('const STAFF_PANEL_X', 'function drawDungeonArch'),
].join('\n')

const staffRuntimeSource = transpileModule(
  `
    function loadStaffRuntime() {
      ${staffSource}
      return {
        STAFF_PANEL_X,
        STAFF_PANEL_Y,
        STAFF_PANEL_W,
        STAFF_PANEL_H,
        STAFF_LEFT,
        STAFF_RIGHT,
        STAFF_BOTTOM_LINE_Y,
        STAFF_LINE_GAP,
        staffNote,
        staffY,
        drawStaffNotationView,
      }
    }
    return loadStaffRuntime()
  `,
  {
    compilerOptions: {
      module: ModuleKind.None,
      target: ScriptTarget.ES2022,
    },
  },
).outputText

const staff = new Function(staffRuntimeSource)() as {
  STAFF_PANEL_X: number
  STAFF_PANEL_Y: number
  STAFF_PANEL_W: number
  STAFF_PANEL_H: number
  STAFF_LEFT: number
  STAFF_RIGHT: number
  STAFF_BOTTOM_LINE_Y: number
  STAFF_LINE_GAP: number
  staffNote: (note: string | null) => { name: string; stepFromE4: number } | null
  staffY: (note: { stepFromE4: number }) => number
  drawStaffNotationView: (ctx: CanvasRenderingContext2D, view: unknown) => void
}

type DrawCall = {
  kind: string
  args: unknown[]
}

function traceContext(): CanvasRenderingContext2D & { calls: DrawCall[] } {
  const calls: DrawCall[] = []
  const record = (kind: string, ...args: unknown[]) => calls.push({ kind, args })
  return {
    calls,
    save: () => record('save'),
    restore: () => record('restore'),
    beginPath: () => record('beginPath'),
    closePath: () => record('closePath'),
    roundRect: (...args: unknown[]) => record('roundRect', ...args),
    moveTo: (...args: unknown[]) => record('moveTo', ...args),
    lineTo: (...args: unknown[]) => record('lineTo', ...args),
    ellipse: (...args: unknown[]) => record('ellipse', ...args),
    arc: (...args: unknown[]) => record('arc', ...args),
    fill: () => record('fill'),
    stroke: () => record('stroke'),
    fillText: (...args: unknown[]) => record('fillText', ...args),
    measureText: (text: string) => ({ width: text.length * 6 }),
  } as unknown as CanvasRenderingContext2D & { calls: DrawCall[] }
}

type NoteView = {
  tuner: {
    visible: boolean
    sourceNote: string | null
    canUseSource: boolean
    renderDeviation: number | null
    onTarget: boolean
  }
  active: { villagerId: number } | null
  villagers: Array<{
    id: number
    notes: string[]
    visualBurn: number
    burned: number
  }>
  noteNamesVisible: boolean
}

function renderStaffFrame(
  queue: string[],
  activeIndex: number,
  sourceNote: string | null = queue[activeIndex] ?? null,
) {
  const ctx = traceContext()
  const targetNote = queue[activeIndex]
  assert.ok(targetNote, `active staff target ${activeIndex} should exist`)
  const view: NoteView = {
    tuner: {
      visible: true,
      sourceNote,
      canUseSource: sourceNote !== null,
      renderDeviation: sourceNote === null ? null : 0,
      onTarget: sourceNote !== null,
    },
    active: { villagerId: 1 },
    villagers: [{ id: 1, notes: queue, visualBurn: activeIndex, burned: activeIndex }],
    noteNamesVisible: true,
  }
  staff.drawStaffNotationView(ctx, view)
  return ctx
}

const expectedY: Record<string, number> = {
  // Independent contract coordinates: bottom line E4 = 109px, half-step = 4px.
  C4: 117,
  E4: 109,
  F4: 105,
  A4: 97,
  B4: 93,
  C5: 89,
  F5: 77,
}

const expectedStep: Record<string, number> = {
  C4: -2,
  E4: 0,
  F4: 1,
  A4: 3,
  B4: 4,
  C5: 5,
  F5: 8,
}

const queueX = (queueLength: number, index: number) => {
  const queueLeft = staff.STAFF_LEFT + 42
  const queueRight = staff.STAFF_RIGHT - 24
  return queueLength === 1
    ? (queueLeft + queueRight) / 2
    : queueLeft + ((queueRight - queueLeft) / (queueLength - 1)) * index
}

function targetEllipse(ctx: ReturnType<typeof traceContext>, expectedX: number) {
  const matches = ctx.calls.filter(call => call.kind === 'ellipse' && call.args[0] === expectedX)
  assert.equal(matches.length, 1, `one target note head should be rendered at x=${expectedX}`)
  return matches[0]
}

function heardDiamondCenter(ctx: ReturnType<typeof traceContext>, expectedX: number): number {
  const index = ctx.calls.findIndex((call, callIndex) => {
    if (call.kind !== 'moveTo' || call.args[0] !== expectedX) return false
    const next = ctx.calls[callIndex + 1]
    return next?.kind === 'lineTo' && next.args[0] === expectedX + 5
  })
  assert.ok(index >= 0, `heard marker should start at x=${expectedX}`)
  return Number(ctx.calls[index].args[1]) + 5
}

function targetHighlightArcs(ctx: ReturnType<typeof traceContext>) {
  return ctx.calls
    .filter(call => call.kind === 'arc' && call.args[2] === 11)
    .map(call => ({ x: call.args[0], y: call.args[1], radius: call.args[2] }))
}

function ledgerSegments(ctx: ReturnType<typeof traceContext>) {
  const segments: Array<{ x1: number; y: number; x2: number }> = []
  for (let index = 0; index < ctx.calls.length - 1; index += 1) {
    const start = ctx.calls[index]
    const end = ctx.calls[index + 1]
    if (
      start.kind === 'moveTo' &&
      end.kind === 'lineTo' &&
      typeof start.args[0] === 'number' &&
      typeof start.args[1] === 'number' &&
      end.args[1] === start.args[1] &&
      end.args[0] === start.args[0] + 22
    ) {
      segments.push({ x1: start.args[0], y: start.args[1], x2: end.args[0] })
    }
  }
  return segments
}

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

for (const [noteName, y] of Object.entries(expectedY)) {
  const note = staff.staffNote(noteName)
  check(() => assert.ok(note, `${noteName} should parse as a staff note`))
  check(() => assert.equal(note?.stepFromE4, expectedStep[noteName]))
  check(() => assert.equal(note ? staff.staffY(note) : null, y, `${noteName} staff y`))
}

check(() => assert.equal(staff.STAFF_BOTTOM_LINE_Y, 109, 'treble bottom line coordinate'))
check(() => assert.equal(staff.STAFF_LINE_GAP, 8, 'treble line spacing'))
check(() => assert.match(source, /if \(view\.staffNotationVisible\) drawStaffNotationView\(ctx, view\)/, 'main canvas calls staff renderer'))
check(() => assert.match(source, /const staffCanvas = staffCanvasRef\.current[\s\S]*?drawStaffNotationView\(staffCtx, view\)/, 'portrait staff canvas calls staff renderer'))

const namedQueue = Object.keys(expectedY)
for (const [activeIndex, noteName] of namedQueue.entries()) {
  const ctx = renderStaffFrame(namedQueue, activeIndex)
  const expectedX = queueX(namedQueue.length, activeIndex)
  const ellipse = targetEllipse(ctx, expectedX)
  const targetY = Number(ellipse.args[1])
  check(() => assert.equal(targetY, expectedY[noteName], `${noteName} actual rendered target y`))
  check(() => assert.equal(heardDiamondCenter(ctx, expectedX), expectedY[noteName], `${noteName} heard marker y`))
  check(() => assert.equal(ellipse.args[0], expectedX, `${noteName} active-index x linkage`))
  check(() => assert.deepEqual(
    targetHighlightArcs(ctx),
    [{ x: expectedX, y: expectedY[noteName], radius: 11 }],
    `${noteName} has exactly one active target highlight at its queue index`,
  ))
}

const splitSourceFrame = renderStaffFrame(namedQueue, 4, 'C5')
check(() => assert.equal(Number(targetEllipse(splitSourceFrame, queueX(namedQueue.length, 4)).args[1]), expectedY.B4, 'target B4 y remains independent of heard C5'))
check(() => assert.equal(heardDiamondCenter(splitSourceFrame, queueX(namedQueue.length, 4)), expectedY.C5, 'heard C5 uses its own source coordinate'))
check(() => assert.deepEqual(
  splitSourceFrame.calls
    .filter(call => call.kind === 'fillText' && typeof call.args[0] === 'string' && /^[A-G][#b]?-?\d+$/.test(call.args[0]))
    .map(call => call.args[0]),
  [...namedQueue, 'C5'],
  'multi-note queue labels remain source note names',
))

const ascendingQueue = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']
const trajectoryExpectedY = [117, 113, 109, 105, 101, 97, 93, 89, 85, 81, 77]
const ascendingRenderedY = ascendingQueue.map((noteName, activeIndex) => {
  const ctx = renderStaffFrame(ascendingQueue, activeIndex, noteName)
  const expectedX = queueX(ascendingQueue.length, activeIndex)
  check(() => assert.deepEqual(
    targetHighlightArcs(ctx),
    [{ x: expectedX, y: trajectoryExpectedY[activeIndex], radius: 11 }],
    `ascending active target ${noteName} highlight follows the changing index`,
  ))
  return Number(targetEllipse(ctx, expectedX).args[1])
})
check(() => assert.deepEqual(ascendingRenderedY, trajectoryExpectedY, 'ascending renderer trajectory'))
check(() => assert.ok(ascendingRenderedY.every((y, index) => index === 0 || y < ascendingRenderedY[index - 1]), 'ascending rendered targets move upward'))

const descendingQueue = [...ascendingQueue].reverse()
const descendingRenderedY = descendingQueue.map((noteName, activeIndex) => {
  const ctx = renderStaffFrame(descendingQueue, activeIndex, noteName)
  const expectedX = queueX(descendingQueue.length, activeIndex)
  check(() => assert.deepEqual(
    targetHighlightArcs(ctx),
    [{ x: expectedX, y: [...trajectoryExpectedY].reverse()[activeIndex], radius: 11 }],
    `descending active target ${noteName} highlight follows the changing index`,
  ))
  return Number(targetEllipse(ctx, expectedX).args[1])
})
check(() => assert.deepEqual(descendingRenderedY, [...trajectoryExpectedY].reverse(), 'descending renderer trajectory'))
check(() => assert.ok(descendingRenderedY.every((y, index) => index === 0 || y > descendingRenderedY[index - 1]), 'descending rendered targets move downward'))

const singleTargetX = queueX(1, 0)
const exactLedger = (...ys: number[]) => ys.map(y => ({ x1: singleTargetX - 11, y, x2: singleTargetX + 11 }))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['C4'], 0, null)), exactLedger(expectedY.C4), 'C4 has exactly one ledger below the staff'))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['E4'], 0, null)), [], 'E4 has no ledger line inside the staff'))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['A5'], 0, null)), exactLedger(69), 'A5 has exactly one ledger above the staff'))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['C6'], 0, null)), exactLedger(69, 61), 'C6 has exactly the two required upper ledgers'))
// Target and heard overlay intentionally each draw their own ledger layer.
// Matching C4 therefore has two identical segments; differing low/high notes
// have exactly one segment at each applicable position, with no extras.
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['C4'], 0, 'C4')), exactLedger(expectedY.C4, expectedY.C4), 'matching C4 keeps target plus heard ledger layers'))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['C4'], 0, 'A5')), exactLedger(expectedY.C4, 69), 'C4 target plus high A5 heard ledger layers'))
check(() => assert.deepEqual(ledgerSegments(renderStaffFrame(['A5'], 0, 'C4')), exactLedger(69, expectedY.C4), 'A5 target plus low C4 heard ledger layers'))
check(() => assert.deepEqual(
  renderStaffFrame(['C4'], 0, null).calls
    .filter(call => call.kind === 'fillText' && typeof call.args[0] === 'string' && /^[A-G][#b]?-?\d+$/.test(call.args[0]))
    .map(call => call.args[0]),
  ['C4'],
  'C4 label is not mislabeled F4',
))

console.log(`pitchforks staff geometry: ${checks}/${checks} PASS`)
