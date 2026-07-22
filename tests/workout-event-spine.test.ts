import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_WORKOUT_EVENT_BYTES,
  WORKOUT_EVENT_SCHEMA_VERSION,
  WorkoutEventContractError,
  classifyWorkoutReplay,
  createUndoEvent,
  createWorkoutEvent,
  verifyWorkoutEvent,
  type WorkoutEvent,
  type WorkoutEventErrorCode,
} from '../src/lib/workout/events';
import { MAX_WORKOUT_EVENT_BATCH, reduceWorkoutEvents } from '../src/lib/workout/reducer';
import { canonicalSerialize, fingerprintCanonical } from '../src/lib/workoutFoundationContracts';

const UUID_1 = '00000000-0000-4000-8000-000000000001';
const UUID_2 = '00000000-0000-4000-8000-000000000002';
const UUID_3 = '00000000-0000-4000-8000-000000000003';
const AT_1 = '2026-07-22T12:00:00.000Z';
const AT_2 = '2026-07-22T12:01:00.000Z';
const AT_3 = '2026-07-22T12:02:00.000Z';

const uuid = (value: string) => ({ uuidFactory: () => value });
const error = (code: WorkoutEventErrorCode, path?: string) => (caught: unknown) => {
  assert.ok(caught instanceof WorkoutEventContractError);
  assert.equal(caught.code, code);
  if (path !== undefined) assert.equal(caught.path, path);
  return true;
};
const create = (payload: Record<string, unknown> = { value: 1 }, uuidValue = UUID_1, accountId = 'member-a', occurredAt = AT_1) =>
  createWorkoutEvent({ accountId, type: 'set.confirmed', occurredAt, payload }, uuid(uuidValue));
const mutable = (event: WorkoutEvent) => JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

test('creation uses a stable opaque identity, canonical digest, clone, and recursive freeze', async () => {
  const input = { nested: { value: 1 }, items: [{ count: 2 }] };
  const event = await createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: input }, uuid(UUID_1));

  assert.equal(event.schemaVersion, WORKOUT_EVENT_SCHEMA_VERSION);
  assert.equal(event.eventId, `wev_${UUID_1}`);
  assert.match(event.digest, /^sha256:[0-9a-f]{64}$/);
  input.nested.value = 99;
  input.items[0].count = 88;
  assert.deepEqual(event.payload, { items: [{ count: 2 }], nested: { value: 1 } });
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.payload), true);
  assert.equal(Object.isFrozen((event.payload as { nested: object }).nested), true);
  assert.equal(Object.isFrozen((event.payload as { items: readonly object[] }).items), true);
  assert.equal(Object.isFrozen((event.payload as { items: readonly object[] }).items[0]), true);
  try { (event.payload as { nested: { value: number } }).nested.value = 7; } catch { /* strict runtimes throw; loose runtimes still cannot mutate */ }
  assert.equal((event.payload as { nested: { value: number } }).nested.value, 1);
  const verified = await verifyWorkoutEvent(event);
  assert.deepEqual(verified, event, 'verification returns the same canonical value');
  assert.equal(Object.isFrozen(verified), true);
});

test('replay classification separates duplicate, conflict, new identity, and account partition', async () => {
  const original = await create({ value: 1 }, UUID_1);
  const duplicate = await create({ value: 1 }, UUID_1);
  const changed = await create({ value: 2 }, UUID_1);
  const another = await create({ value: 1 }, UUID_2);
  const otherAccount = await create({ value: 1 }, UUID_1, 'member-b');

  assert.equal(await classifyWorkoutReplay(undefined, original), 'new');
  assert.equal(await classifyWorkoutReplay(original, duplicate), 'duplicate');
  assert.equal(await classifyWorkoutReplay(original, changed), 'conflict');
  assert.equal(await classifyWorkoutReplay(original, another), 'new');
  assert.equal((await reduceWorkoutEvents([original, another])).activeEvents.length, 2);
  await assert.rejects(() => classifyWorkoutReplay(original, otherAccount), error('ACCOUNT_PARTITION', '$.accountId'));
});

test('every authenticated field mutation is rejected before use', async () => {
  const original = await create({ nested: { value: 1 } }, UUID_1);
  const mutations: Array<(value: Record<string, unknown>) => void> = [
    value => { value.eventId = `wev_${UUID_2}`; },
    value => { value.accountId = 'member-b'; },
    value => { value.type = 'set.adjusted'; },
    value => { value.occurredAt = AT_2; },
    value => { value.payload = { nested: { value: 2 } }; },
    value => { value.digest = `sha256:${'0'.repeat(64)}`; },
  ];
  for (const mutate of mutations) {
    const candidate = mutable(original);
    mutate(candidate);
    await assert.rejects(() => verifyWorkoutEvent(candidate), error('DIGEST_MISMATCH', '$.digest'));
  }

  const undo = await createUndoEvent(original, AT_2, {}, uuid(UUID_2));
  const changedTarget = mutable(undo);
  changedTarget.compensatesEventId = `wev_${UUID_3}`;
  await assert.rejects(() => verifyWorkoutEvent(changedTarget), error('DIGEST_MISMATCH', '$.digest'));
});

