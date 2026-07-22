import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalSerialize, type CanonicalValue } from '../src/lib/workoutFoundationContracts';
import { createWorkoutEvent, type WorkoutEvent } from '../src/lib/workout/events';

type ProofPhase = 'prepared' | 'writing' | 'accepted' | 'cleaning' | 'clean';

type ProofReceipt = Readonly<{
  receiptVersion: 'workout-event-receipt/1';
  recordId: string;
  eventId: string;
  digest: string;
  acceptedAt: string;
}>;

type StoredProofEvent = Readonly<{
  id: string;
  userId: string;
  eventId: string;
  schemaVersion: string;
  digest: string;
  type: string;
  occurredAt: string;
  payload: unknown;
  compensatesEventId: string | null;
  acceptedAt: Date;
}>;

export type WorkoutEventRouteProofDatabase = Readonly<{
  userExists(userId: string): Promise<boolean>;
  countForUser(userId: string): Promise<number>;
  findByIdentity(userId: string, eventId: string): Promise<StoredProofEvent | null>;
  findById(id: string): Promise<StoredProofEvent | null>;
  deleteById(id: string): Promise<void>;
}>;

type ProofManifest = Readonly<{
  version: 'workout-event-route-proof/1';
  expectedCommit: string;
  origin: string;
  userId: string;
  eventId: string;
  originalEvent: WorkoutEvent;
  changedEvent: WorkoutEvent;
  baselineUserEventCount: number;
  phase: ProofPhase;
  receipt: ProofReceipt | null;
}>;

export type WorkoutEventRouteProofOptions = Readonly<{
  mode: 'apply' | 'cleanup';
  stateDirectory: string;
  expectedCommit?: string;
  origin?: string;
  cookie?: string;
  userId?: string;
  concurrency?: number;
}>;

export type WorkoutEventRouteProofDependencies = Readonly<{
  database: WorkoutEventRouteProofDatabase;
  fetch: typeof globalThis.fetch;
  uuid: () => string;
  now: () => string;
}>;

type PublicProofSummary = Readonly<{
  version: 'workout-event-route-proof-summary/1';
  expectedCommit: string;
  origin: string;
  cases: Readonly<Record<string, 'PASS'>>;
  firstReceiptHash: string;
  replayReceiptHash: string;
  eventIdentityHash: string;
  baselineCount: number;
  finalCount: number;
  cleanup: 'PASS';
}>;

const MANIFEST_FILENAME = 'manifest.private.json';
const ROUTE_PATH = '/api/workout/events';

const hold = (code: string): Error => new Error(`HOLD_${code}`);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const manifestPath = (stateDirectory: string): string => resolve(stateDirectory, MANIFEST_FILENAME);

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw caught;
  }
};

