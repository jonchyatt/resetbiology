import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXERCISE_IDENTITY_VERSION, FOUNDATION_ENVELOPE_VERSION, WorkoutFoundationContractError, assertMovementUseEligible, canonicalSerialize,
  classifyExerciseRelationship, createExerciseIdentity, createVersionEnvelope, fingerprintCanonical, normalizeWorkoutUnit, parseVersionEnvelope,
  type MovementFoundationMetadata, type WorkoutUnit,
} from '../src/lib/workoutFoundationContracts';

const error = (code: WorkoutFoundationContractError['code'], path: string, message: string) => (caught: unknown) => {
  assert.ok(caught instanceof WorkoutFoundationContractError); assert.equal(caught.code, code); assert.equal(caught.path, path); assert.equal(caught.message, message); return true;
};
const source = { movement: 'front squat', labels: ['lower', 'strength'] } as const;
const snapshotAt = '2026-07-21T12:00:00.000Z';
const review = { reviewerId: 'reviewer-1', reviewedAt: '2026-07-21T11:00:00.000Z', sourceVersion: 'source/1' } as const;

test('canonical serialization is deterministic, NFC-aware, and hashes known vectors', async () => {
  assert.equal(canonicalSerialize({ b: 1, a: -0 }), '{"a":0,"b":1}');
  assert.equal(canonicalSerialize({ text: 'e\u0301' }), canonicalSerialize({ text: 'é' }));
  assert.notEqual(canonicalSerialize(['first', 'second']), canonicalSerialize(['second', 'first']));
  assert.equal(await fingerprintCanonical({}), 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  assert.equal(await fingerprintCanonical({ b: 1, a: 0 }), 'sha256:f4c1d8bd90d7ccd720aa5a69a67185fb9caf4f35926a4eacf53a86d0e70bdf88');
  assert.equal(canonicalSerialize({ 2: 'two', 10: 'ten', 1: 'one' }), '{"1":"one","10":"ten","2":"two"}');
  assert.equal(canonicalSerialize({ root: { 2: 2, 10: 10, 1: 1 }, items: [{ 2: 'c', 10: 'b', 1: 'a' }, { z: null, a: true }] }), '{"items":[{"1":"a","10":"b","2":"c"},{"a":true,"z":null}],"root":{"1":1,"10":10,"2":2}}');
  assert.equal(canonicalSerialize({ quote: '"', slash: '\\', control: '\b\f\n\r\t\u0000' }), '{"control":"\\b\\f\\n\\r\\t\\u0000","quote":"\\\"","slash":"\\\\"}');
  const insertedFirst = { z: { 2: 'two', 1: 'one' }, a: ['x', { b: false, a: true }] };
  const insertedSecond = { a: ['x', { a: true, b: false }], z: { 1: 'one', 2: 'two' } };
  assert.equal(canonicalSerialize(insertedFirst), canonicalSerialize(insertedSecond));
  assert.equal(await fingerprintCanonical(insertedFirst), await fingerprintCanonical(insertedSecond));
  assert.throws(() => canonicalSerialize({ 'é': 1, 'e\u0301': 2 }), error('CANONICAL_KEY_COLLISION', '$', 'Object keys collide after NFC normalization.'));
});

test('canonical validation rejects every unsupported family without getter execution', () => {
  for (const value of [undefined, 1n, () => 1, Symbol('x'), NaN, Infinity, new Date(), new (class Value {})()]) {
    assert.throws(() => canonicalSerialize(value as never), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.'));
  }
  const circular: { self?: unknown } = {}; circular.self = circular;
  assert.throws(() => canonicalSerialize(circular as never), error('CIRCULAR_REFERENCE', '$.self', 'Canonical value must not contain circular references.'));
  let accessed = false; const accessor = {}; Object.defineProperty(accessor, 'x', { enumerable: true, get: () => { accessed = true; return 1; } });
  assert.throws(() => canonicalSerialize(accessor as never), error('INVALID_CANONICAL_VALUE', '$.x', 'Canonical value must be JSON-safe.')); assert.equal(accessed, false);
  const sparse = new Array(1); assert.throws(() => canonicalSerialize(sparse), error('INVALID_CANONICAL_VALUE', '$[0]', 'Canonical value must be JSON-safe.'));
  const arrayAccessor: unknown[] = [1]; accessed = false; Object.defineProperty(arrayAccessor, '0', { enumerable: true, get: () => { accessed = true; return 1; } });
  assert.throws(() => canonicalSerialize({ items: arrayAccessor }), error('INVALID_CANONICAL_VALUE', '$.items[0]', 'Canonical value must be JSON-safe.')); assert.equal(accessed, false);
  const arrayExtra: unknown[] = []; Object.defineProperty(arrayExtra, 'extra', { enumerable: true, value: 1 });
  assert.throws(() => canonicalSerialize(arrayExtra), error('INVALID_CANONICAL_VALUE', '$.extra', 'Canonical value must be JSON-safe.'));
  const hiddenArrayExtra: unknown[] = []; Object.defineProperty(hiddenArrayExtra, 'extra', { enumerable: false, value: 1 });
  assert.throws(() => canonicalSerialize(hiddenArrayExtra), error('INVALID_CANONICAL_VALUE', '$.extra', 'Canonical value must be JSON-safe.'));
  const symbolValue = {}; Object.defineProperty(symbolValue, Symbol('hidden'), { value: 1 });
  assert.throws(() => canonicalSerialize(symbolValue as never), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.'));
});

test('canonical cloning preserves dangerous own keys without prototype pollution', async () => {
  const dangerous = JSON.parse('{"__proto__":1,"constructor":{"kind":"own"},"prototype":["kept"]}') as Record<string, unknown>;
  assert.equal(canonicalSerialize(dangerous), '{"__proto__":1,"constructor":{"kind":"own"},"prototype":["kept"]}');
  assert.notEqual(await fingerprintCanonical(dangerous), await fingerprintCanonical({}));
  const before = (Object.prototype as Record<string, unknown>).polluted;
  const envelope = await createVersionEnvelope({ entityType: 'exercise', sourceId: 'dangerous', sourceContent: source, adapterVersion: '1.2.0', ruleVersion: 'rule/1', snapshotAt, payload: dangerous });
  const cloned = envelope.payload as Record<string, unknown>;
  assert.deepEqual(Object.keys(cloned).sort(), ['__proto__', 'constructor', 'prototype']);
  assert.equal(Object.prototype.hasOwnProperty.call(cloned, '__proto__'), true);
  assert.equal(cloned.__proto__, 1);
  assert.equal((cloned.constructor as Record<string, unknown>).kind, 'own');
  assert.deepEqual(cloned.prototype, ['kept']);
  assert.equal((Object.prototype as Record<string, unknown>).polluted, before);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('canonical traversal enforces array-index and deterministic DoS ceilings', async () => {
  let depth: unknown = null;
  for (let index = 0; index < 64; index += 1) depth = [depth];
  assert.doesNotThrow(() => canonicalSerialize(depth as never));
  assert.throws(() => canonicalSerialize([depth] as never), error('INVALID_CANONICAL_VALUE', `$${'[0]'.repeat(64)}`, 'Canonical value must be JSON-safe.'));
  const atArrayLimit = Array.from({ length: 10_000 }, () => 0); assert.doesNotThrow(() => canonicalSerialize(atArrayLimit));
  let accessed = false; const hostileLength = new Array(10_001); Object.defineProperty(hostileLength, '0', { enumerable: true, get: () => { accessed = true; return 0; } });
  assert.throws(() => canonicalSerialize(hostileLength), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.')); assert.equal(accessed, false);
  for (const [key, path] of [['01', '$["01"]'], ['0001', '$["0001"]'], ['-1', '$["-1"]'], ['4294967295', '$["4294967295"]'], ['4294967296', '$["4294967296"]'], ['+1', '$["+1"]'], ['1.0', '$["1.0"]'], ['1e0', '$["1e0"]'], ['named', '$.named']] as const) {
    const array: unknown[] = []; Object.defineProperty(array, key, { enumerable: false, value: 1 });
    assert.throws(() => canonicalSerialize(array), error('INVALID_CANONICAL_VALUE', path, 'Canonical value must be JSON-safe.'));
  }
  const textAtLimit = 'x'.repeat(1_048_576); assert.doesNotThrow(() => canonicalSerialize(textAtLimit));
  assert.throws(() => canonicalSerialize(`${textAtLimit}x`), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.'));
  const keyAtLimit = 'k'.repeat(1_048_576); const keyBoundary = {} as Record<string, unknown>; Object.defineProperty(keyBoundary, keyAtLimit, { enumerable: true, value: 0 }); assert.doesNotThrow(() => canonicalSerialize(keyBoundary));
  const keyOverLimit = 'k'.repeat(1_048_577); const keyOverflow = {} as Record<string, unknown>; Object.defineProperty(keyOverflow, keyOverLimit, { enumerable: true, value: 0 });
  assert.throws(() => canonicalSerialize(keyOverflow), (caught: unknown) => { assert.ok(caught instanceof WorkoutFoundationContractError); assert.equal(caught.code, 'INVALID_CANONICAL_VALUE'); assert.equal(caught.message, 'Canonical value must be JSON-safe.'); assert.equal(caught.path.length, 1_048_579); assert.ok(caught.path.startsWith('$.')); assert.ok(caught.path.endsWith('k')); return true; });
  const maxOutput = [...Array.from({ length: 7 }, () => 'x'.repeat(1_048_573)), 'x'.repeat(1_048_572)]; assert.equal(new TextEncoder().encode(canonicalSerialize(maxOutput)).byteLength, 8_388_608);
  assert.throws(() => canonicalSerialize([...Array.from({ length: 7 }, () => 'x'.repeat(1_048_573)), 'x'.repeat(1_048_573)]), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.'));
  const dataAtLimit = Object.fromEntries(Array.from({ length: 100_000 }, (_, index) => [`k${index}`, 0])); assert.doesNotThrow(() => canonicalSerialize(dataAtLimit));
  const dataOverLimit = { ...dataAtLimit, overflow: 0 }; assert.throws(() => canonicalSerialize(dataOverLimit), error('INVALID_CANONICAL_VALUE', '$.overflow', 'Canonical value must be JSON-safe.'));
  const cloneOverLimit = { payload: `${textAtLimit}x` }; await assert.rejects(() => createVersionEnvelope({ entityType: 'exercise', sourceId: 'limits', sourceContent: source, adapterVersion: '1.2.0', ruleVersion: 'r', snapshotAt, payload: cloneOverLimit } as never), error('INVALID_CANONICAL_VALUE', '$.payload', 'Canonical value must be JSON-safe.'));
  const valid = await createVersionEnvelope({ entityType: 'exercise', sourceId: 'limits', sourceContent: source, adapterVersion: '1.2.0', ruleVersion: 'r', snapshotAt, payload: {} });
  await assert.rejects(() => parseVersionEnvelope({ ...valid, payload: cloneOverLimit }, source), error('INVALID_CANONICAL_VALUE', '$.payload', 'Canonical value must be JSON-safe.'));
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'); let digestCalls = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: async () => { digestCalls += 1; return new ArrayBuffer(32); } } } });
  try { await assert.rejects(() => fingerprintCanonical(`${textAtLimit}x`), error('INVALID_CANONICAL_VALUE', '$', 'Canonical value must be JSON-safe.')); assert.equal(digestCalls, 0); }
  finally { if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor); else delete (globalThis as { crypto?: Crypto }).crypto; }
});

test('hidden data participates equally in canonical bytes, cloning, and freezing', async () => {
  const hiddenArray: unknown[] = [];
  const hiddenItem = { nested: ['kept'] } as Record<string, unknown>;
  Object.defineProperty(hiddenItem, '__proto__', { configurable: true, enumerable: true, value: 'array-own', writable: true });
  Object.defineProperty(hiddenArray, '0', { configurable: true, enumerable: false, value: hiddenItem, writable: true });
  hiddenArray.length = 1;
  const payload = { visible: 'visible' } as Record<string, unknown>;
  Object.defineProperty(payload, 'hidden', { configurable: true, enumerable: false, value: { array: hiddenArray, constructor: { nested: true }, prototype: ['own'] }, writable: true });
  assert.equal(canonicalSerialize(payload), '{"hidden":{"array":[{"__proto__":"array-own","nested":["kept"]}],"constructor":{"nested":true},"prototype":["own"]},"visible":"visible"}');
  const changed = { visible: 'visible' } as Record<string, unknown>;
  Object.defineProperty(changed, 'hidden', { enumerable: false, value: { array: ['changed'], constructor: { nested: true }, prototype: ['own'] } });
  assert.notEqual(await fingerprintCanonical(payload), await fingerprintCanonical(changed));
  const envelope = await createVersionEnvelope({ entityType: 'exercise', sourceId: 'hidden', sourceContent: source, adapterVersion: '1.2.0', ruleVersion: 'rule/1', snapshotAt, payload });
  const cloned = envelope.payload as Record<string, unknown>;
  const hidden = Object.getOwnPropertyDescriptor(cloned, 'hidden')?.value as Record<string, unknown>;
  const clonedArray = hidden.array as unknown[];
  assert.equal(Object.getOwnPropertyDescriptor(cloned, 'hidden')?.enumerable, false);
  assert.equal(Object.getOwnPropertyDescriptor(clonedArray, '0')?.enumerable, false);
  assert.ok(Object.isFrozen(cloned)); assert.ok(Object.isFrozen(hidden)); assert.ok(Object.isFrozen(clonedArray)); assert.ok(Object.isFrozen(clonedArray[0]));
  (hiddenArray[0] as Record<string, unknown>).nested = ['mutated'];
  assert.deepEqual((clonedArray[0] as Record<string, unknown>).nested, ['kept']);
  const parsed = await parseVersionEnvelope<typeof payload>(envelope, source);
  const parsedHidden = Object.getOwnPropertyDescriptor(parsed.payload as Record<string, unknown>, 'hidden')?.value as Record<string, unknown>;
  assert.ok(Object.isFrozen(parsedHidden)); assert.ok(Object.isFrozen(parsedHidden.array));
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  const hiddenCycle = {} as Record<string, unknown>; Object.defineProperty(hiddenCycle, 'hidden', { enumerable: false, value: hiddenCycle });
  assert.throws(() => canonicalSerialize(hiddenCycle), error('CIRCULAR_REFERENCE', '$.hidden', 'Canonical value must not contain circular references.'));
  const hiddenCollision = {} as Record<string, unknown>; Object.defineProperty(hiddenCollision, 'é', { enumerable: false, value: 1 }); Object.defineProperty(hiddenCollision, 'e\u0301', { enumerable: false, value: 2 });
  assert.throws(() => canonicalSerialize(hiddenCollision), error('CANONICAL_KEY_COLLISION', '$', 'Object keys collide after NFC normalization.'));
  let accessed = false; const nestedGetter = { nested: {} as Record<string, unknown> }; Object.defineProperty(nestedGetter.nested, 'hidden', { enumerable: false, get: () => { accessed = true; return 1; } });
  assert.throws(() => canonicalSerialize(nestedGetter), error('INVALID_CANONICAL_VALUE', '$.nested.hidden', 'Canonical value must be JSON-safe.')); assert.equal(accessed, false);
});

test('fingerprinting fails closed when native Web Crypto is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    await assert.rejects(() => fingerprintCanonical({}), error('CRYPTO_UNAVAILABLE', '$', 'SHA-256 Web Crypto is unavailable.'));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete (globalThis as { crypto?: Crypto }).crypto;
  }
});

test('unit aliases are explicit, idempotent, and ambiguous values reject', () => {
  const official: WorkoutUnit[] = ['repetition', 'second', 'minute', 'meter', 'kilometer', 'mile', 'kilogram', 'pound', 'watt', 'rpm', 'bpm', 'rpe', 'rir', 'percent_1rm', 'percent_mvc', 'percent_max_heart_rate', 'heart_rate_zone', 'bodyweight', 'celsius', 'fahrenheit', 'millimeter_mercury'];
  official.forEach(unit => assert.equal(normalizeWorkoutUnit(unit), unit));
  const aliases: Record<string, WorkoutUnit> = {
    rep: 'repetition', reps: 'repetition', repetition: 'repetition', repetitions: 'repetition', sec: 'second', secs: 'second', second: 'second', seconds: 'second',
    min: 'minute', mins: 'minute', minute: 'minute', minutes: 'minute', meter: 'meter', meters: 'meter', metre: 'meter', metres: 'meter',
    km: 'kilometer', kilometer: 'kilometer', kilometers: 'kilometer', kilometre: 'kilometer', kilometres: 'kilometer', mi: 'mile', mile: 'mile', miles: 'mile',
    kg: 'kilogram', kgs: 'kilogram', kilogram: 'kilogram', kilograms: 'kilogram', lb: 'pound', lbs: 'pound', pound: 'pound', pounds: 'pound',
    watt: 'watt', watts: 'watt', '%1rm': 'percent_1rm', 'percent 1rm': 'percent_1rm', percent_1rm: 'percent_1rm', '%mvc': 'percent_mvc', 'percent mvc': 'percent_mvc', percent_mvc: 'percent_mvc',
    '%mhr': 'percent_max_heart_rate', '%maxhr': 'percent_max_heart_rate', 'percent max heart rate': 'percent_max_heart_rate', percent_max_heart_rate: 'percent_max_heart_rate',
    c: 'celsius', '°c': 'celsius', celsius: 'celsius', f: 'fahrenheit', '°f': 'fahrenheit', fahrenheit: 'fahrenheit', mmhg: 'millimeter_mercury', 'millimeter mercury': 'millimeter_mercury', millimeter_mercury: 'millimeter_mercury',
  };
  Object.entries(aliases).forEach(([raw, unit]) => assert.equal(normalizeWorkoutUnit(` ${raw} `), unit));
  ['m', 's', 'w', '%', 'bw', 'zone', 'unknown'].forEach(raw => assert.throws(() => normalizeWorkoutUnit(raw), error('UNKNOWN_UNIT', '$.units[0]', 'Workout unit is unsupported or ambiguous.')));
});

test('identity collision matrix preserves stable identity while raw source content remains opaque', async () => {
  const base = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: ' Front  Squat ', equipmentKeys: ['rack', 'barbell'], units: ['reps', 'kg'] });
  const formatting = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: [' BARBELL ', 'rack'], units: ['kilogram', 'repetition'] });
  const variant = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: 'pause squat', equipmentKeys: ['rack', 'barbell'], units: ['reps', 'kg'] });
  const equipment = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['kettlebell'], units: ['reps', 'kg'] });
  const sourceId = await createExerciseIdentity({ sourceExerciseId: 'EX-2', variantKey: 'front squat', equipmentKeys: ['rack', 'barbell'], units: ['reps', 'kg'] });
  const unit = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['rack', 'barbell'], units: ['reps', 'lb'] });
  assert.equal(base.fingerprint, formatting.fingerprint); assert.notEqual(base.fingerprint, variant.fingerprint); assert.notEqual(base.fingerprint, equipment.fingerprint); assert.notEqual(base.fingerprint, sourceId.fingerprint); assert.notEqual(base.fingerprint, unit.fingerprint);
  const normalizedSource = { sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['barbell', 'rack'], units: ['kilogram', 'repetition'] };
  const reorderedNormalizedSource = { sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['barbell', 'rack'], units: ['kilogram', 'repetition'] };
  const contentA = await fingerprintCanonical({ ...normalizedSource, label: 'Front Squat', note: 'one' });
  const contentB = await fingerprintCanonical({ ...normalizedSource, label: 'Front squat', note: 'one' });
  const contentC = await fingerprintCanonical({ ...normalizedSource, label: 'Front Squat', note: 'two' });
  const rawAlias = await fingerprintCanonical({ ...normalizedSource, unit: 'kg' });
  const rawCanonical = await fingerprintCanonical({ ...normalizedSource, unit: 'kilogram' });
  assert.equal(await fingerprintCanonical(normalizedSource), await fingerprintCanonical(reorderedNormalizedSource));
  assert.notEqual(rawAlias, rawCanonical);
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: contentA }, { identity: formatting, sourceContentFingerprint: contentA }), 'exact');
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: contentA }, { identity: formatting, sourceContentFingerprint: contentB }), 'same-identity-new-content');
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: contentA }, { identity: formatting, sourceContentFingerprint: contentC }), 'same-identity-new-content');
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: contentA }, { identity: variant, sourceContentFingerprint: contentB }), 'different');
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: rawAlias }, { identity: formatting, sourceContentFingerprint: rawCanonical }), 'same-identity-new-content');
  assert.equal(classifyExerciseRelationship({ identity: base, sourceContentFingerprint: contentA }, { identity: equipment, sourceContentFingerprint: contentA }), 'different');
  for (const [input, path] of [
    [{ sourceExerciseId: '', variantKey: 'x', equipmentKeys: [], units: ['rep'] }, '$.sourceExerciseId'],
    [{ sourceExerciseId: 'x', variantKey: '', equipmentKeys: [], units: ['rep'] }, '$.variantKey'],
    [{ sourceExerciseId: 'x', variantKey: 'x', equipmentKeys: undefined, units: ['rep'] }, '$.equipmentKeys'],
    [{ sourceExerciseId: 'x', variantKey: 'x', equipmentKeys: [], units: undefined }, '$.units'],
  ] as const) {
    await assert.rejects(() => createExerciseIdentity(input as never), error('INVALID_IDENTITY', path, 'Exercise identity metadata is incomplete or invalid.'));
  }
  await assert.rejects(() => createExerciseIdentity({ sourceExerciseId: 'x', variantKey: 'x', equipmentKeys: [], units: ['m'] }), error('UNKNOWN_UNIT', '$.units[0]', 'Workout unit is unsupported or ambiguous.'));
});

