import assert from 'node:assert/strict'
import { decideFreeLaunch, isFreeLaunchOn } from '../src/lib/freeLaunch'

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
assert.deepEqual(decideFreeLaunch('/modules/3', true), { action: 'redirect', to: '/audio' })
for (const p of ['/api/foods/analyze-image', '/api/voice/chat']) {
  const d = decideFreeLaunch(p, true)
  assert.equal(d.action, 'block')
}

assert.equal(isFreeLaunchOn({}), false)
assert.equal(isFreeLaunchOn({ NEXT_PUBLIC_FREE_LAUNCH: 'on' }), true)
assert.equal(isFreeLaunchOn({ NEXT_PUBLIC_FREE_LAUNCH: 'true' }), false)
console.log('free-launch gate: PASS')
