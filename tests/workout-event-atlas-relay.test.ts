import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AtlasDatabasePort,
  ClockPort,
  CreateWorkoutEventInput,
  FileSystemPort,
  GitPort,
  IndexDescription,
  OutputPort,
  RandomPort,
  RelayIdentity,
  RelayPorts,
  RunState,
  WorkoutEventRecordSnapshot,
} from '../scripts/workout-event-atlas-relay';
import {
  RELAY_COLLECTION_NAME,
  RELAY_EXPECTED_INDEX_NAME,
  RelayHoldError,
  WorkoutEventDuplicateKeyError,
  buildPrismaDatabasePort,
  canonicalStringify,
  classifyWorkoutEventIndexes,
  computeIndexSetFingerprintSha256,
  loadRunState,
  resolveRelayIdentityFromDatabaseUrl,
  runApply,
  runCensus,
  runCleanup,
  runCleanupCommand,
  sha256Hex,
} from '../scripts/workout-event-atlas-relay';

process.env.DATABASE_URL = 'poison://offline-suite-must-never-connect';
const execFileAsync = promisify(execFile);

const COMMIT = 'a'.repeat(40);
const TARGET = 'b'.repeat(64);
const STATE_DIR = path.resolve('C:\\rb-workout-relay-offline-state');
const CENSUS_PATH = path.join(STATE_DIR, 'census-receipt.json');
const RUN_STATE_PATH = path.join(STATE_DIR, 'run-state.json');

const identity: RelayIdentity = Object.freeze({
  databaseName: 'resetbiology',
  targetFingerprintSha256: TARGET,
});

const sealTestState = (state: Omit<RunState, 'authoritySha256'>): RunState =>
  Object.freeze({ ...state, authoritySha256: sha256Hex(canonicalStringify(state)) });

const payloadFor = (state: RunState, candidate: RunState['candidates'][number]): unknown => ({
  runMarker: state.runMarker,
  slot: candidate.slot,
  role: candidate.role,
  probe: 'atlas-relay-synthetic-nonclinical-probe',
});

const idIndex: IndexDescription = Object.freeze({
  name: '_id_',
  key: Object.freeze([Object.freeze(['_id', 1] as const)]),
  unique: false,
  sparse: false,
  hasPartialFilter: false,
  hasExpireAfterSeconds: false,
  hidden: false,
  hasCollation: false,
});

const goodIndex = (name = RELAY_EXPECTED_INDEX_NAME): IndexDescription =>
  Object.freeze({
    name,
    key: Object.freeze([
      Object.freeze(['userId', 1] as const),
      Object.freeze(['eventId', 1] as const),
    ]),
    unique: true,
    sparse: false,
    hasPartialFilter: false,
    hasExpireAfterSeconds: false,
    hidden: false,
    hasCollation: false,
  });

const withIndex = (overrides: Partial<IndexDescription>): IndexDescription =>
  Object.freeze({ ...goodIndex(), ...overrides });

class FakeClock implements ClockPort {
  current = new Date('2026-07-22T15:00:00.000Z');
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

class FakeRandom implements RandomPort {
  private counter = 0;
  randomHex(byteLength: number): string {
    this.counter += 1;
    return sha256Hex(`offline-random-${this.counter}`).slice(0, byteLength * 2);
  }
}

class FakeGit implements GitPort {
  head = COMMIT;
  status = '';
  async revParseHead(): Promise<string> {
    return this.head;
  }
  async statusShort(): Promise<string> {
    return this.status;
  }
}

class FakeOutput implements OutputPort {
  readonly lines: string[] = [];
  write(line: string): void {
    this.lines.push(line);
  }
  text(): string {
    return this.lines.join('\n');
  }
}

class FakeFs implements FileSystemPort {
  readonly files = new Map<string, string>();
  readonly writes: Array<Readonly<{ path: string; contents: string; exclusive: boolean }>> = [];
  failAtomicWrites = 0;
  atomicWriteAttempts = 0;
  readonly failAtomicWriteAt = new Set<number>();
  failUnlinks = 0;
  readonly failUnlinkPaths = new Set<string>();
  readonly existsErrors = new Map<string, string>();

  async exists(targetPath: string): Promise<boolean> {
    const code = this.existsErrors.get(targetPath);
    if (code !== undefined) {
      const error = new Error('offline exists failure') as NodeJS.ErrnoException;
      error.code = code;
      throw error;
    }
    return this.files.has(targetPath);
  }
  async readFile(targetPath: string): Promise<string> {
    const value = this.files.get(targetPath);
    if (value === undefined) throw new Error('offline missing file');
    return value;
  }
  async writeFileAtomic(targetPath: string, contents: string): Promise<void> {
    this.atomicWriteAttempts += 1;
    if (this.failAtomicWriteAt.has(this.atomicWriteAttempts)) {
      throw new Error('offline scheduled atomic write failure');
    }
    if (this.failAtomicWrites > 0) {
      this.failAtomicWrites -= 1;
      throw new Error('offline atomic write failure');
    }
    this.files.set(targetPath, contents);
    this.writes.push(Object.freeze({ path: targetPath, contents, exclusive: false }));
  }
  async createExclusive(targetPath: string, contents: string): Promise<boolean> {
    if (this.files.has(targetPath)) return false;
    this.files.set(targetPath, contents);
    this.writes.push(Object.freeze({ path: targetPath, contents, exclusive: true }));
    return true;
  }
  async unlink(targetPath: string): Promise<void> {
    if (this.failUnlinkPaths.has(targetPath)) throw new Error('offline targeted unlink failure');
    if (this.failUnlinks > 0) {
      this.failUnlinks -= 1;
      throw new Error('offline unlink failure');
    }
    if (!this.files.delete(targetPath)) throw new Error('offline missing unlink target');
  }
}

type CreateMode = 'normal' | 'wrong-target' | 'unexpected' | 'lost-response';

class FakeDb implements AtlasDatabasePort {
  collectionNames: string[] = [RELAY_COLLECTION_NAME];
  indexes: IndexDescription[] = [idIndex];
  duplicateGroupCount = 0;
  malformedIdentityCount = 0;
  externalRowCount = 0;
  readonly rows = new Map<string, WorkoutEventRecordSnapshot>();
  readonly existingUsers = new Set<string>();
  readonly calls: string[] = [];
  readonly createInputs: CreateWorkoutEventInput[] = [];
  readonly deletedIds: string[] = [];
  failListCollections = false;
  failFindCount = 0;
  failDeleteCount = 0;
  replaceBeforeDelete = false;
  failIndexAfterCreate = false;
  driftFinalIndex = false;
  holdContentionCollisions = false;
  allUsersExist = false;
  pretendCandidateExists = false;
  createMode: CreateMode = 'normal';
  lostResponseFired = false;
  contentionStarts = 0;
  contentionPeakBeforeRelease = 0;
  private releaseContention: (() => void) | null = null;
  private contentionGate: Promise<void> | null = null;
  private releaseHeldCollisionGate: () => void = () => undefined;
  private readonly heldCollisionGate = new Promise<void>((resolve) => {
    this.releaseHeldCollisionGate = resolve;
  });
  private signalHeldCollision: () => void = () => undefined;
  private readonly heldCollisionSignal = new Promise<void>((resolve) => {
    this.signalHeldCollision = resolve;
  });

