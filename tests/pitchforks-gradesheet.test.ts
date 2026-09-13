import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  MAX_REQUEST_BYTES,
  MAX_SCREENSHOT_BYTES,
  PITCHFORKS_GRADE_IDS,
  validatePitchforksGradesheet,
} from '../src/lib/pitchforksGradesheet';
import {
  createPitchforksGradesheetPostHandler,
  PITCHFORKS_GAMEPLAY_BASELINE_COMMIT,
  PITCHFORKS_PROCEDURE_ID,
  type PitchforksGradesheetReceipt,
} from '../src/lib/pitchforksGradesheetServer';
import { POST } from '../app/api/pitchforks-gradesheet/route';

const ALLOWED_ORIGIN = 'http://127.0.0.1:4314';
const AUTOMATED_TESTER = 'AUTOMATED TEST - NOT HUMAN ACCEPTANCE';

const makePayload = (statuses: string[] = ['pass', 'not-tested', 'not-tested', 'not-tested']): Record<string, unknown> => ({
  version: 1,
  tester: AUTOMATED_TESTER,
  device: 'test device',
  items: PITCHFORKS_GRADE_IDS.map((id, index) => ({ id, status: statuses[index], notes: `${id} note` })),
});

const jsonRequest = (body: unknown, headers: Record<string, string> = {}): Request =>
  new Request('http://127.0.0.1:4314/api/pitchforks-gradesheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ALLOWED_ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const png = (length = 8): Buffer => {
  const bytes = Buffer.alloc(length);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};

const screenshotPayload = (type: string, data: string, name = 'capture.png'): Record<string, unknown> => {
  const payload = makePayload();
  const items = payload.items as Array<Record<string, unknown>>;
  items[0] = { ...items[0], screenshot: { name, type, data } };
  return payload;
};

const responseJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;

const responseErrorCode = async (response: Response): Promise<string> => {
  const body = await responseJson(response);
  const error = body.error as Record<string, unknown>;
  return String(error.code);
};

const testHandler = (onSave: (receipt: PitchforksGradesheetReceipt) => void = () => undefined) =>
  createPitchforksGradesheetPostHandler({
    getNodeEnv: () => 'development',
    createId: () => '00000000-0000-4000-8000-000000000001',
    now: () => new Date('2026-09-10T20:00:00.000Z'),
    saveReceipt: async receipt => onSave(receipt),
  });

