import assert from 'node:assert/strict'

import {
  requestPitchforksMicrophoneStream,
} from '../src/components/PitchDefender/usePitchDetection'

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function fakeStream(): { readonly stream: MediaStream; readonly stops: () => number } {
  let stopCount = 0
  const track = {
    stop: () => { stopCount += 1 },
  } as unknown as MediaStreamTrack
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream
  return { stream, stops: () => stopCount }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

async function main(): Promise<void> {
  const pending = deferred<MediaStream>()
  await assert.rejects(
    requestPitchforksMicrophoneStream(() => pending.promise, 10),
    /microphone request timed out/i,
  )

  // A late browser success cannot leak a stream after the timeout has made the
  // UI recoverable; the next attempt is independent of the old request.
  const late = fakeStream()
  pending.resolve(late.stream)
  await flush()
  assert.equal(late.stops(), 1, 'late permission success must release its stream')

  const permissionError = new Error('NotAllowedError: permission denied')
  await assert.rejects(
    requestPitchforksMicrophoneStream(() => Promise.reject(permissionError), 50),
    error => error === permissionError,
  )

  const successful = fakeStream()
  const result = await requestPitchforksMicrophoneStream(() => Promise.resolve(successful.stream), 50)
  assert.strictEqual(result, successful.stream)
  assert.equal(successful.stops(), 0, 'successful microphone start must retain its live stream')

  const recovered = fakeStream()
  const retryResult = await requestPitchforksMicrophoneStream(() => Promise.resolve(recovered.stream), 50)
  assert.strictEqual(retryResult, recovered.stream, 'a retry must work after a timed-out request')

  console.log('pitchforks microphone readiness: pending timeout, rejection, success, cleanup, and retry: PASS')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
