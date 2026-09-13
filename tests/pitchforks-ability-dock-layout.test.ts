import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)
const dockStart = source.indexOf('className="grid w-full max-w-[760px] sm:grid-cols-4 grid-cols-2 gap-2" data-testid="pf3-ability-dock"')
const dockEnd = source.indexOf('data-testid="pf3-replay-notes"', dockStart)
assert.ok(dockStart > 0 && dockEnd > dockStart, 'ability dock must precede the native replay row')
const dock = source.slice(dockStart, dockEnd)

const actionContracts = [
  ['pf3-close-smash-action', 'closeSmashActionDisabled', 'onClick={requestCloseSmash}'],
  ['pf3-raincall-action', 'raincallActionDisabled', 'onClick={activateRaincall}'],
  ['pf3-bell-arm', 'bellArmDisabled', 'onClick={requestBellArm}'],
  ['pf3-bell-release', 'bellReleaseDisabled', 'onClick={requestBellRelease}'],
  ['pf3-galvanic-bank', 'galvanicBankDisabled', 'onClick={requestGalvanicArm}'],
  ['pf3-galvanic-release', 'galvanicReleaseDisabled', 'onClick={requestGalvanicRelease}'],
  ['pf3-galvanic-cancel', 'galvanicCancelDisabled', 'onClick={() => cancelGalvanic()}'],
  ['pf3-thunderhead-arm', 'thunderheadArmDisabled', 'onClick={requestThunderheadArm}'],
  ['pf3-thunderhead-release', 'thunderheadReleaseDisabled', 'onClick={requestThunderheadRelease}'],
] as const

const actionIds = [...dock.matchAll(/data-testid="(pf3-[^"]+(?:action|arm|release|bank|cancel))"/g)]
  .map(match => match[1])
assert.deepEqual(actionIds, actionContracts.map(([testId]) => testId), 'ability action inventory must remain unchanged')

for (const [testId, disabledExpression, handler] of actionContracts) {
  const buttonStart = dock.indexOf(`data-testid="${testId}"`)
  const buttonEnd = dock.indexOf('</button>', buttonStart)
  assert.ok(buttonStart >= 0 && buttonEnd > buttonStart, `${testId} must remain a button`)
  const button = dock.slice(buttonStart, buttonEnd)
  assert.match(button, new RegExp(`disabled=\\{${disabledExpression}\\}`), `${testId} keeps its disabled expression`)
  assert.ok(button.includes(handler), `${testId} keeps its existing handler`)
  assert.match(button, /aria-describedby=/, `${testId} remains associated with status`) 
  assert.match(button, /min-h-12/, `${testId} keeps a 48px minimum height`)
  assert.match(button, /min-w-\[48px\]/, `${testId} keeps a 48px minimum width`)
  assert.match(button, /text-sm/, `${testId} keeps a readable visible label`)
}

const statusContracts = [
  ['pf3-close-smash-status', 'pf3-close-smash-control', 'pf3-close-smash-action'],
  ['pf3-bell-status', 'pf3-bell-control', 'pf3-bell-arm'],
  ['pf3-galvanic-status', 'pf3-galvanic-control', 'pf3-galvanic-bank'],
  ['pf3-thunderhead-status', 'pf3-thunderhead-control', 'pf3-thunderhead-arm'],
] as const
for (const [statusId, controlId, firstActionId] of statusContracts) {
  const controlStart = dock.indexOf(`data-testid="${controlId}"`)
  const statusStart = dock.indexOf(`data-testid="${statusId}"`, controlStart)
  const firstAction = dock.indexOf(`data-testid="${firstActionId}"`, statusStart)
  assert.ok(controlStart >= 0 && statusStart > controlStart && firstAction > statusStart, `${controlId} keeps status before its actions`)
  const statusEnd = dock.indexOf('>', statusStart)
  const status = dock.slice(statusStart, statusEnd)
  assert.equal((dock.match(new RegExp(`\\sid="${statusId}"`, 'g')) ?? []).length, 1, `${statusId} keeps one real id`)
  assert.match(status, new RegExp(`\\sid="${statusId}"`))
  assert.match(status, /role="status"/)
  assert.match(status, /text-sm/, `${statusId} remains visibly readable`)
}