  async waitForHeldCollision(): Promise<void> {
    await this.heldCollisionSignal;
  }
  releaseHeldCollisions(): void {
    this.releaseHeldCollisionGate();
  }

  private pairKey(userId: string, eventId: string): string {
    return `${userId}\u0000${eventId}`;
  }

  async listCollectionNames(): Promise<readonly string[]> {
    this.calls.push('listCollections');
    if (this.failListCollections) throw new Error('SECRET_ATLAS_LIST_FAILURE');
    return Object.freeze([...this.collectionNames]);
  }
  async countWorkoutEvents(): Promise<number> {
    this.calls.push('count');
    return this.externalRowCount + this.rows.size;
  }
  async listWorkoutEventIndexes(): Promise<readonly IndexDescription[]> {
    this.calls.push('listIndexes');
    if (this.driftFinalIndex && this.createInputs.length > 0) {
      return Object.freeze([idIndex, goodIndex('replacement-unique-index')]);
    }
    return Object.freeze([...this.indexes]);
  }
  async countDuplicateIdentityGroups(): Promise<number> {
    this.calls.push('duplicates');
    return this.duplicateGroupCount;
  }
  async countMalformedIdentityDocuments(): Promise<number> {
    this.calls.push('malformed');
    return this.malformedIdentityCount;
  }
  async createUniqueCompoundIndex(): Promise<void> {
    this.calls.push('createIndex');
    this.collectionNames = [RELAY_COLLECTION_NAME];
    this.indexes = [idIndex, goodIndex()];
    if (this.failIndexAfterCreate) throw new Error('SECRET_INDEX_RESPONSE_LOST');
  }
  async findWorkoutEventById(id: string): Promise<WorkoutEventRecordSnapshot | null> {
    this.calls.push('findEvent');
    if (this.failFindCount > 0) {
      this.failFindCount -= 1;
      throw new Error('SECRET_TRANSIENT_FIND');
    }
    if (this.pretendCandidateExists && this.rows.size === 0) {
      return Object.freeze({
        id,
        userId: 'f'.repeat(24),
        eventId: 'foreign-event',
        digest: 'foreign-digest',
        payload: Object.freeze({ runMarker: 'foreign-run' }),
        acceptedAt: '2026-07-22T15:00:00.000Z',
      });
    }
    return this.rows.get(id) ?? null;
  }
  async findUserById(id: string): Promise<Readonly<{ id: string }> | null> {
    this.calls.push('findUser');
    return this.allUsersExist || this.existingUsers.has(id) ? Object.freeze({ id }) : null;
  }
  async createWorkoutEvent(input: CreateWorkoutEventInput): Promise<WorkoutEventRecordSnapshot> {
    this.calls.push('createEvent');
    this.createInputs.push(input);
    const payload = input.payload as Readonly<{ role?: unknown }>;
    if (payload.role === 'contention') {
      this.contentionStarts += 1;
      if (this.contentionGate === null) {
        this.contentionGate = new Promise<void>((resolve) => {
          this.releaseContention = resolve;
        });
      }
      this.contentionPeakBeforeRelease = Math.max(this.contentionPeakBeforeRelease, this.contentionStarts);
      if (this.contentionStarts === 32) this.releaseContention?.();
      await this.contentionGate;
    }
    if (this.createMode === 'unexpected') throw new Error('SECRET_UNEXPECTED_CREATE');
    if (this.rows.has(input.id)) throw new WorkoutEventDuplicateKeyError(Object.freeze(['id']));
    const pair = this.pairKey(input.userId, input.eventId);
    const pairExists = [...this.rows.values()].some((row) => this.pairKey(row.userId, row.eventId) === pair);
    if (pairExists) {
      if (this.holdContentionCollisions && payload.role === 'contention') {
        this.signalHeldCollision();
        await this.heldCollisionGate;
      }
      const target = this.createMode === 'wrong-target' ? ['id'] : ['userId', 'eventId'];
      throw new WorkoutEventDuplicateKeyError(Object.freeze(target));
    }
    const snapshot: WorkoutEventRecordSnapshot = Object.freeze({
      id: input.id,
      userId: input.userId,
      eventId: input.eventId,
      digest: input.digest,
      payload: input.payload,
      acceptedAt: '2026-07-22T15:00:00.000Z',
    });
    this.rows.set(input.id, snapshot);
    if (this.createMode === 'lost-response' && !this.lostResponseFired && payload.role === 'contention') {
      this.lostResponseFired = true;
      throw new Error('SECRET_LOST_RESPONSE_AFTER_COMMIT');
    }
    return snapshot;
  }
  async deleteWorkoutEventIfExact(input: {
    id: string;
    userId: string;
    eventId: string;
    digest: string;
    payload: unknown;
  }): Promise<'deleted' | 'missing' | 'mismatch'> {
    this.calls.push('deleteEvent');
    if (this.failDeleteCount > 0) {
      this.failDeleteCount -= 1;
      throw new Error('SECRET_TRANSIENT_DELETE');
    }
    const current = this.rows.get(input.id);
    if (current === undefined) return 'missing';
    if (this.replaceBeforeDelete) {
      this.replaceBeforeDelete = false;
      this.rows.set(input.id, Object.freeze({ ...current, userId: 'f'.repeat(24) }));
    }
    const observed = this.rows.get(input.id)!;
    const exact =
      observed.id === input.id &&
      observed.userId === input.userId &&
      observed.eventId === input.eventId &&
      observed.digest === input.digest &&
      canonicalStringify(observed.payload) === canonicalStringify(input.payload);
    if (!exact) return 'mismatch';
    this.rows.delete(input.id);
    this.deletedIds.push(input.id);
    return 'deleted';
  }
}

type TestContext = Readonly<{
  db: FakeDb;
  fs: FakeFs;
  clock: FakeClock;
  random: FakeRandom;
  git: FakeGit;
  out: FakeOutput;
  ports: RelayPorts;
}>;

const makeContext = (): TestContext => {
  const db = new FakeDb();
  const fs = new FakeFs();
  const clock = new FakeClock();
  const random = new FakeRandom();
  const git = new FakeGit();
  const out = new FakeOutput();
  return Object.freeze({ db, fs, clock, random, git, out, ports: Object.freeze({ db, fs, clock, random, git, out }) });
};

const runFreshCensus = async (context: TestContext) =>
  runCensus(context.ports, { expectedCommit: COMMIT, identity, stateDir: STATE_DIR });

const runApplyFromCensus = async (context: TestContext, overrides: Partial<Parameters<typeof runApply>[1]> = {}) => {
  const census = await runFreshCensus(context);
  assert.equal(census.gate, 'PASS');
  assert.ok(census.receiptPath);
  assert.ok(census.receiptSha256);
  return runApply(context.ports, {
    expectedCommit: COMMIT,
    identity,
    stateDir: STATE_DIR,
    censusReceiptPath: census.receiptPath,
    receiptSha256: census.receiptSha256,
    confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    ...overrides,
  });
};

type Case = Readonly<{ name: string; run(): Promise<void> }>;
const cases: Case[] = [];
const addCase = (name: string, run: () => Promise<void>): void => {
  cases.push(Object.freeze({ name, run }));
};

addCase('01 absent collection census is zero and read-only', async () => {
  const c = makeContext();
  c.db.collectionNames = [];
  c.db.indexes = [];
  const result = await runFreshCensus(c);
  assert.equal(result.gate, 'PASS');
  assert.equal(result.receipt?.baselineCount, 0);
  assert.deepEqual(c.db.calls, ['listCollections']);
  assert.equal(c.db.createInputs.length, 0);
});

addCase('02 empty existing collection accepts only the id index', async () => {
  const c = makeContext();
  const result = await runFreshCensus(c);
  assert.equal(result.gate, 'PASS');
  assert.equal(result.receipt?.acceptableIndexName, null);
  assert.equal(result.receipt?.indexSetFingerprintSha256, computeIndexSetFingerprintSha256([idIndex]));
  for (const rawResult of [
    { ok: 0, cursor: { id: 0, firstBatch: [] } },
    { ok: '1', cursor: { id: 0, firstBatch: [] } },
    { ok: 1, cursor: { id: 1, firstBatch: [] } },
    { ok: 1, cursor: { id: '0', firstBatch: [] } },
    { ok: 1, cursor: { firstBatch: [] } },
    { ok: 1, cursor: { id: 0, firstBatch: [] }, writeErrors: [] },
  ]) {
    const adapter = buildPrismaDatabasePort(
      { async $runCommandRaw() { return rawResult; } } as never,
      {} as never,
    );
    await assert.rejects(() => adapter.listCollectionNames(), /relay-invalid-command-response/);
  }
  {
    const adapter = buildPrismaDatabasePort(
      { async $runCommandRaw() { return { ok: 0, n: 0 }; } } as never,
      {} as never,
    );
    await assert.rejects(() => adapter.countWorkoutEvents(), /relay-invalid-command-response/);
  }
  {
    const adapter = buildPrismaDatabasePort(
      {
        async $runCommandRaw() {
          return { ok: 1, cursor: { id: 0, firstBatch: [{ total: 0 }, { total: 9 }] } };
        },
      } as never,
      {} as never,
    );
    await assert.rejects(() => adapter.countDuplicateIdentityGroups(), /relay-invalid-command-response/);
  }
});

addCase('03 correct preexisting unique index passes without fabrication', async () => {
  const c = makeContext();
  c.db.indexes = [idIndex, goodIndex('already-correct')];
  const result = await runFreshCensus(c);
  assert.equal(result.gate, 'PASS');
  assert.equal(result.receipt?.acceptableIndexName, 'already-correct');
});

addCase('04 duplicate identity groups hold before mutation', async () => {
  const c = makeContext();
  c.db.duplicateGroupCount = 1;
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_DUPLICATE_IDENTITY');
  assert.equal(c.db.createInputs.length, 0);
});

addCase('05 missing or null identity rows hold before mutation', async () => {
  const c = makeContext();
  c.db.malformedIdentityCount = 2;
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_MALFORMED_IDENTITY');
});

addCase('06 invalid identity types hold before mutation', async () => {
  const c = makeContext();
  c.db.malformedIdentityCount = 3;
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_MALFORMED_IDENTITY');
});

addCase('07 same-key nonunique index is ambiguous', async () => {
  const c = makeContext();
  c.db.indexes = [idIndex, withIndex({ unique: false })];
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_INDEX_AMBIGUOUS');
  for (const badId of [
    Object.freeze({ ...idIndex, key: Object.freeze([Object.freeze(['digest', 1] as const)]) }),
    Object.freeze({ ...idIndex, sparse: true }),
    Object.freeze({ ...idIndex, unique: false, uniqueSpecified: true }),
  ]) {
    const hostile = makeContext();
    hostile.db.indexes = [badId, goodIndex()];
    const held = await runFreshCensus(hostile);
    assert.equal(held.holdCode, 'HOLD_INDEX_AMBIGUOUS');
  }
});

addCase('08 conflicting expected index name is rejected', async () => {
  const c = makeContext();
  c.db.indexes = [idIndex, withIndex({ name: RELAY_EXPECTED_INDEX_NAME, unique: false })];
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_INDEX_AMBIGUOUS');
});

addCase('09 reversed compound-key order is rejected', async () => {
  const c = makeContext();
  c.db.indexes = [
    idIndex,
    withIndex({
      key: Object.freeze([
        Object.freeze(['eventId', 1] as const),
        Object.freeze(['userId', 1] as const),
      ]),
    }),
  ];
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_INDEX_AMBIGUOUS');
  for (const invalidDirection of ['hashed', '1', true, null, -1]) {
    const adapter = buildPrismaDatabasePort(
      {
        async $runCommandRaw() {
          return {
            ok: 1,
            cursor: {
              id: 0,
              firstBatch: [
                { name: '_id_', key: { _id: 1 } },
                { name: RELAY_EXPECTED_INDEX_NAME, key: { userId: invalidDirection, eventId: 1 }, unique: true },
              ],
            },
          };
        },
      } as never,
      {} as never,
    );
    if (invalidDirection === -1) {
      const parsed = await adapter.listWorkoutEventIndexes();
      assert.equal(classifyWorkoutEventIndexes(parsed, true).holdCode, 'HOLD_INDEX_AMBIGUOUS');
    } else {
      await assert.rejects(() => adapter.listWorkoutEventIndexes(), /relay-invalid-index-description/);
    }
  }
});

addCase('10 sparse partial ttl hidden and collation modifiers all hold', async () => {
  const modifiers: Array<Partial<IndexDescription>> = [
    { sparse: true },
    { hasPartialFilter: true },
    { hasExpireAfterSeconds: true },
    { hidden: true },
    { hasCollation: true },
  ];
  for (const modifier of modifiers) {
    const c = makeContext();
    c.db.indexes = [idIndex, withIndex(modifier)];
    const result = await runFreshCensus(c);
    assert.equal(result.holdCode, 'HOLD_INDEX_AMBIGUOUS', JSON.stringify(modifier));
  }
});

addCase('11 unexpected extra collection index holds', async () => {
  const c = makeContext();
  c.db.indexes = [
    idIndex,
    goodIndex(),
    Object.freeze({ ...goodIndex('unexpected'), key: Object.freeze([Object.freeze(['digest', 1] as const)]) }),
  ];
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_INDEX_AMBIGUOUS');
});

addCase('12 census query failure is sanitized', async () => {
  const c = makeContext();
  c.db.failListCollections = true;
  const result = await runFreshCensus(c);
  assert.equal(result.holdCode, 'HOLD_CENSUS_QUERY_FAILED');
  assert.doesNotMatch(c.out.text(), /SECRET_ATLAS_LIST_FAILURE|Error|stack/i);
});

addCase('13 stale tampered wrong-target receipts and state tampering hold', async () => {
  {
    const c = makeContext();
    const census = await runFreshCensus(c);
    c.clock.advance(601_000);
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_RECEIPT_STALE');
  }
  {
    const c = makeContext();
    const census = await runFreshCensus(c);
    c.fs.files.set(census.receiptPath!, c.fs.files.get(census.receiptPath!)! + 'tamper');
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_RECEIPT_TAMPERED');
  }
  {
    const c = makeContext();
    const census = await runFreshCensus(c);
    const receipt = JSON.parse(c.fs.files.get(census.receiptPath!)!) as Record<string, unknown>;
    delete receipt.gate;
    delete receipt.holdCode;
    const rewrittenReceipt = canonicalStringify(receipt);
    c.fs.files.set(census.receiptPath!, rewrittenReceipt);
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: sha256Hex(rewrittenReceipt),
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_RECEIPT_TAMPERED');
    assert.equal(c.db.calls.includes('createIndex'), false);
    assert.equal(c.db.createInputs.length, 0);
  }
  {
    const c = makeContext();
    c.db.duplicateGroupCount = 1;
    const census = await runFreshCensus(c);
    assert.equal(census.gate, 'HOLD');
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_RECEIPT_TAMPERED');
    assert.equal(c.db.calls.includes('createIndex'), false);
    assert.equal(c.db.createInputs.length, 0);
  }
  {
    const c = makeContext();
    const census = await runFreshCensus(c);
    const wrongIdentity = Object.freeze({ ...identity, targetFingerprintSha256: 'c'.repeat(64) });
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity: wrongIdentity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_RECEIPT_TARGET_MISMATCH');
  }
  {
    const fs = new FakeFs();
    const state = sealTestState({
      runStateVersion: 'workout-event-atlas-relay-run-state/1',
      runId: '6'.repeat(32),
      runMarker: 'run',
      createdAtIso: '2026-07-22T15:00:00.000Z',
      expectedCommit: COMMIT,
      targetFingerprintSha256: TARGET,
      censusReceiptSha256: '7'.repeat(64),
      expectedIndexName: RELAY_EXPECTED_INDEX_NAME,
      confirmedIndexSetFingerprintSha256: null,
      baselineCount: 0,
      candidates: [],
      candidatesSha256: sha256Hex(canonicalStringify([])),
      confirmedIds: [],
      cleanupObservedIds: [],
      cleanupDeletedIds: [],
      phase: 'prepared',
    });
    fs.files.set(RUN_STATE_PATH, canonicalStringify({ ...state, candidates: [{ candidateId: 'tampered' }] }));
    await assert.rejects(() => loadRunState(fs, RUN_STATE_PATH), (error: unknown) => {
      assert.ok(error instanceof RelayHoldError);
      assert.equal(error.code, 'HOLD_STATE_CORRUPT');
      return true;
    });
  }
  {
    const expected = sha256Hex('mongodb+srv|cluster.example.test|resetbiology');
    assert.throws(
      () => resolveRelayIdentityFromDatabaseUrl('mongodb://cluster.example.test/resetbiology', expected),
      (error: unknown) => error instanceof RelayHoldError && error.code === 'HOLD_TARGET_MISMATCH',
    );
  }
  for (const staleFile of ['run-state.json', 'apply.lock', 'final-receipt.json']) {
    const c = makeContext();
    c.fs.files.set(path.join(STATE_DIR, staleFile), 'stale');
    const result = await runFreshCensus(c);
    assert.equal(result.holdCode, 'HOLD_ARGS_INVALID');
    assert.equal(c.db.calls.length, 0);
  }
  {
    const valid = makeContext();
    const result = await runApplyFromCensus(valid);
    assert.equal(result.result, 'PASS');
    const initial = valid.fs.writes.find((write) => write.path === RUN_STATE_PATH)!.contents;
    const mutations: Array<(state: Record<string, unknown>) => void> = [
      (state) => { state.runId = '8'.repeat(32); },
      (state) => { state.runMarker = 'relay-tampered'; },
      (state) => { state.expectedCommit = '9'.repeat(40); },
      (state) => { state.targetFingerprintSha256 = '9'.repeat(64); },
      (state) => { state.censusReceiptSha256 = '9'.repeat(64); },
      (state) => { state.expectedIndexName = 'wrong-index'; },
      (state) => { state.confirmedIndexSetFingerprintSha256 = '9'.repeat(64); },
      (state) => { state.baselineCount = 42; },
      (state) => { state.confirmedIds = ['0'.repeat(24)]; },
      (state) => { state.cleanupObservedIds = ['0'.repeat(24)]; },
      (state) => { state.phase = 'cleaning'; },
    ];
    for (const mutate of mutations) {
      const fs = new FakeFs();
      const tampered = JSON.parse(initial) as Record<string, unknown>;
      mutate(tampered);
      fs.files.set(RUN_STATE_PATH, canonicalStringify(tampered));
      await assert.rejects(() => loadRunState(fs, RUN_STATE_PATH), (error: unknown) => {
        assert.ok(error instanceof RelayHoldError);
        assert.equal(error.code, 'HOLD_STATE_CORRUPT');
        return true;
      });
    }
  }
});

addCase('14 missing explicit index confirmation holds with zero writes', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c, { confirmIndex: 'wrong-confirmation' });
  assert.equal(result.holdCode, 'HOLD_MISSING_CONFIRMATION');
  assert.equal(c.db.createInputs.length, 0);
  assert.equal(c.db.calls.includes('createIndex'), false);
  {
    const stale = makeContext();
    const census = await runFreshCensus(stale);
    stale.fs.files.set(RUN_STATE_PATH, 'stale-private-recovery-state');
    const stopped = await runApply(stale.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(stopped.holdCode, 'HOLD_STATE_CORRUPT');
    assert.equal(stale.db.calls.includes('createIndex'), false);
  }
  for (const externalPath of [
    path.resolve('C:\\outside-relay-state\\census-receipt.json'),
    path.join(STATE_DIR, 'alternate-receipt.json'),
  ]) {
    const confined = makeContext();
    const census = await runFreshCensus(confined);
    confined.fs.files.set(externalPath, confined.fs.files.get(census.receiptPath!)!);
    const stopped = await runApply(confined.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: externalPath,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(stopped.holdCode, 'HOLD_ARGS_INVALID');
    assert.equal(confined.db.calls.includes('createIndex'), false);
  }
});

addCase('15 apply-time drift and synthetic identity collisions stop before writes', async () => {
  {
    const c = makeContext();
    const census = await runFreshCensus(c);
    c.db.malformedIdentityCount = 1;
    const result = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(result.holdCode, 'HOLD_DRIFT');
    assert.equal(c.db.createInputs.length, 0);
  }
  {
    const c = makeContext();
    c.db.pretendCandidateExists = true;
    const result = await runApplyFromCensus(c);
    assert.equal(result.holdCode, 'HOLD_ID_COLLISION');
    assert.equal(c.db.rows.size, 0);
  }
  {
    const c = makeContext();
    c.db.allUsersExist = true;
    const result = await runApplyFromCensus(c);
    assert.equal(result.holdCode, 'HOLD_USER_COLLISION');
    assert.equal(c.db.createInputs.length, 0);
  }
});

addCase('16 Prisma adapter emits only the exact unique index and malformed-type queries', async () => {
  const commands: Array<Record<string, unknown>> = [];
  const prisma = {
    async $runCommandRaw(command: Record<string, unknown>): Promise<Record<string, unknown>> {
      commands.push(command);
      if ('aggregate' in command) return { ok: 1, cursor: { id: 0, firstBatch: [{ total: 0 }] } };
      return { ok: 1 };
    },
  };
  const db = buildPrismaDatabasePort(prisma as never, {} as never);
  await db.createUniqueCompoundIndex();
  assert.deepEqual(commands[0], {
    createIndexes: RELAY_COLLECTION_NAME,
    indexes: [
      {
        key: { userId: 1, eventId: 1 },
        name: RELAY_EXPECTED_INDEX_NAME,
        unique: true,
      },
    ],
  });
  await db.countMalformedIdentityDocuments();
  const pipeline = commands[1]?.pipeline as readonly Record<string, unknown>[];
  assert.ok(Array.isArray(pipeline));
  const serialized = canonicalStringify(pipeline);
  assert.match(serialized, /"userId":\{.*"\$type":"objectId"/);
  assert.match(serialized, /"eventId":\{.*"\$type":"string"/);
  {
    const invalid = buildPrismaDatabasePort(
      { async $runCommandRaw() { return {}; } } as never,
      {} as never,
    );
    await assert.rejects(() => invalid.listCollectionNames(), /relay-invalid-command-response/);
    await assert.rejects(() => invalid.countWorkoutEvents(), /relay-invalid-command-response/);
    await assert.rejects(() => invalid.createUniqueCompoundIndex(), /relay-invalid-command-response/);
  }
  {
    let capturedWhere: unknown = null;
    const exactDelete = buildPrismaDatabasePort(
      {
        workoutEvent: {
          async deleteMany(args: { where: unknown }) {
            capturedWhere = args.where;
            return { count: 1 };
          },
          async findUnique() {
            throw new Error('reread must not run after exact deletion');
          },
        },
      } as never,
      {} as never,
    );
    const payload = { runMarker: 'relay-delete', slot: 4, role: 'contention', probe: 'atlas-relay-synthetic-nonclinical-probe' };
    const deleted = await exactDelete.deleteWorkoutEventIfExact({
      id: '1'.repeat(24),
      userId: '2'.repeat(24),
      eventId: 'event-delete',
      digest: '3'.repeat(64),
      payload,
    });
    assert.equal(deleted, 'deleted');
    assert.deepEqual(capturedWhere, {
      id: '1'.repeat(24),
      userId: '2'.repeat(24),
      eventId: 'event-delete',
      digest: '3'.repeat(64),
      payload: { equals: payload },
    });
  }
});

addCase('17 index creation is read back before any probe insert', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  const createdAt = c.db.calls.indexOf('createIndex');
  const readbackAt = c.db.calls.indexOf('listIndexes', createdAt + 1);
  const firstInsertAt = c.db.calls.indexOf('createEvent');
  assert.ok(createdAt >= 0 && readbackAt > createdAt && firstInsertAt > readbackAt);
});

addCase('18 thirty-two simultaneous creates yield one winner and thirty-one exact collisions', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  assert.equal(c.db.contentionPeakBeforeRelease, 32);
  assert.equal(c.db.createInputs.filter((input) => (input.payload as { role?: string }).role === 'contention').length, 32);
  assert.equal(new Set(c.db.createInputs.map((input) => input.id)).size, 34);
  const receipt = JSON.parse(c.fs.files.get(result.finalReceiptPath!)!) as Record<string, unknown>;
  assert.equal(receipt.contentionSuccessCount, 1);
  assert.equal(receipt.contentionCollisionCount, 31);
  assert.equal(receipt.deletedCount, 2);
  assert.equal(c.db.rows.size, 0);
  {
    const immediate = makeContext();
    immediate.db.holdContentionCollisions = true;
    const applyPromise = runApplyFromCensus(immediate);
    await Promise.race([
      immediate.db.waitForHeldCollision(),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('winner confirmation timeout')), 2000)),
    ]);
    const durableState = JSON.parse(immediate.fs.files.get(RUN_STATE_PATH)!) as RunState;
    assert.equal(durableState.confirmedIds.length, 1);
    assert.equal(durableState.phase, 'writing');
    immediate.db.releaseHeldCollisions();
    const completed = await applyPromise;
    assert.equal(completed.result, 'PASS');
  }
});

