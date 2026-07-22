/**
 * 07-03B isolated Atlas uniqueness relay for LOG-03 only.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export const RELAY_TARGET_DATABASE_NAME = 'resetbiology' as const;
export const RELAY_COLLECTION_NAME = 'workout_events' as const;
export const RELAY_EXPECTED_INDEX_NAME = 'workout_events_userId_eventId_unique' as const;
export const RELAY_RECEIPT_MAX_AGE_SECONDS = 600;
export const RELAY_CONTENTION_WIDTH = 32;
export const RELAY_TOTAL_CANDIDATES = 34;
export const RELAY_CLEANUP_RETRY_DELAYS_MS = [0, 250, 1000] as const;

export type HoldCode =
  | 'HOLD_ARGS_INVALID'
  | 'HOLD_NO_DATABASE_ENV'
  | 'HOLD_TARGET_MISMATCH'
  | 'HOLD_COMMIT_MISMATCH'
  | 'HOLD_WORKTREE_DIRTY'
  | 'HOLD_CENSUS_QUERY_FAILED'
  | 'HOLD_DUPLICATE_IDENTITY'
  | 'HOLD_MALFORMED_IDENTITY'
  | 'HOLD_INDEX_AMBIGUOUS'
  | 'HOLD_RECEIPT_STALE'
  | 'HOLD_RECEIPT_TAMPERED'
  | 'HOLD_RECEIPT_TARGET_MISMATCH'
  | 'HOLD_LOCK_STALE'
  | 'HOLD_DRIFT'
  | 'HOLD_MISSING_CONFIRMATION'
  | 'HOLD_INDEX_CREATE_FAILED'
  | 'HOLD_INDEX_READBACK'
  | 'HOLD_STATE_CORRUPT'
  | 'HOLD_STATE_TARGET_MISMATCH'
  | 'HOLD_ID_COLLISION'
  | 'HOLD_USER_COLLISION'
  | 'HOLD_CONTENTION_UNEXPECTED'
  | 'HOLD_ID_MISMATCH'
  | 'HOLD_IMMUTABILITY_VIOLATION'
  | 'HOLD_CLEANUP_IDENTITY_MISMATCH'
  | 'HOLD_CLEANUP'
  | 'HOLD_UNEXPECTED';

export class RelayHoldError extends Error {
  readonly name = 'RelayHoldError';
  readonly code: HoldCode;

  constructor(code: HoldCode) {
    super(code);
    this.code = code;
  }
}

const sanitizeToHoldCode = (caught: unknown, fallback: HoldCode): HoldCode =>
  caught instanceof RelayHoldError ? caught.code : fallback;

export type IndexKeyEntry = readonly [field: string, direction: 1 | -1];

export type IndexDescription = Readonly<{
  name: string;
  key: readonly IndexKeyEntry[];
  unique: boolean;
  uniqueSpecified?: boolean;
  sparse: boolean;
  sparseSpecified?: boolean;
  hasPartialFilter: boolean;
  hasExpireAfterSeconds: boolean;
  hidden: boolean;
  hiddenSpecified?: boolean;
  hasCollation: boolean;
  serverIndexVersion?: number | null;
  namespace?: string | null;
  background?: boolean | null;
}>;

export type WorkoutEventRecordSnapshot = Readonly<{
  id: string;
  userId: string;
  eventId: string;
  digest: string;
  payload: unknown;
  acceptedAt: string;
}>;

export type CreateWorkoutEventInput = Readonly<{
  id: string;
  userId: string;
  eventId: string;
  schemaVersion: string;
  digest: string;
  type: string;
  occurredAt: string;
  payload: unknown;
}>;

export type DeleteExactWorkoutEventInput = Readonly<{
  id: string;
  userId: string;
  eventId: string;
  digest: string;
  payload: unknown;
}>;

export type DeleteExactWorkoutEventResult = 'deleted' | 'missing' | 'mismatch';

export class WorkoutEventDuplicateKeyError extends Error {
  readonly name = 'WorkoutEventDuplicateKeyError';
  readonly target: readonly string[];

  constructor(target: readonly string[]) {
    super('workout event identity collision');
    this.target = target;
  }
}

export type AtlasDatabasePort = Readonly<{
  listCollectionNames(): Promise<readonly string[]>;
  countWorkoutEvents(): Promise<number>;
  listWorkoutEventIndexes(): Promise<readonly IndexDescription[]>;
  countDuplicateIdentityGroups(): Promise<number>;
  countMalformedIdentityDocuments(): Promise<number>;
  createUniqueCompoundIndex(): Promise<void>;
  findWorkoutEventById(id: string): Promise<WorkoutEventRecordSnapshot | null>;
  findUserById(id: string): Promise<Readonly<{ id: string }> | null>;
  createWorkoutEvent(input: CreateWorkoutEventInput): Promise<WorkoutEventRecordSnapshot>;
  deleteWorkoutEventIfExact(input: DeleteExactWorkoutEventInput): Promise<DeleteExactWorkoutEventResult>;
}>;

export type FileSystemPort = Readonly<{
  exists(targetPath: string): Promise<boolean>;
  readFile(targetPath: string): Promise<string>;
  writeFileAtomic(targetPath: string, contents: string): Promise<void>;
  createExclusive(targetPath: string, contents: string): Promise<boolean>;
  unlink(targetPath: string): Promise<void>;
}>;

export type ClockPort = Readonly<{
  now(): Date;
}>;

export type RandomPort = Readonly<{
  randomHex(byteLength: number): string;
}>;

export type GitPort = Readonly<{
  revParseHead(): Promise<string>;
  statusShort(): Promise<string>;
}>;

export type OutputPort = Readonly<{
  write(line: string): void;
}>;

export type RelayPorts = Readonly<{
  db: AtlasDatabasePort;
  fs: FileSystemPort;
  clock: ClockPort;
  random: RandomPort;
  git: GitPort;
  out: OutputPort;
}>;

export type RelayIdentity = Readonly<{
  databaseName: string;
  targetFingerprintSha256: string;
}>;

export const sha256Hex = (input: string): string => createHash('sha256').update(input, 'utf8').digest('hex');

export const canonicalStringify = (value: unknown): string => {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortKeys);
    }
    if (input !== null && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = sortKeys(record[key]);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
};

export const isFullCommitSha = (value: string): boolean => /^[0-9a-f]{40}$/i.test(value);
export const isTargetFingerprint = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);
export const isCandidateObjectId = (value: string): boolean => /^[0-9a-f]{24}$/i.test(value);

export const areAllDistinct = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const computeTargetFingerprintSha256 = (driver: string, lowercaseHostname: string): string =>
  sha256Hex(driver + '|' + lowercaseHostname + '|' + RELAY_TARGET_DATABASE_NAME);

export type ParsedDatabaseTarget = Readonly<{
  driver: string;
  lowercaseHostname: string;
  databaseName: string;
}>;

export const parseDatabaseUrlForTarget = (rawUrl: string): ParsedDatabaseTarget => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RelayHoldError('HOLD_TARGET_MISMATCH');
  }
  const driver = parsed.protocol.replace(/:$/, '');
  const lowercaseHostname = parsed.hostname.toLowerCase();
  const rawPath = parsed.pathname.replace(/^\//, '').split('?')[0] ?? '';
  const databaseName = decodeURIComponent(rawPath);
  if (driver.length === 0 || lowercaseHostname.length === 0 || databaseName.length === 0) {
    throw new RelayHoldError('HOLD_TARGET_MISMATCH');
  }
  return Object.freeze({ driver, lowercaseHostname, databaseName });
};

export const resolveRelayIdentityFromDatabaseUrl = (
  rawUrl: string,
  expectedTargetFingerprintSha256: string,
): RelayIdentity => {
  const parsedTarget = parseDatabaseUrlForTarget(rawUrl);
  if (parsedTarget.driver !== 'mongodb+srv' || parsedTarget.databaseName !== RELAY_TARGET_DATABASE_NAME) {
    throw new RelayHoldError('HOLD_TARGET_MISMATCH');
  }
  const fingerprint = computeTargetFingerprintSha256(parsedTarget.driver, parsedTarget.lowercaseHostname);
  if (fingerprint.toLowerCase() !== expectedTargetFingerprintSha256.toLowerCase()) {
    throw new RelayHoldError('HOLD_TARGET_MISMATCH');
  }
  return Object.freeze({ databaseName: parsedTarget.databaseName, targetFingerprintSha256: fingerprint });
};

const isAcceptableCompoundIndexShape = (index: IndexDescription): boolean =>
  index.name.length > 0 &&
  index.key.length === 2 &&
  index.key[0][0] === 'userId' &&
  index.key[0][1] === 1 &&
  index.key[1][0] === 'eventId' &&
  index.key[1][1] === 1 &&
  index.unique &&
  !index.sparse &&
  !index.hasPartialFilter &&
  !index.hasExpireAfterSeconds &&
  !index.hidden &&
  !index.hasCollation;

const isAcceptableIdIndexShape = (index: IndexDescription): boolean =>
  index.name === '_id_' &&
  index.key.length === 1 &&
  index.key[0][0] === '_id' &&
  index.key[0][1] === 1 &&
  (!index.uniqueSpecified || index.unique) &&
  !index.sparse &&
  !index.hasPartialFilter &&
  !index.hasExpireAfterSeconds &&
  !index.hidden &&
  !index.hasCollation &&
  index.background !== true;

export type IndexClassification = Readonly<{
  acceptableIndexName: string | null;
  holdCode: HoldCode | null;
}>;

export const classifyWorkoutEventIndexes = (
  indexes: readonly IndexDescription[],
  collectionExists: boolean,
): IndexClassification => {
  if (collectionExists) {
    const idIndexes = indexes.filter((index) => index.name === '_id_');
    if (idIndexes.length !== 1 || !isAcceptableIdIndexShape(idIndexes[0])) {
      return Object.freeze({ acceptableIndexName: null, holdCode: 'HOLD_INDEX_AMBIGUOUS' as HoldCode });
    }
  } else if (indexes.length !== 0) {
    return Object.freeze({ acceptableIndexName: null, holdCode: 'HOLD_INDEX_AMBIGUOUS' as HoldCode });
  }
  const nonIdIndexes = indexes.filter((index) => index.name !== '_id_');
  if (nonIdIndexes.length === 0) {
    return Object.freeze({ acceptableIndexName: null, holdCode: null });
  }
  const acceptable = nonIdIndexes.filter(isAcceptableCompoundIndexShape);
  if (nonIdIndexes.length === 1 && acceptable.length === 1) {
    return Object.freeze({ acceptableIndexName: acceptable[0].name, holdCode: null });
  }
  return Object.freeze({ acceptableIndexName: null, holdCode: 'HOLD_INDEX_AMBIGUOUS' as HoldCode });
};

export const computeIndexSetFingerprintSha256 = (indexes: readonly IndexDescription[]): string => {
  const normalized = [...indexes]
    .map((index) => ({
      name: index.name,
      key: index.key.map(([field, direction]) => [field, direction]),
      unique: index.unique,
      uniqueSpecified: index.uniqueSpecified ?? false,
      sparse: index.sparse,
      sparseSpecified: index.sparseSpecified ?? false,
      hasPartialFilter: index.hasPartialFilter,
      hasExpireAfterSeconds: index.hasExpireAfterSeconds,
      hidden: index.hidden,
      hiddenSpecified: index.hiddenSpecified ?? false,
      hasCollation: index.hasCollation,
      serverIndexVersion: index.serverIndexVersion ?? null,
      namespace: index.namespace ?? null,
      background: index.background ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return sha256Hex(canonicalStringify(normalized));
};

export type CensusResult = Readonly<{
  baselineCount: number;
  duplicateGroupCount: number;
  malformedIdentityCount: number;
  indexes: readonly IndexDescription[];
  acceptableIndexName: string | null;
  indexSetFingerprintSha256: string;
  gate: 'PASS' | 'HOLD';
  holdCode: HoldCode | null;
}>;

const performCensusRead = async (db: AtlasDatabasePort): Promise<CensusResult> => {
  let collectionNames: readonly string[];
  try {
    collectionNames = await db.listCollectionNames();
  } catch {
    throw new RelayHoldError('HOLD_CENSUS_QUERY_FAILED');
  }
  const collectionExists = collectionNames.includes(RELAY_COLLECTION_NAME);

  let baselineCount = 0;
  let duplicateGroupCount = 0;
  let malformedIdentityCount = 0;
  let indexes: readonly IndexDescription[] = [];

  if (collectionExists) {
    try {
      baselineCount = await db.countWorkoutEvents();
      indexes = await db.listWorkoutEventIndexes();
      duplicateGroupCount = await db.countDuplicateIdentityGroups();
      malformedIdentityCount = await db.countMalformedIdentityDocuments();
    } catch {
      throw new RelayHoldError('HOLD_CENSUS_QUERY_FAILED');
    }
  }

  const classification = classifyWorkoutEventIndexes(indexes, collectionExists);
  const indexSetFingerprintSha256 = computeIndexSetFingerprintSha256(indexes);

  let gate: 'PASS' | 'HOLD' = 'PASS';
  let holdCode: HoldCode | null = null;
  if (duplicateGroupCount !== 0) {
    gate = 'HOLD';
    holdCode = 'HOLD_DUPLICATE_IDENTITY';
  } else if (malformedIdentityCount !== 0) {
    gate = 'HOLD';
    holdCode = 'HOLD_MALFORMED_IDENTITY';
  } else if (classification.holdCode !== null) {
    gate = 'HOLD';
    holdCode = classification.holdCode;
  }

  return Object.freeze({
    baselineCount,
    duplicateGroupCount,
    malformedIdentityCount,
    indexes,
    acceptableIndexName: classification.acceptableIndexName,
    indexSetFingerprintSha256,
    gate,
    holdCode,
  });
};

const verifyCleanExactCommit = async (git: GitPort, expectedCommit: string): Promise<void> => {
  let head: string;
  let status: string;
  try {
    head = (await git.revParseHead()).trim();
    status = (await git.statusShort()).trim();
  } catch {
    throw new RelayHoldError('HOLD_COMMIT_MISMATCH');
  }
  if (head.toLowerCase() !== expectedCommit.toLowerCase()) {
    throw new RelayHoldError('HOLD_COMMIT_MISMATCH');
  }
  if (status.length !== 0) {
    throw new RelayHoldError('HOLD_WORKTREE_DIRTY');
  }
};

export type CensusReceipt = Readonly<{
  receiptVersion: 'workout-event-atlas-relay-census/2';
  generatedAtIso: string;
  expectedCommit: string;
  targetFingerprintSha256: string;
  baselineCount: number;
  duplicateGroupCount: number;
  malformedIdentityCount: number;
  acceptableIndexName: string | null;
  indexSetFingerprintSha256: string;
  gate: 'PASS' | 'HOLD';
  holdCode: HoldCode | null;
}>;

export type CensusArgs = Readonly<{
  expectedCommit: string;
  identity: RelayIdentity;
  stateDir: string;
}>;

export type CensusOutcome = Readonly<{
  gate: 'PASS' | 'HOLD';
  holdCode: HoldCode | null;
  receipt: CensusReceipt | null;
  receiptPath: string | null;
  receiptSha256: string | null;
}>;

const durablePersist = async (fs: FileSystemPort, targetPath: string, value: unknown): Promise<string> => {
  const contents = canonicalStringify(value);
  await fs.writeFileAtomic(targetPath, contents);
  const reread = await fs.readFile(targetPath);
  if (reread !== contents) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  return sha256Hex(contents);
};

const emitGateLine = (out: OutputPort, gate: 'PASS' | 'HOLD', holdCode: HoldCode | null): void => {
  out.write(gate === 'PASS' ? 'PREMUTATION_GATE=PASS' : 'PREMUTATION_GATE=HOLD:' + (holdCode ?? 'HOLD_UNEXPECTED'));
};

const requireFreshAbsoluteStateDir = async (fs: FileSystemPort, stateDir: string): Promise<void> => {
  if (!path.isAbsolute(stateDir)) {
    throw new RelayHoldError('HOLD_ARGS_INVALID');
  }
  for (const fileName of ['census-receipt.json', 'run-state.json', 'apply.lock', 'final-receipt.json']) {
    if (await fs.exists(path.join(stateDir, fileName))) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }
  }
};

export async function runCensus(
  ports: Pick<RelayPorts, 'db' | 'git' | 'fs' | 'clock' | 'out'>,
  args: CensusArgs,
): Promise<CensusOutcome> {
  const { db, git, fs, clock, out } = ports;
  const receiptPath = path.join(args.stateDir, 'census-receipt.json');
  try {
    await requireFreshAbsoluteStateDir(fs, args.stateDir);
    await verifyCleanExactCommit(git, args.expectedCommit);
    if (args.identity.databaseName !== RELAY_TARGET_DATABASE_NAME) {
      throw new RelayHoldError('HOLD_TARGET_MISMATCH');
    }

    const census = await performCensusRead(db);

    const receipt: CensusReceipt = Object.freeze({
      receiptVersion: 'workout-event-atlas-relay-census/2',
      generatedAtIso: clock.now().toISOString(),
      expectedCommit: args.expectedCommit.toLowerCase(),
      targetFingerprintSha256: args.identity.targetFingerprintSha256.toLowerCase(),
      baselineCount: census.baselineCount,
      duplicateGroupCount: census.duplicateGroupCount,
      malformedIdentityCount: census.malformedIdentityCount,
      acceptableIndexName: census.acceptableIndexName,
      indexSetFingerprintSha256: census.indexSetFingerprintSha256,
      gate: census.gate,
      holdCode: census.holdCode,
    });

    const receiptSha256 = await durablePersist(fs, receiptPath, receipt);

    emitGateLine(out, census.gate, census.holdCode);
    out.write('RECEIPT_SHA256=' + receiptSha256);
    out.write('RECEIPT_PATH=' + receiptPath);
    out.write('BASELINE_COUNT=' + String(census.baselineCount));
    out.write('DUPLICATE_GROUP_COUNT=' + String(census.duplicateGroupCount));
    out.write('MALFORMED_IDENTITY_COUNT=' + String(census.malformedIdentityCount));

    return Object.freeze({
      gate: census.gate,
      holdCode: census.holdCode,
      receipt,
      receiptPath,
      receiptSha256,
    });
  } catch (caught) {
    const holdCode = sanitizeToHoldCode(caught, 'HOLD_UNEXPECTED');
    emitGateLine(out, 'HOLD', holdCode);
    return Object.freeze({ gate: 'HOLD', holdCode, receipt: null, receiptPath: null, receiptSha256: null });
  }
}

export type ContentionRole = 'contention' | 'crossUser' | 'changedDigest';

export type ContentionSlot = Readonly<{
  slot: number;
  candidateId: string;
  userId: string;
  eventId: string;
  digest: string;
  role: ContentionRole;
}>;

export type RunState = Readonly<{
  runStateVersion: 'workout-event-atlas-relay-run-state/1';
  runId: string;
  runMarker: string;
  createdAtIso: string;
  expectedCommit: string;
  targetFingerprintSha256: string;
  censusReceiptSha256: string;
  expectedIndexName: typeof RELAY_EXPECTED_INDEX_NAME;
  confirmedIndexSetFingerprintSha256: string | null;
  baselineCount: number;
  candidates: readonly ContentionSlot[];
  candidatesSha256: string;
  confirmedIds: readonly string[];
  cleanupObservedIds: readonly string[];
  cleanupDeletedIds: readonly string[];
  phase: 'prepared' | 'writing' | 'cleaning' | 'clean';
  authoritySha256: string;
}>;

type UnsealedRunState = Omit<RunState, 'authoritySha256'>;

const sealRunState = (state: UnsealedRunState): RunState =>
  Object.freeze({ ...state, authoritySha256: sha256Hex(canonicalStringify(state)) });

const withoutAuthoritySha256 = (state: RunState): UnsealedRunState => {
  const { authoritySha256: _authoritySha256, ...authority } = state;
  return authority;
};

const buildContentionPayload = (runMarker: string, slot: number, role: ContentionRole): unknown => ({
  runMarker,
  slot,
  role,
  probe: 'atlas-relay-synthetic-nonclinical-probe',
});

const generateDistinctSyntheticUserIds = async (
  db: AtlasDatabasePort,
  random: RandomPort,
): Promise<readonly [string, string]> => {
  const generateOne = async (excluding: readonly string[]): Promise<string> => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = random.randomHex(12);
      if (!isCandidateObjectId(candidate) || excluding.includes(candidate)) {
        continue;
      }
      const existing = await db.findUserById(candidate);
      if (existing === null) {
        return candidate;
      }
    }
    throw new RelayHoldError('HOLD_USER_COLLISION');
  };
  const userIdA = await generateOne([]);
  const userIdB = await generateOne([userIdA]);
  if (userIdA === userIdB) {
    throw new RelayHoldError('HOLD_USER_COLLISION');
  }
  return Object.freeze([userIdA, userIdB]);
};

const buildCandidateSlots = (
  random: RandomPort,
  userIdA: string,
  userIdB: string,
  eventId: string,
  digestPrimary: string,
  digestChanged: string,
): readonly ContentionSlot[] => {
  const usedIds = new Set<string>();
  const nextCandidateId = (): string => {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = random.randomHex(12);
      if (isCandidateObjectId(candidate) && !usedIds.has(candidate)) {
        usedIds.add(candidate);
        return candidate;
      }
    }
    throw new RelayHoldError('HOLD_ID_COLLISION');
  };

  const slots: ContentionSlot[] = [];
  for (let slot = 0; slot < RELAY_CONTENTION_WIDTH; slot += 1) {
    slots.push(
      Object.freeze({
        slot,
        candidateId: nextCandidateId(),
        userId: userIdA,
        eventId,
        digest: digestPrimary,
        role: 'contention' as const,
      }),
    );
  }
  slots.push(
    Object.freeze({
      slot: RELAY_CONTENTION_WIDTH,
      candidateId: nextCandidateId(),
      userId: userIdB,
      eventId,
      digest: digestPrimary,
      role: 'crossUser' as const,
    }),
  );
  slots.push(
    Object.freeze({
      slot: RELAY_CONTENTION_WIDTH + 1,
      candidateId: nextCandidateId(),
      userId: userIdA,
      eventId,
      digest: digestChanged,
      role: 'changedDigest' as const,
    }),
  );
  return Object.freeze(slots);
};

const persistRunState = async (fs: FileSystemPort, runStatePath: string, state: RunState): Promise<string> =>
  durablePersist(fs, runStatePath, state);

export const loadRunState = async (fs: FileSystemPort, runStatePath: string): Promise<RunState> => {
  let raw: string;
  try {
    raw = await fs.readFile(runStatePath);
  } catch {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  const state = parsed as RunState;
  if (
    typeof state !== 'object' ||
    state === null ||
    state.runStateVersion !== 'workout-event-atlas-relay-run-state/1' ||
    typeof state.runId !== 'string' ||
    !/^[0-9a-f]{32}$/i.test(state.runId) ||
    typeof state.runMarker !== 'string' ||
    state.runMarker.length < 8 ||
    typeof state.createdAtIso !== 'string' ||
    !Number.isFinite(new Date(state.createdAtIso).getTime()) ||
    !isFullCommitSha(state.expectedCommit) ||
    !isTargetFingerprint(state.targetFingerprintSha256) ||
    !isTargetFingerprint(state.censusReceiptSha256) ||
    state.expectedIndexName !== RELAY_EXPECTED_INDEX_NAME ||
    (state.confirmedIndexSetFingerprintSha256 !== null &&
      !isTargetFingerprint(state.confirmedIndexSetFingerprintSha256)) ||
    !Number.isSafeInteger(state.baselineCount) ||
    state.baselineCount < 0 ||
    !Array.isArray(state.candidates) ||
    state.candidates.length !== RELAY_TOTAL_CANDIDATES ||
    typeof state.candidatesSha256 !== 'string' ||
    !Array.isArray(state.confirmedIds) ||
    !Array.isArray(state.cleanupObservedIds) ||
    !Array.isArray(state.cleanupDeletedIds) ||
    !['prepared', 'writing', 'cleaning', 'clean'].includes(state.phase) ||
    !isTargetFingerprint(state.authoritySha256)
  ) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  const candidatesValid = state.candidates.every((candidate, index) => {
    const expectedRole: ContentionRole =
      index < RELAY_CONTENTION_WIDTH ? 'contention' : index === RELAY_CONTENTION_WIDTH ? 'crossUser' : 'changedDigest';
    return (
      candidate !== null &&
      typeof candidate === 'object' &&
      candidate.slot === index &&
      candidate.role === expectedRole &&
      isCandidateObjectId(candidate.candidateId) &&
      isCandidateObjectId(candidate.userId) &&
      typeof candidate.eventId === 'string' &&
      candidate.eventId.length > 0 &&
      /^[0-9a-f]{64}$/i.test(candidate.digest)
    );
  });
  const candidateIds = state.candidates.map((candidate) => candidate.candidateId);
  const eventIds = state.candidates.map((candidate) => candidate.eventId);
  const contentionUserIds = state.candidates
    .filter((candidate) => candidate.role !== 'crossUser')
    .map((candidate) => candidate.userId);
  const crossUser = state.candidates[RELAY_CONTENTION_WIDTH];
  const primaryDigest = state.candidates[0]?.digest;
  const digestRolesValid = state.candidates.every((candidate) =>
    candidate.role === 'changedDigest' ? candidate.digest !== primaryDigest : candidate.digest === primaryDigest,
  );
  if (
    !candidatesValid ||
    !areAllDistinct(candidateIds) ||
    !eventIds.every((eventId) => eventId === eventIds[0]) ||
    !contentionUserIds.every((userId) => userId === contentionUserIds[0]) ||
    crossUser === undefined ||
    crossUser.userId === contentionUserIds[0] ||
    !digestRolesValid ||
    !state.confirmedIds.every((id) => isCandidateObjectId(id) && candidateIds.includes(id)) ||
    !areAllDistinct(state.confirmedIds) ||
    !state.cleanupObservedIds.every((id) => isCandidateObjectId(id) && candidateIds.includes(id)) ||
    !areAllDistinct(state.cleanupObservedIds) ||
    !state.cleanupDeletedIds.every((id) => isCandidateObjectId(id) && state.cleanupObservedIds.includes(id)) ||
    !areAllDistinct(state.cleanupDeletedIds)
  ) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  const recomputed = sha256Hex(canonicalStringify(state.candidates));
  if (recomputed !== state.candidatesSha256) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  if (sha256Hex(canonicalStringify(withoutAuthoritySha256(state))) !== state.authoritySha256) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  return state;
};

export type ContentionOutcome = Readonly<{
  runStatePath: string;
  runMarker: string;
  winnerId: string;
  winnerSnapshot: WorkoutEventRecordSnapshot;
  crossUserId: string;
  confirmedIds: readonly string[];
  contentionSuccessCount: number;
  contentionCollisionCount: number;
  crossUserProven: boolean;
  immutabilityProven: boolean;
}>;

const isExactOrderedTarget = (target: readonly string[]): boolean =>
  target.length === 2 && target[0] === 'userId' && target[1] === 'eventId';

export type ContentionProofControls = Readonly<{
  censusReceiptSha256: string;
  onStateTransition(state: RunState): void;
  beforeFirstWrite(): Promise<string>;
}>;

export const runContentionAndImmutabilityProof = async (
  ports: Pick<RelayPorts, 'db' | 'fs' | 'clock' | 'random' | 'out'>,
  stateDir: string,
  expectedCommit: string,
  identity: RelayIdentity,
  baselineCount: number,
  controls: ContentionProofControls,
): Promise<ContentionOutcome> => {
  const { db, fs, clock, random, out } = ports;

  const runId = random.randomHex(16);
  const runMarker = 'relay-' + clock.now().toISOString() + '-' + random.randomHex(8);
  const [userIdA, userIdB] = await generateDistinctSyntheticUserIds(db, random);
  const eventId = random.randomHex(16);
  const digestPrimary = sha256Hex(runMarker + ':' + eventId + ':primary');
  const digestChanged = sha256Hex(runMarker + ':' + eventId + ':changed');

  const candidates = buildCandidateSlots(random, userIdA, userIdB, eventId, digestPrimary, digestChanged);
  if (candidates.length !== RELAY_TOTAL_CANDIDATES) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  const candidateIds = candidates.map((c) => c.candidateId);
  if (!candidateIds.every(isCandidateObjectId) || !areAllDistinct(candidateIds)) {
    throw new RelayHoldError('HOLD_ID_COLLISION');
  }

  const runStatePath = path.join(stateDir, 'run-state.json');
  const candidatesSha256 = sha256Hex(canonicalStringify(candidates));
  let state = sealRunState({
    runStateVersion: 'workout-event-atlas-relay-run-state/1',
    runId,
    runMarker,
    createdAtIso: clock.now().toISOString(),
    expectedCommit: expectedCommit.toLowerCase(),
    targetFingerprintSha256: identity.targetFingerprintSha256.toLowerCase(),
    censusReceiptSha256: controls.censusReceiptSha256.toLowerCase(),
    expectedIndexName: RELAY_EXPECTED_INDEX_NAME,
    confirmedIndexSetFingerprintSha256: null,
    baselineCount,
    candidates,
    candidatesSha256,
    confirmedIds: Object.freeze([]),
    cleanupObservedIds: Object.freeze([]),
    cleanupDeletedIds: Object.freeze([]),
    phase: 'prepared',
  });
  await persistRunState(fs, runStatePath, state);

  try {
    for (const candidate of candidates) {
      const existing = await db.findWorkoutEventById(candidate.candidateId);
      if (existing !== null) {
        throw new RelayHoldError('HOLD_ID_COLLISION');
      }
    }
  } catch (caught) {
    try {
      await fs.unlink(runStatePath);
    } catch {
      throw new RelayHoldError('HOLD_STATE_CORRUPT');
    }
    throw caught;
  }

  const transitionState = async (patch: Partial<UnsealedRunState>): Promise<void> => {
    const next = sealRunState({ ...withoutAuthoritySha256(state), ...patch });
    await persistRunState(fs, runStatePath, next);
    state = next;
    controls.onStateTransition(state);
  };

  let confirmationQueue: Promise<void> = Promise.resolve();
  const persistConfirmed = (id: string): Promise<void> => {
    const task = confirmationQueue.then(async () => {
      if (!state.confirmedIds.includes(id)) {
        await transitionState({ confirmedIds: Object.freeze([...state.confirmedIds, id]) });
      }
    });
    confirmationQueue = task.catch(() => undefined);
    return task;
  };

  const runTrackedCreate = async (slot: ContentionSlot): Promise<WorkoutEventRecordSnapshot> => {
    const created = await db.createWorkoutEvent({
      id: slot.candidateId,
      userId: slot.userId,
      eventId: slot.eventId,
      schemaVersion: 'atlas-relay/1',
      digest: slot.digest,
      type: 'relay.synthetic.probe',
      occurredAt: clock.now().toISOString(),
      payload: buildContentionPayload(runMarker, slot.slot, slot.role),
    });
    if (created.id !== slot.candidateId) {
      throw new RelayHoldError('HOLD_ID_MISMATCH');
    }
    await persistConfirmed(created.id);
    return created;
  };

  await transitionState({ phase: 'writing' });
  const confirmedIndexSetFingerprintSha256 = await controls.beforeFirstWrite();
  if (!isTargetFingerprint(confirmedIndexSetFingerprintSha256)) {
    throw new RelayHoldError('HOLD_INDEX_READBACK');
  }
  await transitionState({ confirmedIndexSetFingerprintSha256 });

  const contentionSlots = candidates.filter((c) => c.role === 'contention');

  let releaseGate: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const pendingAttempts = contentionSlots.map((slot) =>
    (async () => {
      await gate;
      return runTrackedCreate(slot);
    })(),
  );
  releaseGate();
  const attempts = await Promise.allSettled(pendingAttempts);

  let successCount = 0;
  let collisionCount = 0;
  let winnerId: string | null = null;
  let winnerSnapshot: WorkoutEventRecordSnapshot | null = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const outcome = attempts[i];
    const slot = contentionSlots[i];
    if (outcome.status === 'fulfilled') {
      successCount += 1;
      winnerId = outcome.value.id;
      winnerSnapshot = outcome.value;
    } else if (outcome.reason instanceof WorkoutEventDuplicateKeyError) {
      if (!isExactOrderedTarget(outcome.reason.target)) {
        throw new RelayHoldError('HOLD_CONTENTION_UNEXPECTED');
      }
      collisionCount += 1;
    } else {
      throw new RelayHoldError('HOLD_CONTENTION_UNEXPECTED');
    }
  }

  if (
    successCount !== 1 ||
    collisionCount !== RELAY_CONTENTION_WIDTH - 1 ||
    winnerId === null ||
    winnerSnapshot === null
  ) {
    throw new RelayHoldError('HOLD_CONTENTION_UNEXPECTED');
  }

  const crossUserSlot = candidates.find((c) => c.role === 'crossUser');
  if (crossUserSlot === undefined) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  const crossUserRecord = await runTrackedCreate(crossUserSlot);
  const crossUserProven = true;

  const changedDigestSlot = candidates.find((c) => c.role === 'changedDigest');
  if (changedDigestSlot === undefined) {
    throw new RelayHoldError('HOLD_STATE_CORRUPT');
  }
  let changedDigestRejected = false;
  try {
    await runTrackedCreate(changedDigestSlot);
  } catch (caught) {
    if (caught instanceof WorkoutEventDuplicateKeyError && isExactOrderedTarget(caught.target)) {
      changedDigestRejected = true;
    } else {
      throw new RelayHoldError('HOLD_CONTENTION_UNEXPECTED');
    }
  }
  if (!changedDigestRejected) {
    throw new RelayHoldError('HOLD_IMMUTABILITY_VIOLATION');
  }

  const rereadWinner = await db.findWorkoutEventById(winnerId);
  if (
    rereadWinner === null ||
    rereadWinner.id !== winnerSnapshot.id ||
    rereadWinner.digest !== winnerSnapshot.digest ||
    rereadWinner.acceptedAt !== winnerSnapshot.acceptedAt ||
    canonicalStringify(rereadWinner.payload) !== canonicalStringify(winnerSnapshot.payload)
  ) {
    throw new RelayHoldError('HOLD_IMMUTABILITY_VIOLATION');
  }
  const immutabilityProven = true;

  out.write('CONTENTION_SUCCESS_COUNT=' + String(successCount));
  out.write('CONTENTION_COLLISION_COUNT=' + String(collisionCount));
  out.write('CANDIDATE_IDS_SHA256=' + sha256Hex(canonicalStringify(candidates.map((c) => c.candidateId))));

  return Object.freeze({
    runStatePath,
    runMarker,
    winnerId,
    winnerSnapshot: rereadWinner,
    crossUserId: crossUserRecord.id,
    confirmedIds: state.confirmedIds,
    contentionSuccessCount: successCount,
    contentionCollisionCount: collisionCount,
    crossUserProven,
    immutabilityProven,
  });
};

export type CleanupOutcome = Readonly<{
  result: 'PASS' | 'HOLD_CLEANUP';
  holdCode: HoldCode | null;
  precommittedCount: number;
  confirmedReturnedCount: number;
  observedCount: number;
  deletedCount: number;
  precommittedIdsSha256: string;
  confirmedReturnedIdsSha256: string;
  observedIdsSha256: string;
  deletedIdsSha256: string;
}>;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

type CleanupAttemptResult = Readonly<{
  ok: boolean;
  observedIds: readonly string[];
  deletedIds: readonly string[];
}>;

type CleanupTransitionHooks = Readonly<{
  onObserved(ids: readonly string[]): Promise<void>;
  onDeleted(id: string): Promise<void>;
}>;

const expectedPayloadForCandidate = (state: RunState, candidate: ContentionSlot): unknown =>
  buildContentionPayload(state.runMarker, candidate.slot, candidate.role);

const attemptCleanupOnce = async (
  db: AtlasDatabasePort,
  state: RunState,
  hooks: CleanupTransitionHooks,
): Promise<CleanupAttemptResult | RelayHoldError> => {
  type ObservedRow = Readonly<{ candidateId: string; row: WorkoutEventRecordSnapshot }>;
  const observedRows: ObservedRow[] = [];

  try {
    for (const candidate of state.candidates) {
      const observed = await db.findWorkoutEventById(candidate.candidateId);
      if (observed === null) {
        continue;
      }

      const payload = observed.payload as Readonly<{ runMarker?: unknown }> | null;
      const observedRunMarker = payload !== null && typeof payload === 'object' ? payload.runMarker : undefined;
      const expectedPayload = expectedPayloadForCandidate(state, candidate);
      const identityMatches =
        observed.id === candidate.candidateId &&
        observed.userId === candidate.userId &&
        observed.eventId === candidate.eventId &&
        observed.digest === candidate.digest &&
        observedRunMarker === state.runMarker &&
        canonicalStringify(observed.payload) === canonicalStringify(expectedPayload);

      if (!identityMatches) {
        return new RelayHoldError('HOLD_CLEANUP_IDENTITY_MISMATCH');
      }
      observedRows.push({ candidateId: candidate.candidateId, row: observed });
    }
  } catch (caught) {
    if (caught instanceof RelayHoldError) {
      return caught;
    }
    return Object.freeze({ ok: false, observedIds: Object.freeze([]), deletedIds: Object.freeze([]) });
  }

  const observedIds = observedRows.map((r) => r.row.id);
  try {
    await hooks.onObserved(observedIds);
  } catch {
    return Object.freeze({ ok: false, observedIds: Object.freeze(observedIds), deletedIds: Object.freeze([]) });
  }

  const deletedIds: string[] = [];
  try {
    for (const observedRow of observedRows) {
      const candidate = state.candidates.find((entry) => entry.candidateId === observedRow.candidateId);
      if (candidate === undefined) {
        return new RelayHoldError('HOLD_STATE_CORRUPT');
      }
      const deletion = await db.deleteWorkoutEventIfExact({
        id: candidate.candidateId,
        userId: candidate.userId,
        eventId: candidate.eventId,
        digest: candidate.digest,
        payload: expectedPayloadForCandidate(state, candidate),
      });
      if (deletion === 'mismatch') {
        return new RelayHoldError('HOLD_CLEANUP_IDENTITY_MISMATCH');
      }
      if (deletion === 'deleted') {
        deletedIds.push(candidate.candidateId);
        await hooks.onDeleted(candidate.candidateId);
      }
    }
  } catch {
    return Object.freeze({
      ok: false,
      observedIds: Object.freeze(observedIds),
      deletedIds: Object.freeze(deletedIds),
    });
  }

  let finalCount: number;
  let duplicateGroupCount: number;
  let indexes: readonly IndexDescription[];
  try {
    finalCount = await db.countWorkoutEvents();
    duplicateGroupCount = await db.countDuplicateIdentityGroups();
    indexes = await db.listWorkoutEventIndexes();
  } catch {
    return Object.freeze({ ok: false, observedIds: Object.freeze(observedIds), deletedIds: Object.freeze(deletedIds) });
  }

  const collectionExistsAfterCleanup = finalCount > 0 || indexes.length > 0;
  const classification = classifyWorkoutEventIndexes(indexes, collectionExistsAfterCleanup);
  const finalIndexSetFingerprintSha256 = computeIndexSetFingerprintSha256(indexes);
  const finalIndexSetMatches =
    state.confirmedIndexSetFingerprintSha256 === null
      ? classification.acceptableIndexName !== null
      : finalIndexSetFingerprintSha256 === state.confirmedIndexSetFingerprintSha256;

  let allPrecommittedAbsent = true;
  try {
    for (const candidate of state.candidates) {
      const stillPresent = await db.findWorkoutEventById(candidate.candidateId);
      if (stillPresent !== null) {
        allPrecommittedAbsent = false;
        break;
      }
    }
  } catch {
    return Object.freeze({ ok: false, observedIds: Object.freeze(observedIds), deletedIds: Object.freeze(deletedIds) });
  }

  const restored =
    finalCount === state.baselineCount &&
    duplicateGroupCount === 0 &&
    classification.acceptableIndexName !== null &&
    finalIndexSetMatches &&
    allPrecommittedAbsent;

  return Object.freeze({
    ok: restored,
    observedIds: Object.freeze(observedIds),
    deletedIds: Object.freeze(deletedIds),
  });
};

const runCleanupFromAuthority = async (
  ports: Pick<RelayPorts, 'db' | 'fs' | 'out'>,
  runStatePath: string,
  initialState: RunState,
  expectedCommit: string,
  identity: RelayIdentity,
): Promise<CleanupOutcome> => {
  const { db, fs, out } = ports;
  let state = initialState;
  if (
    state.expectedCommit.toLowerCase() !== expectedCommit.toLowerCase() ||
    state.targetFingerprintSha256.toLowerCase() !== identity.targetFingerprintSha256.toLowerCase()
  ) {
    throw new RelayHoldError('HOLD_STATE_TARGET_MISMATCH');
  }

  const precommittedIds = state.candidates.map((c) => c.candidateId);

  const observedIdSet = new Set<string>(state.cleanupObservedIds);
  const deletedIdSet = new Set<string>(state.cleanupDeletedIds);
  let passed = false;
  let holdCode: HoldCode | null = null;
  let statePersistenceFailed = false;

  const persistTransition = async (patch: Partial<UnsealedRunState>): Promise<void> => {
    state = sealRunState({ ...withoutAuthoritySha256(state), ...patch });
    if (statePersistenceFailed) {
      // The last known-good envelope remains recovery authority. Continue only
      // exact atomic cleanup in memory, preserve that file, and force HOLD.
      return;
    }
    try {
      await persistRunState(fs, runStatePath, state);
    } catch {
      statePersistenceFailed = true;
    }
  };

  await persistTransition({ phase: 'cleaning' });

  const hooks: CleanupTransitionHooks = Object.freeze({
    async onObserved(ids: readonly string[]): Promise<void> {
      for (const id of ids) observedIdSet.add(id);
      const ordered = precommittedIds.filter((id) => observedIdSet.has(id));
      await persistTransition({ cleanupObservedIds: Object.freeze(ordered) });
    },
    async onDeleted(id: string): Promise<void> {
      deletedIdSet.add(id);
      const ordered = precommittedIds.filter((candidateId) => deletedIdSet.has(candidateId));
      await persistTransition({ cleanupDeletedIds: Object.freeze(ordered) });
    },
  });

  for (const delayMs of RELAY_CLEANUP_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    const attempt = await attemptCleanupOnce(db, state, hooks);
    if (attempt instanceof RelayHoldError) {
      holdCode = attempt.code;
      break;
    }
    for (const id of attempt.observedIds) {
      observedIdSet.add(id);
    }
    for (const id of attempt.deletedIds) {
      deletedIdSet.add(id);
    }
    if (attempt.ok) {
      passed = true;
      break;
    }
  }

  const aggregatedObserved = precommittedIds.filter((id) => observedIdSet.has(id));
  const aggregatedDeleted = precommittedIds.filter((id) => deletedIdSet.has(id));

  if (passed) {
    await persistTransition({
      phase: 'clean',
      cleanupObservedIds: Object.freeze(aggregatedObserved),
      cleanupDeletedIds: Object.freeze(aggregatedDeleted),
    });
    if (statePersistenceFailed) {
      passed = false;
      holdCode = 'HOLD_CLEANUP';
    }
  }

  const precommittedIdsSha256 = sha256Hex(canonicalStringify(precommittedIds));
  const confirmedReturnedIdsSha256 = sha256Hex(canonicalStringify(state.confirmedIds));
  const observedIdsSha256 = sha256Hex(canonicalStringify(aggregatedObserved));
  const deletedIdsSha256 = sha256Hex(canonicalStringify(aggregatedDeleted));

  out.write('PRECOMMITTED_COUNT=' + String(precommittedIds.length));
  out.write('CONFIRMED_RETURNED_COUNT=' + String(state.confirmedIds.length));
  out.write('OBSERVED_COUNT=' + String(aggregatedObserved.length));
  out.write('DELETED_COUNT=' + String(aggregatedDeleted.length));
  out.write('PRECOMMITTED_IDS_SHA256=' + precommittedIdsSha256);
  out.write('CONFIRMED_RETURNED_IDS_SHA256=' + confirmedReturnedIdsSha256);
  out.write('OBSERVED_IDS_SHA256=' + observedIdsSha256);
  out.write('DELETED_IDS_SHA256=' + deletedIdsSha256);

  if (passed) {
    try {
      await fs.unlink(runStatePath);
    } catch {
      passed = false;
      holdCode = 'HOLD_CLEANUP';
    }
  }
  return Object.freeze({
    result: passed ? 'PASS' : 'HOLD_CLEANUP',
    holdCode: passed ? null : (holdCode ?? 'HOLD_CLEANUP'),
    precommittedCount: precommittedIds.length,
    confirmedReturnedCount: state.confirmedIds.length,
    observedCount: aggregatedObserved.length,
    deletedCount: aggregatedDeleted.length,
    precommittedIdsSha256,
    confirmedReturnedIdsSha256,
    observedIdsSha256,
    deletedIdsSha256,
  });
};

export const runCleanup = async (
  ports: Pick<RelayPorts, 'db' | 'fs' | 'out'>,
  runStatePath: string,
  expectedCommit: string,
  identity: RelayIdentity,
): Promise<CleanupOutcome> => {
  const state = await loadRunState(ports.fs, runStatePath);
  return runCleanupFromAuthority(ports, runStatePath, state, expectedCommit, identity);
};

export type ApplyArgs = Readonly<{
  expectedCommit: string;
  identity: RelayIdentity;
  stateDir: string;
  censusReceiptPath: string;
  receiptSha256: string;
  confirmIndex: string;
}>;

export type ApplyOutcome = Readonly<{
  result: 'PASS' | 'HOLD';
  holdCode: HoldCode | null;
  finalReceiptPath: string | null;
  finalReceiptSha256: string | null;
}>;

export type FinalReceipt = Readonly<{
  receiptVersion: 'workout-event-atlas-relay-final/2';
  generatedAtIso: string;
  expectedCommit: string;
  targetFingerprintSha256: string;
  result: 'PASS' | 'HOLD';
  holdCode: HoldCode | null;
  confirmedIndexNameSha256: string | null;
  indexSetFingerprintSha256: string | null;
  baselineRestored: boolean | null;
  contentionSuccessCount: number | null;
  contentionCollisionCount: number | null;
  crossUserProven: boolean | null;
  immutabilityProven: boolean | null;
  cleanupResult: 'PASS' | 'HOLD_CLEANUP' | null;
  precommittedCount: number | null;
  confirmedReturnedCount: number | null;
  observedCount: number | null;
  deletedCount: number | null;
  precommittedIdsSha256: string | null;
  confirmedReturnedIdsSha256: string | null;
  observedIdsSha256: string | null;
  deletedIdsSha256: string | null;
}>;

const readCensusReceipt = async (fs: FileSystemPort, receiptPath: string, expectedSha256: string): Promise<CensusReceipt> => {
  let raw: string;
  try {
    raw = await fs.readFile(receiptPath);
  } catch {
    throw new RelayHoldError('HOLD_RECEIPT_TAMPERED');
  }
  const actualSha256 = sha256Hex(raw);
  if (actualSha256 !== expectedSha256) {
    throw new RelayHoldError('HOLD_RECEIPT_TAMPERED');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RelayHoldError('HOLD_RECEIPT_TAMPERED');
  }
  const receipt = parsed as CensusReceipt;
  const expectedKeys = [
    'acceptableIndexName',
    'baselineCount',
    'duplicateGroupCount',
    'expectedCommit',
    'gate',
    'generatedAtIso',
    'holdCode',
    'indexSetFingerprintSha256',
    'malformedIdentityCount',
    'receiptVersion',
    'targetFingerprintSha256',
  ];
  if (
    typeof receipt !== 'object' ||
    receipt === null ||
    Array.isArray(receipt) ||
    canonicalStringify(Object.keys(receipt).sort()) !== canonicalStringify(expectedKeys) ||
    receipt.receiptVersion !== 'workout-event-atlas-relay-census/2' ||
    typeof receipt.generatedAtIso !== 'string' ||
    !Number.isFinite(new Date(receipt.generatedAtIso).getTime()) ||
    !isFullCommitSha(receipt.expectedCommit) ||
    !isTargetFingerprint(receipt.targetFingerprintSha256) ||
    !Number.isSafeInteger(receipt.baselineCount) ||
    receipt.baselineCount < 0 ||
    receipt.duplicateGroupCount !== 0 ||
    receipt.malformedIdentityCount !== 0 ||
    (receipt.acceptableIndexName !== null &&
      (typeof receipt.acceptableIndexName !== 'string' || receipt.acceptableIndexName.length === 0)) ||
    !isTargetFingerprint(receipt.indexSetFingerprintSha256) ||
    receipt.gate !== 'PASS' ||
    receipt.holdCode !== null
  ) {
    throw new RelayHoldError('HOLD_RECEIPT_TAMPERED');
  }
  return receipt;
};

export async function runApply(ports: RelayPorts, args: ApplyArgs): Promise<ApplyOutcome> {
  const { db, fs, git, clock, out } = ports;
  const lockPath = path.join(args.stateDir, 'apply.lock');
  let lockAcquired = false;
  let holdCode: HoldCode | null = null;
  let confirmedIndexNameSha256: string | null = null;
  let indexSetFingerprintSha256: string | null = null;
  let contentionSuccessCount: number | null = null;
  let contentionCollisionCount: number | null = null;
  let crossUserProven: boolean | null = null;
  let immutabilityProven: boolean | null = null;
  let baselineRestored: boolean | null = null;
  let cleanupOutcome: CleanupOutcome | null = null;

  try {
    if (args.confirmIndex !== RELAY_EXPECTED_INDEX_NAME) {
      throw new RelayHoldError('HOLD_MISSING_CONFIRMATION');
    }

    const resolvedStateDir = path.resolve(args.stateDir);
    const resolvedReceiptPath = path.resolve(args.censusReceiptPath);
    if (
      !path.isAbsolute(args.stateDir) ||
      !path.isAbsolute(args.censusReceiptPath) ||
      path.dirname(resolvedReceiptPath) !== resolvedStateDir ||
      path.basename(resolvedReceiptPath) !== 'census-receipt.json'
    ) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }

    const receipt = await readCensusReceipt(fs, args.censusReceiptPath, args.receiptSha256);

    const receiptAgeMs = clock.now().getTime() - new Date(receipt.generatedAtIso).getTime();
    if (!Number.isFinite(receiptAgeMs) || receiptAgeMs < 0 || receiptAgeMs > RELAY_RECEIPT_MAX_AGE_SECONDS * 1000) {
      throw new RelayHoldError('HOLD_RECEIPT_STALE');
    }

    if (
      receipt.expectedCommit.toLowerCase() !== args.expectedCommit.toLowerCase() ||
      receipt.targetFingerprintSha256.toLowerCase() !== args.identity.targetFingerprintSha256.toLowerCase()
    ) {
      throw new RelayHoldError('HOLD_RECEIPT_TARGET_MISMATCH');
    }

    await verifyCleanExactCommit(git, args.expectedCommit);
    if (args.identity.databaseName !== RELAY_TARGET_DATABASE_NAME) {
      throw new RelayHoldError('HOLD_TARGET_MISMATCH');
    }

    if (
      (await fs.exists(path.join(args.stateDir, 'run-state.json'))) ||
      (await fs.exists(path.join(args.stateDir, 'final-receipt.json')))
    ) {
      throw new RelayHoldError('HOLD_STATE_CORRUPT');
    }

    const lockContents = canonicalStringify({ createdAtIso: clock.now().toISOString(), expectedCommit: args.expectedCommit });
    const created = await fs.createExclusive(lockPath, lockContents);
    if (!created) {
      throw new RelayHoldError('HOLD_LOCK_STALE');
    }
    lockAcquired = true;
    const rereadLock = await fs.readFile(lockPath);
    if (rereadLock !== lockContents) {
      throw new RelayHoldError('HOLD_STATE_CORRUPT');
    }

    const freshCensus = await performCensusRead(db);
    const driftDetected =
      freshCensus.baselineCount !== receipt.baselineCount ||
      freshCensus.duplicateGroupCount !== receipt.duplicateGroupCount ||
      freshCensus.malformedIdentityCount !== receipt.malformedIdentityCount ||
      freshCensus.acceptableIndexName !== receipt.acceptableIndexName ||
      freshCensus.indexSetFingerprintSha256 !== receipt.indexSetFingerprintSha256 ||
      freshCensus.gate !== 'PASS';
    if (driftDetected) {
      throw new RelayHoldError('HOLD_DRIFT');
    }

    const runStatePath = path.join(args.stateDir, 'run-state.json');
    let cleanupAuthority: RunState | null = null;
    try {
      const contentionOutcome = await runContentionAndImmutabilityProof(
        { db, fs, clock, random: ports.random, out },
        args.stateDir,
        args.expectedCommit,
        args.identity,
        freshCensus.baselineCount,
        {
          censusReceiptSha256: args.receiptSha256,
          onStateTransition(state): void {
            cleanupAuthority = state;
          },
          async beforeFirstWrite(): Promise<string> {
            let indexNameInUse = freshCensus.acceptableIndexName;
            if (indexNameInUse === null) {
              try {
                await db.createUniqueCompoundIndex();
              } catch {
                throw new RelayHoldError('HOLD_INDEX_CREATE_FAILED');
              }
            }
            let readback: readonly IndexDescription[];
            try {
              readback = await db.listWorkoutEventIndexes();
            } catch {
              throw new RelayHoldError('HOLD_INDEX_READBACK');
            }
            const classification = classifyWorkoutEventIndexes(readback, true);
            if (classification.acceptableIndexName === null) {
              throw new RelayHoldError('HOLD_INDEX_READBACK');
            }
            indexNameInUse = classification.acceptableIndexName;
            indexSetFingerprintSha256 = computeIndexSetFingerprintSha256(readback);
            confirmedIndexNameSha256 = sha256Hex(indexNameInUse);
            out.write('INDEX_NAME_SHA256=' + confirmedIndexNameSha256);
            return indexSetFingerprintSha256;
          },
        },
      );
      contentionSuccessCount = contentionOutcome.contentionSuccessCount;
      contentionCollisionCount = contentionOutcome.contentionCollisionCount;
      crossUserProven = contentionOutcome.crossUserProven;
      immutabilityProven = contentionOutcome.immutabilityProven;
    } catch (caught) {
      holdCode = sanitizeToHoldCode(caught, 'HOLD_CONTENTION_UNEXPECTED');
    } finally {
      const authority: RunState | null = cleanupAuthority;
      if (authority !== null) {
        try {
          cleanupOutcome = await runCleanupFromAuthority(
            { db, fs, out },
            runStatePath,
            authority,
            args.expectedCommit,
            args.identity,
          );
          baselineRestored = cleanupOutcome.result === 'PASS';
          if (cleanupOutcome.result !== 'PASS') {
            holdCode = 'HOLD_CLEANUP';
          }
        } catch {
          cleanupOutcome = null;
          baselineRestored = false;
          holdCode = 'HOLD_CLEANUP';
        }
      }
    }

    if (cleanupAuthority !== null && cleanupOutcome === null) {
      holdCode = 'HOLD_CLEANUP';
    }
    if (holdCode === null && cleanupOutcome?.result !== 'PASS') {
      holdCode = 'HOLD_CLEANUP';
    }
    if (cleanupAuthority === null && holdCode === null) {
      // Reaching this point without durable authority means the write gate never opened.
      holdCode = 'HOLD_STATE_CORRUPT';
    }
    /* cleanup is intentionally complete before the run lock is released */
  } catch (caught) {
    holdCode = sanitizeToHoldCode(caught, 'HOLD_UNEXPECTED');
  } finally {
    if (lockAcquired) {
      try {
        await fs.unlink(lockPath);
      } catch {
        holdCode = 'HOLD_STATE_CORRUPT';
      }
    }
  }

  const result: 'PASS' | 'HOLD' = holdCode === null ? 'PASS' : 'HOLD';
  const finalReceipt: FinalReceipt = Object.freeze({
    receiptVersion: 'workout-event-atlas-relay-final/2',
    generatedAtIso: clock.now().toISOString(),
    expectedCommit: args.expectedCommit.toLowerCase(),
    targetFingerprintSha256: args.identity.targetFingerprintSha256.toLowerCase(),
    result,
    holdCode,
    confirmedIndexNameSha256,
    indexSetFingerprintSha256,
    baselineRestored,
    contentionSuccessCount,
    contentionCollisionCount,
    crossUserProven,
    immutabilityProven,
    cleanupResult: cleanupOutcome?.result ?? null,
    precommittedCount: cleanupOutcome?.precommittedCount ?? null,
    confirmedReturnedCount: cleanupOutcome?.confirmedReturnedCount ?? null,
    observedCount: cleanupOutcome?.observedCount ?? null,
    deletedCount: cleanupOutcome?.deletedCount ?? null,
    precommittedIdsSha256: cleanupOutcome?.precommittedIdsSha256 ?? null,
    confirmedReturnedIdsSha256: cleanupOutcome?.confirmedReturnedIdsSha256 ?? null,
    observedIdsSha256: cleanupOutcome?.observedIdsSha256 ?? null,
    deletedIdsSha256: cleanupOutcome?.deletedIdsSha256 ?? null,
  });

  const finalReceiptPath = path.join(args.stateDir, 'final-receipt.json');
  let finalReceiptSha256: string | null = null;
  try {
    finalReceiptSha256 = await durablePersist(fs, finalReceiptPath, finalReceipt);
  } catch (caught) {
    if (holdCode === null) {
      holdCode = sanitizeToHoldCode(caught, 'HOLD_STATE_CORRUPT');
    }
  }

  const finalResult: 'PASS' | 'HOLD' = finalReceiptSha256 === null ? 'HOLD' : result;
  out.write(finalResult === 'PASS' ? 'RELAY_RESULT=PASS' : 'RELAY_RESULT=HOLD:' + (holdCode ?? 'HOLD_UNEXPECTED'));
  if (finalReceiptSha256 !== null) {
    out.write('FINAL_RECEIPT_SHA256=' + finalReceiptSha256);
    out.write('FINAL_RECEIPT_PATH=' + finalReceiptPath);
  }

  return Object.freeze({
    result: finalResult,
    holdCode: finalResult === 'PASS' ? null : (holdCode ?? 'HOLD_UNEXPECTED'),
    finalReceiptPath: finalReceiptSha256 === null ? null : finalReceiptPath,
    finalReceiptSha256,
  });
}

