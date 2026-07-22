import {
  canonicalSerialize,
  fingerprintCanonical,
  type CanonicalValue,
  type Sha256Fingerprint,
} from '../../workoutFoundationContracts';

export const WORKOUT_EVENT_SCHEMA_VERSION = 'workout-event/1' as const;
export const WORKOUT_UNDO_EVENT_TYPE = 'workout.undo' as const;
export const MAX_WORKOUT_EVENT_BYTES = 64 * 1024;

export type WorkoutEventId = `wev_${string}`;
export type WorkoutReplayClassification = 'new' | 'duplicate' | 'conflict';

export type WorkoutEvent<TPayload extends CanonicalValue = CanonicalValue> = Readonly<{
  schemaVersion: typeof WORKOUT_EVENT_SCHEMA_VERSION;
  eventId: WorkoutEventId;
  accountId: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
  compensatesEventId?: WorkoutEventId;
  digest: Sha256Fingerprint;
}>;

export type CreateWorkoutEventInput<TPayload extends CanonicalValue> = Readonly<{
  accountId: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
  compensatesEventId?: WorkoutEventId;
}>;

export type CreateWorkoutEventOptions = Readonly<{
  uuidFactory?: () => string;
}>;

export type WorkoutEventErrorCode =
  | 'INVALID_EVENT'
  | 'INVALID_EVENT_ID'
  | 'INVALID_ACCOUNT_ID'
  | 'INVALID_EVENT_TYPE'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_COMPENSATION'
  | 'EVENT_TOO_LARGE'
  | 'DIGEST_MISMATCH'
  | 'ACCOUNT_PARTITION'
  | 'REPLAY_CONFLICT'
  | 'BATCH_TOO_LARGE'
  | 'UNDO_TARGET_MISSING'
  | 'UNDO_OF_UNDO'
  | 'DOUBLE_COMPENSATION';

export class WorkoutEventContractError extends Error {
  readonly name = 'WorkoutEventContractError';

  constructor(readonly code: WorkoutEventErrorCode, readonly path: string, message: string) {
    super(message);
  }
}

const eventIdPattern = /^wev_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const eventTypePattern = /^[a-z][a-z0-9._-]{0,63}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;

function fail(code: WorkoutEventErrorCode, path: string, message: string): never {
  throw new WorkoutEventContractError(code, path, message);
}

const cloneCanonical = <TValue extends CanonicalValue>(value: TValue): TValue =>
  JSON.parse(canonicalSerialize(value)) as TValue;

const assertEventByteLimit = (value: CanonicalValue): void => {
  const bytes = new TextEncoder().encode(canonicalSerialize(value)).byteLength;
  if (bytes > MAX_WORKOUT_EVENT_BYTES) {
    fail('EVENT_TOO_LARGE', '$', `Complete canonical event bytes must not exceed ${MAX_WORKOUT_EVENT_BYTES}.`);
  }
};

const freezeCanonical = <TValue extends CanonicalValue>(value: TValue): TValue => {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) freezeCanonical(nested);
    Object.freeze(value);
  }
  return value;
};

const isCanonicalTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !timestampPattern.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
};

function assertEventId(value: unknown, path: string): asserts value is WorkoutEventId {
  if (typeof value !== 'string' || !eventIdPattern.test(value)) {
    fail('INVALID_EVENT_ID', path, 'Event identity must be wev_ plus a canonical lowercase UUID.');
  }
}