addCase('19 wrong duplicate target and unknown create failures fail closed and clean up', async () => {
  for (const mode of ['wrong-target', 'unexpected'] as const) {
    const c = makeContext();
    c.db.createMode = mode;
    const result = await runApplyFromCensus(c);
    assert.equal(result.holdCode, 'HOLD_CONTENTION_UNEXPECTED');
    assert.equal(c.db.rows.size, 0);
    assert.equal(c.fs.files.has(RUN_STATE_PATH), false);
  }
  class FakeKnownRequestError extends Error {
    readonly code = 'P2002';
    constructor(readonly meta: Readonly<{ target: unknown }>) {
      super('offline p2002');
    }
  }
  const input: CreateWorkoutEventInput = Object.freeze({
    id: '1'.repeat(24),
    userId: '2'.repeat(24),
    eventId: 'event-p2002',
    schemaVersion: 'atlas-relay/1',
    digest: '3'.repeat(64),
    type: 'relay.synthetic.probe',
    occurredAt: '2026-07-22T15:00:00.000Z',
    payload: {},
  });
  for (const target of [
    [{ toString: () => 'userId' }, { toString: () => 'eventId' }],
    [new String('userId'), new String('eventId')],
    ['userId', 7],
    ['eventId', 'userId'],
    ['userId', 'eventId', 'extra'],
  ]) {
    const adapter = buildPrismaDatabasePort(
      { workoutEvent: { async create() { throw new FakeKnownRequestError({ target }); } } } as never,
      { PrismaClientKnownRequestError: FakeKnownRequestError } as never,
    );
    await assert.rejects(() => adapter.createWorkoutEvent(input), (error: unknown) => {
      assert.ok(error instanceof WorkoutEventDuplicateKeyError);
      assert.deepEqual(error.target, []);
      return true;
    });
  }
});

