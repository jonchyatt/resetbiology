import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { POST } from '../app/api/workout/events/route';
import {
  WorkoutEventLedgerError,
  acceptWorkoutEvent,
  type WorkoutEventReceipt,
  type WorkoutEventStore,
  type WorkoutEventStoreCreateInput,
  type WorkoutEventStoreRecord,
} from '../src/lib/workout/eventService';
import { WorkoutEventContractError, createWorkoutEvent } from '../src/lib/workout/events';
import { createPrismaWorkoutEventStore } from '../src/lib/workout/prismaEventStore';
import {
  cleanupWorkoutEventRouteProof,
  runWorkoutEventRouteProof,
  type WorkoutEventRouteProofDatabase,
} from '../scripts/workout-event-route-proof';

const MEMBER_A = '507f1f77bcf86cd799439011';
const AT = '2026-07-22T20:00:00.000Z';
const RECEIPT: WorkoutEventReceipt = Object.freeze({
  receiptVersion: 'workout-event-receipt/1',
  recordId: '507f1f77bcf86cd799439012',
  eventId: 'wev_00000000-0000-4000-8000-000000000001',
  digest: `sha256:${'a'.repeat(64)}`,
  acceptedAt: AT,
});

const { createWorkoutEventPostHandler } = POST.testContract;

let uuidCounter = 0;
const nextUuid = (): string => {
  uuidCounter += 1;
  return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
};

const makeEvent = (accountId = MEMBER_A, uuid = nextUuid(), payload: Record<string, unknown> = { value: 1 }) =>
  createWorkoutEvent({ accountId, type: 'set.confirmed', occurredAt: AT, payload }, { uuidFactory: () => uuid });

const storedRecord = (input: WorkoutEventStoreCreateInput, overrides: Partial<WorkoutEventStoreRecord> = {}): WorkoutEventStoreRecord => ({
  id: '507f1f77bcf86cd799439012',
  userId: input.userId,
  eventId: input.eventId,
  schemaVersion: input.schemaVersion,
  digest: input.digest,
  type: input.type,
  occurredAt: input.occurredAt,
  payload: input.payload,
  compensatesEventId: input.compensatesEventId,
  acceptedAt: new Date(AT),
  ...overrides,
});

class MemoryStore implements WorkoutEventStore {
  row: WorkoutEventStoreRecord | null = null;
  createCalls = 0;
  findCalls = 0;

  async create(input: WorkoutEventStoreCreateInput): Promise<WorkoutEventStoreRecord> {
    this.createCalls += 1;
    if (this.row !== null) {
      const { createWorkoutEventIdentityCollisionError } = await import('../src/lib/workout/eventService');
      throw createWorkoutEventIdentityCollisionError(['userId', 'eventId']);
    }
    this.row = storedRecord(input);
    return this.row;
  }

  async findByIdentity(): Promise<WorkoutEventStoreRecord | null> {
    this.findCalls += 1;
    return this.row;
  }
}

const okResolution = { status: 'ok', user: { id: MEMBER_A } } as any;
const session = { user: { sub: 'auth0|proof', email: 'owned@example.test', email_verified: true } } as any;

type RouteOverrides = Partial<Parameters<typeof createWorkoutEventPostHandler>[0]>;

const routeDependencies = (overrides: RouteOverrides = {}) => {
  const store = new MemoryStore();
  let loadStoreCalls = 0;
  const dependencies = {
    getSession: async () => session,
    resolveUser: async () => okResolution,
    loadStore: async () => { loadStoreCalls += 1; return store; },
    acceptEvent: acceptWorkoutEvent,
    getDeploymentCommit: () => 'a'.repeat(40),
    ...overrides,
  } as Parameters<typeof createWorkoutEventPostHandler>[0];
  return { dependencies, store, loadStoreCalls: () => loadStoreCalls };
};

const jsonRequest = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('https://resetbiology.com/api/workout/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const responseBody = (response: Response): Promise<any> => response.json();

const trackedRequest = (body: string): { request: Request; reads: () => number } => {
  const request = jsonRequest(body);
  const originalBody = request.body;
  let reads = 0;
  Object.defineProperty(request, 'body', {
    configurable: true,
    get: () => { reads += 1; return originalBody; },
  });
  return { request, reads: () => reads };
};

const prismaP2002 = (target: unknown): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('SECRET_DATABASE_CANARY', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target },
  });