test('canonical object-key order is digest-equivalent without collapsing distinct event identities', async () => {
  const first = await createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: { z: 1, a: { y: 2, b: 3 } } }, uuid(UUID_1));
  const reordered = await createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: { a: { b: 3, y: 2 }, z: 1 } }, uuid(UUID_1));
  const newIdentity = await createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: { a: { b: 3, y: 2 }, z: 1 } }, uuid(UUID_2));
  assert.equal(first.digest, reordered.digest);
  assert.equal(await classifyWorkoutReplay(first, reordered), 'duplicate');
  assert.notEqual(first.digest, newIdentity.digest, 'event identity participates in the fingerprint');
  assert.equal(await classifyWorkoutReplay(first, newIdentity), 'new');
});

test('Undo is append-only, keeps history, and removes only its earlier target from the active projection', async () => {
  const first = await create({ set: 1 }, UUID_1, 'member-a', AT_1);
  const second = await create({ set: 2 }, UUID_2, 'member-a', AT_3);
  const undo = await createUndoEvent(first, AT_2, { reason: 'accidental tap' }, uuid(UUID_3));
  const input = [first, undo, second];
  const before = [...input];
  const projection = await reduceWorkoutEvents(input);

  assert.deepEqual(input, before);
  assert.deepEqual(projection.history.map(event => event.eventId), [first.eventId, undo.eventId, second.eventId]);
  assert.deepEqual(projection.activeEvents.map(event => event.eventId), [second.eventId]);
  assert.deepEqual(projection.compensatedEventIds, [first.eventId]);
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.history), true);
  assert.equal(Object.isFrozen(projection.activeEvents), true);

  const replayed = await reduceWorkoutEvents([first, undo, undo, second]);
  assert.deepEqual(replayed, projection, 'exact Undo retry is harmless');
});

test('Undo rejects missing or later targets, cross-account batches, Undo-of-Undo, and double compensation', async () => {
  const target = await create({ set: 1 }, UUID_1);
  const undo = await createUndoEvent(target, AT_2, {}, uuid(UUID_2));

  await assert.rejects(() => reduceWorkoutEvents([undo, target]), error('UNDO_TARGET_MISSING', '$[0].compensatesEventId'));

  const crossAccountUndo = await createWorkoutEvent({
    accountId: 'member-b', type: 'workout.undo', occurredAt: AT_2, payload: {}, compensatesEventId: target.eventId,
  }, uuid(UUID_2));
  await assert.rejects(() => reduceWorkoutEvents([target, crossAccountUndo]), error('ACCOUNT_PARTITION', '$[1].accountId'));

  await assert.rejects(() => createUndoEvent(undo, AT_3, {}, uuid(UUID_3)), error('INVALID_COMPENSATION', '$.compensatesEventId'));
  const undoOfUndo = await createWorkoutEvent({
    accountId: 'member-a', type: 'workout.undo', occurredAt: AT_3, payload: {}, compensatesEventId: undo.eventId,
  }, uuid(UUID_3));
  await assert.rejects(() => reduceWorkoutEvents([target, undo, undoOfUndo]), error('UNDO_OF_UNDO', '$[2].compensatesEventId'));

  const secondUndo = await createUndoEvent(target, AT_3, {}, uuid(UUID_3));
  await assert.rejects(() => reduceWorkoutEvents([target, undo, secondUndo]), error('DOUBLE_COMPENSATION', '$[2].compensatesEventId'));
});

test('reduction is append-ordered, deterministic, account-bound, and resource-bounded', async () => {
  const laterClock = await create({ order: 1 }, UUID_1, 'member-a', AT_3);
  const earlierClock = await create({ order: 2 }, UUID_2, 'member-a', AT_1);
  const events = [laterClock, earlierClock];
  const first = await reduceWorkoutEvents(events);
  const second = await reduceWorkoutEvents(events);
  assert.deepEqual(first, second);
  assert.deepEqual(first.activeEvents.map(event => event.eventId), [laterClock.eventId, earlierClock.eventId], 'client timestamps never reorder append history');

  const otherAccount = await create({ order: 3 }, UUID_3, 'member-b', AT_2);
  await assert.rejects(() => reduceWorkoutEvents([laterClock, otherAccount]), error('ACCOUNT_PARTITION', '$[1].accountId'));
  await assert.rejects(
    () => reduceWorkoutEvents(new Array(MAX_WORKOUT_EVENT_BATCH + 1).fill(laterClock)),
    error('BATCH_TOO_LARGE', '$'),
  );
  assert.deepEqual(await reduceWorkoutEvents([]), { accountId: null, history: [], activeEvents: [], compensatedEventIds: [] });
});

