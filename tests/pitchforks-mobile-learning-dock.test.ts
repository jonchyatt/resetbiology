import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const playStart = source.indexOf('data-testid="pf3-learning-dock"')
const playEnd = source.indexOf('{geometryDebug && (', playStart)
assert.ok(playStart >= 0 && playEnd > playStart, 'playing learning dock must exist')
const dock = source.slice(playStart, playEnd)

assert.match(source, /type PortraitDockPanel = 'staff' \| 'settings' \| null/)
assert.doesNotMatch(source, /pointer-events-none absolute bottom-2 left-1\/2[^\n]*pf3-portrait-staff/)
assert.ok(dock.indexOf('pf3-portrait-staff-band') > dock.indexOf('pf3-learning-dock'), 'portrait staff must live inside the dock')
assert.match(dock, /data-testid="pf3-replay-notes"[\s\S]*?min-h-12/)
assert.match(dock, /data-testid="pf3-staff-drawer-toggle"[\s\S]*?aria-expanded=\{portraitDockPanel === 'staff'\}[\s\S]*?min-h-12/)
assert.match(dock, /data-testid="pf3-options-drawer-toggle"[\s\S]*?aria-expanded=\{portraitDockPanel === 'settings'\}[\s\S]*?min-h-12/)
assert.match(dock, /id="pf3-portrait-staff-panel"[\s\S]*?role="region"[\s\S]*?aria-label="Staff notation drawer"/)
assert.match(dock, /id=\{layoutMode === 'portrait' \? 'pf3-portrait-options-panel' : undefined\}[\s\S]*?max-h-\[42svh\] overflow-y-auto overscroll-contain/)
assert.match(dock, /if \(layoutMode === 'portrait' && value\) setPortraitDockPanel\('staff'\)/)
assert.match(dock, /touchSized=\{layoutMode === 'portrait'\}/)
assert.match(source, /const controlSize = props\.touchSized \? 'min-h-12' : ''/)
assert.match(source, /Math\.min\(containerWidth - 32, 360\)/)

console.log('pitchforks mobile learning dock: 12/12 PASS')
