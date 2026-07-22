export const EXERCISE_IDENTITY_VERSION = 'exercise-identity/1' as const;
export const FOUNDATION_ENVELOPE_VERSION = 'workout-foundation-envelope/1' as const;

export type CanonicalValue = null | boolean | string | number | readonly CanonicalValue[] | { readonly [key: string]: CanonicalValue };
export type Sha256Fingerprint = `sha256:${string}`;
export type WorkoutUnit =
  | 'repetition' | 'second' | 'minute' | 'meter' | 'kilometer' | 'mile' | 'kilogram' | 'pound' | 'watt' | 'rpm' | 'bpm' | 'rpe' | 'rir'
  | 'percent_1rm' | 'percent_mvc' | 'percent_max_heart_rate' | 'heart_rate_zone' | 'bodyweight' | 'celsius' | 'fahrenheit' | 'millimeter_mercury';

export interface ExerciseIdentity { readonly version: typeof EXERCISE_IDENTITY_VERSION; readonly fingerprint: Sha256Fingerprint; readonly canonicalKey: string; }
export interface ReviewProvenance { readonly reviewerId: string; readonly reviewedAt: string; readonly sourceVersion: string; }
export interface ReviewedList { readonly status: 'documented' | 'unknown'; readonly items: readonly string[]; }
export interface MovementFoundationMetadata {
  readonly identity: ExerciseIdentity; readonly sourceExerciseId: string; readonly variantKey: string; readonly equipmentKeys: readonly string[];
  readonly units: readonly WorkoutUnit[]; readonly movementPatternKey: string; readonly programRoleKey: string; readonly primaryMuscleIds: readonly string[];
  readonly supportingMuscleIds: readonly string[]; readonly skillDemandKey: string; readonly jointDemandKeys: readonly string[];
  readonly contraindications: ReviewedList; readonly stoppingRules: ReviewedList; readonly reviewedMediaCueVersion: string; readonly review: ReviewProvenance;
}
export interface VersionEnvelope<T extends CanonicalValue> {
  readonly envelopeVersion: typeof FOUNDATION_ENVELOPE_VERSION; readonly entityType: 'protocol' | 'assignment-plan' | 'rule' | 'exercise';
  readonly sourceId: string; readonly sourceContentFingerprint: Sha256Fingerprint; readonly adapterVersion: '1.2.0'; readonly ruleVersion: string;
  readonly snapshotAt: string; readonly review?: ReviewProvenance; readonly payload: T;
}

export type WorkoutFoundationErrorCode =
  | 'INVALID_CANONICAL_VALUE' | 'CANONICAL_KEY_COLLISION' | 'CIRCULAR_REFERENCE' | 'CRYPTO_UNAVAILABLE' | 'INVALID_FINGERPRINT'
  | 'INVALID_IDENTITY' | 'UNKNOWN_UNIT' | 'INVALID_ENVELOPE' | 'UNSUPPORTED_ADAPTER_VERSION' | 'INVALID_TIMESTAMP'
  | 'SOURCE_FINGERPRINT_MISMATCH' | 'INVALID_PROVENANCE' | 'MOVEMENT_USE_INELIGIBLE';

export class WorkoutFoundationContractError extends Error {
  readonly name = 'WorkoutFoundationContractError';
  constructor(readonly code: WorkoutFoundationErrorCode, readonly path: string, message: string) { super(message); }
}

