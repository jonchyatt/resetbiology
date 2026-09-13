import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const lessonStart = source.indexOf('type SupportedVillageLesson')
const lessonEnd = source.indexOf('\n\nfunction pitchIdentity', lessonStart)
assert.ok(lessonStart >= 0 && lessonEnd > lessonStart, 'lesson metadata seam must remain present')
const lesson = source.slice(lessonStart, lessonEnd)

const sequenceStart = source.indexOf('const playVillagerSequence')
const sequenceEnd = source.indexOf('\n  useEffect', sequenceStart)
assert.ok(sequenceStart >= 0 && sequenceEnd > sequenceStart, 'sequence seam must remain present')
const sequence = source.slice(sequenceStart, sequenceEnd)

const sparkStart = source.indexOf('const updateSparkGuide')
const sparkEnd = source.indexOf('\n  const resetRangeMatch', sparkStart)
assert.ok(sparkStart >= 0 && sparkEnd > sparkStart, 'Spark Guide seam must remain present')
const spark = source.slice(sparkStart, sparkEnd)

check(() => {
  assert.match(lesson, /support\?: ['"]SUPPORTED['"] \| ['"]UNAIDED_RETURN['"]/, 'future return support is optional metadata')
  assert.doesNotMatch(lesson, /support!:/, 'support remains absent-safe')
})

check(() => {
  const replayMark = sequence.indexOf("if (mode === 'replay' && supportedLesson?.support === 'UNAIDED_RETURN')")
  const playbackSelection = sequence.indexOf('const playbackNotes =')
  assert.ok(replayMark >= 0 && playbackSelection > replayMark, 'replay hint is recorded before playback selection')
  assert.match(sequence, /hintedTargetKeysRef\.current\.add\(targetKey\)/)
  assert.match(sequence, /even when the current cue profile is Guided/)
})

check(() => {
  assert.match(sequence, /const unhintedUnaidedReturnCue = supportedLesson\?\.support === ['"]UNAIDED_RETURN['"][\s\S]*mode === ['"]cue['"][\s\S]*!hintedTargetKeysRef\.current\.has\(targetKey\)/)
  assert.match(sequence, /const playbackNotes = supportedLesson\s*\?\s*\[supportedLesson\.contextNote, supportedLesson\.targetNote\]\s*:\s*liveNotes/)
  assert.match(sequence, /if \(unhintedUnaidedReturnCue\) playbackNotes\.pop\(\)/)
  assert.match(sequence, /playbackNotes\.forEach\(\(note, toneIndex\)/)
  assert.match(sequence, /const tineIndex = supportedLesson \? villager\.burned : villager\.burned \+ toneIndex/)
})

check(() => {
  const replayMark = sequence.indexOf("if (mode === 'replay' && supportedLesson?.support === 'UNAIDED_RETURN')")
  const answerSchedule = sequence.indexOf('playbackNotes.forEach')
  assert.ok(replayMark >= 0 && answerSchedule > replayMark, 'replay downgrade happens before target scheduling')
  assert.match(sequence, /mode === 'replay'[\s\S]*supportedLesson\.contextNote, supportedLesson\.targetNote/)
  assert.match(sequence, /if \(unhintedUnaidedReturnCue\) playbackNotes\.pop\(\)/)
})

check(() => {
  assert.match(sequence, /const targetKey = `\$\{villager\.id\}:\$\{villager\.burned\}`/)
  assert.match(sequence, /mode === 'cue'[\s\S]*!hintedTargetKeysRef\.current\.has\(targetKey\)/)
  assert.match(sequence, /const playbackNotes = supportedLesson\s*\n\s*\? \[supportedLesson\.contextNote, supportedLesson\.targetNote\]/)
  assert.match(sequence, /: liveNotes/)
})

check(() => {
  const muteGate = sequence.indexOf('if (!emitsTone)')
  const heardMark = sequence.indexOf('for (const note of playbackNotes) waveNotesHeardRef.current.add(note)')
  assert.ok(muteGate >= 0 && heardMark > muteGate, 'muted cues return before heard provenance is recorded')
  assert.match(sequence, /const emitsTone = \(buttonLane \|\| mode === 'replay' \|\| audioCueRef\.current\) && cueVolumeRef\.current > 0/)
  assert.match(source, /const ECHO_TAIL_MS = 350/)
  assert.match(sequence, /const suppressMs = toneWindowMs \+ ECHO_TAIL_MS/)
  assert.match(sequence, /matchingSuppressedUntilRef\.current = performance\.now\(\) \+ TONE_SUPPRESS_MS/)
  assert.match(sequence, /markToneEmitted\(TONE_SUPPRESS_MS\)/)
  assert.match(sequence, /clearCueTimers\(\)/)
})

check(() => {
  assert.match(spark, /const unhintedUnaidedReturn = normalBellRouteAvailable\(\)[\s\S]*target\.villager\.totalTines === 1[\s\S]*support === ['"]UNAIDED_RETURN['"][\s\S]*targetNote === target\.note[\s\S]*!hintedTargetKeysRef\.current\.has\(target\.key\)/)
  assert.match(spark, /!unhintedUnaidedReturn/)
  assert.match(spark, /stillEligible[\s\S]*!\(normalBellRouteAvailable\(\)[\s\S]*support === ['"]UNAIDED_RETURN['"][\s\S]*!hintedTargetKeysRef\.current\.has\(liveTarget\.key\)\)/)
  assert.match(spark, /waveNotesHeardRef\.current\.add\(liveTarget\.note\)/)
})

check(() => {
  assert.match(source, /playVillagerSequence\(target\.villager, ['"]cue['"]\)/)
  assert.match(source, /playVillagerSequence\(active\.villager, ['"]replay['"]\)/)
  assert.doesNotMatch(source, /villageReturnQueue/)
  assert.doesNotMatch(sequence, /recordVillagePractice|reviewTargetNote|UNAIDED_RETURN.*offer/)
})

console.log(`pitchforks Village return audio seam: ${checks}/${checks} PASS (source/harness only; playback remains unverified)`)