test('version envelopes are source-bound, immutable clones, and reject exact malformed states', async () => {
  const payload = { nested: { values: [1, 2] } }; const mutableReview = { ...review };
  const input = { entityType: 'exercise' as const, sourceId: 'ex-1', sourceContent: source, adapterVersion: '1.2.0' as const, ruleVersion: 'rule/1', snapshotAt, review: mutableReview, payload };
  const envelope = await createVersionEnvelope(input);
  assert.equal(envelope.envelopeVersion, FOUNDATION_ENVELOPE_VERSION); assert.ok(Object.isFrozen(envelope)); assert.ok(Object.isFrozen(envelope.payload.nested)); assert.ok(Object.isFrozen(envelope.review));
  payload.nested.values.push(3); mutableReview.reviewerId = 'changed'; assert.deepEqual(envelope.payload.nested.values, [1, 2]); assert.equal(envelope.review?.reviewerId, review.reviewerId);
  const raw = JSON.parse(JSON.stringify(envelope)); const parsed = await parseVersionEnvelope<typeof payload>(raw, source); raw.payload.nested.values.push(4); assert.notEqual(parsed.payload, envelope.payload); assert.ok(Object.isFrozen(parsed.payload.nested.values)); assert.deepEqual(parsed.payload.nested.values, [1, 2]);
  for (const fingerprint of ['sha256:ABC', 'sha256:abc', `sha256:${'a'.repeat(65)}`]) {
    await assert.rejects(() => parseVersionEnvelope({ ...envelope, sourceContentFingerprint: fingerprint }, source), error('INVALID_FINGERPRINT', '$.sourceContentFingerprint', 'Fingerprint must use lowercase sha256:<64 hex> format.'));
  }
  await assert.rejects(() => parseVersionEnvelope(envelope, { ...source, labels: ['other'] }), error('SOURCE_FINGERPRINT_MISMATCH', '$.sourceContentFingerprint', 'Source-content fingerprint does not match.'));
  for (const [rawEnvelope, code, path, message] of [
    [{ ...envelope, envelopeVersion: 'wrong' }, 'INVALID_ENVELOPE', '$.envelopeVersion', 'Version envelope is incomplete or invalid.'],
    [{ ...envelope, entityType: 'other' }, 'INVALID_ENVELOPE', '$.entityType', 'Version envelope is incomplete or invalid.'],
    [{ ...envelope, sourceId: ' ' }, 'INVALID_ENVELOPE', '$.sourceId', 'Version envelope is incomplete or invalid.'],
    [{ ...envelope, ruleVersion: ' ' }, 'INVALID_ENVELOPE', '$.ruleVersion', 'Version envelope is incomplete or invalid.'],
    [{ ...envelope, adapterVersion: '1.1.0' }, 'UNSUPPORTED_ADAPTER_VERSION', '$.adapterVersion', 'Adapter version must be 1.2.0.'],
    [{ ...envelope, snapshotAt: '2026-02-30T12:00:00.000Z' }, 'INVALID_TIMESTAMP', '$.snapshotAt', 'Timestamp must be canonical UTC ISO-8601 with milliseconds.'],
    [{ ...envelope, snapshotAt: '2026-07-21T12:00:00Z' }, 'INVALID_TIMESTAMP', '$.snapshotAt', 'Timestamp must be canonical UTC ISO-8601 with milliseconds.'],
  ] as const) await assert.rejects(() => parseVersionEnvelope(rawEnvelope, source), error(code, path, message));
  const withoutPayload = { ...envelope }; delete (withoutPayload as { payload?: unknown }).payload;
  await assert.rejects(() => parseVersionEnvelope(withoutPayload, source), error('INVALID_ENVELOPE', '$.payload', 'Version envelope is incomplete or invalid.'));
  for (const [reviewPatch, path] of [[{ reviewerId: '' }, '$.review.reviewerId'], [{ sourceVersion: '' }, '$.review.sourceVersion'], [{ reviewedAt: 'not-a-time' }, '$.review.reviewedAt'], [{ reviewedAt: '2026-07-21T12:00:00.001Z' }, '$.review.reviewedAt']] as const) {
    await assert.rejects(() => createVersionEnvelope({ ...input, review: { ...review, ...reviewPatch }, payload: {} }), error('INVALID_PROVENANCE', path, 'Review provenance is incomplete, invalid, or later than the snapshot.'));
  }
  await assert.rejects(() => createVersionEnvelope({ ...input, sourceContent: { invalid: undefined }, payload: {} } as never), error('INVALID_CANONICAL_VALUE', '$.invalid', 'Canonical value must be JSON-safe.'));
  await assert.rejects(() => createVersionEnvelope({ ...input, payload: { invalid: undefined } } as never), error('INVALID_CANONICAL_VALUE', '$.invalid', 'Canonical value must be JSON-safe.'));
  let accessed = false; const accessorRaw = { ...envelope }; Object.defineProperty(accessorRaw, 'sourceId', { enumerable: true, get: () => { accessed = true; return 'x'; } });
  await assert.rejects(() => parseVersionEnvelope(accessorRaw, source), error('INVALID_ENVELOPE', '$.sourceId', 'Version envelope is incomplete or invalid.')); assert.equal(accessed, false);
  accessed = false; const reviewAccessor = { ...envelope, review: { ...review } }; Object.defineProperty(reviewAccessor.review, 'reviewedAt', { enumerable: true, get: () => { accessed = true; return snapshotAt; } });
  await assert.rejects(() => parseVersionEnvelope(reviewAccessor, source), error('INVALID_PROVENANCE', '$.review.reviewedAt', 'Review provenance is incomplete, invalid, or later than the snapshot.')); assert.equal(accessed, false);
  accessed = false; const createAccessor = { ...input }; Object.defineProperty(createAccessor, 'entityType', { enumerable: true, get: () => { accessed = true; return 'exercise'; } });
  await assert.rejects(() => createVersionEnvelope(createAccessor as never), error('INVALID_ENVELOPE', '$.entityType', 'Version envelope is incomplete or invalid.')); assert.equal(accessed, false);
});

