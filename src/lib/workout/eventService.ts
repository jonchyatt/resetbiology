import {
  WorkoutEventContractError,
  verifyWorkoutEvent,
  type WorkoutEvent,
  type WorkoutEventId,
} from './events';
import type { Sha256Fingerprint } from '../workoutFoundationContracts';

export type WorkoutEventStoreRecord = Readonly<{
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

export type WorkoutEventStoreCreateInput = Readonly<{
  userId: string;
  eventId: string;
  schemaVersion: string;
  digest: string;
  type: string;
  occurredAt: string;
  payload: unknown;
  compensatesEventId: string | null;
}>;

export type WorkoutEventStore = Readonly<{
  create(input: WorkoutEventStoreCreateInput): Promise<WorkoutEventStoreRecord>;
  findByIdentity(userId: string, eventId: string): Promise<WorkoutEventStoreRecord | null>;
}>;

export type WorkoutEventReceipt = Readonly<{
  receiptVersion: 'workout-event-receipt/1';
  recordId: string;
  eventId: string;
  digest: string;
  acceptedAt: string;
}>;

const WORKOUT_EVENT_RECEIPT_VERSION = 'workout-event-receipt/1' as const;

const COLLISION_TARGET = ['userId', 'eventId'] as const;

class WorkoutEventIdentityCollisionError extends Error {
  readonly name = 'WorkoutEventIdentityCollisionError';

  constructor() {
    super('Workout event identity collision.');
  }
}

export function createWorkoutEventIdentityCollisionError(target: readonly unknown[]): Error {
  const isExactTarget =
    Array.isArray(target) &&
    target.length === COLLISION_TARGET.length &&
    target.every((value, index) => value === COLLISION_TARGET[index]);
  if (!isExactTarget) {
    throw new TypeError(
      'createWorkoutEventIdentityCollisionError requires the exact ordered target ["userId", "eventId"].',
    );
  }
  return new WorkoutEventIdentityCollisionError();
}

export type WorkoutEventLedgerErrorCode = 'LEDGER_UNAVAILABLE' | 'LEDGER_INCONSISTENT' | 'LEDGER_CORRUPT';

const LEDGER_ERROR_MESSAGES: Record<WorkoutEventLedgerErrorCode, string> = {
  LEDGER_UNAVAILABLE: 'Workout event acceptance could not be confirmed.',
  LEDGER_INCONSISTENT: 'Workout event acceptance could not be reconciled.',
  LEDGER_CORRUPT: 'Stored workout event could not be verified.',
};

export class WorkoutEventLedgerError extends Error {
  readonly name = 'WorkoutEventLedgerError';
  readonly code: WorkoutEventLedgerErrorCode;

  constructor(code: WorkoutEventLedgerErrorCode) {
    const message = LEDGER_ERROR_MESSAGES[code];
    if (message === undefined) {
      throw new TypeError('WorkoutEventLedgerError requires a known ledger error code.');
    }
    super(message);
    this.code = code;
  }
}

const captureStoredEvent = (record: WorkoutEventStoreRecord): Record<string, unknown> => {
  const accountId = record.userId;
  const digest = record.digest;
  const eventId = record.eventId;
  const occurredAt = record.occurredAt;
  const payload = record.payload;
  const schemaVersion = record.schemaVersion;
  const type = record.type;
  const compensatesEventId = record.compensatesEventId;
  const reconstructed: Record<string, unknown> = {
    accountId,
    digest,
    eventId,
    occurredAt,
    payload,
    schemaVersion,
    type,
  };
  if (compensatesEventId !== null) {
    reconstructed.compensatesEventId = compensatesEventId;
  }
  return reconstructed;
};

type VerifiedStoredWorkoutEventRecord = Readonly<{
  recordId: string;
  acceptedAt: string;
  eventId: WorkoutEventId;
  digest: Sha256Fingerprint;
}>;

const normalizeReceiptId = (id: unknown): string => {
  if (typeof id !== 'string') {
    throw new Error('stored record id must be a primitive string');
  }
  if (id.trim().length === 0) {
    throw new Error('stored record id must be nonempty after trimming');
  }
  return id;
};

const normalizeReceiptAcceptedAt = (acceptedAt: unknown): string => {
  if (!(acceptedAt instanceof Date)) {
    throw new Error('stored record acceptedAt must be a real, finite Date');
  }
  const time = Date.prototype.getTime.call(acceptedAt);
  if (!Number.isFinite(time)) {
    throw new Error('stored record acceptedAt must be a real, finite Date');
  }
  return Date.prototype.toISOString.call(acceptedAt);
};

const verifyStoredWorkoutEventRecord = async (
  record: WorkoutEventStoreRecord,
): Promise<VerifiedStoredWorkoutEventRecord> => {
  try {
    const rawId = record.id;
    const rawAcceptedAt = record.acceptedAt;
    const capturedEvent = captureStoredEvent(record);
    const recordId = normalizeReceiptId(rawId);
    const acceptedAt = normalizeReceiptAcceptedAt(rawAcceptedAt);
    const event = await verifyWorkoutEvent(capturedEvent);
    return Object.freeze({
      recordId,
      acceptedAt,
      eventId: event.eventId,
      digest: event.digest,
    });
  } catch {
    throw new WorkoutEventLedgerError('LEDGER_CORRUPT');
  }
};

const buildReceipt = (snapshot: VerifiedStoredWorkoutEventRecord): WorkoutEventReceipt =>
  Object.freeze({
    receiptVersion: WORKOUT_EVENT_RECEIPT_VERSION,
    recordId: snapshot.recordId,
    eventId: snapshot.eventId,
    digest: snapshot.digest,
    acceptedAt: snapshot.acceptedAt,
  });

const verifyStoredRecordAndBuildReceipt = async (
  record: WorkoutEventStoreRecord,
  verifiedEvent: WorkoutEvent,
): Promise<WorkoutEventReceipt> => {
  const snapshot = await verifyStoredWorkoutEventRecord(record);
  if (snapshot.digest !== verifiedEvent.digest) {
    throw new WorkoutEventContractError(
      'REPLAY_CONFLICT',
      '$.digest',
      'Workout event identity was reused with changed authenticated content.',
    );
  }
  return buildReceipt(snapshot);
};

const resolveCollisionReceipt = async (
  store: WorkoutEventStore,
  trustedUserId: string,
  verifiedEvent: WorkoutEvent,
): Promise<WorkoutEventReceipt> => {
  let winner: WorkoutEventStoreRecord | null;
  try {
    winner = await store.findByIdentity(trustedUserId, verifiedEvent.eventId);
  } catch {
    throw new WorkoutEventLedgerError('LEDGER_UNAVAILABLE');
  }
  if (winner === null) {
    throw new WorkoutEventLedgerError('LEDGER_INCONSISTENT');
  }
  return verifyStoredRecordAndBuildReceipt(winner, verifiedEvent);
};

export async function acceptWorkoutEvent(
  store: WorkoutEventStore,
  trustedUserId: string,
  rawEvent: unknown,
): Promise<WorkoutEventReceipt> {
  if (typeof trustedUserId !== 'string' || trustedUserId.trim().length === 0) {
    throw new TypeError('acceptWorkoutEvent requires a trusted, nonblank authenticated user id.');
  }

  const verifiedEvent = await verifyWorkoutEvent(rawEvent);

  if (verifiedEvent.accountId !== trustedUserId) {
    throw new WorkoutEventContractError(
      'ACCOUNT_PARTITION',
      '$.accountId',
      'Events from different accounts cannot share a replay partition.',
    );
  }

  let inserted: WorkoutEventStoreRecord;
  try {
    inserted = await store.create({
      userId: trustedUserId,
      eventId: verifiedEvent.eventId,
      schemaVersion: verifiedEvent.schemaVersion,
      digest: verifiedEvent.digest,
      type: verifiedEvent.type,
      occurredAt: verifiedEvent.occurredAt,
      payload: verifiedEvent.payload,
      compensatesEventId: verifiedEvent.compensatesEventId ?? null,
    });
  } catch (caught) {
    if (caught instanceof WorkoutEventIdentityCollisionError) {
      return resolveCollisionReceipt(store, trustedUserId, verifiedEvent);
    }
    throw new WorkoutEventLedgerError('LEDGER_UNAVAILABLE');
  }

  return verifyStoredRecordAndBuildReceipt(inserted, verifiedEvent);
}