addCase('20 same event key is accepted for a distinct synthetic user', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  const contention = c.db.createInputs.find((input) => (input.payload as { role?: string }).role === 'contention')!;
  const crossUser = c.db.createInputs.find((input) => (input.payload as { role?: string }).role === 'crossUser')!;
  assert.equal(crossUser.eventId, contention.eventId);
  assert.notEqual(crossUser.userId, contention.userId);
  const receipt = JSON.parse(c.fs.files.get(result.finalReceiptPath!)!) as Record<string, unknown>;
  assert.equal(receipt.crossUserProven, true);
});

addCase('21 changed digest cannot replace the first accepted event', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  const contention = c.db.createInputs.find((input) => (input.payload as { role?: string }).role === 'contention')!;
  const changed = c.db.createInputs.find((input) => (input.payload as { role?: string }).role === 'changedDigest')!;
  assert.equal(changed.userId, contention.userId);
  assert.equal(changed.eventId, contention.eventId);
  assert.notEqual(changed.digest, contention.digest);
  const receipt = JSON.parse(c.fs.files.get(result.finalReceiptPath!)!) as Record<string, unknown>;
  assert.equal(receipt.immutabilityProven, true);
});

addCase('22 all candidate ids are durably allowlisted before writes and cleanup stays inside that list', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  const firstStateWrite = c.fs.writes.find((write) => write.path === RUN_STATE_PATH);
  assert.ok(firstStateWrite);
  const state = JSON.parse(firstStateWrite.contents) as RunState;
  assert.equal(state.candidates.length, 34);
  assert.equal(state.confirmedIds.length, 0);
  const allowlist = new Set(state.candidates.map((candidate) => candidate.candidateId));
  assert.equal(c.db.createInputs.every((input) => allowlist.has(input.id)), true);
  assert.equal(c.db.deletedIds.every((id) => allowlist.has(id)), true);
  {
    const replacementRace = makeContext();
    replacementRace.db.replaceBeforeDelete = true;
    const stopped = await runApplyFromCensus(replacementRace);
    assert.equal(stopped.holdCode, 'HOLD_CLEANUP');
    assert.equal(replacementRace.db.deletedIds.length, 0);
    assert.equal(replacementRace.db.rows.size, 2);
    assert.equal(replacementRace.fs.files.has(RUN_STATE_PATH), true);
  }
});