test('movement-use gates fail closed in deterministic order', async () => {
  const identity = await createExerciseIdentity({ sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['barbell'], units: ['repetition'] });
  const metadata: MovementFoundationMetadata = { identity, sourceExerciseId: 'EX-1', variantKey: 'front squat', equipmentKeys: ['barbell'], units: ['repetition'], movementPatternKey: 'squat', programRoleKey: 'primary', primaryMuscleIds: ['quadriceps'], supportingMuscleIds: [], skillDemandKey: 'high', jointDemandKeys: ['knee'], contraindications: { status: 'documented', items: [] }, stoppingRules: { status: 'documented', items: [] }, reviewedMediaCueVersion: 'cue/1', review };
  await assert.doesNotReject(() => assertMovementUseEligible(metadata, 'performance-comparison')); await assert.doesNotReject(() => assertMovementUseEligible(metadata, 'substitution'));
  for (const [patch, path] of [
    [{ units: [] }, '$.units'], [{ movementPatternKey: '' }, '$.movementPatternKey'], [{ programRoleKey: '' }, '$.programRoleKey'], [{ primaryMuscleIds: [] }, '$.primaryMuscleIds'],
    [{ supportingMuscleIds: undefined }, '$.supportingMuscleIds'], [{ skillDemandKey: '' }, '$.skillDemandKey'], [{ jointDemandKeys: undefined }, '$.jointDemandKeys'], [{ reviewedMediaCueVersion: '' }, '$.reviewedMediaCueVersion'],
    [{ review: { ...review, reviewerId: '' } }, '$.review.reviewerId'], [{ review: { ...review, sourceVersion: '' } }, '$.review.sourceVersion'], [{ review: { ...review, reviewedAt: 'not-a-time' } }, '$.review.reviewedAt'],
  ] as const) await assert.rejects(() => assertMovementUseEligible({ ...metadata, ...patch } as never, 'performance-comparison'), error('MOVEMENT_USE_INELIGIBLE', path, 'Movement metadata is not eligible for the requested use.'));
  await assert.rejects(() => assertMovementUseEligible({ ...metadata, contraindications: { status: 'unknown', items: [] } }, 'substitution'), error('MOVEMENT_USE_INELIGIBLE', '$.contraindications', 'Movement metadata is not eligible for the requested use.'));
  await assert.rejects(() => assertMovementUseEligible({ ...metadata, stoppingRules: { status: 'unknown', items: [] } }, 'substitution'), error('MOVEMENT_USE_INELIGIBLE', '$.stoppingRules', 'Movement metadata is not eligible for the requested use.'));
  await assert.rejects(() => assertMovementUseEligible({ ...metadata, identity: { ...metadata.identity, version: 'wrong' } } as never, 'performance-comparison'), error('MOVEMENT_USE_INELIGIBLE', '$.identity.version', 'Movement metadata is not eligible for the requested use.'));
  await assert.rejects(() => assertMovementUseEligible({ ...metadata, identity: { ...metadata.identity, version: EXERCISE_IDENTITY_VERSION, canonicalKey: '{}' } }, 'performance-comparison'), error('MOVEMENT_USE_INELIGIBLE', '$.identity.canonicalKey', 'Movement metadata is not eligible for the requested use.'));
  const forgedIdentity = { ...metadata.identity, fingerprint: `sha256:${'0'.repeat(64)}` as const };
  // Relationship classification trusts supplied identifiers; eligibility independently authenticates them asynchronously.
  assert.equal(classifyExerciseRelationship({ identity: forgedIdentity, sourceContentFingerprint: metadata.identity.fingerprint }, { identity: forgedIdentity, sourceContentFingerprint: metadata.identity.fingerprint }), 'exact');
  await assert.rejects(() => assertMovementUseEligible({ ...metadata, identity: forgedIdentity }, 'performance-comparison'), error('MOVEMENT_USE_INELIGIBLE', '$.identity.fingerprint', 'Movement metadata is not eligible for the requested use.'));
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'); Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try { await assert.rejects(() => assertMovementUseEligible(metadata, 'performance-comparison'), error('CRYPTO_UNAVAILABLE', '$', 'SHA-256 Web Crypto is unavailable.')); }
  finally { if (cryptoDescriptor) Object.defineProperty(globalThis, 'crypto', cryptoDescriptor); else delete (globalThis as { crypto?: Crypto }).crypto; }
});
