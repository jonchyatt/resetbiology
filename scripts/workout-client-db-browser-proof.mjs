import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runPrefix = `rb-workout-client-proof-${Date.now()}-${randomUUID()}`;
const databaseNames = new Set();
const pages = new Set();
const passed = [];

const dbName = label => {
  const name = `${runPrefix}-${label}`;
  databaseNames.add(name);
  return name;
};

const check = async (name, proof) => {
  await proof();
  passed.push(name);
  console.log(`PASS ${name}`);
};

const bundleResult = await build({
  stdin: {
    contents: [
      "export * from './src/lib/workout/clientDb.ts';",
      "export * from './src/lib/workout/events/index.ts';",
      "export { canonicalSerialize, fingerprintCanonical } from './src/lib/workoutFoundationContracts.ts';",
    ].join('\n'),
    loader: 'ts',
    resolveDir: repoRoot,
    sourcefile: 'workout-client-db-proof-entry.ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'WorkoutProof',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
});
const bundle = bundleResult.outputFiles[0]?.text;
assert.ok(bundle, 'esbuild did not produce the browser proof bundle');

const server = createServer((_request, response) => {
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
  });
  response.end('<!doctype html><html><body>isolated workout storage proof</body></html>');
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;

let browser;
let context;

const installStorageTrap = async page => {
  await page.evaluate(() => {
    globalThis.__workoutStorageTouches = [];
    for (const method of ['setItem', 'removeItem', 'clear']) {
      const original = Storage.prototype[method];
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value(...args) {
          globalThis.__workoutStorageTouches.push({ method, key: typeof args[0] === 'string' ? args[0] : null });
          throw new Error(`Forbidden Storage.${method} call`);
        },
        writable: true,
      });
      globalThis[`__workoutStorageOriginal_${method}`] = original;
    }
  });
};

const newProofPage = async () => {
  const page = await context.newPage();
  pages.add(page);
  await page.goto(origin);
  await installStorageTrap(page);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    globalThis.__workoutHandles = Object.create(null);
    globalThis.__workoutRawHandles = Object.create(null);
  });
  return page;
};

const openHandle = (page, key, accountId, databaseName) => page.evaluate(async args => {
  const handle = await globalThis.WorkoutProof.openWorkoutClientDb(args.accountId, { databaseName: args.databaseName });
  globalThis.__workoutHandles[args.key] = handle;
  return handle.state;
}, { key, accountId, databaseName });

const closeHandle = (page, key) => page.evaluate(handleKey => {
  const handle = globalThis.__workoutHandles[handleKey];
  if (handle) handle.close();
  return handle?.state ?? null;
}, key);

const createEvent = (page, {
  accountId,
  uuid,
  payload = { nested: { value: 1 }, items: [{ count: 2 }] },
  occurredAt = '2026-07-22T12:00:00.000Z',
  type = 'set.confirmed',
}) => page.evaluate(async args => globalThis.WorkoutProof.createWorkoutEvent({
  accountId: args.accountId,
  type: args.type,
  occurredAt: args.occurredAt,
  payload: args.payload,
}, { uuidFactory: () => args.uuid }), { accountId, uuid, payload, occurredAt, type });

const enqueue = (page, key, event) => page.evaluate(async args => {
  try {
    const value = await globalThis.__workoutHandles[args.key].enqueueWorkoutEvent(args.event);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: { name: error?.name, code: error?.code, path: error?.path, message: error?.message } };
  }
}, { key, event });

const read = (page, key) => page.evaluate(async handleKey => {
  try {
    const value = await globalThis.__workoutHandles[handleKey].readWorkoutEvents();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: { name: error?.name, code: error?.code, path: error?.path, message: error?.message } };
  }
}, key);

const storageTouches = page => page.evaluate(() => [...globalThis.__workoutStorageTouches]);

const closeAllPageHandles = async page => {
  if (page.isClosed()) return;
  await page.evaluate(() => {
    for (const handle of Object.values(globalThis.__workoutHandles ?? {})) handle?.close?.();
    for (const handle of Object.values(globalThis.__workoutRawHandles ?? {})) handle?.close?.();
  }).catch(() => undefined);
};

