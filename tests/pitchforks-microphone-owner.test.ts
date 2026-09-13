import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createPitchforksMicrophoneOwner,
  type PitchforksMicrophoneOwner,
} from '../src/components/PitchDefender/pitchforksMicrophoneOwner'

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

interface DeferredHarness {
  readonly owner: PitchforksMicrophoneOwner
  readonly starts: () => number
  readonly stops: () => number
  readonly isLive: () => boolean
  readonly gates: Deferred<void>[]
}

function makeDeferredHarness(): DeferredHarness {
  let startCalls = 0
  let stopCalls = 0
  let live = false
  const gates: Deferred<void>[] = []
  const owner = createPitchforksMicrophoneOwner({
    start: () => {
      startCalls += 1
      const gate = deferred<void>()
      gates.push(gate)
      return gate.promise.then(() => {
        live = true
      })
    },
    stop: () => {
      stopCalls += 1
      live = false
    },
    isLive: () => live,
  })
  return {
    owner,
    starts: () => startCalls,
    stops: () => stopCalls,
    isLive: () => live,
    gates,
  }
}

async function main(): Promise<void> {
  // Concurrent callers share the same permission request and a live source
  // never reopens the device.
  const duplicate = makeDeferredHarness()
  const first = duplicate.owner.start()
  const duplicateStart = duplicate.owner.start()
  check(() => assert.strictEqual(first, duplicateStart))
  check(() => assert.equal(duplicate.starts(), 1))
  duplicate.gates[0].resolve()
  await first
  check(() => assert.equal(duplicate.isLive(), true))
  await duplicate.owner.start()
  check(() => assert.equal(duplicate.starts(), 1))
  duplicate.owner.stop()
  check(() => assert.equal(duplicate.stops(), 1))
  check(() => assert.equal(duplicate.isLive(), false))

  // Stop fences all callers that shared the old pending request. A late
  // permission success is released before a post-stop request is started.
  const pendingStop = makeDeferredHarness()
  const oldStart = pendingStop.owner.start()
  const oldDuplicate = pendingStop.owner.start()
  check(() => assert.strictEqual(oldStart, oldDuplicate))
  pendingStop.owner.stop()
  check(() => assert.equal(pendingStop.stops(), 1))
  const afterStop = pendingStop.owner.start()
  const afterStopDuplicate = pendingStop.owner.start()
  check(() => assert.strictEqual(afterStop, afterStopDuplicate))
  check(() => assert.equal(pendingStop.starts(), 1))
  pendingStop.gates[0].resolve()
  await flush()
  check(() => assert.equal(pendingStop.stops(), 2))
  check(() => assert.equal(pendingStop.starts(), 2))
  await oldStart
  pendingStop.gates[1].resolve()
  await afterStop
  check(() => assert.equal(pendingStop.isLive(), true))

  // A rejected start releases the serializer, cleans up through stop(), and
  // keeps the original error visible to its caller. A later attempt recovers.
  const rejection = makeDeferredHarness()
  const startError = new Error('permission denied')
  const failedStart = rejection.owner.start()
  rejection.gates[0].reject(startError)
  await assert.rejects(failedStart, error => error === startError)
  check(() => assert.equal(rejection.stops(), 1))
  const recovered = rejection.owner.start()
  check(() => assert.equal(rejection.starts(), 2))
  rejection.gates[1].resolve()
  await recovered
  check(() => assert.equal(rejection.isLive(), true))

  // The settled start promise includes lifecycle cleanup, so an immediate
  // catch-and-retry cannot observe the old rejected run as still pending.
  const immediateRecovery = makeDeferredHarness()
  const immediateError = new Error('immediate rejection')
  const immediateFailed = immediateRecovery.owner.start()
  immediateRecovery.gates[0].reject(immediateError)
  await assert.rejects(immediateFailed, error => error === immediateError)
  const immediateRetry = immediateRecovery.owner.start()
  check(() => assert.equal(immediateRecovery.starts(), 2))
  immediateRecovery.gates[1].resolve()
  await immediateRetry

  // Awaiting a stopped pending start also waits for its late cleanup. A new
  // request made immediately afterward remains queued until that drain ends.
  const awaitedCleanup = makeDeferredHarness()
  const stoppedStart = awaitedCleanup.owner.start()
  awaitedCleanup.owner.stop()
  awaitedCleanup.gates[0].resolve()
  await stoppedStart
  check(() => assert.equal(awaitedCleanup.stops(), 2))
  const afterAwait = awaitedCleanup.owner.start()
  check(() => assert.equal(awaitedCleanup.starts(), 1))
  await flush()
  check(() => assert.equal(awaitedCleanup.starts(), 2))
  awaitedCleanup.gates[1].resolve()
  await afterAwait

  // Rejection also drains a post-stop queue instead of stranding it.
  const rejectedWhileStopped = makeDeferredHarness()
  const rejectedPending = rejectedWhileStopped.owner.start()
  rejectedWhileStopped.owner.stop()
  const queuedAfterReject = rejectedWhileStopped.owner.start()
  const stoppedError = new Error('late permission rejection')
  rejectedWhileStopped.gates[0].reject(stoppedError)
  await assert.rejects(rejectedPending, error => error === stoppedError)
  await flush()
  check(() => assert.equal(rejectedWhileStopped.stops(), 2))
  check(() => assert.equal(rejectedWhileStopped.starts(), 2))
  rejectedWhileStopped.gates[1].resolve()
  await queuedAfterReject
  check(() => assert.equal(rejectedWhileStopped.isLive(), true))

  // Repeated stops create generations: a queued request present at the second
  // stop is invalidated, while a request made after it still drains the old
  // permission operation and then starts exactly once.
  const generations = makeDeferredHarness()
  const generationZero = generations.owner.start()
  generations.owner.stop()
  const invalidatedQueue = generations.owner.start()
  generations.owner.stop()
  await invalidatedQueue
  check(() => assert.equal(generations.starts(), 1))
  const latestGeneration = generations.owner.start()
  check(() => assert.equal(generations.starts(), 1))
  generations.gates[0].resolve()
  await flush()
  check(() => assert.equal(generations.stops(), 3))
  check(() => assert.equal(generations.starts(), 2))
  await generationZero
  generations.gates[1].resolve()
  await latestGeneration
  check(() => assert.equal(generations.isLive(), true))

  // An already-live owner does not call the underlying start callback, while
  // stop remains immediate and the next start is a new operation.
  let initiallyLive = true
  let initiallyLiveStarts = 0
  let initiallyLiveStops = 0
  const alreadyLive = createPitchforksMicrophoneOwner({
    start: async () => {
      initiallyLiveStarts += 1
      initiallyLive = true
    },
    stop: () => {
      initiallyLiveStops += 1
      initiallyLive = false
    },
    isLive: () => initiallyLive,
  })
  await alreadyLive.start()
  await alreadyLive.start()
  check(() => assert.equal(initiallyLiveStarts, 0))
  alreadyLive.stop()
  check(() => assert.equal(initiallyLiveStops, 1))
  await alreadyLive.start()
  check(() => assert.equal(initiallyLiveStarts, 1))

  const source = readFileSync(
    resolve(process.cwd(), 'src/components/PitchDefender/pitchforksMicrophoneOwner.ts'),
    'utf8',
  )
  check(() => assert.match(source, /createPitchforksMicrophoneOwner/))
  check(() => assert.match(source, /Promise<void>/))
  check(() => assert.match(source, /activeRun/))
  check(() => assert.match(source, /queuedStart/))
  check(() => assert.match(source, /invalidated/))
  check(() => assert.doesNotMatch(source, /setTimeout|setInterval|navigator\.mediaDevices/))
  check(() => assert.doesNotMatch(source, /localStorage|setItem|removeItem|clear\(/))

  console.log(`pitchforks microphone owner: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
