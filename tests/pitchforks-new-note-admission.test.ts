import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const between = (start: string, end: string) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.ok(startIndex >= 0, `missing ${start}`)
  assert.ok(endIndex > startIndex, `missing ${end} after ${start}`)
  return source.slice(startIndex, endIndex)
}

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const request = between('const requestNewNoteAdmission', 'const replayNewNoteCeremonyTone')
check(() => assert.match(request, /setCeremonySnapshot\(\{ active: true, note, toneFired: false, tonePulseKey: 0 \}\)/))
check(() => assert.doesNotMatch(request, /setUnlockedNotes|unlockedNotesRef\.current\s*=|ensureNoteMemory|reviewNote|saveFsrs/))
check(() => assert.doesNotMatch(request, /setTimeout|scheduleCeremonyTone|playPianoNote/))

const threshold = between('const maybeUnlockNextNote', 'const latencyForTarget')
check(() => assert.match(threshold, /requestNewNoteAdmission\(nextNote\)/))
check(() => assert.doesNotMatch(threshold, /const newPool|setUnlockedNotes|ensureNoteMemory|saveFsrs/))
check(() => assert.match(threshold, /deferredAdmissionNotesRef\.current\.has\(nextNote\)/))
check(() => assert.match(threshold, /admissionRecallReady\(currentPool, cueSupportProfileRef\.current\)/))

const accept = between('const acceptNewNoteAdmission', 'const deferNewNoteAdmission')
check(() => assert.match(accept, /if \(!admissionMatched \|\| !note\) return/))
check(() => assert.match(accept, /const newPool = \[\.\.\.currentPool, note\]/))
check(() => assert.match(accept, /unlockedNotesRef\.current = newPool/))
check(() => assert.match(accept, /ensureNoteMemory\(note\)/))
check(() => assert.match(accept, /saveFsrs\(\)/))

const defer = between('const deferNewNoteAdmission', 'const latencyForTarget')
check(() => assert.match(defer, /deferredAdmissionNotesRef\.current\.add\(note\)/))
check(() => assert.match(defer, /clearNewNoteCeremony\(\)/))
check(() => assert.doesNotMatch(defer, /reviewNote|setHud|score|health|streak|setUnlockedNotes|saveFsrs/))

check(() => assert.match(source, /ceremonyRef\.current\.active \|\| matchingSuppressedNow\(\)/))
check(() => assert.match(source, /if \(ceremonyRef\.current\.active\) \{[\s\S]*?lockHeldMsRef\.current = 0[\s\S]*?return/))
check(() => assert.match(source, /admissionCuePlayed[\s\S]*?exactPitchSampleState\(sourcePitch, noteToFreq\(note\), CONFIDENCE_FLOOR, MATCH_TOLERANCE_CENTS\)/))
check(() => assert.match(source, /advanceExactPitchHold\([\s\S]*?admissionHeldMsRef\.current[\s\S]*?admissionMatched[\s\S]*?HOLD_MS/))
check(() => assert.match(source, /data-testid="pf3-admission-hear"/))
check(() => assert.match(source, /data-testid="pf3-admission-comfortable"/))
check(() => assert.match(source, /data-testid="pf3-admission-not-yet"/))
check(() => assert.match(source, /scheduleCeremonyTone\(ceremony\.note, true\)/))
check(() => assert.match(source, /markToneEmitted\(TONE_SUPPRESS_MS\)/))
check(() => assert.match(source, /admissionDialogPanelRef\.current\?\.focus\(\)/))
check(() => assert.match(source, /admissionReturnFocusRef\.current/))
check(() => assert.match(source, /onCancel=\{event => \{[\s\S]*?deferNewNoteAdmission\(\)/))
check(() => assert.match(source, /<dialog[\s\S]*?admissionDialogRef/))
check(() => assert.doesNotMatch(between('const newNoteCeremonyBanner', '{newNoteUnlocked && !ceremony.active'), /min-h-11/))
check(() => assert.match(source, /NOT YET/))
check(() => assert.match(source, /No penalty/))
check(() => assert.match(source, /const CONFIDENCE_FLOOR = 0\.75/))
check(() => assert.match(source, /const MATCH_TOLERANCE_CENTS = 70/))
check(() => assert.match(source, /const HOLD_MS = 300/))

console.log(`pitchforks new-note admission contract: ${checks}/${checks} PASS`)
