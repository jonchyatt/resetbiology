import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PitchforksBossMicrophoneStatus } from '../src/components/PitchDefender/PitchforksIII'

const props = {
  onRetry: () => {},
  buttonClassName: 'control-class',
}

test('Bell Tower microphone startup renders calm pending copy without retry action', () => {
  const markup = renderToStaticMarkup(createElement(PitchforksBossMicrophoneStatus, {
    ...props,
    isListening: false,
    isStarting: true,
    error: null,
  }))

  assert.match(markup, /Starting microphone\.\.\./)
  assert.doesNotMatch(markup, /RETRY MICROPHONE/)
})

test('Bell Tower microphone timeout/error keeps the retry action', () => {
  const markup = renderToStaticMarkup(createElement(PitchforksBossMicrophoneStatus, {
    ...props,
    isListening: false,
    isStarting: false,
    error: 'Microphone request timed out.',
  }))

  assert.match(markup, /Microphone unavailable\. Your chamber is still open; retry when ready\./)
  assert.match(markup, /RETRY MICROPHONE/)
})
