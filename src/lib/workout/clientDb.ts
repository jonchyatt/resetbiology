import Dexie, { type DexieOptions, type Table } from 'dexie';
import {
  WorkoutEventContractError,
  classifyWorkoutReplay,
  verifyWorkoutEvent,
  type WorkoutEvent,
  type WorkoutEventId,
  type WorkoutReplayClassification,
} from './events';

export const WORKOUT_CLIENT_DB_NAME = 'ResetBiologyWorkoutEvents';
export const WORKOUT_CLIENT_DB_SCHEMA_VERSION = 1;

export type WorkoutClientDbState = 'opening' | 'ready' | 'blocked' | 'version-changed' | 'closed';
export type WorkoutClientStorageErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA'
  | 'STORAGE_BLOCKED'
  | 'STORAGE_VERSION_CHANGED'
  | 'STORAGE_CLOSED'
  | 'STORAGE_WRITE_FAILED';

export class WorkoutClientStorageError extends Error {
  readonly name = 'WorkoutClientStorageError';

  constructor(readonly code: WorkoutClientStorageErrorCode, message: string) {
    super(message);
  }
}

export type WorkoutOutboxRecord = Readonly<{
  sequence: number;
  accountId: string;
  eventId: WorkoutEventId;
  digest: WorkoutEvent['digest'];
  state: 'pending';
  event: WorkoutEvent;
}>;

export type WorkoutEventEnqueueResult = Readonly<{
  classification: Exclude<WorkoutReplayClassification, 'conflict'>;
  record: WorkoutOutboxRecord;
}>;

export type OpenWorkoutClientDbOptions = Readonly<{
  databaseName?: string;
}>;

export type WorkoutClientDb = Readonly<{
  state: WorkoutClientDbState;
  enqueueWorkoutEvent(event: WorkoutEvent): Promise<WorkoutEventEnqueueResult>;
  readWorkoutEvents(): Promise<readonly WorkoutOutboxRecord[]>;
  close(): void;
}>;

type StoredWorkoutOutboxRow = {
  sequence?: number;
  accountId: string;
  eventId: WorkoutEventId;
  digest: WorkoutEvent['digest'];
  state: 'pending';
  event: WorkoutEvent;
};

type StoredWorkoutOutboxInsert = Omit<StoredWorkoutOutboxRow, 'sequence'>;

class WorkoutClientDatabase extends Dexie {
  outboxEvents!: Table<StoredWorkoutOutboxRow, number, StoredWorkoutOutboxInsert>;

  constructor(databaseName: string, options: DexieOptions) {
    super(databaseName, options);
    this.version(WORKOUT_CLIENT_DB_SCHEMA_VERSION).stores({
      outboxEvents: '++sequence,&[accountId+eventId],[accountId+sequence]',
    });
  }
}

type Lifecycle = { state: WorkoutClientDbState };

const storageFail = (code: WorkoutClientStorageErrorCode, message: string): WorkoutClientStorageError =>
  new WorkoutClientStorageError(code, message);

const ownErrorName = (value: unknown): string | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const name = Reflect.get(value, 'name');
  return typeof name === 'string' ? name : undefined;
};

const errorNames = (value: unknown): Set<string> => {
  const names = new Set<string>();
  const seen = new Set<unknown>();
  let cursor: unknown = value;
  for (let depth = 0; depth < 5 && cursor !== null && typeof cursor === 'object' && !seen.has(cursor); depth += 1) {
    seen.add(cursor);
    const name = ownErrorName(cursor);
    if (name) names.add(name);
    cursor = Reflect.get(cursor, 'inner') ?? Reflect.get(cursor, 'cause');
  }
  return names;
};

const mapStorageError = (
  error: unknown,
  fallback: Extract<WorkoutClientStorageErrorCode, 'STORAGE_UNAVAILABLE' | 'STORAGE_WRITE_FAILED'>,
): WorkoutClientStorageError => {
  if (error instanceof WorkoutClientStorageError) return error;
  const names = errorNames(error);
  if (names.has('QuotaExceededError')) {
    return storageFail('STORAGE_QUOTA', 'Browser storage is full; the workout event was not saved.');
  }
  if (names.has('VersionError')) {
    return storageFail('STORAGE_VERSION_CHANGED', 'Workout storage changed in another page; open a fresh handle.');
  }
  if (
    names.has('SecurityError')
    || names.has('MissingAPIError')
    || names.has('NotSupportedError')
    || names.has('InvalidStateError')
  ) {
    return storageFail('STORAGE_UNAVAILABLE', 'Durable browser storage is unavailable; no workout event was saved.');
  }
  return fallback === 'STORAGE_UNAVAILABLE'
    ? storageFail(fallback, 'Durable browser storage is unavailable; no workout event was saved.')
    : storageFail(fallback, 'Browser storage rejected the workout event; it was not saved.');
};

