import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BLOCKED_PAID_AI_API_PATHS, HIDDEN_SURFACE_PREFIXES, decideFreeLaunch, isFreeLaunchOn } from '../src/lib/freeLaunch'

// Flag off: nothing changes for any path.
for (const p of ['/store', '/order/x', '/api/voice/chat', '/modules', '/peptides', '/']) {
  assert.deepEqual(decideFreeLaunch(p, false), { action: 'pass' }, `off: ${p}`)
}

// Flag on: hidden families redirect, including subpaths, but not look-alikes.
for (const p of ['/store', '/store/x', '/order', '/order/energybits', '/pricing', '/subscription', '/education/peptides', '/breath', '/affiliates', '/cellular-peptide/a', '/product/1']) {
  assert.deepEqual(decideFreeLaunch(p, true), { action: 'redirect', to: '/get-started' }, p)
}
for (const p of ['/storefront', '/ordering', '/peptides', '/nutrition', '/journal', '/audio', '/portal', '/get-started', '/api/peptides', '/']) {
  assert.deepEqual(decideFreeLaunch(p, true), { action: 'pass' }, p)
}
assert.deepEqual(decideFreeLaunch('/modules/3', true), { action: 'redirect', to: '/get-started' })
for (const p of ['/api/foods/analyze-image', '/api/voice/chat']) {
  const d = decideFreeLaunch(p, true)
  assert.equal(d.action, 'block')
}

// No gate target may itself be redirected by next.config.ts (would loop or chain).
const cfg = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8')
const cfgSources = Array.from(cfg.matchAll(/source:\s*'([^']+)'/g), ([, s]) => s)
const targets = new Set<string>()
for (const p of [...HIDDEN_SURFACE_PREFIXES, '/modules/3', '/store/x', ...BLOCKED_PAID_AI_API_PATHS]) {
  const d = decideFreeLaunch(p, true)
  if (d.action === 'redirect') targets.add(d.to)
}
for (const to of targets) {
  assert.ok(!cfgSources.includes(to), `gate target ${to} is redirected by next.config.ts`)
  assert.equal(decideFreeLaunch(to, true).action, 'pass', `gate target ${to} is itself gated`)
}

assert.equal(isFreeLaunchOn({}), false)
assert.equal(isFreeLaunchOn({ NEXT_PUBLIC_FREE_LAUNCH: 'on' }), true)
assert.equal(isFreeLaunchOn({ NEXT_PUBLIC_FREE_LAUNCH: 'true' }), false)
console.log('free-launch gate: PASS')