const writeManifest = async (stateDirectory: string, manifest: ProofManifest): Promise<void> => {
  await mkdir(stateDirectory, { recursive: true });
  const target = manifestPath(stateDirectory);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest)}\n`, { encoding: 'utf8', flag: 'w' });
  await rename(temporary, target);
};

const readManifest = async (stateDirectory: string): Promise<ProofManifest> => {
  const parsed = JSON.parse(await readFile(manifestPath(stateDirectory), 'utf8')) as ProofManifest;
  if (parsed.version !== 'workout-event-route-proof/1') throw hold('MANIFEST_VERSION');
  return parsed;
};

const replaceManifest = (
  manifest: ProofManifest,
  update: Partial<Pick<ProofManifest, 'phase' | 'receipt'>>,
): ProofManifest => Object.freeze({ ...manifest, ...update });

const sameCanonical = (left: unknown, right: unknown): boolean =>
  canonicalSerialize(left as CanonicalValue) === canonicalSerialize(right as CanonicalValue);

const assertReceipt = (raw: unknown, expected: WorkoutEvent): ProofReceipt => {
  if (raw === null || Array.isArray(raw) || typeof raw !== 'object') throw hold('RECEIPT_SHAPE');
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  if (keys.join('\0') !== ['acceptedAt', 'digest', 'eventId', 'receiptVersion', 'recordId'].join('\0')) {
    throw hold('RECEIPT_SHAPE');
  }
  if (
    value.receiptVersion !== 'workout-event-receipt/1' ||
    typeof value.recordId !== 'string' || value.recordId.length === 0 ||
    value.eventId !== expected.eventId ||
    value.digest !== expected.digest ||
    typeof value.acceptedAt !== 'string'
  ) {
    throw hold('RECEIPT_VALUE');
  }
  try {
    if (new Date(value.acceptedAt).toISOString() !== value.acceptedAt) throw new Error();
  } catch {
    throw hold('RECEIPT_VALUE');
  }
  return Object.freeze(value as ProofReceipt);
};

const assertStoredEventMatchesManifest = (row: StoredProofEvent, manifest: ProofManifest): void => {
  const event = manifest.originalEvent;
  if (
    row.userId !== manifest.userId ||
    row.eventId !== event.eventId ||
    row.schemaVersion !== event.schemaVersion ||
    row.digest !== event.digest ||
    row.type !== event.type ||
    row.occurredAt !== event.occurredAt ||
    row.compensatesEventId !== (event.compensatesEventId ?? null) ||
    !sameCanonical(row.payload, event.payload)
  ) {
    throw hold('CLEANUP_MISMATCH');
  }
  if (manifest.receipt !== null) {
    if (
      row.id !== manifest.receipt.recordId ||
      row.acceptedAt.toISOString() !== manifest.receipt.acceptedAt
    ) {
      throw hold('CLEANUP_MISMATCH');
    }
  }
};

export const cleanupWorkoutEventRouteProof = async (
  stateDirectory: string,
  database: WorkoutEventRouteProofDatabase,
): Promise<ProofManifest> => {
  let manifest = await readManifest(stateDirectory);
  manifest = replaceManifest(manifest, { phase: 'cleaning' });
  await writeManifest(stateDirectory, manifest);

  let cleanupRecordId = manifest.receipt?.recordId ?? null;
  const row = await database.findByIdentity(manifest.userId, manifest.eventId);
  if (row !== null) {
    assertStoredEventMatchesManifest(row, manifest);
    if (manifest.receipt === null) {
      const recoveredReceipt: ProofReceipt = Object.freeze({
        receiptVersion: 'workout-event-receipt/1',
        recordId: row.id,
        eventId: row.eventId,
        digest: row.digest,
        acceptedAt: row.acceptedAt.toISOString(),
      });
      manifest = replaceManifest(manifest, { receipt: recoveredReceipt });
      await writeManifest(stateDirectory, manifest);
    }
    cleanupRecordId = manifest.receipt?.recordId ?? row.id;
    await database.deleteById(row.id);
  }
  if (await database.findByIdentity(manifest.userId, manifest.eventId) !== null) {
    throw hold('CLEANUP_RESIDUE');
  }
  if (cleanupRecordId !== null && await database.findById(cleanupRecordId) !== null) {
    throw hold('CLEANUP_RECORD_RESIDUE');
  }
  const finalCount = await database.countForUser(manifest.userId);
  if (finalCount !== manifest.baselineUserEventCount) throw hold('BASELINE_CHANGED');

  manifest = replaceManifest(manifest, { phase: 'clean' });
  await writeManifest(stateDirectory, manifest);
  const confirmed = await readManifest(stateDirectory);
  if (confirmed.phase !== 'clean') throw hold('CLEANUP_MANIFEST');
  return confirmed;
};

const postEvent = async (
  fetchImplementation: typeof globalThis.fetch,
  origin: string,
  cookie: string,
  event: WorkoutEvent,
  expectedCommit: string,
): Promise<Response> => {
  const response = await fetchImplementation(`${origin}${ROUTE_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify(event),
    cache: 'no-store',
    redirect: 'manual',
  });
  if (response.headers.get('x-rb-deployment-commit')?.toLowerCase() !== expectedCommit) {
    throw hold('DEPLOYMENT_COMMIT_MISMATCH');
  }
  return response;
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown;
  } catch {
    throw hold('RESPONSE_JSON');
  }
};