const assertAccountId: (accountId: unknown) => asserts accountId is string = (accountId): asserts accountId is string => {
  if (typeof accountId !== 'string' || accountId.trim().length === 0 || [...accountId].length > 256) {
    throw new WorkoutEventContractError(
      'INVALID_ACCOUNT_ID',
      '$.accountId',
      'Account identity must be nonblank and at most 256 characters.',
    );
  }
};

const assertDatabaseName: (databaseName: unknown) => asserts databaseName is string = (databaseName): asserts databaseName is string => {
  if (typeof databaseName !== 'string' || databaseName.trim().length === 0 || [...databaseName].length > 256) {
    throw storageFail('STORAGE_UNAVAILABLE', 'Workout browser storage name is invalid.');
  }
};

const browserDexieOptions = (): DexieOptions => {
  const indexedDbFactory = globalThis.indexedDB;
  const keyRange = globalThis.IDBKeyRange;
  if (!indexedDbFactory || !keyRange) {
    throw storageFail('STORAGE_UNAVAILABLE', 'Durable browser storage is unavailable; no workout event was saved.');
  }
  return { indexedDB: indexedDbFactory, IDBKeyRange: keyRange };
};

const freezeRecord = (record: {
  sequence: number;
  accountId: string;
  eventId: WorkoutEventId;
  digest: WorkoutEvent['digest'];
  state: 'pending';
  event: WorkoutEvent;
}): WorkoutOutboxRecord => Object.freeze(record);

const checkedRecord = async (row: StoredWorkoutOutboxRow): Promise<WorkoutOutboxRecord> => {
  const event = await verifyWorkoutEvent(row.event);
  if (
    !Number.isSafeInteger(row.sequence)
    || (row.sequence ?? 0) <= 0
    || row.state !== 'pending'
    || row.accountId !== event.accountId
    || row.eventId !== event.eventId
    || row.digest !== event.digest
  ) {
    throw storageFail('STORAGE_WRITE_FAILED', 'Stored workout event metadata is invalid.');
  }
  return freezeRecord({
    sequence: row.sequence as number,
    accountId: row.accountId,
    eventId: row.eventId,
    digest: row.digest,
    state: row.state,
    event,
  });
};

class AccountBoundWorkoutClientDb implements WorkoutClientDb {
  #accountId: string;
  #database: WorkoutClientDatabase;
  #lifecycle: Lifecycle;
  #versionChangeHandler: (event: IDBVersionChangeEvent) => void;

  constructor(
    accountId: string,
    database: WorkoutClientDatabase,
    lifecycle: Lifecycle,
    versionChangeHandler: (event: IDBVersionChangeEvent) => void,
  ) {
    this.#accountId = accountId;
    this.#database = database;
    this.#lifecycle = lifecycle;
    this.#versionChangeHandler = versionChangeHandler;
  }

  get state(): WorkoutClientDbState {
    return this.#lifecycle.state;
  }