type CaseResult = { id: number; name: string; ok: boolean; error?: unknown };
const results: CaseResult[] = [];
const TOTAL_CASES = 20;

async function runCase(id: number, name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    results.push({ id, name, ok: true });
    console.log(`[PASS ${id}/${TOTAL_CASES}] ${name}`);
  } catch (error) {
    results.push({ id, name, ok: false, error });
    console.error(`[FAIL ${id}/${TOTAL_CASES}] ${name}`);
    console.error(error);
  }
}

async function main(): Promise<void> {
  await runCase(1, 'unauthenticated request returns before body read or store load', async () => {
    const tracked = trackedRequest('{}');
    const route = routeDependencies({ getSession: async () => null });
    const response = await createWorkoutEventPostHandler(route.dependencies)(tracked.request);
    assert.equal(response.status, 401);
    assert.deepEqual(await responseBody(response), { error: 'unauthorized' });
    assert.equal(tracked.reads(), 0);
    assert.equal(route.loadStoreCalls(), 0);
  });

  await runCase(2, 'unverified email and identity failure return before body or store', async () => {
    for (const [resolution, status, error] of [
      [{ status: 'unverified_email', email: 'owned@example.test' }, 403, 'verify_email'],
      [null, 503, 'identity_lookup_failed'],
    ] as const) {
      const tracked = trackedRequest('{}');
      const route = routeDependencies({ resolveUser: async () => resolution as any });
      const response = await createWorkoutEventPostHandler(route.dependencies)(tracked.request);
      assert.equal(response.status, status);
      assert.deepEqual(await responseBody(response), { error });
      assert.equal(tracked.reads(), 0);
      assert.equal(route.loadStoreCalls(), 0);
    }
  });

  await runCase(3, 'invalid media, malformed JSON, multiple values, and non-objects are invalid_event', async () => {
    const requests = [
      new Request('https://resetbiology.com/api/workout/events', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }),
      jsonRequest('{'),
      jsonRequest('{} {}'),
      jsonRequest('null'),
      jsonRequest('[]'),
      jsonRequest('42'),
    ];
    for (const request of requests) {
      const route = routeDependencies();
      const response = await createWorkoutEventPostHandler(route.dependencies)(request);
      assert.equal(response.status, 400);
      assert.deepEqual(await responseBody(response), { error: 'invalid_event' });
      assert.equal(route.loadStoreCalls(), 0);
    }
  });

  await runCase(4, 'fatal UTF-8 and stream failures are invalid_event', async () => {
    const badUtf8 = new Request('https://resetbiology.com/api/workout/events', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xc3, 0x28]),
    });
    const failingStream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.error(new Error('SECRET_STREAM_CANARY')); },
    });
    const failed = new Request('https://resetbiology.com/api/workout/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: failingStream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    for (const request of [badUtf8, failed]) {
      const route = routeDependencies();
      const response = await createWorkoutEventPostHandler(route.dependencies)(request);
      assert.equal(response.status, 400);
      assert.deepEqual(await responseBody(response), { error: 'invalid_event' });
      assert.equal(route.loadStoreCalls(), 0);
    }
  });

  await runCase(5, 'actual-byte ceiling accepts 65,536 and rejects 65,537 despite a lying header', async () => {
    const atSize = (target: number): string => {
      const baseline = JSON.stringify({ pad: '' }).length;
      const value = JSON.stringify({ pad: 'x'.repeat(target - baseline) });
      assert.equal(new TextEncoder().encode(value).byteLength, target);
      return value;
    };
    const accepting = routeDependencies({ acceptEvent: async () => RECEIPT });
    const accepted = await createWorkoutEventPostHandler(accepting.dependencies)(jsonRequest(atSize(65536)));
    assert.equal(accepted.status, 200);
    assert.equal(accepting.loadStoreCalls(), 1);

    const rejecting = routeDependencies({ acceptEvent: async () => RECEIPT });
    const rejected = await createWorkoutEventPostHandler(rejecting.dependencies)(jsonRequest(atSize(65537), { 'content-length': '1' }));
    assert.equal(rejected.status, 400);
    assert.deepEqual(await responseBody(rejected), { error: 'invalid_event' });
    assert.equal(rejecting.loadStoreCalls(), 0);

    const declared = trackedRequest('{}');
    declared.request.headers.set('content-length', '65537');
    const declaredRoute = routeDependencies({ acceptEvent: async () => RECEIPT });
    const declaredResponse = await createWorkoutEventPostHandler(declaredRoute.dependencies)(declared.request);
    assert.equal(declaredResponse.status, 400);
    assert.equal(declared.reads(), 0);
    assert.equal(declaredRoute.loadStoreCalls(), 0);
  });

  await runCase(6, 'strict validator rejects unknown fields and stale digests before create', async () => {
    const valid = await makeEvent();
    for (const body of [{ ...valid, unknown: true }, { ...valid, type: 'set.adjusted' }]) {
      const route = routeDependencies();
      const response = await createWorkoutEventPostHandler(route.dependencies)(jsonRequest(body));
      assert.equal(response.status, 400);
      assert.deepEqual(await responseBody(response), { error: 'invalid_event' });
      assert.equal(route.store.createCalls, 0);
    }
  });

  await runCase(7, 'account mismatch is 403 and makes zero create calls', async () => {
    const event = await makeEvent('507f1f77bcf86cd799439099');
    const route = routeDependencies();
    const response = await createWorkoutEventPostHandler(route.dependencies)(jsonRequest(event));
    assert.equal(response.status, 403);
    assert.deepEqual(await responseBody(response), { error: 'account_mismatch' });
    assert.equal(route.store.createCalls, 0);
  });

  await runCase(8, 'first accept and exact replay return byte-identical five-string receipts', async () => {
    const event = await makeEvent();
    const route = routeDependencies();
    const handler = createWorkoutEventPostHandler(route.dependencies);
    const first = await handler(jsonRequest(event));
    const replay = await handler(jsonRequest(event));
    assert.equal(first.status, 200);
    assert.equal(replay.status, 200);
    assert.equal(first.headers.get('x-rb-deployment-commit'), 'a'.repeat(40));
    const firstText = await first.text();
    const replayText = await replay.text();
    assert.equal(replayText, firstText);
    assert.deepEqual(Object.keys(JSON.parse(firstText)).sort(), ['acceptedAt', 'digest', 'eventId', 'receiptVersion', 'recordId'].sort());
    assert.equal(route.store.createCalls, 2);
    assert.equal(route.store.findCalls, 1);

    const concurrent = await Promise.all(Array.from({ length: 8 }, () => handler(jsonRequest(event))));
    const concurrentTexts = await Promise.all(concurrent.map(response => response.text()));
    assert.ok(concurrentTexts.every(text => text === firstText));
  });

  await runCase(9, 'changed replay is 409 and preserves the original ten-field row', async () => {
    const uuid = nextUuid();
    const original = await makeEvent(MEMBER_A, uuid, { value: 1 });
    const changed = await makeEvent(MEMBER_A, uuid, { value: 2 });
    const route = routeDependencies();
    const handler = createWorkoutEventPostHandler(route.dependencies);
    assert.equal((await handler(jsonRequest(original))).status, 200);
    const before = route.store.row;
    const response = await handler(jsonRequest(changed));
    assert.equal(response.status, 409);
    assert.deepEqual(await responseBody(response), { error: 'replay_conflict' });
    assert.deepEqual(route.store.row, before);
  });

  await runCase(10, 'closed ledger errors map without exposing caught text', async () => {
    const event = await makeEvent();
    const cases: Array<[unknown, number, string]> = [
      [new WorkoutEventLedgerError('LEDGER_UNAVAILABLE'), 503, 'ledger_unavailable'],
      [new WorkoutEventLedgerError('LEDGER_INCONSISTENT'), 503, 'ledger_unavailable'],
      [new WorkoutEventLedgerError('LEDGER_CORRUPT'), 500, 'ledger_corrupt'],
      [new Error('SECRET_DATABASE_CANARY'), 503, 'ledger_unavailable'],
    ];
    for (const [caught, status, error] of cases) {
      const route = routeDependencies({ acceptEvent: async () => { throw caught; } });
      const response = await createWorkoutEventPostHandler(route.dependencies)(jsonRequest(event));
      assert.equal(response.status, status);
      const text = await response.text();
      assert.equal(text.includes('SECRET_DATABASE_CANARY'), false);
      assert.deepEqual(JSON.parse(text), { error });
    }
  });

  await runCase(11, 'adapter success sends create-eight and select-ten', async () => {
    const event = await makeEvent();
    let createArgs: any;
    const delegate = {
      create: async (args: any) => { createArgs = args; return storedRecord(args.data); },
      findUnique: async () => null,
    };
    const store = createPrismaWorkoutEventStore(delegate);
    const receipt = await acceptWorkoutEvent(store, MEMBER_A, event);
    assert.equal(receipt.eventId, event.eventId);
    assert.deepEqual(Object.keys(createArgs.data).sort(), [
      'compensatesEventId', 'digest', 'eventId', 'occurredAt', 'payload', 'schemaVersion', 'type', 'userId',
    ].sort());
    assert.deepEqual(Object.keys(createArgs.select).sort(), [
      'acceptedAt', 'compensatesEventId', 'digest', 'eventId', 'id', 'occurredAt', 'payload', 'schemaVersion', 'type', 'userId',
    ].sort());
  });

  await runCase(12, 'typed exact P2002 becomes checked collision and service rereads winner', async () => {
    const event = await makeEvent();
    const winner = storedRecord({
      userId: MEMBER_A, eventId: event.eventId, schemaVersion: event.schemaVersion, digest: event.digest,
      type: event.type, occurredAt: event.occurredAt, payload: event.payload, compensatesEventId: null,
    });
    let finds = 0;
    const store = createPrismaWorkoutEventStore({
      create: async () => { throw prismaP2002(['userId', 'eventId']); },
      findUnique: async () => { finds += 1; return winner; },
    });
    const receipt = await acceptWorkoutEvent(store, MEMBER_A, event);
    assert.equal(receipt.recordId, winner.id);
    assert.equal(finds, 1);
  });

  await runCase(13, 'ambiguous typed P2002 reconciles exact state before service classification', async () => {
    const event = await makeEvent();
    const winner = storedRecord({
      userId: MEMBER_A, eventId: event.eventId, schemaVersion: event.schemaVersion, digest: event.digest,
      type: event.type, occurredAt: event.occurredAt, payload: event.payload, compensatesEventId: null,
    });
    for (const target of [undefined, ['eventId', 'userId'], ['digest'], ['userId', 'eventId', 'digest'], 'index_name']) {
      let finds = 0;
      const store = createPrismaWorkoutEventStore({
        create: async () => { throw prismaP2002(target); },
        findUnique: async () => { finds += 1; return winner; },
      });
      const receipt = await acceptWorkoutEvent(store, MEMBER_A, event);
      assert.equal(receipt.digest, event.digest);
      assert.equal(finds, 2, 'adapter reconciles once and service rereads once');
    }
  });

  await runCase(14, 'non-P2002 lost response reconciles a committed exact winner', async () => {
    const event = await makeEvent();
    const winner = storedRecord({
      userId: MEMBER_A, eventId: event.eventId, schemaVersion: event.schemaVersion, digest: event.digest,
      type: event.type, occurredAt: event.occurredAt, payload: event.payload, compensatesEventId: null,
    });
    let finds = 0;
    const store = createPrismaWorkoutEventStore({
      create: async () => { throw new Error('SECRET_LOST_RESPONSE'); },
      findUnique: async () => { finds += 1; return winner; },
    });
    const receipt = await acceptWorkoutEvent(store, MEMBER_A, event);
    assert.equal(receipt.recordId, winner.id);
    assert.equal(finds, 2);
  });

  await runCase(15, 'typed, forged, and generic failures with no winner stay unavailable', async () => {
    const event = await makeEvent();
    for (const caught of [
      prismaP2002(undefined),
      { code: 'P2002', meta: { target: ['userId', 'eventId'] }, message: 'SECRET_FORGED' },
      new Error('SECRET_GENERIC'),
    ]) {
      const store = createPrismaWorkoutEventStore({
        create: async () => { throw caught; },
        findUnique: async () => null,
      });
      await assert.rejects(() => acceptWorkoutEvent(store, MEMBER_A, event), (error: unknown) => {
        assert.ok(error instanceof WorkoutEventLedgerError);
        assert.equal(error.code, 'LEDGER_UNAVAILABLE');
        assert.equal(error.message.includes('SECRET'), false);
        return true;
      });
    }
  });

  await runCase(16, 'reconciliation lookup failure stays redacted unavailable', async () => {
    const event = await makeEvent();
    const store = createPrismaWorkoutEventStore({
      create: async () => { throw prismaP2002(['digest']); },
      findUnique: async () => { throw new Error('SECRET_LOOKUP_CANARY'); },
    });
    await assert.rejects(() => acceptWorkoutEvent(store, MEMBER_A, event), (error: unknown) => {
      assert.ok(error instanceof WorkoutEventLedgerError);
      assert.equal(error.code, 'LEDGER_UNAVAILABLE');
      assert.equal(error.message.includes('SECRET'), false);
      return true;
    });
  });

  await runCase(17, 'route always emits one closed response for contract and ledger errors', async () => {
    const event = await makeEvent();
    const errors = [
      new WorkoutEventContractError('INVALID_EVENT', '$', 'SECRET'),
      new WorkoutEventContractError('ACCOUNT_PARTITION', '$.accountId', 'SECRET'),
      new WorkoutEventContractError('REPLAY_CONFLICT', '$.eventId', 'SECRET'),
      new WorkoutEventLedgerError('LEDGER_CORRUPT'),
    ];
    for (const caught of errors) {
      let calls = 0;
      const route = routeDependencies({ acceptEvent: async () => { calls += 1; throw caught; } });
      const response = await createWorkoutEventPostHandler(route.dependencies)(jsonRequest(event));
      assert.equal(calls, 1);
      const body = await response.text();
      assert.equal(body.includes('SECRET'), false);
      await assert.rejects(() => response.text(), TypeError);
    }
  });

  await runCase(18, 'isolated proof converges receipts and restores exact baseline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rb-workout-route-proof-test-'));
    let row: WorkoutEventStoreRecord | null = null;
    const database: WorkoutEventRouteProofDatabase = {
      userExists: async userId => userId === MEMBER_A,
      countForUser: async () => row === null ? 0 : 1,
      findByIdentity: async (_userId, eventId) => row?.eventId === eventId ? row : null,
      findById: async id => row?.id === id ? row : null,
      deleteById: async id => { if (row?.id !== id) throw new Error('wrong delete'); row = null; },
    };
    const acceptedAt = new Date(AT);
    const fakeFetch: typeof globalThis.fetch = async (_input, init) => {
      const event = JSON.parse(String(init?.body)) as any;
      if (row === null) {
        row = storedRecord({
          userId: MEMBER_A, eventId: event.eventId, schemaVersion: event.schemaVersion, digest: event.digest,
          type: event.type, occurredAt: event.occurredAt, payload: event.payload,
          compensatesEventId: event.compensatesEventId ?? null,
        }, { acceptedAt });
      }
      const headers = { 'x-rb-deployment-commit': 'a'.repeat(40) };
      if (row.digest !== event.digest) return Response.json({ error: 'replay_conflict' }, { status: 409, headers });
      return Response.json({
        receiptVersion: 'workout-event-receipt/1', recordId: row.id, eventId: row.eventId,
        digest: row.digest, acceptedAt: row.acceptedAt.toISOString(),
      }, { headers });
    };
    try {
      const summary = await runWorkoutEventRouteProof({
        mode: 'apply', stateDirectory: directory, expectedCommit: 'a'.repeat(40),
        origin: 'https://resetbiology.com', cookie: '__session=SECRET_COOKIE', userId: MEMBER_A, concurrency: 3,
      }, { database, fetch: fakeFetch, uuid: () => nextUuid(), now: () => AT });
      assert.equal(summary.cleanup, 'PASS');
      assert.equal(summary.firstReceiptHash, summary.replayReceiptHash);
      assert.equal(summary.baselineCount, 0);
      assert.equal(summary.finalCount, 0);
      assert.equal(row, null);
      const publicText = JSON.stringify(summary);
      assert.equal(publicText.includes(MEMBER_A), false);
      assert.equal(publicText.includes('SECRET_COOKIE'), false);
      const manifest = JSON.parse(await readFile(join(directory, 'manifest.private.json'), 'utf8'));
      assert.equal(manifest.phase, 'clean');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  await runCase(19, 'proof refuses weak authority, wrong deployments, and primary-key residue', async () => {
    const database: WorkoutEventRouteProofDatabase = {
      userExists: async () => true, countForUser: async () => 0,
      findByIdentity: async () => null, findById: async () => null, deleteById: async () => undefined,
    };
    await assert.rejects(() => runWorkoutEventRouteProof({ mode: 'apply', stateDirectory: '' }, {
      database, fetch: globalThis.fetch, uuid: nextUuid, now: () => AT,
    }), /HOLD_STATE_DIRECTORY/);

    const wrongCommitDirectory = await mkdtemp(join(tmpdir(), 'rb-workout-route-commit-test-'));
    let wrongCommitRow: WorkoutEventStoreRecord | null = null;
    const wrongCommitDatabase: WorkoutEventRouteProofDatabase = {
      userExists: async () => true,
      countForUser: async () => wrongCommitRow === null ? 0 : 1,
      findByIdentity: async (_userId, eventId) => wrongCommitRow?.eventId === eventId ? wrongCommitRow : null,
      findById: async id => wrongCommitRow?.id === id ? wrongCommitRow : null,
      deleteById: async id => { if (wrongCommitRow?.id === id) wrongCommitRow = null; },
    };
    const wrongCommitFetch: typeof globalThis.fetch = async (_input, init) => {
      const event = JSON.parse(String(init?.body)) as any;
      wrongCommitRow = storedRecord({
        userId: MEMBER_A, eventId: event.eventId, schemaVersion: event.schemaVersion, digest: event.digest,
        type: event.type, occurredAt: event.occurredAt, payload: event.payload,
        compensatesEventId: event.compensatesEventId ?? null,
      });
      return Response.json({
        receiptVersion: 'workout-event-receipt/1', recordId: wrongCommitRow.id,
        eventId: wrongCommitRow.eventId, digest: wrongCommitRow.digest,
        acceptedAt: wrongCommitRow.acceptedAt.toISOString(),
      }, { headers: { 'x-rb-deployment-commit': 'b'.repeat(40) } });
    };

    const residueDirectory = await mkdtemp(join(tmpdir(), 'rb-workout-route-residue-test-'));
    const lostDeleteDirectory = await mkdtemp(join(tmpdir(), 'rb-workout-route-lost-delete-test-'));
    try {
      await assert.rejects(() => runWorkoutEventRouteProof({
        mode: 'apply', stateDirectory: wrongCommitDirectory, expectedCommit: 'a'.repeat(40),
        origin: 'https://resetbiology.com', cookie: '__session=SECRET_COOKIE', userId: MEMBER_A,
      }, { database: wrongCommitDatabase, fetch: wrongCommitFetch, uuid: nextUuid, now: () => AT }),
      /HOLD_DEPLOYMENT_COMMIT_MISMATCH/);
      assert.equal(wrongCommitRow, null);

      const uuid = nextUuid();
      const originalEvent = await makeEvent(MEMBER_A, uuid);
      const changedEvent = await makeEvent(MEMBER_A, uuid, { value: 2 });
      const residue = storedRecord({
        userId: MEMBER_A, eventId: originalEvent.eventId, schemaVersion: originalEvent.schemaVersion,
        digest: originalEvent.digest, type: originalEvent.type, occurredAt: originalEvent.occurredAt,
        payload: originalEvent.payload, compensatesEventId: originalEvent.compensatesEventId ?? null,
      });
      await writeFile(join(residueDirectory, 'manifest.private.json'), `${JSON.stringify({
        version: 'workout-event-route-proof/1', expectedCommit: 'a'.repeat(40),
        origin: 'https://resetbiology.com', userId: MEMBER_A, eventId: originalEvent.eventId,
        originalEvent, changedEvent, baselineUserEventCount: 0, phase: 'writing', receipt: null,
      })}\n`, 'utf8');
      let residueIdentityReads = 0;
      const residueDatabase: WorkoutEventRouteProofDatabase = {
        userExists: async () => true,
        countForUser: async () => 0,
        findByIdentity: async () => { residueIdentityReads += 1; return residueIdentityReads === 1 ? residue : null; },
        findById: async id => id === residue.id ? residue : null,
        deleteById: async () => undefined,
      };
      await assert.rejects(
        () => cleanupWorkoutEventRouteProof(residueDirectory, residueDatabase),
        /HOLD_CLEANUP_RECORD_RESIDUE/,
      );

      const lostDeleteManifest = {
        version: 'workout-event-route-proof/1', expectedCommit: 'a'.repeat(40),
        origin: 'https://resetbiology.com', userId: MEMBER_A, eventId: originalEvent.eventId,
        originalEvent, changedEvent, baselineUserEventCount: 0, phase: 'writing', receipt: null,
      };
      await writeFile(
        join(lostDeleteDirectory, 'manifest.private.json'),
        `${JSON.stringify(lostDeleteManifest)}\n`,
        'utf8',
      );
      let lostDeleteRow: WorkoutEventStoreRecord | null = residue;
      const lostDeleteDatabase: WorkoutEventRouteProofDatabase = {
        userExists: async () => true,
        countForUser: async () => lostDeleteRow === null ? 0 : 1,
        findByIdentity: async () => lostDeleteRow,
        findById: async id => lostDeleteRow?.id === id ? lostDeleteRow : null,
        deleteById: async () => { lostDeleteRow = null; throw new Error('lost delete response'); },
      };
      await assert.rejects(
        () => cleanupWorkoutEventRouteProof(lostDeleteDirectory, lostDeleteDatabase),
        /lost delete response/,
      );
      const interruptedManifest = JSON.parse(await readFile(
        join(lostDeleteDirectory, 'manifest.private.json'),
        'utf8',
      ));
      assert.equal(interruptedManifest.receipt.recordId, residue.id);
      const recovered = await cleanupWorkoutEventRouteProof(lostDeleteDirectory, {
        ...lostDeleteDatabase,
        deleteById: async () => { throw new Error('unexpected second delete'); },
      });
      assert.equal(recovered.phase, 'clean');
    } finally {
      await Promise.all([
        rm(wrongCommitDirectory, { recursive: true, force: true }),
        rm(residueDirectory, { recursive: true, force: true }),
        rm(lostDeleteDirectory, { recursive: true, force: true }),
      ]);
    }
  });

  await runCase(20, 'source guard keeps runtime insert-only and browser drain out of C1', async () => {
    const [adapter, route, proof] = await Promise.all([
      readFile('src/lib/workout/prismaEventStore.ts', 'utf8'),
      readFile('app/api/workout/events/route.ts', 'utf8'),
      readFile('scripts/workout-event-route-proof.ts', 'utf8'),
    ]);
    assert.equal(/\.(update|upsert|delete|deleteMany|\$runCommandRaw)\s*\(/.test(adapter), false);
    assert.equal(/clientDb|browser.*drain|awardWorkoutPoints|workoutReadiness/.test(`${adapter}\n${route}`), false);
    assert.equal(/deleteMany|user\.delete|session\.delete|auth0/i.test(proof), false);
    assert.equal(/from ['"](?:mongodb|mongoose)['"]/.test(proof), false);
  });

  const failures = results.filter(result => !result.ok);
  if (failures.length > 0) {
    console.error(`workout event route contract failed: ${failures.length}/${TOTAL_CASES}`);
    process.exitCode = 1;
    return;
  }
  console.log(`workout event route contract passed: ${TOTAL_CASES}/${TOTAL_CASES}`);
}

void main();
