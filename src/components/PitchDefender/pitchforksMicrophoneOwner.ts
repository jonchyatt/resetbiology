export interface PitchforksMicrophoneOwnerInput {
  readonly start: () => Promise<void>
  readonly stop: () => void
  readonly isLive: () => boolean
}

export interface PitchforksMicrophoneOwner {
  /** Start once, sharing a pending request with concurrent callers. */
  readonly start: () => Promise<void>
  /** Stop now and fence starts that belong to the stopped generation. */
  readonly stop: () => void
}

interface StartRun {
  readonly promise: Promise<void>
  readonly settled: Promise<void>
  invalidated: boolean
}

interface QueuedStart {
  readonly generation: number
  readonly promise: Promise<void>
  readonly resolve: () => void
  readonly reject: (error: unknown) => void
  invalidated: boolean
}

interface Drain {
  readonly run: StartRun
}

function safelyStop(stop: () => void): void {
  try {
    stop()
  } catch {
    // A cleanup callback cannot be allowed to strand the serializer or hide
    // the original start rejection from its caller.
  }
}

function rejected(error: unknown): Promise<void> {
  return Promise.reject(error)
}

export function createPitchforksMicrophoneOwner(
  input: PitchforksMicrophoneOwnerInput,
): PitchforksMicrophoneOwner {
  if (!input || typeof input.start !== 'function' || typeof input.stop !== 'function' || typeof input.isLive !== 'function') {
    throw new TypeError('Invalid Pitchforks microphone owner callbacks')
  }

  // Snapshot the callbacks so a mutable options object cannot redirect an
  // in-flight permission request to another microphone lifecycle.
  const startMic = input.start.bind(input)
  const stopMic = input.stop.bind(input)
  const checkLive = input.isLive.bind(input)

  let generation = 0
  let activeRun: StartRun | null = null
  let drain: Drain | null = null
  let queuedStart: QueuedStart | null = null

  const invalidateQueuedStart = (): void => {
    const queued = queuedStart
    queuedStart = null
    if (!queued) return
    queued.invalidated = true
    // A request invalidated by an explicit stop is intentionally a successful
    // no-op; a later request gets a fresh generation and is still executed.
    queued.resolve()
  }

  const beginStart = (): Promise<void> => {
    let live: boolean
    try {
      live = checkLive()
    } catch (error) {
      return rejected(error)
    }
    if (live) return Promise.resolve()

    let actual: Promise<void>
    try {
      actual = Promise.resolve(startMic())
    } catch (error) {
      actual = rejected(error)
    }

    // The cleanup branch runs for both ordinary failures and permission
    // failures after stop(), releasing any stream a lower layer acquired
    // before rejecting while preserving the original rejection below.
    let run!: StartRun
    const promise = actual.then(
      () => {
        if (run.invalidated) safelyStop(stopMic)
      },
      error => {
        safelyStop(stopMic)
        throw error
      },
    )
    // This promise is intentionally observed before returning `promise`, so
    // callers that immediately recover from a rejection see the old run
    // cleared rather than accidentally sharing its already-rejected promise.
    const settled = promise.then(
      () => undefined,
      () => undefined,
    )
    run = { promise, settled, invalidated: false }
    activeRun = run
    void promise.then(() => {
      if (activeRun === run) activeRun = null
    }, () => {
      if (activeRun === run) activeRun = null
    })
    return promise
  }

  const finishDrain = (token: Drain): void => {
    if (drain !== token) return
    drain = null
    const queued = queuedStart
    queuedStart = null
    if (!queued) return
    if (queued.invalidated || queued.generation !== generation) {
      queued.resolve()
      return
    }
    const next = beginStart()
    next.then(queued.resolve, queued.reject)
  }

  const beginDrain = (run: StartRun): void => {
    if (drain) return
    const token: Drain = { run }
    drain = token
    void run.settled.then(() => finishDrain(token))
  }

  const start = (): Promise<void> => {
    if (activeRun && !activeRun.invalidated) return activeRun.promise

    if (drain) {
      if (queuedStart && !queuedStart.invalidated) return queuedStart.promise
      let resolveQueued!: () => void
      let rejectQueued!: (error: unknown) => void
      const promise = new Promise<void>((resolve, reject) => {
        resolveQueued = resolve
        rejectQueued = reject
      })
      queuedStart = {
        generation,
        promise,
        resolve: resolveQueued,
        reject: rejectQueued,
        invalidated: false,
      }
      return promise
    }

    return beginStart()
  }

  const stop = (): void => {
    generation += 1
    invalidateQueuedStart()
    safelyStop(stopMic)

    if (activeRun && !activeRun.invalidated) {
      activeRun.invalidated = true
      beginDrain(activeRun)
    }
  }

  return { start, stop }
}