async function main(): Promise<void> {
  for (const statuses of [
    ['pass', 'pass', 'pass', 'pass'],
    ['fail', 'fail', 'fail', 'fail'],
    ['pass', 'not-tested', 'not-tested', 'not-tested'],
  ]) {
    const result = validatePitchforksGradesheet(makePayload(statuses));
    assert.equal(result.ok, true, `valid statuses should pass: ${statuses.join(',')}`);
  }
  assert.equal(validatePitchforksGradesheet(makePayload(['not-tested', 'not-tested', 'not-tested', 'not-tested'])).ok, false);
  console.log('[PASS] valid pass/fail/partial and at-least-one-answered validation');

  const unknownId = makePayload();
  (unknownId.items as Array<Record<string, unknown>>)[0].id = 'unknown-id';
  assert.equal(validatePitchforksGradesheet(unknownId).ok, false);

  const duplicateId = makePayload();
  (duplicateId.items as Array<Record<string, unknown>>)[1].id = PITCHFORKS_GRADE_IDS[0];
  assert.equal(validatePitchforksGradesheet(duplicateId).ok, false);

  const missingItems = makePayload();
  missingItems.items = (missingItems.items as unknown[]).slice(0, 3);
  assert.equal(validatePitchforksGradesheet(missingItems).ok, false);

  const unknownField = makePayload();
  (unknownField as Record<string, unknown>).unexpected = true;
  assert.equal(validatePitchforksGradesheet(unknownField).ok, false);
  console.log('[PASS] unknown, missing, duplicate IDs and unknown fields rejected');

  for (const invalid of [
    null,
    [],
    { ...makePayload(), version: '1' },
    { ...makePayload(), tester: 1 },
    { ...makePayload(), device: null },
    { ...makePayload(), items: {} },
    { ...makePayload(), items: [1, 2, 3, 4] },
    { ...makePayload(), items: [{ id: 'staff-visible', status: 'maybe', notes: '' }, ...((makePayload().items as unknown[]).slice(1))] },
  ]) {
    assert.equal(validatePitchforksGradesheet(invalid).ok, false);
  }
  console.log('[PASS] strict primitive types, version, counts and status validation');

  const validPng = png();
  const pngResult = validatePitchforksGradesheet(screenshotPayload('image/png', validPng.toString('base64')));
  assert.equal(pngResult.ok, true);

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/jpeg', jpeg.toString('base64'), 'capture.jpg')).ok, true);

  const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'binary');
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/webp', webp.toString('base64'), 'capture.webp')).ok, true);

  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/jpeg', validPng.toString('base64'), 'capture.jpg')).ok, false);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', 'data:image/png;base64,' + validPng.toString('base64'))).ok, false);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', `${validPng.toString('base64')} `)).ok, false);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', Buffer.from('<svg></svg>').toString('base64'), 'capture.svg')).ok, false);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', validPng.toString('base64'), '../capture.png')).ok, false);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', validPng.toString('base64'), 'capture.html')).ok, false);

  const fourMiB = png(MAX_SCREENSHOT_BYTES);
  const fourMiBResult = validatePitchforksGradesheet(screenshotPayload('image/png', fourMiB.toString('base64')));
  assert.equal(fourMiBResult.ok, true, 'a decoded screenshot at exactly 4 MiB is valid');

  const tooLarge = png(MAX_SCREENSHOT_BYTES + 1);
  assert.equal(validatePitchforksGradesheet(screenshotPayload('image/png', tooLarge.toString('base64'))).ok, false);
  console.log('[PASS] base64 canonicality, PNG/JPEG/WEBP magic, names and 4 MiB screenshot bound');

  const notesAtLimit = makePayload();
  (notesAtLimit.items as Array<Record<string, unknown>>)[0].notes = 'n'.repeat(2000);
  assert.equal(validatePitchforksGradesheet(notesAtLimit).ok, true);
  const notesOverLimit = clone(notesAtLimit);
  (notesOverLimit.items as Array<Record<string, unknown>>)[0].notes = 'n'.repeat(2001);
  assert.equal(validatePitchforksGradesheet(notesOverLimit).ok, false);
  const testerOverLimit = makePayload();
  testerOverLimit.tester = 't'.repeat(81);
  assert.equal(validatePitchforksGradesheet(testerOverLimit).ok, false);
  const deviceOverLimit = makePayload();
  deviceOverLimit.device = 'd'.repeat(161);
  assert.equal(validatePitchforksGradesheet(deviceOverLimit).ok, false);
  console.log('[PASS] tester/device/note bounds');

  let saved: PitchforksGradesheetReceipt | null = null;
  const handler = testHandler(receipt => { saved = receipt; });
  const accepted = await handler(jsonRequest(makePayload()));
  assert.equal(accepted.status, 201);
  assert.deepEqual(await responseJson(accepted), {
    id: '00000000-0000-4000-8000-000000000001',
    savedAt: '2026-09-10T20:00:00.000Z',
  });
  assert.equal(saved?.tester, AUTOMATED_TESTER);
  assert.equal(saved?.type, 'gradesheet-submission');
  assert.equal(saved?.acceptance, 'unreviewed');
  assert.equal(saved?.procedureId, PITCHFORKS_PROCEDURE_ID);
  assert.equal(saved?.gameplayBaselineCommit, PITCHFORKS_GAMEPLAY_BASELINE_COMMIT);
  console.log('[PASS] development POST returns 201 and adds fixed unreviewed receipt metadata');

  let saveCalls = 0;
  const rejectingHandler = testHandler(() => { saveCalls += 1; });
  const badResponse = await rejectingHandler(jsonRequest(unknownId));
  assert.equal(badResponse.status, 400);
  assert.equal(await responseErrorCode(badResponse), 'invalid_gradesheet');
  assert.equal(saveCalls, 0, 'invalid payloads never reach the writer');

  const missingOrigin = await rejectingHandler(new Request('http://127.0.0.1:4314/api/pitchforks-gradesheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(makePayload()),
  }));
  assert.equal(missingOrigin.status, 403);
  assert.equal(await responseErrorCode(missingOrigin), 'origin_not_allowed');

  const wrongOrigin = await rejectingHandler(jsonRequest(makePayload(), { origin: 'https://example.test' }));
  assert.equal(wrongOrigin.status, 403);
  assert.equal(await responseErrorCode(wrongOrigin), 'origin_not_allowed');
  console.log('[PASS] origin guard and validation prevent writes');

  const failedSave = createPitchforksGradesheetPostHandler({
    getNodeEnv: () => 'development',
    createId: () => '00000000-0000-4000-8000-000000000002',
    now: () => new Date('2026-09-10T20:00:00.000Z'),
    saveReceipt: async () => { throw new Error('SECRET_INTERNAL_PATH'); },
  });
  const failedSaveResponse = await failedSave(jsonRequest(makePayload()));
  assert.equal(failedSaveResponse.status, 500);
  const failedSaveText = await failedSaveResponse.text();
  const failedSaveBody = JSON.parse(failedSaveText) as { error?: { code?: string } };
  assert.equal(failedSaveBody.error?.code, 'receipt_save_failed');
  assert.equal(failedSaveText.includes('SECRET_INTERNAL_PATH'), false);
  assert.equal(failedSaveText.includes('00000000-0000-4000-8000-000000000002'), false);
  console.log('[PASS] save failure returns honest redacted 500 without false success');

  const declaredTooLarge = await rejectingHandler(jsonRequest('{}', {
    'content-length': String(MAX_REQUEST_BYTES + 1),
  }));
  assert.equal(declaredTooLarge.status, 413);
  assert.equal(await responseErrorCode(declaredTooLarge), 'payload_too_large');

  const actualTooLarge = await rejectingHandler(new Request('http://127.0.0.1:4314/api/pitchforks-gradesheet', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ALLOWED_ORIGIN },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES + 1));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' }));
  assert.equal(actualTooLarge.status, 413);
  assert.equal(await responseErrorCode(actualTooLarge), 'payload_too_large');
  assert.equal(saveCalls, 0);
  console.log('[PASS] declared and actual 24 MiB request bounds return structured 413');

  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const productionResponse = await POST(jsonRequest(makePayload()));
    assert.equal(productionResponse.status, 404);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
  console.log('[PASS] production POST is not exposed');

  const serverSource = await readFile(new URL('../src/lib/pitchforksGradesheetServer.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /D:\/jarvis-evidence-archive\/pitchforks-rework\/gradesheets/);
  assert.match(serverSource, /flag:\s*'wx'/);
  console.log('[PASS] receipt writer uses explicit private directory and exclusive create');
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