addCase('23 lost create response still cleans the precommitted row and restores baseline', async () => {
  const c = makeContext();
  c.db.createMode = 'lost-response';
  const result = await runApplyFromCensus(c);
  assert.equal(result.holdCode, 'HOLD_CONTENTION_UNEXPECTED');
  assert.equal(c.db.lostResponseFired, true);
  assert.equal(c.db.rows.size, 0);
  assert.equal(c.fs.files.has(RUN_STATE_PATH), false);
  const receipt = JSON.parse(c.fs.files.get(result.finalReceiptPath!)!) as Record<string, unknown>;
  assert.equal(receipt.baselineRestored, true);
  assert.equal(receipt.cleanupResult, 'PASS');
  {
    const staleLock = makeContext();
    staleLock.fs.failUnlinkPaths.add(path.join(STATE_DIR, 'apply.lock'));
    const stopped = await runApplyFromCensus(staleLock);
    assert.equal(stopped.holdCode, 'HOLD_STATE_CORRUPT');
    assert.equal(staleLock.fs.files.has(path.join(STATE_DIR, 'apply.lock')), true);
    assert.equal(staleLock.db.rows.size, 0);
    assert.deepEqual(
      staleLock.out.lines.filter((line) => line.startsWith('RELAY_RESULT=')),
      ['RELAY_RESULT=HOLD:HOLD_STATE_CORRUPT'],
    );
  }
  {
    const lostIndexResponse = makeContext();
    lostIndexResponse.db.failIndexAfterCreate = true;
    const stopped = await runApplyFromCensus(lostIndexResponse);
    assert.equal(stopped.result, 'HOLD');
    assert.equal(lostIndexResponse.db.rows.size, 0);
    assert.equal(lostIndexResponse.fs.files.has(RUN_STATE_PATH), false);
    const phases = lostIndexResponse.fs.writes
      .filter((write) => write.path === RUN_STATE_PATH)
      .map((write) => (JSON.parse(write.contents) as RunState).phase);
    assert.equal(phases.includes('cleaning'), true);
    assert.equal(phases.includes('clean'), true);
  }
  {
    const transitionFailure = makeContext();
    transitionFailure.fs.failAtomicWriteAt.add(7);
    const stopped = await runApplyFromCensus(transitionFailure);
    assert.equal(stopped.holdCode, 'HOLD_CLEANUP');
    assert.equal(transitionFailure.db.rows.size, 0);
    assert.equal(transitionFailure.fs.files.has(RUN_STATE_PATH), true);
    const lastKnownGood = JSON.parse(transitionFailure.fs.files.get(RUN_STATE_PATH)!) as RunState;
    assert.equal(lastKnownGood.phase, 'writing');
    assert.equal(lastKnownGood.confirmedIds.length, 2);
    const runStateWrites = transitionFailure.fs.writes.filter((write) => write.path === RUN_STATE_PATH);
    assert.equal(runStateWrites.length, 5);
  }
});