const assertPreimageFields = (value: {
  schemaVersion: unknown;
  eventId: unknown;
  accountId: unknown;
  type: unknown;
  occurredAt: unknown;
  compensatesEventId?: unknown;
}): void => {
  if (value.schemaVersion !== WORKOUT_EVENT_SCHEMA_VERSION) {
    fail('INVALID_EVENT', '$.schemaVersion', `Schema version must be ${WORKOUT_EVENT_SCHEMA_VERSION}.`);
  }
  assertEventId(value.eventId, '$.eventId');
  if (typeof value.accountId !== 'string' || value.accountId.trim().length === 0 || [...value.accountId].length > 256) {
    fail('INVALID_ACCOUNT_ID', '$.accountId', 'Account identity must be nonblank and at most 256 characters.');
  }
  if (typeof value.type !== 'string' || !eventTypePattern.test(value.type)) {
    fail('INVALID_EVENT_TYPE', '$.type', 'Event type is invalid.');
  }
  if (!isCanonicalTimestamp(value.occurredAt)) {
    fail('INVALID_TIMESTAMP', '$.occurredAt', 'Event timestamp must be exact UTC ISO-8601 with milliseconds.');
  }
  if (value.compensatesEventId !== undefined) assertEventId(value.compensatesEventId, '$.compensatesEventId');
  if (value.type === WORKOUT_UNDO_EVENT_TYPE && value.compensatesEventId === undefined) {
    fail('INVALID_COMPENSATION', '$.compensatesEventId', 'Undo event must name the event it compensates.');
  }
  if (value.type !== WORKOUT_UNDO_EVENT_TYPE && value.compensatesEventId !== undefined) {
    fail('INVALID_COMPENSATION', '$.compensatesEventId', 'Only an Undo event may compensate another event.');
  }
  if (value.eventId === value.compensatesEventId) {
    fail('INVALID_COMPENSATION', '$.compensatesEventId', 'Undo event cannot compensate itself.');
  }
};

type EventPreimage<TPayload extends CanonicalValue = CanonicalValue> = Readonly<{
  schemaVersion: typeof WORKOUT_EVENT_SCHEMA_VERSION;
  eventId: WorkoutEventId;
  accountId: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
  compensatesEventId?: WorkoutEventId;
}>;

const buildPreimage = <TPayload extends CanonicalValue>(value: {
  schemaVersion: typeof WORKOUT_EVENT_SCHEMA_VERSION;
  eventId: WorkoutEventId;
  accountId: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
  compensatesEventId?: WorkoutEventId;
}): EventPreimage<TPayload> => {
  const preimage = value.compensatesEventId === undefined
    ? {
        schemaVersion: value.schemaVersion,
        eventId: value.eventId,
        accountId: value.accountId,
        type: value.type,
        occurredAt: value.occurredAt,
        payload: value.payload,
      }
    : {
        schemaVersion: value.schemaVersion,
        eventId: value.eventId,
        accountId: value.accountId,
        type: value.type,
        occurredAt: value.occurredAt,
        payload: value.payload,
        compensatesEventId: value.compensatesEventId,
      };

  const cloned = cloneCanonical(preimage as CanonicalValue) as EventPreimage<TPayload>;
  assertPreimageFields(cloned);
  assertEventByteLimit(cloned);
  return cloned;
};

const createEventId = (uuidFactory: () => string): WorkoutEventId => {
  const eventId = `wev_${uuidFactory()}`;
  assertEventId(eventId, '$.eventId');
  return eventId;
};

export const createWorkoutEvent = async <TPayload extends CanonicalValue>(
  input: CreateWorkoutEventInput<TPayload>,
  options: CreateWorkoutEventOptions = {},
): Promise<WorkoutEvent<TPayload>> => {
  const uuidFactory = options.uuidFactory ?? (() => globalThis.crypto.randomUUID());
  const preimage = buildPreimage({
    schemaVersion: WORKOUT_EVENT_SCHEMA_VERSION,
    eventId: createEventId(uuidFactory),
    accountId: input.accountId,
    type: input.type,
    occurredAt: input.occurredAt,
    payload: input.payload,
    ...(input.compensatesEventId === undefined ? {} : { compensatesEventId: input.compensatesEventId }),
  });
  const digest = await fingerprintCanonical(preimage);
  const event = { ...preimage, digest } as unknown as CanonicalValue;
  assertEventByteLimit(event);
  return freezeCanonical(event) as WorkoutEvent<TPayload>;
};

