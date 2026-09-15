import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pitchforksSource = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)
const songcraftSource = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksSongcraft.tsx', import.meta.url),
  'utf8',
)
const headerSource = readFileSync(
  new URL('../src/components/Navigation/Header.tsx', import.meta.url),
  'utf8',
)

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => assert.match(pitchforksSource, /const pitchIsActive = pitch\?\.isActive \?\? false/))
check(() => assert.match(pitchforksSource, /const pitchFrequency = pitch\?\.frequency \?\? 0/))
check(() => assert.match(pitchforksSource, /const pitchConfidence = pitch\?\.confidence \?\? 0/))
check(() => assert.match(pitchforksSource, /const source = pitchRef\.current/))
check(() => assert.match(pitchforksSource, /const sourcePitch = pitchRef\.current/))
check(() => assert.match(pitchforksSource, /if \(!ceremony\.active \|\| !ceremony\.note \|\| !admissionCuePlayed\) return/))
check(() => assert.doesNotMatch(pitchforksSource, /\}, \[[^\n]*\bpitch\b[^\n]*\]\)/))

check(() => assert.match(headerSource, /export function Header\(\)[\s\S]*?if \(shouldHideHeader\(pathname\)\) return null[\s\S]*?return <HeaderContent \/>/))
check(() => assert.match(headerSource, /function HeaderContent\(\)[\s\S]*?const \{ user, isLoading \} = useUser\(\)/))

const acknowledgeBlock = songcraftSource.slice(
  songcraftSource.indexOf('const acknowledge = useCallback'),
  songcraftSource.indexOf('const retrySave = useCallback'),
)
check(() => assert.match(acknowledgeBlock, /const wasListening = microphoneRef\.current\.isListening/))
check(() => assert.match(acknowledgeBlock, /applyResult\(result\)[\s\S]*?if \(wasListening && result\.state\.lane === 'voice' && result\.state\.current\.kind === 'note'\) startMic\(\)/))

console.log(`pitchforks cleanup contracts: ${checks}/${checks} PASS`)
