import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksSongcraftPanel.tsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  assert.match(source, /function PhraseProgress\(/)
  assert.match(source, /data-testid="pitchforks-songcraft-phrase-progress"/)
  assert.match(source, /data-testid="pitchforks-songcraft-current-occurrence"/)
  assert.match(source, /OCCURRENCE \$\{position\} OF \$\{total\}/)
  assert.match(source, /data-testid="pitchforks-songcraft-progress-percent"/)
  assert.match(source, /aria-valuetext=\{`\$\{occurrenceLabel\}; \$\{percent\}% complete`\}/)
})

check(() => {
  assert.match(source, /function nextActionLabel\(/)
  assert.match(source, /data-testid="pitchforks-songcraft-next-action"/)
  assert.match(source, /Retry saving before you answer again\./)
  assert.match(source, /Hear the note to open the answer choices\./)
  assert.match(source, /Start the microphone, then sing the current note\./)
})

check(() => {
  assert.match(source, /data-testid="pitchforks-songcraft-replay-controls"/)
  assert.match(source, /HEAR NOTE · REPLAY/)
  assert.match(source, /aria-label="Play or replay the current note"/)
  assert.match(source, /data-testid="pitchforks-songcraft-hint"/)
  assert.match(source, /data-testid="pitchforks-songcraft-recovery"/)
  assert.match(source, /data-testid="pitchforks-songcraft-retry-save"/)
  assert.match(source, /data-testid="pitchforks-songcraft-retry-note"/)
})

check(() => {
  assert.match(source, /data-testid="pitchforks-songcraft-tempo-guidance"/)
  assert.match(source, /Untimed phrase practice comes first\./)
  assert.match(source, /optional Tempo Encore appears below\./)
})

check(() => {
  assert.match(source, /readonly paused\?: boolean/)
  assert.match(source, /readonly hasNextSong\?: boolean/)
  assert.match(source, /readonly onTogglePause\?: \(\) => void/)
  assert.match(source, /readonly onReplayPhrase\?: \(\) => void/)
  assert.match(source, /readonly onNextSong\?: \(\) => void/)
  assert.match(source, /function PracticeSessionControls\(/)
  assert.match(source, /data-testid="pitchforks-songcraft-pause-toggle"/)
  assert.match(source, /\{paused \? 'RESUME' : 'PAUSE'\}/)
  assert.match(source, /data-testid="pitchforks-songcraft-completion-actions"/)
  assert.match(source, /data-testid="pitchforks-songcraft-replay-phrase"/)
  assert.match(source, /data-testid="pitchforks-songcraft-next-song"/)
  assert.match(source, /disabled=\{!hasNextSong\}/)
  assert.match(source, /onClick=\{onTogglePause\}/)
  assert.match(source, /onClick=\{onReplayPhrase\}/)
  assert.match(source, /onClick=\{onNextSong\}/)
})

check(() => {
  assert.match(source, /disabled=\{busy \|\| !active\.canAnswer\}/)
  assert.match(source, /onAnswer=\{onAnswer\}/)
  assert.match(source, /onStartMic=\{onStartMic\}/)
  assert.match(source, /onHear=\{onHear\}/)
  assert.match(source, /onHint=\{onHint\}/)
  assert.match(source, /onRetrySave=\{onRetrySave\}/)
  assert.match(source, /onRetryNote=\{onRetryNote\}/)
  assert.match(source, /{current\.message}/)
})

console.log(`pitchforks Songcraft panel guidance: ${checks}/${checks} PASS (source contract; mounted route remains unverified)`)