export const runWorkoutEventRouteProof = async (
  options: WorkoutEventRouteProofOptions,
  dependencies: WorkoutEventRouteProofDependencies,
): Promise<PublicProofSummary> => {
  if (options.stateDirectory.trim().length === 0) throw hold('STATE_DIRECTORY');
  if (options.mode === 'cleanup') {
    const clean = await cleanupWorkoutEventRouteProof(options.stateDirectory, dependencies.database);
    return Object.freeze({
      version: 'workout-event-route-proof-summary/1',
      expectedCommit: clean.expectedCommit,
      origin: clean.origin,
      cases: Object.freeze({ cleanup_only: 'PASS' as const }),
      firstReceiptHash: clean.receipt === null ? '' : sha256(canonicalSerialize(clean.receipt as unknown as CanonicalValue)),
      replayReceiptHash: clean.receipt === null ? '' : sha256(canonicalSerialize(clean.receipt as unknown as CanonicalValue)),
      eventIdentityHash: sha256(clean.eventId),
      baselineCount: clean.baselineUserEventCount,
      finalCount: clean.baselineUserEventCount,
      cleanup: 'PASS',
    });
  }

  const expectedCommit = options.expectedCommit?.trim();
  const origin = options.origin?.replace(/\/$/, '');
  const cookie = options.cookie;
  const userId = options.userId?.trim();
  if (!expectedCommit || !/^[0-9a-f]{40}$/.test(expectedCommit)) throw hold('EXPECTED_COMMIT');
  if (!origin || !/^https:\/\//.test(origin)) throw hold('ORIGIN');
  if (!cookie || cookie.trim().length === 0) throw hold('AUTH_SESSION');
  if (!userId) throw hold('USER_ID');
  if (await pathExists(manifestPath(options.stateDirectory))) throw hold('UNFINISHED_MANIFEST');
  if (!(await dependencies.database.userExists(userId))) throw hold('USER_NOT_FOUND');

  const uuid = dependencies.uuid();
  const originalEvent = await createWorkoutEvent({
    accountId: userId,
    type: 'set.confirmed',
    occurredAt: dependencies.now(),
    payload: { proof: 'route-replay', value: 1 },
  }, { uuidFactory: () => uuid });
  const changedEvent = await createWorkoutEvent({
    accountId: userId,
    type: 'set.confirmed',
    occurredAt: originalEvent.occurredAt,
    payload: { proof: 'route-replay', value: 2 },
  }, { uuidFactory: () => uuid });
  if (await dependencies.database.findByIdentity(userId, originalEvent.eventId) !== null) {
    throw hold('PREEXISTING');
  }

  const baselineUserEventCount = await dependencies.database.countForUser(userId);
  let manifest: ProofManifest = Object.freeze({
    version: 'workout-event-route-proof/1',
    expectedCommit,
    origin,
    userId,
    eventId: originalEvent.eventId,
    originalEvent,
    changedEvent,
    baselineUserEventCount,
    phase: 'prepared',
    receipt: null,
  });
  await writeManifest(options.stateDirectory, manifest);

  let firstReceipt: ProofReceipt | null = null;
  let replayReceipt: ProofReceipt | null = null;
  let proofFailure: unknown;
  try {
    manifest = replaceManifest(manifest, { phase: 'writing' });
    await writeManifest(options.stateDirectory, manifest);

    const firstResponse = await postEvent(dependencies.fetch, origin, cookie, originalEvent, expectedCommit);
    if (firstResponse.status !== 200) throw hold('FIRST_ACCEPT');
    firstReceipt = assertReceipt(await readJson(firstResponse), originalEvent);
    manifest = replaceManifest(manifest, { phase: 'accepted', receipt: firstReceipt });
    await writeManifest(options.stateDirectory, manifest);

    const replayResponse = await postEvent(dependencies.fetch, origin, cookie, originalEvent, expectedCommit);
    if (replayResponse.status !== 200) throw hold('EXACT_REPLAY');
    replayReceipt = assertReceipt(await readJson(replayResponse), originalEvent);
    if (!sameCanonical(firstReceipt, replayReceipt)) throw hold('RECEIPT_DIVERGENCE');

    const concurrency = options.concurrency ?? 8;
    if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 16) throw hold('CONCURRENCY');
    const cohort = await Promise.all(Array.from({ length: concurrency }, async () => {
      const response = await postEvent(dependencies.fetch, origin, cookie, originalEvent, expectedCommit);
      if (response.status !== 200) throw hold('CONCURRENT_REPLAY');
      return assertReceipt(await readJson(response), originalEvent);
    }));
    if (cohort.some(receipt => !sameCanonical(receipt, firstReceipt))) throw hold('CONCURRENT_DIVERGENCE');

    const changedResponse = await postEvent(dependencies.fetch, origin, cookie, changedEvent, expectedCommit);
    if (changedResponse.status !== 409) throw hold('CHANGED_REPLAY_STATUS');
    const changedBody = await readJson(changedResponse);
    if (!sameCanonical(changedBody, { error: 'replay_conflict' })) throw hold('CHANGED_REPLAY_BODY');

    await postEvent(dependencies.fetch, origin, cookie, originalEvent, expectedCommit);
    const retryResponse = await postEvent(dependencies.fetch, origin, cookie, originalEvent, expectedCommit);
    if (retryResponse.status !== 200) throw hold('LOST_RESPONSE_RETRY');
    const retryReceipt = assertReceipt(await readJson(retryResponse), originalEvent);
    if (!sameCanonical(retryReceipt, firstReceipt)) throw hold('LOST_RESPONSE_DIVERGENCE');

    const stored = await dependencies.database.findByIdentity(userId, originalEvent.eventId);
    if (stored === null) throw hold('WINNER_MISSING');
    assertStoredEventMatchesManifest(stored, manifest);
  } catch (caught) {
    proofFailure = caught;
  }

  let clean: ProofManifest;
  try {
    clean = await cleanupWorkoutEventRouteProof(options.stateDirectory, dependencies.database);
  } catch (cleanupFailure) {
    throw cleanupFailure;
  }
  if (proofFailure !== undefined) throw proofFailure;
  if (firstReceipt === null || replayReceipt === null) throw hold('RECEIPT_MISSING');

  const firstReceiptHash = sha256(canonicalSerialize(firstReceipt as unknown as CanonicalValue));
  const replayReceiptHash = sha256(canonicalSerialize(replayReceipt as unknown as CanonicalValue));
  return Object.freeze({
    version: 'workout-event-route-proof-summary/1',
    expectedCommit,
    origin,
    cases: Object.freeze({
      first_accept: 'PASS',
      exact_replay: 'PASS',
      concurrent_replay: 'PASS',
      changed_replay: 'PASS',
      lost_response_retry: 'PASS',
      cleanup: 'PASS',
    }),
    firstReceiptHash,
    replayReceiptHash,
    eventIdentityHash: sha256(clean.eventId),
    baselineCount: clean.baselineUserEventCount,
    finalCount: await dependencies.database.countForUser(clean.userId),
    cleanup: 'PASS',
  });
};