test('validation rejects invalid identities, accounts, types, timestamps, compensation shapes, and oversized content', async () => {
  await assert.rejects(() => create({ value: 1 }, '00000000-0000-4000-8000-00000000000A'), error('INVALID_EVENT_ID', '$.eventId'));
  await assert.rejects(() => createWorkoutEvent({ accountId: '   ', type: 'set.confirmed', occurredAt: AT_1, payload: {} }, uuid(UUID_1)), error('INVALID_ACCOUNT_ID', '$.accountId'));
  await assert.rejects(() => createWorkoutEvent({ accountId: 'a'.repeat(257), type: 'set.confirmed', occurredAt: AT_1, payload: {} }, uuid(UUID_1)), error('INVALID_ACCOUNT_ID', '$.accountId'));
  await assert.rejects(() => createWorkoutEvent({ accountId: 'member-a', type: '1bad', occurredAt: AT_1, payload: {} }, uuid(UUID_1)), error('INVALID_EVENT_TYPE', '$.type'));
  await assert.rejects(() => createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: '2026-07-22T12:00:00Z', payload: {} }, uuid(UUID_1)), error('INVALID_TIMESTAMP', '$.occurredAt'));
  await assert.rejects(() => createWorkoutEvent({ accountId: 'member-a', type: 'workout.undo', occurredAt: AT_1, payload: {} }, uuid(UUID_1)), error('INVALID_COMPENSATION', '$.compensatesEventId'));
  await assert.rejects(() => createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: {}, compensatesEventId: `wev_${UUID_2}` }, uuid(UUID_1)), error('INVALID_COMPENSATION', '$.compensatesEventId'));
  await assert.rejects(
    () => createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: { text: 'x'.repeat(MAX_WORKOUT_EVENT_BYTES) } }, uuid(UUID_1)),
    error('EVENT_TOO_LARGE', '$'),
  );

  const preimageAtLimit = {
    accountId: 'member-a',
    eventId: `wev_${UUID_1}`,
    occurredAt: AT_1,
    payload: { text: 'x'.repeat(65_340) },
    schemaVersion: WORKOUT_EVENT_SCHEMA_VERSION,
    type: 'set.confirmed',
  };
  assert.equal(new TextEncoder().encode(canonicalSerialize(preimageAtLimit)).byteLength, MAX_WORKOUT_EVENT_BYTES);
  await assert.rejects(
    () => createWorkoutEvent({ accountId: 'member-a', type: 'set.confirmed', occurredAt: AT_1, payload: preimageAtLimit.payload }, uuid(UUID_1)),
    error('EVENT_TOO_LARGE', '$'),
    'the complete event must fit even when its fingerprint preimage fits exactly',
  );
  const oversizedButAuthentic = { ...preimageAtLimit, digest: await fingerprintCanonical(preimageAtLimit) } as WorkoutEvent;
  assert.equal(new TextEncoder().encode(canonicalSerialize(oversizedButAuthentic)).byteLength, 65_619);
  await assert.rejects(
    () => verifyWorkoutEvent(oversizedButAuthentic),
    error('EVENT_TOO_LARGE', '$'),
    'verification must reject a validly fingerprinted complete event over the ceiling',
  );

  const valid = await create();
  const oversizedReplay = { ...mutable(valid), payload: { text: 'x'.repeat(MAX_WORKOUT_EVENT_BYTES) } } as unknown as WorkoutEvent;
  await assert.rejects(() => reduceWorkoutEvents([oversizedReplay]), error('EVENT_TOO_LARGE', '$'));
  const extra = { ...mutable(valid), clinicalApproval: true };
  await assert.rejects(() => verifyWorkoutEvent(extra), error('INVALID_EVENT', '$'));
});

test('the event contract remains clinically opaque', async () => {
  const event = await createWorkoutEvent({ accountId: 'member-a', type: 'opaque.action', occurredAt: AT_1, payload: { opaque: 'value' } }, uuid(UUID_1));
  const projection = await reduceWorkoutEvents([event]);
  assert.deepEqual(projection.activeEvents[0].payload, { opaque: 'value' });
  assert.equal('exercise' in projection, false);
  assert.equal('readiness' in projection, false);
  assert.equal('score' in projection, false);
});