  #assertReady(): void {
    if (this.#lifecycle.state === 'version-changed') {
      throw storageFail('STORAGE_VERSION_CHANGED', 'Workout storage changed in another page; open a fresh handle.');
    }
    if (this.#lifecycle.state === 'blocked') {
      throw storageFail('STORAGE_BLOCKED', 'Workout storage is blocked by another page; open a fresh handle.');
    }
    if (this.#lifecycle.state !== 'ready') {
      throw storageFail('STORAGE_CLOSED', 'This workout storage handle is closed.');
    }
  }

  async #readByIdentity(eventId: WorkoutEventId): Promise<StoredWorkoutOutboxRow | undefined> {
    return this.#database.outboxEvents.where('[accountId+eventId]').equals([this.#accountId, eventId]).first();
  }

  async enqueueWorkoutEvent(event: WorkoutEvent): Promise<WorkoutEventEnqueueResult> {
    this.#assertReady();
    const verified = await verifyWorkoutEvent(event);
    if (verified.accountId !== this.#accountId) {
      throw new WorkoutEventContractError(
        'ACCOUNT_PARTITION',
        '$.accountId',
        'Workout event does not belong to this browser-storage account partition.',
      );
    }

    try {
      return await this.#database.transaction('rw!', this.#database.outboxEvents, async () => {
        this.#assertReady();
        const existing = await this.#readByIdentity(verified.eventId);
        if (existing) {
          const existingRecord = await checkedRecord(existing);
          const replay = await classifyWorkoutReplay(existingRecord.event, verified);
          if (replay === 'conflict') {
            throw new WorkoutEventContractError(
              'REPLAY_CONFLICT',
              '$.eventId',
              'Event identity was reused with different content.',
            );
          }
          return Object.freeze({ classification: 'duplicate' as const, record: existingRecord });
        }

        const sequence = await this.#database.outboxEvents.add({
          accountId: this.#accountId,
          eventId: verified.eventId,
          digest: verified.digest,
          state: 'pending',
          event: verified,
        });
        if (!Number.isSafeInteger(sequence) || sequence <= 0) {
          throw storageFail('STORAGE_WRITE_FAILED', 'Browser storage did not assign a valid append sequence.');
        }
        const record = freezeRecord({
          sequence,
          accountId: this.#accountId,
          eventId: verified.eventId,
          digest: verified.digest,
          state: 'pending',
          event: verified,
        });
        return Object.freeze({ classification: 'new' as const, record });
      });
    } catch (error) {
      if (error instanceof WorkoutEventContractError || error instanceof WorkoutClientStorageError) throw error;
      if (errorNames(error).has('ConstraintError')) {
        const winner = await this.#readByIdentity(verified.eventId).catch(() => undefined);
        if (winner) {
          const existingRecord = await checkedRecord(winner);
          const replay = await classifyWorkoutReplay(existingRecord.event, verified);
          if (replay === 'duplicate') {
            return Object.freeze({ classification: 'duplicate' as const, record: existingRecord });
          }
          throw new WorkoutEventContractError(
            'REPLAY_CONFLICT',
            '$.eventId',
            'Event identity was reused with different content.',
          );
        }
      }
      throw mapStorageError(error, 'STORAGE_WRITE_FAILED');
    }
  }

  async readWorkoutEvents(): Promise<readonly WorkoutOutboxRecord[]> {
    this.#assertReady();
    try {
      const rows = await this.#database.outboxEvents
        .where('[accountId+sequence]')
        .between([this.#accountId, Dexie.minKey], [this.#accountId, Dexie.maxKey], true, true)
        .toArray();
      const records: WorkoutOutboxRecord[] = [];
      for (const row of rows) records.push(await checkedRecord(row));
      return Object.freeze(records);
    } catch (error) {
      if (error instanceof WorkoutEventContractError || error instanceof WorkoutClientStorageError) throw error;
      throw mapStorageError(error, 'STORAGE_WRITE_FAILED');
    }
  }

  close(): void {
    if (this.#lifecycle.state === 'closed') return;
    if (this.#lifecycle.state !== 'version-changed' && this.#lifecycle.state !== 'blocked') {
      this.#lifecycle.state = 'closed';
    }
    this.#database.on.versionchange.unsubscribe(this.#versionChangeHandler);
    this.#database.close({ disableAutoOpen: true });
    this.#accountId = '';
  }
}

export const openWorkoutClientDb = async (
  accountId: string,
  options: OpenWorkoutClientDbOptions = {},
): Promise<WorkoutClientDb> => {
  assertAccountId(accountId);
  const databaseName = options.databaseName ?? WORKOUT_CLIENT_DB_NAME;
  assertDatabaseName(databaseName);

  let database: WorkoutClientDatabase;
  try {
    database = new WorkoutClientDatabase(databaseName, browserDexieOptions());
  } catch (error) {
    if (error instanceof WorkoutClientStorageError) throw error;
    throw mapStorageError(error, 'STORAGE_UNAVAILABLE');
  }

  const lifecycle: Lifecycle = { state: 'opening' };
  let rejectBlocked: (error: WorkoutClientStorageError) => void = () => undefined;
  const blocked = new Promise<never>((_resolve, reject) => {
    rejectBlocked = reject;
  });
  const blockedHandler = (): void => {
    lifecycle.state = 'blocked';
    database.close({ disableAutoOpen: true });
    rejectBlocked(storageFail('STORAGE_BLOCKED', 'Workout storage is blocked by another page; no event was saved.'));
  };
  const versionChangeHandler = (): void => {
    if (lifecycle.state === 'closed' || lifecycle.state === 'blocked') return;
    lifecycle.state = 'version-changed';
    database.close({ disableAutoOpen: true });
  };

  database.on('blocked', blockedHandler);
  database.on('versionchange', versionChangeHandler);

  try {
    const opening = database.open().catch(error => {
      if (lifecycle.state === 'blocked') return database;
      throw error;
    });
    await Promise.race([opening, blocked]);
    if (lifecycle.state === 'blocked') {
      throw storageFail('STORAGE_BLOCKED', 'Workout storage is blocked by another page; no event was saved.');
    }
    lifecycle.state = 'ready';
    database.on.blocked.unsubscribe(blockedHandler);
    return Object.freeze(new AccountBoundWorkoutClientDb(accountId, database, lifecycle, versionChangeHandler));
  } catch (error) {
    database.on.blocked.unsubscribe(blockedHandler);
    database.on.versionchange.unsubscribe(versionChangeHandler);
    database.close({ disableAutoOpen: true });
    if (error instanceof WorkoutClientStorageError) throw error;
    throw mapStorageError(error, 'STORAGE_UNAVAILABLE');
  }
};