export type CleanupArgs = Readonly<{
  expectedCommit: string;
  identity: RelayIdentity;
  runStatePath: string;
  confirmExactCandidateIds: boolean;
}>;

export async function runCleanupCommand(
  ports: Pick<RelayPorts, 'db' | 'fs' | 'git' | 'out'>,
  args: CleanupArgs,
): Promise<CleanupOutcome> {
  const { db, fs, git, out } = ports;
  const lockPath = path.join(path.dirname(args.runStatePath), 'apply.lock');
  let lockAcquired = false;
  try {
    if (!args.confirmExactCandidateIds) {
      throw new RelayHoldError('HOLD_MISSING_CONFIRMATION');
    }
    await verifyCleanExactCommit(git, args.expectedCommit);
    if (args.identity.databaseName !== RELAY_TARGET_DATABASE_NAME) {
      throw new RelayHoldError('HOLD_TARGET_MISMATCH');
    }
    const lockContents = canonicalStringify({ cleanup: true, expectedCommit: args.expectedCommit });
    if (!(await fs.createExclusive(lockPath, lockContents))) {
      throw new RelayHoldError('HOLD_LOCK_STALE');
    }
    lockAcquired = true;
    if ((await fs.readFile(lockPath)) !== lockContents) {
      throw new RelayHoldError('HOLD_STATE_CORRUPT');
    }
    const result = await runCleanup({ db, fs, out }, args.runStatePath, args.expectedCommit, args.identity);
    await fs.unlink(lockPath);
    lockAcquired = false;
    out.write(result.result === 'PASS' ? 'RELAY_RESULT=PASS' : 'RELAY_RESULT=HOLD_CLEANUP');
    return result;
  } catch (caught) {
    const holdCode = sanitizeToHoldCode(caught, 'HOLD_UNEXPECTED');
    if (lockAcquired) {
      try {
        await fs.unlink(lockPath);
        lockAcquired = false;
      } catch {
        // A stale lock is intentionally left visible; recovery must be explicit.
      }
    }
    out.write('RELAY_RESULT=HOLD:' + holdCode);
    return Object.freeze({
      result: 'HOLD_CLEANUP',
      holdCode,
      precommittedCount: 0,
      confirmedReturnedCount: 0,
      observedCount: 0,
      deletedCount: 0,
      precommittedIdsSha256: sha256Hex(''),
      confirmedReturnedIdsSha256: sha256Hex(''),
      observedIdsSha256: sha256Hex(''),
      deletedIdsSha256: sha256Hex(''),
    });
  }
}

