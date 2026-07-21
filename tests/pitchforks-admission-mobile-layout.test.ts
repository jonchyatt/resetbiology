import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const start = source.indexOf('const newNoteCeremonyBanner')
const end = source.indexOf('{newNoteUnlocked && !ceremony.active', start)
assert.ok(start >= 0 && end > start, 'new-note ceremony block must exist')
const ceremony = source.slice(start, end)

assert.match(ceremony, /<dialog[\s\S]*?ref=\{admissionDialogRef\}/)
assert.match(ceremony, /backdrop:bg-black\/85/)
assert.match(ceremony, /className="flex min-h-full items-start justify-center overflow-y-auto px-4"/)
assert.match(ceremony, /ref=\{admissionDialogPanelRef\}[\s\S]*?tabIndex=\{-1\}[\s\S]*?className="my-auto w-full max-w-sm/)
assert.match(ceremony, /paddingTop: 'max\(env\(safe-area-inset-top\), 1\.5rem\)'/)
assert.match(ceremony, /paddingBottom: 'max\(env\(safe-area-inset-bottom\), 1\.5rem\)'/)
assert.ok((ceremony.match(/min-h-12/g) ?? []).length >= 3, 'all three admission actions must be at least 48px high')
assert.doesNotMatch(ceremony, /min-h-11/)
assert.match(source, /dialog\.showModal\(\)/)
assert.match(ceremony, /onCancel=\{event => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?deferNewNoteAdmission\(\)/)

console.log('pitchforks mobile admission modal: 10/10 PASS')
