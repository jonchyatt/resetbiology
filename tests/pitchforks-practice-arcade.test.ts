import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main(): Promise<void> {
const source = await readFile(new URL('../src/components/PitchDefender/PitchforksPracticeArcade.tsx', import.meta.url), 'utf8')

for (const world of ['dungeon', 'village-gate', 'bell-tower', 'cathedral']) {
  assert.match(source, new RegExp(`world: '${world}'`), `arcade exposes ${world}`)
}
assert.match(source, /data-testid=\{`pitchforks-practice-enter-\$\{card\.world\}`\}/, 'each card has a playable entry')

assert.match(source, /onEnterPractice: \(world: PitchforksPracticeWorld\) => void/)
assert.match(source, /untimed/)
assert.match(source, /Four untimed music challenges\. Choose one and sing through the encounter\./)
assert.doesNotMatch(source, /practiceWorld|window\.location\.assign/)
assert.doesNotMatch(source, /localStorage\.(setItem|removeItem)|persist.*unlock|grant.*unlock/i)
assert.doesNotMatch(source, /AudioContext|AnalyserNode|getUserMedia/)

console.log('pitchforks practice arcade: four existing chamber entries, bounded callback, no unlock persistence: PASS')
}

void main()