const parseMode = (): 'apply' | 'cleanup' => {
  const value = process.argv.find(argument => argument.startsWith('--mode='))?.slice('--mode='.length);
  if (value !== 'apply' && value !== 'cleanup') throw hold('MODE');
  return value;
};

const main = async (): Promise<void> => {
  const mode = parseMode();
  let interrupted = false;
  const markInterrupted = (): void => { interrupted = true; };
  process.once('SIGINT', markInterrupted);
  process.once('SIGTERM', markInterrupted);

  const [{ prisma }] = await Promise.all([import('../src/lib/prisma')]);
  const database: WorkoutEventRouteProofDatabase = {
    userExists: async userId => (await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) !== null,
    countForUser: userId => prisma.workoutEvent.count({ where: { userId } }),
    findByIdentity: (userId, eventId) => prisma.workoutEvent.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: {
        id: true, userId: true, eventId: true, schemaVersion: true, digest: true,
        type: true, occurredAt: true, payload: true, compensatesEventId: true, acceptedAt: true,
      },
    }),
    findById: id => prisma.workoutEvent.findUnique({
      where: { id },
      select: {
        id: true, userId: true, eventId: true, schemaVersion: true, digest: true,
        type: true, occurredAt: true, payload: true, compensatesEventId: true, acceptedAt: true,
      },
    }),
    deleteById: async id => { await prisma.workoutEvent.delete({ where: { id } }); },
  };

  try {
    const summary = await runWorkoutEventRouteProof({
      mode,
      stateDirectory: process.env.RB_WORKOUT_PROOF_STATE_DIR ?? '',
      expectedCommit: process.env.RB_WORKOUT_PROOF_EXPECTED_COMMIT,
      origin: process.env.RB_WORKOUT_PROOF_ORIGIN ?? 'https://resetbiology.com',
      cookie: process.env.RB_WORKOUT_PROOF_COOKIE,
      userId: process.env.RB_WORKOUT_PROOF_USER_ID,
    }, {
      database,
      fetch: globalThis.fetch,
      uuid: randomUUID,
      now: () => new Date().toISOString(),
    });
    console.log(JSON.stringify(summary));
    console.log(interrupted ? 'PROOF=HOLD:INTERRUPTED_AFTER_CLEANUP' : 'PROOF=PASS');
    if (interrupted) process.exitCode = 2;
  } catch (caught) {
    const code = caught instanceof Error && /^HOLD_[A-Z0-9_]+$/.test(caught.message)
      ? caught.message.slice('HOLD_'.length)
      : 'UNEXPECTED';
    console.error(`PROOF=HOLD:${code}`);
    process.exitCode = 2;
  } finally {
    process.removeListener('SIGINT', markInterrupted);
    process.removeListener('SIGTERM', markInterrupted);
    await prisma.$disconnect();
  }
};

const isDirectExecution = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  void main();
}