import type { PrismaClient as PrismaClientType, Prisma as PrismaNamespaceType } from '@prisma/client';
import { readFile as nodeReadFile, rename as nodeRename, unlink as nodeUnlink, open as nodeOpen, lstat as nodeLstat, realpath as nodeRealpath } from 'node:fs/promises';
import { randomBytes as nodeRandomBytes } from 'node:crypto';

const toIndexDescription = (raw: Record<string, unknown>): IndexDescription => {
  const allowedKeys = new Set([
    'name',
    'key',
    'v',
    'ns',
    'unique',
    'sparse',
    'partialFilterExpression',
    'expireAfterSeconds',
    'hidden',
    'collation',
  ]);
  if (
    Object.keys(raw).some((key) => !allowedKeys.has(key)) ||
    typeof raw.name !== 'string' ||
    raw.name.length === 0 ||
    raw.key === null ||
    typeof raw.key !== 'object' ||
    Array.isArray(raw.key) ||
    (raw.unique !== undefined && typeof raw.unique !== 'boolean') ||
    (raw.sparse !== undefined && typeof raw.sparse !== 'boolean') ||
    (raw.hidden !== undefined && typeof raw.hidden !== 'boolean') ||
    (raw.v !== undefined && (!Number.isSafeInteger(raw.v) || (raw.v as number) < 0)) ||
    (raw.ns !== undefined && typeof raw.ns !== 'string')
  ) {
    throw new Error('relay-invalid-index-description');
  }
  const entries = Object.entries(raw.key as Record<string, unknown>);
  if (entries.length === 0 || entries.some(([, direction]) => direction !== 1 && direction !== -1)) {
    throw new Error('relay-invalid-index-description');
  }
  const key: IndexKeyEntry[] = entries.map(([field, direction]) => [field, direction as 1 | -1]);
  return Object.freeze({
    name: raw.name,
    key: Object.freeze(key),
    unique: raw.unique === true,
    uniqueSpecified: raw.unique !== undefined,
    sparse: raw.sparse === true,
    sparseSpecified: raw.sparse !== undefined,
    hasPartialFilter: raw.partialFilterExpression !== undefined,
    hasExpireAfterSeconds: raw.expireAfterSeconds !== undefined,
    hidden: raw.hidden === true,
    hiddenSpecified: raw.hidden !== undefined,
    hasCollation: raw.collation !== undefined,
    serverIndexVersion: raw.v === undefined ? null : (raw.v as number),
    namespace: raw.ns === undefined ? null : (raw.ns as string),
    background: null,
  });
};

