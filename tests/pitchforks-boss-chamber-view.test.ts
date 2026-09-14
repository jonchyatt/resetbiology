import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_BOSS_CHAMBER_CANVAS,
  renderBossChamber,
  type PitchforksBossChamberAssets,
  type PitchforksBossChamberCanvasContext,
} from '../src/components/PitchDefender/PitchforksBossChamberView'
import { type PitchforksBossRecitalState } from '../src/components/PitchDefender/pitchforksBossRecital'

type Call = Readonly<{ op: string; args: readonly unknown[] }>

function recorder(): { ctx: PitchforksBossChamberCanvasContext; calls: Call[] } {
  const calls: Call[] = []
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target as PitchforksBossChamberCanvasContext, {
    get: (_, key: string) => {
      if (key === 'globalAlpha') return 1
      if (key === 'imageSmoothingEnabled') return true
      return (...args: unknown[]) => calls.push({ op: key, args })
    },
    set: (_, key: string, value: unknown) => {
      calls.push({ op: `set:${key}`, args: [value] })
      return true
    },
  })
  return { ctx, calls }
}

const image = (name: string) => ({ name }) as unknown as CanvasImageSource

const assets = (overrides: Partial<PitchforksBossChamberAssets> = {}): PitchforksBossChamberAssets => ({
  frankIdle: image('frank-idle'),
  frankCharge: image('frank-charge'),
  stormHeart: image('storm-heart'),
  bellringerRest: image('bellringer-rest'),
  torchmasterChamberPlate: image('torchmaster-plate'),
  villageGatePlate: image('village-plate'),
  bellTowerPlate: image('bell-tower-plate'),
  cathedralPlate: image('cathedral-plate'),
  bellringerChamberPlate: image('private-bellringer-plate'),
  frankMeta: { frame_w: 96, frame_h: 144, frames: 4, rod_tip: { x: 16, y: 0 } },
  walkLeft: { 1: image('villager-1') },
  villagerMeta: { 1: { frame_w: 16, frame_h: 24 } },
  ...overrides,
})

const state = (overrides: Partial<PitchforksBossRecitalState> = {}): PitchforksBossRecitalState => ({
  attempt: 'test-attempt',
  lane: 'voice',
  sequence: ['C4', 'A4'],
  cursor: 0,
  currentNote: 'C4',
  status: 'active',
  claimId: 'claim-1',
  hinted: false,
  pendingReceipt: null,
  lastReceipt: null,
  ...overrides,
})

const imageCalls = (calls: readonly Call[]) => calls.filter(call => call.op === 'drawImage')
const textCalls = (calls: readonly Call[]) => calls.filter(call => call.op === 'fillText').map(call => String(call.args[0]))

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  assert.deepEqual(PITCHFORKS_BOSS_CHAMBER_CANVAS, { width: 720, height: 405 })
  const expected = [
    ['dungeon', 'torchmaster-plate'],
    ['village-gate', 'village-plate'],
    ['bell-tower', 'bell-tower-plate'],
    ['cathedral', 'cathedral-plate'],
  ] as const
  for (const [world, plateName] of expected) {
    const { ctx, calls } = recorder()
    renderBossChamber(ctx, assets(), state(), 0.4, 2, false, world === 'dungeon' ? 'torchmaster' : world === 'village-gate' ? 'choirmaster' : 'bellringer', world)
    assert.equal((imageCalls(calls)[0]?.args[0] as { name?: string } | undefined)?.name, plateName, `plate selected for ${world}`)
    assert.deepEqual(imageCalls(calls)[0]?.args.slice(1), [0, 0, 720, 405])
  }
})

check(() => {
  const { ctx, calls } = recorder()
  renderBossChamber(ctx, assets(), state(), 0.62, 2, false, 'choirmaster', 'village-gate')
  const text = textCalls(calls).join('|')
  assert.match(text, /THE VILLAGE GATE/)
  assert.match(text, /THE CHOIRMASTER/)
  assert.match(text, /C4/)
  assert.match(text, /NOTE 1 OF 2/)
  assert.match(text, /VOICE LOCK/)
  assert.ok(imageCalls(calls).some(call => call.args[0] && (call.args[0] as { name?: string }).name === 'villager-1'))
})

check(() => {
  const { ctx, calls } = recorder()
  renderBossChamber(ctx, assets(), state(), 0, 1, true, 'torchmaster', 'dungeon')
  assert.ok(imageCalls(calls).some(call => (call.args[0] as { name?: string }).name === 'frank-idle'))
  assert.ok(!imageCalls(calls).some(call => (call.args[0] as { name?: string }).name === 'frank-charge'))
})

check(() => {
  const { ctx, calls } = recorder()
  renderBossChamber(ctx, assets(), state({ currentNote: 'A4' }), 0.9, 1, false, 'bellringer', 'bell-tower')
  assert.ok(imageCalls(calls).some(call => (call.args[0] as { name?: string }).name === 'frank-idle'))
  assert.ok(!imageCalls(calls).some(call => (call.args[0] as { name?: string }).name === 'frank-charge'))
  assert.ok(imageCalls(calls).some(call => (call.args[0] as { name?: string }).name === 'bellringer-rest'))
  assert.match(textCalls(calls).join('|'), /THE BELLRINGER/)
  assert.match(textCalls(calls).join('|'), /A4/)
})

check(() => {
  const { ctx, calls } = recorder()
  renderBossChamber(ctx, assets(), state({ lane: 'ear', currentNote: 'E4', hinted: false }), 0.25, 1, false, 'bellringer', 'bell-tower')
  assert.match(textCalls(calls).join('|'), /LISTEN FOR THE NOTE/)
  assert.doesNotMatch(textCalls(calls).join('|'), /\|E4\|/)
})

check(() => {
  const first = recorder()
  const second = recorder()
  const input = state({ currentNote: 'G4' })
  const inputAssets = assets()
  renderBossChamber(first.ctx, inputAssets, input, 0.8, 4, true, 'torchmaster', 'dungeon')
  renderBossChamber(second.ctx, inputAssets, input, 0.8, 4, true, 'torchmaster', 'dungeon')
  assert.deepEqual(first.calls, second.calls, 'same state/assets/clock produce the same paused-safe render trace')
  assert.ok(first.calls.filter(call => call.op === 'set:imageSmoothingEnabled').length >= 1)
})

check(() => {
  const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksBossChamberView.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  assert.match(source, /export function renderBossChamber\(/)
  assert.match(source, /plateKey: 'torchmasterChamberPlate'/)
  assert.match(source, /plateKey: 'villageGatePlate'/)
  assert.match(source, /plateKey: 'bellTowerPlate'/)
  assert.match(source, /plateKey: 'cathedralPlate'/)
  assert.match(source, /UNTIMED RECITAL · NO CLOCK/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /new\s+Image\s*\(/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|setTimeout|requestAnimationFrame/)
})

console.log(`pitchforks boss chamber view: ${checks}/${checks} PASS (pure canvas harness only; visual acceptance remains Terra/Argus)`)
