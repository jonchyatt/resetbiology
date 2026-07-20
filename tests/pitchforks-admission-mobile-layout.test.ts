import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const start = source.indexOf('const newNoteCeremonyBanner')
const end = source.indexOf('{newNoteUnlocked && !ceremony.active', start)
assert.ok(start >= 0 && end > start, 'new-note ceremony block must exist')
const ceremony = source.slice(start, end)

assert.match(ceremony, /className="fixed inset-0[^\"]*items-start[^\"]*overflow-y-auto/)
assert.match(ceremony, /<section className="my-auto w-full max-w-sm/)
assert.match(ceremony, /paddingTop: 'max\(env\(safe-area-inset-top\), 1\.5rem\)'/)
assert.match(ceremony, /paddingBottom: 'max\(env\(safe-area-inset-bottom\), 1\.5rem\)'/)

console.log('pitchforks mobile admission modal: 4/4 PASS')