export const buildPrismaDatabasePort = (
  prisma: PrismaClientType,
  PrismaNamespace: typeof PrismaNamespaceType,
): AtlasDatabasePort => {
  const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const runCommand = async (command: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const rawResult = (await prisma.$runCommandRaw(
      command as PrismaNamespaceType.InputJsonObject,
    )) as unknown;
    if (!isPlainRecord(rawResult)) {
      throw new Error('relay-invalid-command-response');
    }
    const result = rawResult as Record<string, unknown>;
    if (
      typeof result.ok !== 'number' ||
      result.ok !== 1 ||
      result.writeErrors !== undefined ||
      result.writeConcernError !== undefined
    ) {
      throw new Error('relay-invalid-command-response');
    }
    return result;
  };

  const requireFirstBatch = (result: Record<string, unknown>): ReadonlyArray<Record<string, unknown>> => {
    const cursor = result.cursor;
    if (
      !isPlainRecord(cursor) ||
      typeof (cursor as Record<string, unknown>).id !== 'number' ||
      (cursor as Record<string, unknown>).id !== 0 ||
      !Array.isArray((cursor as Record<string, unknown>).firstBatch)
    ) {
      throw new Error('relay-invalid-command-response');
    }
    const firstBatch = (cursor as Record<string, unknown>).firstBatch as unknown[];
    if (firstBatch.some((entry) => !isPlainRecord(entry))) {
      throw new Error('relay-invalid-command-response');
    }
    return firstBatch as ReadonlyArray<Record<string, unknown>>;
  };

  const readAggregateCount = (result: Record<string, unknown>): number => {
    const firstBatch = requireFirstBatch(result);
    if (firstBatch.length === 0) return 0;
    if (firstBatch.length !== 1) throw new Error('relay-invalid-command-response');
    const total = firstBatch[0]?.total;
    if (!Number.isSafeInteger(total) || (total as number) < 0) {
      throw new Error('relay-invalid-command-response');
    }
    return total as number;
  };

  return Object.freeze({
    async listCollectionNames(): Promise<readonly string[]> {
      const result = await runCommand({ listCollections: 1, filter: { name: RELAY_COLLECTION_NAME }, nameOnly: true });
      const firstBatch = requireFirstBatch(result);
      if (
        firstBatch.length > 1 ||
        firstBatch.some((entry) => entry.name !== RELAY_COLLECTION_NAME)
      ) {
        throw new Error('relay-invalid-command-response');
      }
      return Object.freeze(firstBatch.map((entry) => entry.name as string));
    },

    async countWorkoutEvents(): Promise<number> {
      const result = await runCommand({ count: RELAY_COLLECTION_NAME });
      if (!Number.isSafeInteger(result.n) || (result.n as number) < 0) {
        throw new Error('relay-invalid-command-response');
      }
      return result.n as number;
    },

    async listWorkoutEventIndexes(): Promise<readonly IndexDescription[]> {
      const result = await runCommand({ listIndexes: RELAY_COLLECTION_NAME });
      const firstBatch = requireFirstBatch(result);
      return Object.freeze(firstBatch.map(toIndexDescription));
    },

    async countDuplicateIdentityGroups(): Promise<number> {
      const result = await runCommand({
        aggregate: RELAY_COLLECTION_NAME,
        pipeline: [
          { $group: { _id: { userId: '$userId', eventId: '$eventId' }, matchCount: { $sum: 1 } } },
          { $match: { matchCount: { $gt: 1 } } },
          { $count: 'total' },
        ],
        cursor: {},
      });
      return readAggregateCount(result);
    },

    async countMalformedIdentityDocuments(): Promise<number> {
      const result = await runCommand({
        aggregate: RELAY_COLLECTION_NAME,
        pipeline: [
          {
            $match: {
              $or: [
                { userId: { $exists: false } },
                { eventId: { $exists: false } },
                { userId: null },
                { eventId: null },
                { userId: { $not: { $type: 'objectId' } } },
                { eventId: { $not: { $type: 'string' } } },
              ],
            },
          },
          { $count: 'total' },
        ],
        cursor: {},
      });
      return readAggregateCount(result);
    },

    async createUniqueCompoundIndex(): Promise<void> {
      const result = await runCommand({
        createIndexes: RELAY_COLLECTION_NAME,
        indexes: [
          {
            key: { userId: 1, eventId: 1 },
            name: RELAY_EXPECTED_INDEX_NAME,
            unique: true,
          },
        ],
      });
      if (result.ok !== 1) {
        throw new Error('relay-invalid-command-response');
      }
    },

    async findWorkoutEventById(id: string): Promise<WorkoutEventRecordSnapshot | null> {
      const record = await prisma.workoutEvent.findUnique({ where: { id } });
      if (record === null) {
        return null;
      }
      return Object.freeze({
        id: record.id,
        userId: record.userId,
        eventId: record.eventId,
        digest: record.digest,
        payload: record.payload,
        acceptedAt: record.acceptedAt.toISOString(),
      });
    },

    async findUserById(id: string): Promise<Readonly<{ id: string }> | null> {
      const record = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      return record === null ? null : Object.freeze({ id: record.id });
    },

    async createWorkoutEvent(input: CreateWorkoutEventInput): Promise<WorkoutEventRecordSnapshot> {
      try {
        const created = await prisma.workoutEvent.create({
          data: {
            id: input.id,
            userId: input.userId,
            eventId: input.eventId,
            schemaVersion: input.schemaVersion,
            digest: input.digest,
            type: input.type,
            occurredAt: input.occurredAt,
            payload: input.payload as PrismaNamespaceType.InputJsonValue,
          },
        });
        return Object.freeze({
          id: created.id,
          userId: created.userId,
          eventId: created.eventId,
          digest: created.digest,
          payload: created.payload,
          acceptedAt: created.acceptedAt.toISOString(),
        });
      } catch (caught) {
        if (
          caught instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          caught.code === 'P2002'
        ) {
          const meta = caught.meta as Readonly<{ target?: unknown }> | undefined;
          const rawTarget = meta?.target;
          const target =
            Array.isArray(rawTarget) &&
            rawTarget.length === 2 &&
            rawTarget[0] === 'userId' &&
            rawTarget[1] === 'eventId' &&
            rawTarget.every((entry) => typeof entry === 'string')
              ? Object.freeze([...rawTarget] as string[])
              : Object.freeze([] as string[]);
          throw new WorkoutEventDuplicateKeyError(Object.freeze(target));
        }
        throw caught;
      }
    },

    async deleteWorkoutEventIfExact(input: DeleteExactWorkoutEventInput): Promise<DeleteExactWorkoutEventResult> {
      const deleted = await prisma.workoutEvent.deleteMany({
        where: {
          id: input.id,
          userId: input.userId,
          eventId: input.eventId,
          digest: input.digest,
          payload: { equals: input.payload as PrismaNamespaceType.InputJsonValue },
        },
      });
      if (!Number.isSafeInteger(deleted.count) || deleted.count < 0) {
        throw new Error('relay-invalid-delete-count');
      }
      if (deleted.count === 1) return 'deleted';
      if (deleted.count !== 0) throw new Error('relay-invalid-delete-count');
      const stillPresent = await prisma.workoutEvent.findUnique({ where: { id: input.id }, select: { id: true } });
      return stillPresent === null ? 'missing' : 'mismatch';
    },
  });
};