assert.match(dock, /id="pf3-raincall-status" data-testid="pf3-raincall-status" className="sr-only"/)
assert.match(dock, /id="pf3-torch-status" data-testid="pf3-torch-status" className="sr-only"/)
assert.match(dock, /aria-describedby=\{demoMode \? 'pf3-raincall-status pf3-torch-status' : 'pf3-raincall-status'\}/)

for (const diagnostic of [
  'data-close-smash-phase={closeSmashState.phase}',
  'data-close-smash-target={closeSmashState.receipt?.targetKey ?? undefined}',
  'data-bell-phase={bellWaveState.phase}',
  'data-bell-radius={bellWaveProjection.radius.toFixed(1)}',
  'data-bell-contact-count={bellWaveState.contactedStableIDs.length}',
  'data-thunderhead-phase={thunderheadState.phase}',
  'data-thunderhead-target={thunderheadBank?.targetKey ?? undefined}',
  'data-thunderhead-rune-status={THUNDERHEAD_RUNE_STATUS}',
]) {
  assert.ok(dock.includes(diagnostic), `${diagnostic} remains available to diagnostics`)
}

for (const condition of [
  '{bellProof && <section',
  '{galvanicProof && <section',
  '{demoMode && <section',
]) {
  assert.ok(dock.includes(condition), `${condition} keeps its private proof gate`)
}

assert.match(dock, /className="grid w-full max-w-\[760px\] sm:grid-cols-4 grid-cols-2 gap-2" data-testid="pf3-ability-dock"/)
assert.match(dock, /data-testid="pf3-close-smash-control"[\s\S]*?className="[^"]*col-span-1[^"]*flex-col/)
assert.match(dock, /data-testid="pf3-raincall"[\s\S]*?className="[^"]*col-span-1[^"]*flex-col/)
for (const controlId of ['pf3-bell-control', 'pf3-galvanic-control', 'pf3-thunderhead-control']) {
  assert.match(dock, new RegExp(`data-testid="${controlId}"[\\s\\S]*?className="[^\"]*col-span-2[^\"]*flex-col`))
}
for (const statusId of ['pf3-bell-status', 'pf3-galvanic-status', 'pf3-thunderhead-status']) {
  assert.match(dock, new RegExp(`data-testid="${statusId}"[\\s\\S]*?className="flex min-w-0 flex-wrap items-stretch gap-2"`), `${statusId} keeps a separate wrapping action row`)
}
assert.doesNotMatch(dock, /\babsolute\b|\boverflow-(?:hidden|clip|x-hidden|y-hidden)\b/)
assert.doesNotMatch(dock, /SHOWCASE/, 'ability groups do not repeat visible SHOWCASE labels')

const bellStart = dock.indexOf('data-testid="pf3-bell-control"')
const bellEnd = dock.indexOf('data-testid="pf3-galvanic-control"', bellStart)
const bell = dock.slice(bellStart, bellEnd)
assert.match(bell, /aria-label=\{bellStatusCopy\}/, 'detailed Bell status remains available to assistive technology')
assert.doesNotMatch(bell, /PX|CONTACTS/, 'Bell visible copy does not expose radius/contact diagnostics')
assert.match(bell, /className="sr-only"[\s\S]*?PHYSICAL WAVE ONLY · NO TINE CREDIT/)
for (const label of [
  'IDLE · CHARGE THE EXACT NOTE',
  'ARMED · HOLD',
  'CHARGING · HOLD',
  'READY ·',
  'WAVE ACTIVE',
  'WAVE FINISHED',
]) {
  assert.ok(bell.includes(label), `Bell visible status keeps ${label.trim()} state`)
}

console.log('pitchforks ability dock layout: PASS (source guard; browser layout remains separately observed)')