export const verifyWorkoutEvent = async (raw: unknown): Promise<WorkoutEvent> => {
  let clonedValue: CanonicalValue;
  try {
    clonedValue = cloneCanonical(raw as CanonicalValue);
  } catch (caught) {
    if (caught instanceof WorkoutEventContractError) throw caught;
    throw new WorkoutEventContractError('INVALID_EVENT', '$', 'Workout event must be canonical JSON-safe data.');
  }
  assertEventByteLimit(clonedValue);
  if (clonedValue === null || Array.isArray(clonedValue) || typeof clonedValue !== 'object') {
    fail('INVALID_EVENT', '$', 'Workout event must be an object.');
  }
  const cloned = clonedValue as Record<string, CanonicalValue>;
  const expectedKeys = cloned.compensatesEventId === undefined
    ? ['accountId', 'digest', 'eventId', 'occurredAt', 'payload', 'schemaVersion', 'type']
    : ['accountId', 'compensatesEventId', 'digest', 'eventId', 'occurredAt', 'payload', 'schemaVersion', 'type'];
  if (Object.keys(cloned).sort().join('\u0000') !== expectedKeys.join('\u0000')) {
    fail('INVALID_EVENT', '$', 'Workout event contains missing or unexpected fields.');
  }
  if (typeof cloned.digest !== 'string' || !fingerprintPattern.test(cloned.digest)) {
    fail('INVALID_EVENT', '$.digest', 'Event fingerprint must be lowercase SHA-256.');
  }
  const preimage = buildPreimage({
    schemaVersion: cloned.schemaVersion as typeof WORKOUT_EVENT_SCHEMA_VERSION,
    eventId: cloned.eventId as WorkoutEventId,
    accountId: cloned.accountId as string,
    type: cloned.type as string,
    occurredAt: cloned.occurredAt as string,
    payload: cloned.payload,
    ...(cloned.compensatesEventId === undefined ? {} : { compensatesEventId: cloned.compensatesEventId as WorkoutEventId }),
  });
  const expectedDigest = await fingerprintCanonical(preimage);
  if (cloned.digest !== expectedDigest) {
    fail('DIGEST_MISMATCH', '$.digest', 'Event content does not match its fingerprint.');
  }
  return freezeCanonical({ ...preimage, digest: expectedDigest } as unknown as CanonicalValue) as WorkoutEvent;
};

export const classifyWorkoutReplay = async (
  existing: WorkoutEvent | undefined,
  incoming: WorkoutEvent,
): Promise<WorkoutReplayClassification> => {
  const verifiedIncoming = await verifyWorkoutEvent(incoming);
  if (existing === undefined) return 'new';
  const verifiedExisting = await verifyWorkoutEvent(existing);
  if (verifiedExisting.accountId !== verifiedIncoming.accountId) {
    fail('ACCOUNT_PARTITION', '$.accountId', 'Events from different accounts cannot share a replay partition.');
  }
  if (verifiedExisting.eventId !== verifiedIncoming.eventId) return 'new';
  return verifiedExisting.digest === verifiedIncoming.digest ? 'duplicate' : 'conflict';
};

export const createUndoEvent = async <TPayload extends CanonicalValue = Record<string, never>>(
  target: WorkoutEvent,
  occurredAt: string,
  payload: TPayload = {} as TPayload,
  options: CreateWorkoutEventOptions = {},
): Promise<WorkoutEvent<TPayload>> => {
  const verifiedTarget = await verifyWorkoutEvent(target);
  if (verifiedTarget.type === WORKOUT_UNDO_EVENT_TYPE) {
    fail('INVALID_COMPENSATION', '$.compensatesEventId', 'Undo event cannot target another Undo event.');
  }
  return createWorkoutEvent({
    accountId: verifiedTarget.accountId,
    type: WORKOUT_UNDO_EVENT_TYPE,
    occurredAt,
    payload,
    compensatesEventId: verifiedTarget.eventId,
  }, options);
};