addCase('24 cleanup retries transient failures but preserves recovery state on identity mismatch', async () => {
  const makeState = (c: TestContext): RunState => {
    const userA = '2'.repeat(24);
    const userB = '4'.repeat(24);
    const primaryDigest = '3'.repeat(64);
    const candidates = Object.freeze(
      Array.from({ length: 34 }, (_, slot) =>
        Object.freeze({
          slot,
          candidateId: slot.toString(16).padStart(24, '0'),
          userId: slot === 32 ? userB : userA,
          eventId: 'event-offline',
          digest: slot === 33 ? '5'.repeat(64) : primaryDigest,
          role: slot < 32 ? ('contention' as const) : slot === 32 ? ('crossUser' as const) : ('changedDigest' as const),
        }),
      ),
    );
    return sealTestState({
      runStateVersion: 'workout-event-atlas-relay-run-state/1' as const,
      runId: '6'.repeat(32),
      runMarker: 'relay-offline-cleanup',
      createdAtIso: c.clock.now().toISOString(),
      expectedCommit: COMMIT,
      targetFingerprintSha256: TARGET,
      censusReceiptSha256: '7'.repeat(64),
      expectedIndexName: RELAY_EXPECTED_INDEX_NAME,
      confirmedIndexSetFingerprintSha256: computeIndexSetFingerprintSha256([idIndex, goodIndex()]),
      baselineCount: 0,
      candidates,
      candidatesSha256: sha256Hex(canonicalStringify(candidates)),
      confirmedIds: Object.freeze([candidates[0].candidateId]),
      cleanupObservedIds: Object.freeze([]),
      cleanupDeletedIds: Object.freeze([]),
      phase: 'writing',
    });
  };
  {
    const c = makeContext();
    c.db.indexes = [idIndex, goodIndex()];
    const state = makeState(c);
    c.fs.files.set(RUN_STATE_PATH, canonicalStringify(state));
    const candidate = state.candidates[0];
    c.db.rows.set(candidate.candidateId, Object.freeze({
      id: candidate.candidateId,
      userId: '9'.repeat(24),
      eventId: candidate.eventId,
      digest: candidate.digest,
      payload: payloadFor(state, candidate),
      acceptedAt: c.clock.now().toISOString(),
    }));
    const result = await runCleanup({ db: c.db, fs: c.fs, out: c.out }, RUN_STATE_PATH, COMMIT, identity);
    assert.equal(result.holdCode, 'HOLD_CLEANUP_IDENTITY_MISMATCH');
    assert.equal(c.db.deletedIds.length, 0);
    assert.equal(c.fs.files.has(RUN_STATE_PATH), true);
  }
  {
    const c = makeContext();
    c.db.indexes = [idIndex, goodIndex()];
    const state = makeState(c);
    c.fs.files.set(RUN_STATE_PATH, canonicalStringify(state));
    const candidate = state.candidates[0];
    c.db.rows.set(candidate.candidateId, Object.freeze({
      id: candidate.candidateId,
      userId: candidate.userId,
      eventId: candidate.eventId,
      digest: candidate.digest,
      payload: payloadFor(state, candidate),
      acceptedAt: c.clock.now().toISOString(),
    }));
    c.db.failFindCount = 1;
    c.db.failDeleteCount = 1;
    const result = await runCleanup({ db: c.db, fs: c.fs, out: c.out }, RUN_STATE_PATH, COMMIT, identity);
    assert.equal(result.result, 'PASS');
    assert.equal(result.observedCount, 1);
    assert.equal(result.deletedCount, 1);
    assert.equal(c.db.rows.size, 0);
  }
  {
    const c = makeContext();
    c.db.indexes = [idIndex, goodIndex()];
    const state = makeState(c);
    c.fs.files.set(RUN_STATE_PATH, canonicalStringify(state));
    const result = await runCleanupCommand(
      { db: c.db, fs: c.fs, git: c.git, out: c.out },
      { expectedCommit: COMMIT, identity, runStatePath: RUN_STATE_PATH, confirmExactCandidateIds: true },
    );
    assert.equal(result.result, 'PASS');
    assert.equal(c.fs.files.has(path.join(STATE_DIR, 'apply.lock')), false);
    assert.equal(c.fs.files.has(RUN_STATE_PATH), false);
    assert.deepEqual(c.out.lines.filter((line) => line.startsWith('RELAY_RESULT=')), ['RELAY_RESULT=PASS']);
  }
  {
    const c = makeContext();
    c.db.indexes = [idIndex, goodIndex()];
    const state = makeState(c);
    c.fs.files.set(RUN_STATE_PATH, canonicalStringify(state));
    c.fs.files.set(path.join(STATE_DIR, 'apply.lock'), 'existing');
    const result = await runCleanupCommand(
      { db: c.db, fs: c.fs, git: c.git, out: c.out },
      { expectedCommit: COMMIT, identity, runStatePath: RUN_STATE_PATH, confirmExactCandidateIds: true },
    );
    assert.equal(result.holdCode, 'HOLD_LOCK_STALE');
    assert.equal(c.fs.files.has(RUN_STATE_PATH), true);
    assert.deepEqual(c.out.lines.filter((line) => line.startsWith('RELAY_RESULT=')), ['RELAY_RESULT=HOLD:HOLD_LOCK_STALE']);
  }
  for (const code of ['EACCES', 'EPERM', 'EIO']) {
    const c = makeContext();
    const census = await runFreshCensus(c);
    c.fs.existsErrors.set(RUN_STATE_PATH, code);
    const stopped = await runApply(c.ports, {
      expectedCommit: COMMIT,
      identity,
      stateDir: STATE_DIR,
      censusReceiptPath: census.receiptPath!,
      receiptSha256: census.receiptSha256!,
      confirmIndex: RELAY_EXPECTED_INDEX_NAME,
    });
    assert.equal(stopped.result, 'HOLD');
    assert.equal(c.db.createInputs.length, 0);
    assert.equal(c.db.calls.includes('createIndex'), false);
  }
  {
    const indexRace = makeContext();
    indexRace.db.driftFinalIndex = true;
    const stopped = await runApplyFromCensus(indexRace);
    assert.equal(stopped.holdCode, 'HOLD_CLEANUP');
    assert.equal(indexRace.db.rows.size, 0);
    assert.equal(indexRace.fs.files.has(RUN_STATE_PATH), true);
  }
});