const openRaw = (page, key, databaseName, version) => page.evaluate(args => new Promise((resolveOpen, rejectOpen) => {
  const request = indexedDB.open(args.databaseName, args.version);
  request.onerror = () => rejectOpen(request.error);
  request.onblocked = () => rejectOpen(new Error('raw IndexedDB open was blocked'));
  request.onsuccess = () => {
    const database = request.result;
    database.onversionchange = () => undefined;
    globalThis.__workoutRawHandles[args.key] = database;
    resolveOpen(database.version);
  };
}), { key, databaseName, version });

const deleteDatabase = (page, databaseName) => page.evaluate(name => new Promise((resolveDelete, rejectDelete) => {
  const request = indexedDB.deleteDatabase(name);
  request.onsuccess = () => resolveDelete(true);
  request.onerror = () => rejectDelete(request.error);
  request.onblocked = () => rejectDelete(new Error(`cleanup blocked for ${name}`));
}), databaseName);

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext();

  await check('insert, reload, recursive freeze, exact replay, and changed replay', async () => {
    const databaseName = dbName('basic');
    const accountId = 'member-basic';
    const uuid = '00000000-0000-4000-8000-000000000001';
    const firstPage = await newProofPage();
    assert.equal(await openHandle(firstPage, 'basic', accountId, databaseName), 'ready');
    const event = await createEvent(firstPage, { accountId, uuid });
    const canonicalBefore = await firstPage.evaluate(value => globalThis.WorkoutProof.canonicalSerialize(value), event);
    const inserted = await enqueue(firstPage, 'basic', event);
    assert.equal(inserted.ok, true);
    assert.equal(inserted.value.classification, 'new');
    assert.ok(Number.isSafeInteger(inserted.value.record.sequence) && inserted.value.record.sequence > 0);
    assert.equal(inserted.value.record.state, 'pending');
    const originalSequence = inserted.value.record.sequence;
    assert.equal(await closeHandle(firstPage, 'basic'), 'closed');
    await firstPage.close();
    pages.delete(firstPage);

    const reloadedPage = await newProofPage();
    assert.equal(await openHandle(reloadedPage, 'basic', accountId, databaseName), 'ready');
    const recovered = await read(reloadedPage, 'basic');
    assert.equal(recovered.ok, true);
    assert.equal(recovered.value.length, 1);
    const recoveredFacts = await reloadedPage.evaluate(async key => {
      const rows = await globalThis.__workoutHandles[key].readWorkoutEvents();
      return {
        canonical: globalThis.WorkoutProof.canonicalSerialize(rows[0].event),
        eventFrozen: Object.isFrozen(rows[0].event),
        payloadFrozen: Object.isFrozen(rows[0].event.payload),
        nestedFrozen: Object.isFrozen(rows[0].event.payload.nested),
        itemArrayFrozen: Object.isFrozen(rows[0].event.payload.items),
        itemFrozen: Object.isFrozen(rows[0].event.payload.items[0]),
      };
    }, 'basic');
    assert.equal(recoveredFacts.canonical, canonicalBefore);
    assert.deepEqual(Object.values(recoveredFacts).slice(1), [true, true, true, true, true]);

    const duplicate = await enqueue(reloadedPage, 'basic', event);
    assert.equal(duplicate.ok, true);
    assert.equal(duplicate.value.classification, 'duplicate');
    assert.equal(duplicate.value.record.sequence, originalSequence);
    assert.equal((await read(reloadedPage, 'basic')).value.length, 1);

    const changed = await createEvent(reloadedPage, { accountId, uuid, payload: { nested: { value: 99 } } });
    const conflict = await enqueue(reloadedPage, 'basic', changed);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.error.code, 'REPLAY_CONFLICT');
    const unchanged = await read(reloadedPage, 'basic');
    assert.equal(unchanged.value.length, 1);
    assert.equal(unchanged.value[0].digest, event.digest);
    assert.deepEqual(await storageTouches(reloadedPage), []);
  });

  await check('complete-event 64-KiB boundary persists without widening', async () => {
    const databaseName = dbName('size');
    const accountId = 'member-size';
    const uuid = '00000000-0000-4000-8000-000000000002';
    const page = await newProofPage();
    await openHandle(page, 'size', accountId, databaseName);
    const boundary = await page.evaluate(async args => {
      const proof = globalThis.WorkoutProof;
      const options = { uuidFactory: () => args.uuid };
      const input = length => ({
        accountId: args.accountId,
        type: 'set.confirmed',
        occurredAt: '2026-07-22T12:00:00.000Z',
        payload: { text: 'x'.repeat(length) },
      });
      let low = 0;
      let high = proof.MAX_WORKOUT_EVENT_BYTES;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        try {
          await proof.createWorkoutEvent(input(middle), options);
          low = middle;
        } catch {
          high = middle - 1;
        }
      }
      const exact = await proof.createWorkoutEvent(input(low), options);
      const exactBytes = new TextEncoder().encode(proof.canonicalSerialize(exact)).byteLength;
      const preimage = {
        schemaVersion: proof.WORKOUT_EVENT_SCHEMA_VERSION,
        eventId: `wev_${args.uuid}`,
        accountId: args.accountId,
        type: 'set.confirmed',
        occurredAt: '2026-07-22T12:00:00.000Z',
        payload: { text: 'x'.repeat(low + 1) },
      };
      const tooLarge = { ...preimage, digest: await proof.fingerprintCanonical(preimage) };
      const tooLargeBytes = new TextEncoder().encode(proof.canonicalSerialize(tooLarge)).byteLength;
      return { exact, exactBytes, tooLarge, tooLargeBytes };
    }, { accountId, uuid });
    assert.equal(boundary.exactBytes, 65_536);
    assert.equal(boundary.tooLargeBytes, 65_537);
    assert.equal((await enqueue(page, 'size', boundary.exact)).value.classification, 'new');
    const rejected = await enqueue(page, 'size', boundary.tooLarge);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'EVENT_TOO_LARGE');
    assert.equal((await read(page, 'size')).value.length, 1);
    await closeHandle(page, 'size');
    const reload = await newProofPage();
    await openHandle(reload, 'size', accountId, databaseName);
    const recoveredSize = await reload.evaluate(async key => {
      const [row] = await globalThis.__workoutHandles[key].readWorkoutEvents();
      return new TextEncoder().encode(globalThis.WorkoutProof.canonicalSerialize(row.event)).byteLength;
    }, 'size');
    assert.equal(recoveredSize, 65_536);
  });

  await check('account switch quarantines rows and permits same UUID per account', async () => {
    const databaseName = dbName('accounts');
    const uuid = '00000000-0000-4000-8000-000000000003';
    const page = await newProofPage();
    await openHandle(page, 'a', 'member-a', databaseName);
    const eventA = await createEvent(page, { accountId: 'member-a', uuid, payload: { account: 'a' } });
    assert.equal((await enqueue(page, 'a', eventA)).value.classification, 'new');
    assert.equal(await closeHandle(page, 'a'), 'closed');
    assert.equal((await read(page, 'a')).error.code, 'STORAGE_CLOSED');

    await openHandle(page, 'b', 'member-b', databaseName);
    assert.equal((await read(page, 'b')).value.length, 0);
    const eventB = await createEvent(page, { accountId: 'member-b', uuid, payload: { account: 'b' } });
    assert.equal((await enqueue(page, 'b', eventB)).value.classification, 'new');
    assert.equal((await read(page, 'b')).value.length, 1);
    await closeHandle(page, 'b');

    await openHandle(page, 'a2', 'member-a', databaseName);
    const restoredA = await read(page, 'a2');
    assert.equal(restoredA.value.length, 1);
    assert.deepEqual(restoredA.value[0].event.payload, { account: 'a' });
  });

  await check('frozen account facade exposes no raw database authority', async () => {
    const databaseName = dbName('facade');
    const page = await newProofPage();
    await openHandle(page, 'a', 'member-facade-a', databaseName);
    const eventA = await createEvent(page, {
      accountId: 'member-facade-a',
      uuid: '00000000-0000-4000-8000-000000000009',
      payload: { protected: 'account-a' },
    });
    assert.equal((await enqueue(page, 'a', eventA)).value.classification, 'new');
    await closeHandle(page, 'a');

    await openHandle(page, 'b', 'member-facade-b', databaseName);
    const attack = await page.evaluate(async key => {
      const handle = globalThis.__workoutHandles[key];
      const privateNames = ['database', 'accountId', 'lifecycle', 'versionChangeHandler', 'outboxEvents'];
      const reflectedTypes = Object.fromEntries(privateNames.map(name => [name, typeof Reflect.get(handle, name)]));
      const forgedDatabase = { outboxEvents: { toArray: async () => [{ forged: true }] } };
      const setResult = Reflect.set(handle, 'database', forgedDatabase);
      let brandErrorName = null;
      try {
        const reader = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(handle), 'readWorkoutEvents')?.value;
        await Reflect.apply(reader, Object.freeze({ database: forgedDatabase }), []);
      } catch (error) {
        brandErrorName = error?.name ?? null;
      }

      const leakedDatabase = Reflect.get(handle, 'database');
      let leakedRowCount = null;
      let rawDeleteAttempted = false;
      if (leakedDatabase?.outboxEvents) {
        const rows = await leakedDatabase.outboxEvents.toArray();
        leakedRowCount = rows.length;
        for (const row of rows) await leakedDatabase.outboxEvents.delete(row.sequence);
        rawDeleteAttempted = true;
      }

      return {
        isFrozen: Object.isFrozen(handle),
        ownKeys: Reflect.ownKeys(handle).map(value => typeof value === 'symbol' ? value.toString() : value),
        reflectedTypes,
        setResult,
        databaseAfterSetType: typeof Reflect.get(handle, 'database'),
        brandErrorName,
        leakedRowCount,
        rawDeleteAttempted,
      };
    }, 'b');
    assert.equal(attack.isFrozen, true);
    assert.deepEqual(attack.ownKeys, []);
    assert.deepEqual(attack.reflectedTypes, {
      database: 'undefined',
      accountId: 'undefined',
      lifecycle: 'undefined',
      versionChangeHandler: 'undefined',
      outboxEvents: 'undefined',
    });
    assert.equal(attack.setResult, false);
    assert.equal(attack.databaseAfterSetType, 'undefined');
    assert.equal(attack.brandErrorName, 'TypeError');
    assert.equal(attack.leakedRowCount, null);
    assert.equal(attack.rawDeleteAttempted, false);
    assert.equal((await read(page, 'b')).value.length, 0);
    const mismatched = await enqueue(page, 'b', eventA);
    assert.equal(mismatched.ok, false);
    assert.equal(mismatched.error.code, 'ACCOUNT_PARTITION');
    await closeHandle(page, 'b');

    await openHandle(page, 'a2', 'member-facade-a', databaseName);
    const restoredA = await read(page, 'a2');
    assert.equal(restoredA.value.length, 1);
    assert.equal(restoredA.value[0].digest, eventA.digest);
    assert.deepEqual(restoredA.value[0].event, eventA);
  });

  await check('two-page exact replay race converges to one row', async () => {
    const databaseName = dbName('race-duplicate');
    const accountId = 'member-race-duplicate';
    const pageA = await newProofPage();
    const pageB = await newProofPage();
    await Promise.all([
      openHandle(pageA, 'race', accountId, databaseName),
      openHandle(pageB, 'race', accountId, databaseName),
    ]);
    const event = await createEvent(pageA, {
      accountId,
      uuid: '00000000-0000-4000-8000-000000000004',
      payload: { race: 'same' },
    });
    const results = await Promise.all([enqueue(pageA, 'race', event), enqueue(pageB, 'race', event)]);
    assert.equal(results.every(result => result.ok), true);
    assert.deepEqual(results.map(result => result.value.classification).sort(), ['duplicate', 'new']);
    assert.equal((await read(pageA, 'race')).value.length, 1);
  });

  await check('two-page changed replay race keeps one winner and one conflict', async () => {
    const databaseName = dbName('race-conflict');
    const accountId = 'member-race-conflict';
    const pageA = await newProofPage();
    const pageB = await newProofPage();
    await Promise.all([
      openHandle(pageA, 'race', accountId, databaseName),
      openHandle(pageB, 'race', accountId, databaseName),
    ]);
    const uuid = '00000000-0000-4000-8000-000000000005';
    const first = await createEvent(pageA, { accountId, uuid, payload: { winner: 'first' } });
    const second = await createEvent(pageB, { accountId, uuid, payload: { winner: 'second' } });
    const results = await Promise.all([enqueue(pageA, 'race', first), enqueue(pageB, 'race', second)]);
    assert.equal(results.filter(result => result.ok && result.value.classification === 'new').length, 1);
    assert.equal(results.filter(result => !result.ok && result.error.code === 'REPLAY_CONFLICT').length, 1);
    assert.equal((await read(pageA, 'race')).value.length, 1);
  });

  await check('controlled browser quota failure is atomic and distinct', async () => {
    const databaseName = dbName('quota');
    const accountId = 'member-quota';
    const page = await newProofPage();
    await openHandle(page, 'quota', accountId, databaseName);
    const prior = await createEvent(page, {
      accountId,
      uuid: '00000000-0000-4000-8000-000000000006',
      payload: { preserved: true },
    });
    assert.equal((await enqueue(page, 'quota', prior)).value.classification, 'new');
    await page.evaluate(() => {
      globalThis.__originalIndexedDbAdd = IDBObjectStore.prototype.add;
      Object.defineProperty(IDBObjectStore.prototype, 'add', {
        configurable: true,
        value() { throw new DOMException('controlled quota failure', 'QuotaExceededError'); },
        writable: true,
      });
    });
    const blocked = await createEvent(page, {
      accountId,
      uuid: '00000000-0000-4000-8000-000000000007',
      payload: { shouldPersist: false },
    });
    const quota = await enqueue(page, 'quota', blocked);
    await page.evaluate(() => {
      Object.defineProperty(IDBObjectStore.prototype, 'add', {
        configurable: true,
        value: globalThis.__originalIndexedDbAdd,
        writable: true,
      });
    });
    assert.equal(quota.ok, false);
    assert.equal(quota.error.code, 'STORAGE_QUOTA');
    const rows = await read(page, 'quota');
    assert.equal(rows.value.length, 1);
    assert.equal(rows.value[0].eventId, prior.eventId);
    assert.deepEqual(await storageTouches(page), []);
  });

  await check('missing and security-denied IndexedDB fail unavailable without residue', async () => {
    const missingName = dbName('missing');
    const missingPage = await newProofPage();
    const missing = await missingPage.evaluate(async args => {
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
      try {
        await globalThis.WorkoutProof.openWorkoutClientDb(args.accountId, { databaseName: args.databaseName });
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code };
      }
    }, { accountId: 'member-missing', databaseName: missingName });
    assert.deepEqual(missing, { ok: false, code: 'STORAGE_UNAVAILABLE' });

    const deniedName = dbName('denied');
    const deniedPage = await newProofPage();
    const denied = await deniedPage.evaluate(async args => {
      const original = IDBFactory.prototype.open;
      Object.defineProperty(IDBFactory.prototype, 'open', {
        configurable: true,
        value() { throw new DOMException('controlled security denial', 'SecurityError'); },
        writable: true,
      });
      try {
        await globalThis.WorkoutProof.openWorkoutClientDb(args.accountId, { databaseName: args.databaseName });
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code };
      } finally {
        Object.defineProperty(IDBFactory.prototype, 'open', { configurable: true, value: original, writable: true });
      }
    }, { accountId: 'member-denied', databaseName: deniedName });
    assert.deepEqual(denied, { ok: false, code: 'STORAGE_UNAVAILABLE' });
    assert.deepEqual(await storageTouches(deniedPage), []);
  });

  await check('blocked upgrade rejects promptly without deleting the held database', async () => {
    const databaseName = dbName('blocked');
    const rawPage = await newProofPage();
    assert.equal(await openRaw(rawPage, 'blocker', databaseName, 1), 1);
    const modulePage = await newProofPage();
    const outcome = await modulePage.evaluate(async args => Promise.race([
      globalThis.WorkoutProof.openWorkoutClientDb(args.accountId, { databaseName: args.databaseName })
        .then(() => ({ ok: true }))
        .catch(error => ({ ok: false, code: error?.code })),
      new Promise(resolveRace => setTimeout(() => resolveRace({ ok: false, code: 'HUNG' }), 2_000)),
    ]), { accountId: 'member-blocked', databaseName });
    assert.deepEqual(outcome, { ok: false, code: 'STORAGE_BLOCKED' });
    const stillExists = await rawPage.evaluate(async name => (await indexedDB.databases()).some(item => item.name === name), databaseName);
    assert.equal(stillExists, true);
    await rawPage.evaluate(() => globalThis.__workoutRawHandles.blocker.close());
  });

  await check('external version change terminally closes the stale handle', async () => {
    const databaseName = dbName('version-change');
    const modulePage = await newProofPage();
    await openHandle(modulePage, 'versioned', 'member-versioned', databaseName);
    const rawPage = await newProofPage();
    assert.equal(await openRaw(rawPage, 'upgrader', databaseName, 20), 20);
    await modulePage.waitForFunction(() => globalThis.__workoutHandles.versioned.state === 'version-changed');
    const afterUpgrade = await read(modulePage, 'versioned');
    assert.equal(afterUpgrade.ok, false);
    assert.equal(afterUpgrade.error.code, 'STORAGE_VERSION_CHANGED');
    await rawPage.evaluate(() => globalThis.__workoutRawHandles.upgrader.close());
  });

  await check('read-time event corruption fails before return', async () => {
    const databaseName = dbName('corruption');
    const accountId = 'member-corrupt';
    const page = await newProofPage();
    await openHandle(page, 'corrupt', accountId, databaseName);
    const event = await createEvent(page, {
      accountId,
      uuid: '00000000-0000-4000-8000-000000000008',
      payload: { protected: true },
    });
    await enqueue(page, 'corrupt', event);
    await page.evaluate(name => new Promise((resolveMutation, rejectMutation) => {
      const request = indexedDB.open(name);
      request.onerror = () => rejectMutation(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('outboxEvents', 'readwrite');
        const store = transaction.objectStore('outboxEvents');
        const get = store.getAll();
        get.onerror = () => rejectMutation(get.error);
        get.onsuccess = () => {
          const [row] = get.result;
          row.event.payload = { protected: false };
          store.put(row);
        };
        transaction.oncomplete = () => { database.close(); resolveMutation(true); };
        transaction.onerror = () => rejectMutation(transaction.error);
        transaction.onabort = () => rejectMutation(transaction.error);
      };
    }), databaseName);
    const corrupted = await read(page, 'corrupt');
    assert.equal(corrupted.ok, false);
    assert.equal(corrupted.error.code, 'DIGEST_MISMATCH');
  });
} finally {
  if (context) {
    for (const page of [...pages]) await closeAllPageHandles(page);
    for (const page of [...pages]) await page.close().catch(() => undefined);
    pages.clear();

    const cleanupPage = await context.newPage();
    await cleanupPage.goto(origin);
    for (const name of databaseNames) await deleteDatabase(cleanupPage, name);
    const residue = await cleanupPage.evaluate(async prefix => (await indexedDB.databases())
      .map(database => database.name)
      .filter(name => typeof name === 'string' && name.startsWith(prefix)), runPrefix);
    assert.deepEqual(residue, [], `run-scoped IndexedDB residue remained: ${residue.join(', ')}`);
    await cleanupPage.close();
    await context.close();
  }
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

assert.equal(passed.length, 11);
console.log(JSON.stringify({
  verdict: 'PASS',
  browser: 'actual Chrome',
  origin,
  cases: passed,
  databasesCreated: databaseNames.size,
  residue: 0,
}, null, 2));
