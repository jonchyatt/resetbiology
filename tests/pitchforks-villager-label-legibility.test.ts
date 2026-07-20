import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const badgeBlock = source.match(/if \(v\.active && view\.noteNamesVisible\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  if \(v\.active\) \{/)
assert.ok(badgeBlock, 'villager note-label block is present')
const badgeSource = badgeBlock[0]
let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => assert.match(badgeSource, /ctx\.canvas\.clientWidth \/ W/))
check(() => assert.match(badgeSource, /clamp\(11 \/ canvasScale, 14, 26\)/))
check(() => assert.match(badgeSource, /ctx\.font = `bold \$\{noteFontPx\}px monospace`/))
check(() => assert.match(badgeSource, /noteFontPx \+ 7/))
check(() => assert.doesNotMatch(badgeSource, /ctx\.font = 'bold 14px monospace'/))

console.log(`pitchforks villager label legibility: ${checks}/${checks} PASS`)
