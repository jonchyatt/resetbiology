import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  PitchforksVillageLesson,
  type PitchforksVillageLessonProps,
} from '../src/components/PitchDefender/PitchforksVillageLesson'

const noop = () => {}

function render(overrides: Partial<PitchforksVillageLessonProps> = {}): string {
  return renderToStaticMarkup(createElement(PitchforksVillageLesson, {
    objective: 'minor-third',
    contextNote: 'C4',
    targetNote: 'E4',
    support: 'SUPPORTED',
    onReplay: noop,
    ...overrides,
  }))
}

const supported = render()
assert.match(supported, /data-testid="pf3-village-lesson"/)
assert.match(supported, /data-support="SUPPORTED"/)
assert.match(supported, /data-testid="pf3-village-lesson-context"[\s\S]*>C4<\/strong>/)
assert.match(supported, /data-testid="pf3-village-lesson-target"[^>]*>E4<\/strong>/)
assert.match(supported, /MINOR THIRD/)
assert.match(supported, /data-direction="above"/)
assert.match(supported, />ABOVE<\/span>/)
assert.match(supported, /Hear C4, then sing E4: a minor third above\./)
assert.match(supported, /REPLAY LESSON/)

const blind = render({ support: 'UNAIDED_RETURN' })
assert.match(blind, /data-support="UNAIDED_RETURN"/)
assert.match(blind, /UNAIDED RETURN/)
assert.match(blind, /data-testid="pf3-village-lesson-target-hidden"[^>]*>HIDDEN<\/strong>/)
assert.doesNotMatch(blind, /E4/, 'an ungraded return must not reveal the literal target note')
assert.match(blind, /Start on C4\. Move above a minor third\. Sing the return from memory\./)
assert.match(blind, /REPLAY WITH HELP/)
assert.match(blind, /Directional interval shape: from C4 above by a minor third/)

const descending = render({
  objective: 'major-third',
  contextNote: 'A4',
  targetNote: 'F4',
})
assert.match(descending, /data-direction="below"/)
assert.match(descending, /data-testid="pf3-village-lesson-direction"[^>]*>BELOW<\/span>/)
assert.match(descending, /Hear A4, then sing F4: a major third below\./)

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksVillageLesson.tsx', import.meta.url),
  'utf8',
)
assert.match(source, /onClick=\{props\.onReplay\}/)
assert.match(source, /objective: PitchforksVillageLessonObjective/)
assert.match(source, /contextNote: string/)
assert.match(source, /targetNote: string/)
assert.match(source, /support: PitchforksVillageLessonSupport/)
assert.doesNotMatch(source, /useState|useEffect|useReducer|localStorage|sessionStorage|AudioContext|navigator\.mediaDevices|progressbar|pitch.?meter|Hz|cents/i)
assert.equal((source.match(/<button/g) ?? []).length, (source.match(/type="button"/g) ?? []).length, 'the replay control must declare type=button')

console.log('pitchforks Village lesson: PASS — source-bound interval shape, support distinction, blind target concealment, and controlled replay')
