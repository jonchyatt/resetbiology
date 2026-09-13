import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')

const canvasStart = source.indexOf('<div ref={canvasContainerRef}')
const tunerStart = source.indexOf('data-testid="pf3-tuner-feedback"')
const learningDockStart = source.indexOf('data-testid="pf3-learning-dock"')
assert.ok(canvasStart >= 0 && tunerStart > canvasStart && learningDockStart > tunerStart, 'playing stage and external docks must have a stable order')

const stage = source.slice(canvasStart, tunerStart)
const resultBand = source.slice(tunerStart, learningDockStart)
const resultStart = resultBand.indexOf('data-testid="pf3-level-result"')
assert.ok(resultStart >= 0, 'level receipt must render in the external information band')

assert.doesNotMatch(stage, /data-testid="pf3-level-result"|drawWaveReceipt/, 'the stage cannot carry a second centered receipt')
assert.doesNotMatch(source, /function drawWaveReceipt|drawWaveReceipt\(/, 'obsolete canvas receipt helpers must be removed after their only call is gone')
assert.match(resultBand, /data-testid="pf3-tuner-feedback"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/)
assert.equal((resultBand.match(/role="status"/g) ?? []).length, 1, 'the receipt uses the existing single live status region')
assert.doesNotMatch(resultBand.slice(resultStart), /role="status"/, 'receipt details must not create a duplicate live announcement')

assert.match(resultBand, /waveReceiptResult \? \(/, 'receipt content replaces tuner content in place')
assert.match(resultBand, /waveReceiptResult \? 'h-20 max-h-20 items-start justify-start overflow-y-auto overscroll-contain/, 'receipt scroll starts at the top so long content cannot hide above the scroll origin')
assert.match(resultBand, /: 'h-20 max-h-20 items-center justify-center flex-col/, 'tuner and receipt share the same fixed information slot')
assert.match(resultBand, /data-testid="pf3-level-result"[\s\S]*?text-\[11px\]/, 'receipt text stays readable in the reserved information slot')
assert.match(resultBand, /tabIndex=\{waveReceiptResult \? 0 : undefined\}[\s\S]*?overflow-y-auto/, 'long future receipts remain keyboard-scrollable instead of being clipped')
assert.match(resultBand, /data-testid="pf3-result-accuracy"[\s\S]*?accuracyPercent[\s\S]*?PITCHFORKS_LEVEL_ACCURACY_GOAL_PERCENT/)
assert.match(resultBand, /data-testid="pf3-result-next-step"[\s\S]*?waveReceiptResult\.nextStep/)
assert.match(resultBand, /label="HEARD"[\s\S]*?testId="pf3-result-heard"/)
assert.match(resultBand, /label=\{inputMode === 'buttons' \? 'ANSWERED' : 'SUNG'\}[\s\S]*?testId=\{inputMode === 'buttons' \? 'pf3-result-answered' : 'pf3-result-sung'\}/)
assert.match(resultBand, /label="MASTERED"[\s\S]*?testId="pf3-result-mastered"/)

assert.match(source, /const waveReceiptNoteNamesVisible = inputMode === 'buttons' \|\| noteNamesOn/)
assert.match(source, /function WaveReceiptNoteRow[\s\S]*?role="img"[\s\S]*?aria-label=\{`\$\{props\.label\} note \$\{note\}`\}/)
assert.match(source, /props\.noteNamesVisible \? undefined : 'sr-only'/, 'voice receipts honor the note-name setting while preserving accessible note identities')

console.log('pitchforks result dock: PASS (structural source invariants; browser acceptance not observed)')