export const buildRealFileSystemPort = (): FileSystemPort =>
  Object.freeze({
    async exists(targetPath: string): Promise<boolean> {
      try {
        const metadata = await nodeLstat(targetPath);
        if (metadata.isSymbolicLink()) {
          throw new Error('relay-symlink-state-path');
        }
        return true;
      } catch (caught) {
        if ((caught as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw caught;
      }
    },
    async readFile(targetPath: string): Promise<string> {
      if ((await nodeLstat(targetPath)).isSymbolicLink()) {
        throw new Error('relay-symlink-state-path');
      }
      return nodeReadFile(targetPath, 'utf8');
    },
    async writeFileAtomic(targetPath: string, contents: string): Promise<void> {
      const tempPath = targetPath + '.tmp-' + nodeRandomBytes(6).toString('hex');
      const handle = await nodeOpen(tempPath, 'w');
      try {
        await handle.writeFile(contents, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await nodeRename(tempPath, targetPath);
    },
    async createExclusive(targetPath: string, contents: string): Promise<boolean> {
      let handle;
      try {
        handle = await nodeOpen(targetPath, 'wx');
      } catch (caught) {
        if ((caught as NodeJS.ErrnoException).code === 'EEXIST') {
          return false;
        }
        throw caught;
      }
      try {
        await handle.writeFile(contents, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return true;
    },
    async unlink(targetPath: string): Promise<void> {
      await nodeUnlink(targetPath);
    },
  });

export const buildRealGitPort = (): GitPort =>
  Object.freeze({
    async revParseHead(): Promise<string> {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD']);
      return stdout;
    },
    async statusShort(): Promise<string> {
      const { stdout } = await execFileAsync('git', ['status', '--short']);
      return stdout;
    },
  });

export const parseFlags = (argv: readonly string[]): Readonly<Record<string, string | true>> => {
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next;
      i += 1;
    } else {
      flags[name] = true;
    }
  }
  return Object.freeze(flags);
};

const requireStringFlag = (flags: Readonly<Record<string, string | true>>, name: string): string => {
  const value = flags[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RelayHoldError('HOLD_ARGS_INVALID');
  }
  return value;
};

const readBooleanFlag = (flags: Readonly<Record<string, string | true>>, name: string): boolean => flags[name] === true;

export async function main(): Promise<void> {
  const out: OutputPort = Object.freeze({
    write(line: string): void {
      process.stdout.write(line + '\n');
    },
  });

  try {
    const argv = process.argv.slice(2);
    const mode = argv[0];
    const flags = parseFlags(argv.slice(1));
    if (mode !== 'census' && mode !== 'apply' && mode !== 'cleanup') {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }

    const expectedCommit = requireStringFlag(flags, 'expected-commit');
    const expectedTargetSha256 = requireStringFlag(flags, 'expected-target-sha256');
    const stateDir = requireStringFlag(flags, 'state-dir');
    if (!isFullCommitSha(expectedCommit) || !isTargetFingerprint(expectedTargetSha256) || !path.isAbsolute(stateDir)) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }

    const modeArgs =
      mode === 'apply'
        ? Object.freeze({
            censusReceiptPath: requireStringFlag(flags, 'census-receipt'),
            receiptSha256: requireStringFlag(flags, 'receipt-sha256'),
            confirmIndex: requireStringFlag(flags, 'confirm-index'),
          })
        : mode === 'cleanup'
          ? Object.freeze({
              runStatePath: requireStringFlag(flags, 'run-state'),
              confirmExactCandidateIds: readBooleanFlag(flags, 'confirm-exact-candidate-ids'),
            })
          : null;

    if (modeArgs !== null && 'receiptSha256' in modeArgs && !isTargetFingerprint(modeArgs.receiptSha256)) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }
    if (modeArgs !== null && 'runStatePath' in modeArgs) {
      const resolvedStateDir = path.resolve(stateDir);
      const resolvedRunState = path.resolve(modeArgs.runStatePath);
      if (path.dirname(resolvedRunState) !== resolvedStateDir) {
        throw new RelayHoldError('HOLD_ARGS_INVALID');
      }
    }

    const stateDirMetadata = await nodeLstat(stateDir);
    if (stateDirMetadata.isSymbolicLink() || !stateDirMetadata.isDirectory()) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }
    const canonicalStateDir = await nodeRealpath(stateDir);
    if (path.resolve(canonicalStateDir).toLowerCase() !== path.resolve(stateDir).toLowerCase()) {
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    }
    if (modeArgs !== null && 'censusReceiptPath' in modeArgs) {
      if ((await nodeLstat(modeArgs.censusReceiptPath)).isSymbolicLink()) {
        throw new RelayHoldError('HOLD_ARGS_INVALID');
      }
      const canonicalReceiptPath = await nodeRealpath(modeArgs.censusReceiptPath);
      if (
        path.basename(canonicalReceiptPath) !== 'census-receipt.json' ||
        path.dirname(canonicalReceiptPath).toLowerCase() !== canonicalStateDir.toLowerCase()
      ) {
        throw new RelayHoldError('HOLD_ARGS_INVALID');
      }
    }
    if (modeArgs !== null && 'runStatePath' in modeArgs) {
      if ((await nodeLstat(modeArgs.runStatePath)).isSymbolicLink()) {
        throw new RelayHoldError('HOLD_ARGS_INVALID');
      }
      const canonicalRunStatePath = await nodeRealpath(modeArgs.runStatePath);
      if (
        path.basename(canonicalRunStatePath) !== 'run-state.json' ||
        path.dirname(canonicalRunStatePath).toLowerCase() !== canonicalStateDir.toLowerCase()
      ) {
        throw new RelayHoldError('HOLD_ARGS_INVALID');
      }
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
      throw new RelayHoldError('HOLD_NO_DATABASE_ENV');
    }
    const identity = resolveRelayIdentityFromDatabaseUrl(databaseUrl, expectedTargetSha256);

    const git = buildRealGitPort();
    await verifyCleanExactCommit(git, expectedCommit);

    const { PrismaClient, Prisma } = await import('@prisma/client');
    const prisma = new PrismaClient({ log: [] });
    try {
      const ports: RelayPorts = Object.freeze({
        db: buildPrismaDatabasePort(prisma, Prisma),
        fs: buildRealFileSystemPort(),
        clock: Object.freeze({ now: () => new Date() }),
        random: Object.freeze({ randomHex: (byteLength: number) => nodeRandomBytes(byteLength).toString('hex') }),
        git,
        out,
      });

      if (mode === 'census') {
        const outcome = await runCensus(ports, { expectedCommit, identity, stateDir });
        process.exitCode = outcome.gate === 'PASS' ? 0 : 1;
        return;
      }
      if (mode === 'apply' && modeArgs !== null && 'censusReceiptPath' in modeArgs) {
        const outcome = await runApply(ports, {
          expectedCommit,
          identity,
          stateDir,
          censusReceiptPath: modeArgs.censusReceiptPath,
          receiptSha256: modeArgs.receiptSha256,
          confirmIndex: modeArgs.confirmIndex,
        });
        process.exitCode = outcome.result === 'PASS' ? 0 : 1;
        return;
      }
      if (mode === 'cleanup' && modeArgs !== null && 'runStatePath' in modeArgs) {
        const outcome = await runCleanupCommand(ports, {
          expectedCommit,
          identity,
          runStatePath: modeArgs.runStatePath,
          confirmExactCandidateIds: modeArgs.confirmExactCandidateIds,
        });
        process.exitCode = outcome.result === 'PASS' ? 0 : 1;
        return;
      }
      throw new RelayHoldError('HOLD_ARGS_INVALID');
    } finally {
      // Command gates own the terminal verdict; process teardown cannot retract an already published result.
      await prisma.$disconnect().catch(() => undefined);
    }
  } catch (caught) {
    const holdCode = sanitizeToHoldCode(caught, 'HOLD_UNEXPECTED');
    out.write('RELAY_RESULT=HOLD:' + holdCode);
    process.exitCode = 1;
  }
}

const isDirectCliInvocation = (): boolean => {
  const entryArg = process.argv[1];
  return entryArg !== undefined && path.resolve(entryArg) === path.resolve(fileURLToPath(import.meta.url));
};

if (isDirectCliInvocation()) {
  void main();
}