const MESSAGE = {
  canonical: 'Canonical value must be JSON-safe.', collision: 'Object keys collide after NFC normalization.', circular: 'Canonical value must not contain circular references.',
  crypto: 'SHA-256 Web Crypto is unavailable.', fingerprint: 'Fingerprint must use lowercase sha256:<64 hex> format.', identity: 'Exercise identity metadata is incomplete or invalid.',
  unit: 'Workout unit is unsupported or ambiguous.', envelope: 'Version envelope is incomplete or invalid.', adapter: 'Adapter version must be 1.2.0.',
  timestamp: 'Timestamp must be canonical UTC ISO-8601 with milliseconds.', mismatch: 'Source-content fingerprint does not match.',
  provenance: 'Review provenance is incomplete, invalid, or later than the snapshot.', eligible: 'Movement metadata is not eligible for the requested use.',
} as const;
const fail = (code: WorkoutFoundationErrorCode, path: string, message: string): never => { throw new WorkoutFoundationContractError(code, path, message); };
const nonBlank = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const collapse = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ').normalize('NFC');
const fingerprintPattern = /^sha256:[0-9a-f]{64}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isTimestamp = (value: unknown) => typeof value === 'string' && timestampPattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const objectPath = (parent: string, key: string) => /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;

const MAX_DEPTH = 64;
const MAX_ARRAY_LENGTH = 10_000;
const MAX_DATA_ITEMS = 100_000;
const MAX_TEXT_BYTES = 1_048_576;
const MAX_OUTPUT_BYTES = 8_388_608;
const encoder = new TextEncoder();
type CanonicalEntry = Readonly<{ key: string; value: unknown; enumerable: boolean }>;
class CanonicalWriter {
  private readonly chunks: string[] | undefined;
  private bytes = 0;
  constructor(capture: boolean) { this.chunks = capture ? [] : undefined; }
  append(value: string, path: string): void {
    this.bytes += encoder.encode(value).byteLength;
    if (this.bytes > MAX_OUTPUT_BYTES) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
    this.chunks?.push(value);
  }
  output(): string { return this.chunks?.join('') ?? ''; }
}
type TraversalState = { readonly active: Set<object>; readonly writer: CanonicalWriter; dataItems: number; depth: number };
const addDataItem = (state: TraversalState, path: string): void => {
  state.dataItems += 1;
  if (state.dataItems > MAX_DATA_ITEMS) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
};
const normalizedText = (value: string, path: string): string => {
  const normalized = value.normalize('NFC');
  if (encoder.encode(normalized).byteLength > MAX_TEXT_BYTES) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  return normalized;
};
const isArrayIndexKey = (key: string): boolean => {
  if (key === '0') return true;
  if (!/^[1-9]\d*$/.test(key)) return false;
  const number = Number(key);
  return Number.isInteger(number) && number >= 0 && number <= 4_294_967_294 && String(number) === key;
};
const canonicalObjectEntries = (record: Record<string, unknown>, path: string, state: TraversalState): readonly CanonicalEntry[] => {
  if (Object.getOwnPropertySymbols(record).length > 0) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  const normalized = new Map<string, CanonicalEntry>();
  for (const key of Object.getOwnPropertyNames(record)) {
    const keyPath = objectPath(path, key);
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CANONICAL_VALUE', keyPath, MESSAGE.canonical);
    addDataItem(state, keyPath);
    const dataDescriptor = descriptor as PropertyDescriptor & { value: unknown };
    const normalizedKey = normalizedText(key, keyPath);
    if (normalized.has(normalizedKey)) fail('CANONICAL_KEY_COLLISION', path, MESSAGE.collision);
    normalized.set(normalizedKey, { enumerable: Boolean(dataDescriptor.enumerable), key: normalizedKey, value: dataDescriptor.value });
  }
  return [...normalized.values()].sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
};
const arrayEntries = (array: unknown[], path: string, state: TraversalState): readonly CanonicalEntry[] => {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(array, 'length');
  if (!lengthDescriptor || !('value' in lengthDescriptor) || typeof lengthDescriptor.value !== 'number') fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  const length = (lengthDescriptor as PropertyDescriptor & { value: number }).value;
  if (length > MAX_ARRAY_LENGTH) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  if (Object.getOwnPropertySymbols(array).length > 0) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  const entries: CanonicalEntry[] = [];
  for (const key of Object.getOwnPropertyNames(array)) {
    if (key === 'length') continue;
    const itemPath = isArrayIndexKey(key) ? `${path}[${key}]` : objectPath(path, key);
    const descriptor = Object.getOwnPropertyDescriptor(array, key);
    if (!descriptor || !('value' in descriptor)) fail('INVALID_CANONICAL_VALUE', itemPath, MESSAGE.canonical);
    if (!isArrayIndexKey(key) || Number(key) >= length) fail('INVALID_CANONICAL_VALUE', itemPath, MESSAGE.canonical);
    addDataItem(state, itemPath);
    entries.push({ enumerable: Boolean((descriptor as PropertyDescriptor & { value: unknown }).enumerable), key, value: (descriptor as PropertyDescriptor & { value: unknown }).value });
  }
  if (entries.length !== length) {
    for (let index = 0; index < length; index += 1) if (!Object.prototype.hasOwnProperty.call(array, String(index))) fail('INVALID_CANONICAL_VALUE', `${path}[${index}]`, MESSAGE.canonical);
  }
  return entries.sort((left, right) => Number(left.key) - Number(right.key));
};
const canonicalize = (value: unknown, path: string, state: TraversalState): CanonicalValue => {
  if (value === null) { state.writer.append('null', path); return null; }
  if (typeof value === 'boolean') { state.writer.append(value ? 'true' : 'false', path); return value; }
  if (typeof value === 'string') { const normalized = normalizedText(value, path); state.writer.append(JSON.stringify(normalized), path); return normalized; }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
    const normalized = Object.is(value, -0) ? 0 : value;
    state.writer.append(JSON.stringify(normalized), path);
    return normalized;
  }
  if (!value || typeof value !== 'object') fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  const candidate = value as object;
  if (state.active.has(candidate)) fail('CIRCULAR_REFERENCE', path, MESSAGE.circular);
  state.depth += 1;
  if (state.depth > MAX_DEPTH) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
  state.active.add(candidate);
  try {
    if (Array.isArray(value)) {
      const entries = arrayEntries(value as unknown[], path, state);
      state.writer.append('[', path);
      const result = new Array<CanonicalValue>(entries.length);
      entries.forEach(({ enumerable, key, value: child }, index) => {
        if (index > 0) state.writer.append(',', path);
        Object.defineProperty(result, key, { configurable: true, enumerable, value: canonicalize(child, `${path}[${key}]`, state), writable: true });
      });
      state.writer.append(']', path);
      return result;
    }
    if (!isPlainRecord(value)) fail('INVALID_CANONICAL_VALUE', path, MESSAGE.canonical);
    const entries = canonicalObjectEntries(value as Record<string, unknown>, path, state);
    state.writer.append('{', path);
    const result = Object.create(null) as Record<string, CanonicalValue>;
    entries.forEach(({ key, value: child, enumerable }, index) => {
      if (index > 0) state.writer.append(',', path);
      state.writer.append(JSON.stringify(key), objectPath(path, key)); state.writer.append(':', path);
      Object.defineProperty(result, key, { configurable: true, enumerable, value: canonicalize(child, objectPath(path, key), state), writable: true });
    });
    state.writer.append('}', path);
    return result;
  } finally { state.active.delete(candidate); state.depth -= 1; }
};
const traverse = <T extends CanonicalValue>(value: T, capture: boolean): { readonly clone: T; readonly output: string } => {
  const writer = new CanonicalWriter(capture);
  return { clone: canonicalize(value, '$', { active: new Set(), dataItems: 0, depth: 0, writer }) as T, output: writer.output() };
};
export const canonicalSerialize = (value: CanonicalValue): string => traverse(value, true).output;
const cloneFreeze = <T extends CanonicalValue>(value: T): T => {
  const freeze = (candidate: CanonicalValue): CanonicalValue => {
    if (candidate && typeof candidate === 'object') for (const key of Object.getOwnPropertyNames(candidate)) {
      if (Array.isArray(candidate) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (!descriptor || !('value' in descriptor)) fail('INVALID_CANONICAL_VALUE', '$', MESSAGE.canonical);
      freeze((descriptor as PropertyDescriptor & { value: CanonicalValue }).value);
    }
    return Object.freeze(candidate);
  };
  return freeze(traverse(value, false).clone) as T;
};

export const fingerprintCanonical = async (value: CanonicalValue): Promise<Sha256Fingerprint> => {
  const serialized = canonicalSerialize(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('CRYPTO_UNAVAILABLE', '$', MESSAGE.crypto);
  const bytes = new TextEncoder().encode(serialized);
  const digest = await subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

const aliases: Readonly<Record<string, WorkoutUnit>> = {
  repetition: 'repetition', rep: 'repetition', reps: 'repetition', repetitions: 'repetition', second: 'second', sec: 'second', secs: 'second', seconds: 'second',
  minute: 'minute', min: 'minute', mins: 'minute', minutes: 'minute', meter: 'meter', meters: 'meter', metre: 'meter', metres: 'meter', kilometer: 'kilometer', km: 'kilometer', kilometers: 'kilometer', kilometre: 'kilometer', kilometres: 'kilometer',
  mile: 'mile', mi: 'mile', miles: 'mile', kilogram: 'kilogram', kg: 'kilogram', kgs: 'kilogram', kilograms: 'kilogram', pound: 'pound', lb: 'pound', lbs: 'pound', pounds: 'pound',
  watt: 'watt', watts: 'watt', rpm: 'rpm', bpm: 'bpm', rpe: 'rpe', rir: 'rir', percent_1rm: 'percent_1rm', '%1rm': 'percent_1rm', 'percent 1rm': 'percent_1rm',
  percent_mvc: 'percent_mvc', '%mvc': 'percent_mvc', 'percent mvc': 'percent_mvc', percent_max_heart_rate: 'percent_max_heart_rate', '%mhr': 'percent_max_heart_rate', '%maxhr': 'percent_max_heart_rate', 'percent max heart rate': 'percent_max_heart_rate',
  heart_rate_zone: 'heart_rate_zone', bodyweight: 'bodyweight', celsius: 'celsius', c: 'celsius', '°c': 'celsius', fahrenheit: 'fahrenheit', f: 'fahrenheit', '°f': 'fahrenheit',
  millimeter_mercury: 'millimeter_mercury', mmhg: 'millimeter_mercury', 'millimeter mercury': 'millimeter_mercury',
};
export const normalizeWorkoutUnit = (raw: string): WorkoutUnit => {
  const unit = typeof raw === 'string' ? aliases[collapse(raw)] : undefined;
  return unit ?? fail('UNKNOWN_UNIT', '$.units[0]', MESSAGE.unit);
};

type IdentityInput = { sourceExerciseId: string; variantKey: string; equipmentKeys: readonly string[]; units: readonly string[]; };
const identityPreimage = (input: IdentityInput, errorCode: 'INVALID_IDENTITY' | 'MOVEMENT_USE_INELIGIBLE' = 'INVALID_IDENTITY', base = '$') => {
  const invalid = (path: string): never => fail(errorCode, path, errorCode === 'INVALID_IDENTITY' ? MESSAGE.identity : MESSAGE.eligible);
  if (!nonBlank(input?.sourceExerciseId)) invalid(`${base}.sourceExerciseId`);
  if (!nonBlank(input?.variantKey)) invalid(`${base}.variantKey`);
  if (!Array.isArray(input?.equipmentKeys)) invalid(`${base}.equipmentKeys`);
  if (!Array.isArray(input?.units) || input.units.length === 0) invalid(`${base}.units`);
  const equipmentKeys = input.equipmentKeys.map((key, index) => {
    if (!nonBlank(key)) invalid(`${base}.equipmentKeys[${index}]`);
    return collapse(key);
  });
  const units = input.units.map((unit, index) => {
    try { return normalizeWorkoutUnit(unit); }
    catch (error) {
      if (error instanceof WorkoutFoundationContractError && error.code === 'UNKNOWN_UNIT') {
        if (errorCode === 'INVALID_IDENTITY') fail('UNKNOWN_UNIT', `${base}.units[${index}]`, MESSAGE.unit);
        fail('MOVEMENT_USE_INELIGIBLE', `${base}.units[${index}]`, MESSAGE.eligible);
      }
      throw error;
    }
  });
  return { version: EXERCISE_IDENTITY_VERSION, sourceExerciseId: input.sourceExerciseId.trim(), variantKey: collapse(input.variantKey), equipmentKeys: [...new Set(equipmentKeys)].sort(), units: [...new Set(units)].sort() } as const;
};
export const createExerciseIdentity = async (input: IdentityInput): Promise<ExerciseIdentity> => {
  const preimage = identityPreimage(input);
  return Object.freeze({ version: EXERCISE_IDENTITY_VERSION, canonicalKey: canonicalSerialize(preimage), fingerprint: await fingerprintCanonical(preimage) });
};

const validateFingerprint = (value: unknown, path: string) => { if (typeof value !== 'string' || !fingerprintPattern.test(value)) fail('INVALID_FINGERPRINT', path, MESSAGE.fingerprint); return value as Sha256Fingerprint; };
const ownData = (record: Record<string, unknown>, key: string, path: string, code: 'INVALID_ENVELOPE' | 'INVALID_PROVENANCE', message: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) fail(code, path, message);
  return descriptor.value;
};
const validateProvenance = (value: unknown, path: string, snapshotAt?: string): ReviewProvenance => {
  if (!isPlainRecord(value)) fail('INVALID_PROVENANCE', `${path}.reviewerId`, MESSAGE.provenance);
  const record = value as Record<string, unknown>;
  const reviewerId = ownData(record, 'reviewerId', `${path}.reviewerId`, 'INVALID_PROVENANCE', MESSAGE.provenance);
  if (!nonBlank(reviewerId)) fail('INVALID_PROVENANCE', `${path}.reviewerId`, MESSAGE.provenance);
  const reviewedAt = ownData(record, 'reviewedAt', `${path}.reviewedAt`, 'INVALID_PROVENANCE', MESSAGE.provenance);
  if (!isTimestamp(reviewedAt)) fail('INVALID_PROVENANCE', `${path}.reviewedAt`, MESSAGE.provenance);
  const sourceVersion = ownData(record, 'sourceVersion', `${path}.sourceVersion`, 'INVALID_PROVENANCE', MESSAGE.provenance);
  if (!nonBlank(sourceVersion)) fail('INVALID_PROVENANCE', `${path}.sourceVersion`, MESSAGE.provenance);
  if (snapshotAt && (reviewedAt as string) > snapshotAt) fail('INVALID_PROVENANCE', `${path}.reviewedAt`, MESSAGE.provenance);
  return { reviewerId: reviewerId.trim(), reviewedAt, sourceVersion: sourceVersion.trim() };
};
const validateEnvelopeFields = (input: Record<string, unknown>, path = '$', requiresEnvelopeVersion = true): Omit<VersionEnvelope<CanonicalValue>, 'sourceContentFingerprint' | 'payload'> => {
  const envelopeVersion = requiresEnvelopeVersion ? ownData(input, 'envelopeVersion', `${path}.envelopeVersion`, 'INVALID_ENVELOPE', MESSAGE.envelope) : FOUNDATION_ENVELOPE_VERSION;
  if (envelopeVersion !== FOUNDATION_ENVELOPE_VERSION) fail('INVALID_ENVELOPE', `${path}.envelopeVersion`, MESSAGE.envelope);
  const entityType = ownData(input, 'entityType', `${path}.entityType`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (!['protocol', 'assignment-plan', 'rule', 'exercise'].includes(entityType as string)) fail('INVALID_ENVELOPE', `${path}.entityType`, MESSAGE.envelope);
  const sourceId = ownData(input, 'sourceId', `${path}.sourceId`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (!nonBlank(sourceId)) fail('INVALID_ENVELOPE', `${path}.sourceId`, MESSAGE.envelope);
  const adapterVersion = ownData(input, 'adapterVersion', `${path}.adapterVersion`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (adapterVersion !== '1.2.0') fail('UNSUPPORTED_ADAPTER_VERSION', `${path}.adapterVersion`, MESSAGE.adapter);
  const ruleVersion = ownData(input, 'ruleVersion', `${path}.ruleVersion`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (!nonBlank(ruleVersion)) fail('INVALID_ENVELOPE', `${path}.ruleVersion`, MESSAGE.envelope);
  const snapshotAt = ownData(input, 'snapshotAt', `${path}.snapshotAt`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (!isTimestamp(snapshotAt)) fail('INVALID_TIMESTAMP', `${path}.snapshotAt`, MESSAGE.timestamp);
  const reviewValue = ownData(input, 'review', `${path}.review`, 'INVALID_ENVELOPE', MESSAGE.envelope);
  const review = reviewValue === undefined ? undefined : validateProvenance(reviewValue, `${path}.review`, snapshotAt as string);
  return { envelopeVersion: FOUNDATION_ENVELOPE_VERSION, entityType: entityType as VersionEnvelope<CanonicalValue>['entityType'], sourceId: sourceId.trim(), adapterVersion: '1.2.0', ruleVersion: ruleVersion.trim(), snapshotAt: snapshotAt as string, ...(review ? { review } : {}) };
};
export const createVersionEnvelope = async <T extends CanonicalValue>(input: {
  entityType: VersionEnvelope<T>['entityType']; sourceId: string; sourceContent: CanonicalValue; adapterVersion: '1.2.0'; ruleVersion: string; snapshotAt: string; review?: ReviewProvenance; payload: T;
}): Promise<VersionEnvelope<T>> => {
  if (!isPlainRecord(input)) fail('INVALID_ENVELOPE', '$', MESSAGE.envelope);
  const record = input as Record<string, unknown>;
  const fields = validateEnvelopeFields(record, '$', false);
  const sourceContent = ownData(record, 'sourceContent', '$.sourceContent', 'INVALID_ENVELOPE', MESSAGE.envelope);
  const payloadValue = ownData(record, 'payload', '$.payload', 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (sourceContent === undefined) fail('INVALID_ENVELOPE', '$.sourceContent', MESSAGE.envelope);
  if (payloadValue === undefined) fail('INVALID_ENVELOPE', '$.payload', MESSAGE.envelope);
  const sourceContentFingerprint = await fingerprintCanonical(sourceContent as CanonicalValue);
  const payload = cloneFreeze(payloadValue as T);
  const review = fields.review ? cloneFreeze(fields.review as unknown as CanonicalValue) as unknown as ReviewProvenance : undefined;
  return Object.freeze({ ...fields, sourceContentFingerprint, ...(review ? { review } : {}), payload }) as VersionEnvelope<T>;
};
export const parseVersionEnvelope = async <T extends CanonicalValue>(raw: unknown, expectedSourceContent: CanonicalValue): Promise<VersionEnvelope<T>> => {
  if (!isPlainRecord(raw)) fail('INVALID_ENVELOPE', '$', MESSAGE.envelope);
  const record = raw as Record<string, unknown>;
  const fields = validateEnvelopeFields(record);
  const sourceContentFingerprint = validateFingerprint(ownData(record, 'sourceContentFingerprint', '$.sourceContentFingerprint', 'INVALID_ENVELOPE', MESSAGE.envelope), '$.sourceContentFingerprint');
  const expected = await fingerprintCanonical(expectedSourceContent);
  if (sourceContentFingerprint !== expected) fail('SOURCE_FINGERPRINT_MISMATCH', '$.sourceContentFingerprint', MESSAGE.mismatch);
  const payloadValue = ownData(record, 'payload', '$.payload', 'INVALID_ENVELOPE', MESSAGE.envelope);
  if (payloadValue === undefined) fail('INVALID_ENVELOPE', '$.payload', MESSAGE.envelope);
  const payload = cloneFreeze(payloadValue as CanonicalValue) as T;
  const review = fields.review ? cloneFreeze(fields.review as unknown as CanonicalValue) as unknown as ReviewProvenance : undefined;
  return Object.freeze({ ...fields, sourceContentFingerprint, ...(review ? { review } : {}), payload }) as VersionEnvelope<T>;
};

/** Trusted identifier classification only; this does not authenticate eligibility. */
export const classifyExerciseRelationship = (
  left: { identity: ExerciseIdentity; sourceContentFingerprint: Sha256Fingerprint }, right: { identity: ExerciseIdentity; sourceContentFingerprint: Sha256Fingerprint },
): 'exact' | 'same-identity-new-content' | 'different' => left.identity.fingerprint !== right.identity.fingerprint ? 'different' : left.sourceContentFingerprint === right.sourceContentFingerprint ? 'exact' : 'same-identity-new-content';

const eligible = (condition: boolean, path: string): void => { if (!condition) fail('MOVEMENT_USE_INELIGIBLE', path, MESSAGE.eligible); };
const validList = (value: unknown, path: string, nonEmpty = false) => {
  eligible(Array.isArray(value), path);
  const list = value as unknown[];
  eligible(!nonEmpty || list.length > 0, path);
  list.forEach((item, index) => eligible(nonBlank(item), `${path}[${index}]`));
};
export const assertMovementUseEligible = async (metadata: MovementFoundationMetadata, use: 'performance-comparison' | 'substitution'): Promise<void> => {
  eligible(isPlainRecord(metadata), '$');
  const identity = metadata.identity;
  eligible(isPlainRecord(identity), '$.identity');
  eligible(identity.version === EXERCISE_IDENTITY_VERSION, '$.identity.version');
  eligible(typeof identity.fingerprint === 'string' && fingerprintPattern.test(identity.fingerprint), '$.identity.fingerprint');
  const preimage = identityPreimage({ sourceExerciseId: metadata.sourceExerciseId, variantKey: metadata.variantKey, equipmentKeys: metadata.equipmentKeys, units: metadata.units }, 'MOVEMENT_USE_INELIGIBLE');
  eligible(identity.canonicalKey === canonicalSerialize(preimage), '$.identity.canonicalKey');
  eligible(identity.fingerprint === await fingerprintCanonical(preimage), '$.identity.fingerprint');
  validList(metadata.equipmentKeys, '$.equipmentKeys'); validList(metadata.units, '$.units', true);
  eligible(nonBlank(metadata.movementPatternKey), '$.movementPatternKey'); eligible(nonBlank(metadata.programRoleKey), '$.programRoleKey');
  validList(metadata.primaryMuscleIds, '$.primaryMuscleIds', true); validList(metadata.supportingMuscleIds, '$.supportingMuscleIds');
  eligible(nonBlank(metadata.skillDemandKey), '$.skillDemandKey'); validList(metadata.jointDemandKeys, '$.jointDemandKeys');
  eligible(nonBlank(metadata.reviewedMediaCueVersion), '$.reviewedMediaCueVersion');
  try { validateProvenance(metadata.review, '$.review'); }
  catch (error) {
    if (error instanceof WorkoutFoundationContractError) fail('MOVEMENT_USE_INELIGIBLE', error.path, MESSAGE.eligible);
    throw error;
  }
  if (use === 'substitution') {
    for (const [name, list] of [['contraindications', metadata.contraindications], ['stoppingRules', metadata.stoppingRules]] as const) {
      eligible(isPlainRecord(list) && list.status === 'documented', `$.${name}`);
      validList(list.items, `$.${name}.items`);
    }
  }
};