addCase('25 public output and receipts contain counts and hashes but no synthetic identities', async () => {
  const c = makeContext();
  const result = await runApplyFromCensus(c);
  assert.equal(result.result, 'PASS');
  const firstStateWrite = c.fs.writes.find((write) => write.path === RUN_STATE_PATH)!;
  const state = JSON.parse(firstStateWrite.contents) as RunState;
  const publicText = [c.out.text(), c.fs.files.get(CENSUS_PATH), c.fs.files.get(result.finalReceiptPath!)].join('\n');
  for (const candidate of state.candidates) {
    assert.doesNotMatch(publicText, new RegExp(candidate.candidateId, 'i'));
    assert.doesNotMatch(publicText, new RegExp(candidate.userId, 'i'));
    assert.doesNotMatch(publicText, new RegExp(candidate.eventId, 'i'));
  }
  assert.doesNotMatch(publicText, /relay-2026|mongodb|resetbiology|poison/i);
});

addCase('26 source contains no broad migration transaction mutation or runtime coupling', async () => {
  const source = await readFile(path.resolve('scripts/workout-event-atlas-relay.ts'), 'utf8');
  for (const prohibited of [
    /\$transaction\s*\(/,
    /prisma\s+db\s+push/i,
    /dropIndex/i,
    /\.updateMany\s*\(/,
    /\.upsert\s*\(/,
    /from\s+['"][^'"]*\/lib\/prisma['"]/,
    /from\s+['"][^'"]*\/api\//,
  ]) {
    assert.doesNotMatch(source, prohibited);
  }
});

addCase('27 importing the module has no database or filesystem side effects', async () => {
  assert.equal(process.env.DATABASE_URL, 'poison://offline-suite-must-never-connect');
  const c = makeContext();
  assert.equal(c.fs.files.size, 0);
  assert.equal(c.db.calls.length, 0);
  assert.equal(c.out.lines.length, 0);
  const source = await readFile(path.resolve('scripts/workout-event-atlas-relay.ts'), 'utf8');
  assert.match(source, /await import\('@prisma\/client'\)/);
  assert.ok(source.indexOf("await import('@prisma/client')") > source.indexOf('export async function main'));
  const child = await execFileAsync(
    process.execPath,
    [path.resolve('node_modules/tsx/dist/cli.mjs'), '-e', "import('./scripts/workout-event-atlas-relay.ts')"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: 'poison://child-import-must-never-connect' },
      timeout: 10_000,
    },
  );
  assert.equal(child.stdout, '');
  assert.equal(child.stderr, '');
});

addCase('28 thrown secret text is collapsed to stable hold codes', async () => {
  const c = makeContext();
  c.db.failListCollections = true;
  const census = await runFreshCensus(c);
  assert.equal(census.holdCode, 'HOLD_CENSUS_QUERY_FAILED');
  const publicText = [c.out.text(), ...c.fs.files.values()].join('\n');
  assert.doesNotMatch(publicText, /SECRET_ATLAS_LIST_FAILURE|stack|poison:\/\//i);
});

const main = async (): Promise<void> => {
  assert.equal(cases.length, 28, 'the frozen relay contract requires exactly 28 named cases');
  let passed = 0;
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    try {
      await testCase.run();
      passed += 1;
      console.log(`PASS ${index + 1}/28 ${testCase.name}`);
    } catch (error) {
      console.error(`FAIL ${index + 1}/28 ${testCase.name}`);
      throw error;
    }
  }
  console.log(`workout-event-atlas-relay: ${passed}/28 PASS`);
};

void main();
