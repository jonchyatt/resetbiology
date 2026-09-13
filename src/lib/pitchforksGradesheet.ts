import { Buffer } from 'node:buffer';

export const PITCHFORKS_GRADE_IDS = [
  'staff-visible',
  'heard-marker',
  'drawer-switch',
  'phone-layout',
] as const;

export const PITCHFORKS_GRADE_STATUSES = ['not-tested', 'pass', 'fail'] as const;
export const PITCHFORKS_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

export type PitchforksGradesheetId = (typeof PITCHFORKS_GRADE_IDS)[number];
export type PitchforksGradesheetStatus = (typeof PITCHFORKS_GRADE_STATUSES)[number];
export type PitchforksScreenshotType = (typeof PITCHFORKS_SCREENSHOT_TYPES)[number];

export type PitchforksGradesheetScreenshot = Readonly<{
  name: string;
  type: PitchforksScreenshotType;
  data: string;
}>;

export type PitchforksGradesheetItem = Readonly<{
  id: PitchforksGradesheetId;
  status: PitchforksGradesheetStatus;
  notes: string;
  screenshot?: PitchforksGradesheetScreenshot;
}>;

export type PitchforksGradesheetPayload = Readonly<{
  version: 1;
  tester: string;
  device: string;
  items: readonly PitchforksGradesheetItem[];
}>;

export type PitchforksGradesheetValidationCode =
  | 'invalid-object'
  | 'unknown-field'
  | 'invalid-version'
  | 'invalid-tester'
  | 'invalid-device'
  | 'invalid-items'
  | 'invalid-item'
  | 'unknown-item-id'
  | 'duplicate-item-id'
  | 'missing-item-id'
  | 'invalid-status'
  | 'invalid-notes'
  | 'invalid-screenshot'
  | 'invalid-screenshot-name'
  | 'invalid-screenshot-type'
  | 'invalid-screenshot-data'
  | 'screenshot-too-large'
  | 'screenshot-magic-mismatch'
  | 'no-answered-items';

export type PitchforksGradesheetValidationError = Readonly<{
  code: PitchforksGradesheetValidationCode;
  path: string;
}>;

export type PitchforksGradesheetValidationResult =
  | Readonly<{ ok: true; value: PitchforksGradesheetPayload }>
  | Readonly<{ ok: false; error: PitchforksGradesheetValidationError }>;

type PitchforksGradesheetValidationFailure = Readonly<{
  ok: false;
  error: PitchforksGradesheetValidationError;
}>;

const ROOT_FIELDS = new Set(['version', 'tester', 'device', 'items']);
const ITEM_FIELDS = new Set(['id', 'status', 'notes', 'screenshot']);
const SCREENSHOT_FIELDS = new Set(['name', 'type', 'data']);

const fail = (
  code: PitchforksGradesheetValidationCode,
  path: string,
): PitchforksGradesheetValidationFailure => ({ ok: false, error: { code, path } });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasOnlyFields = (value: Record<string, unknown>, allowed: ReadonlySet<string>): string | null => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return key;
  }
  return null;
};

const isStringWithin = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length <= maxLength;

const isPitchforksId = (value: unknown): value is PitchforksGradesheetId =>
  typeof value === 'string' && (PITCHFORKS_GRADE_IDS as readonly string[]).includes(value);

const isStatus = (value: unknown): value is PitchforksGradesheetStatus =>
  typeof value === 'string' && (PITCHFORKS_GRADE_STATUSES as readonly string[]).includes(value);

const isScreenshotType = (value: unknown): value is PitchforksScreenshotType =>
  typeof value === 'string' && (PITCHFORKS_SCREENSHOT_TYPES as readonly string[]).includes(value);

const isUnsafeScreenshotName = (name: string): boolean => {
  if (name.length === 0 || name.length > 255 || name === '.' || name === '..') return true;
  if (name.includes('/') || name.includes('\\')) return true;
  if (/^[a-z]:/i.test(name) || name.startsWith('~')) return true;
  if (/[\u0000-\u001f\u007f]/u.test(name)) return true;
  return /\.(?:svg|html?|xhtml)(?:$|\.)/iu.test(name);
};

const decodedBase64Length = (value: string): number => {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length / 4) * 3 - padding;
};

const MAX_SCREENSHOT_BASE64_LENGTH = Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4;

const isCanonicalBase64 = (value: string): boolean => {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  if (value.length > MAX_SCREENSHOT_BASE64_LENGTH) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
};

const startsWithBytes = (value: Uint8Array, expected: readonly number[]): boolean =>
  value.length >= expected.length && expected.every((byte, index) => value[index] === byte);

const detectedScreenshotType = (bytes: Uint8Array): PitchforksScreenshotType | null => {
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) return 'image/webp';
  return null;
};

const validateScreenshot = (
  value: unknown,
  path: string,
): { ok: true; value: PitchforksGradesheetScreenshot } | { ok: false; error: PitchforksGradesheetValidationError } => {
  if (!isRecord(value)) return fail('invalid-screenshot', path);
  const unknownField = hasOnlyFields(value, SCREENSHOT_FIELDS);
  if (unknownField !== null) return fail('unknown-field', `${path}.${unknownField}`);

  const name = value.name;
  if (typeof name !== 'string' || isUnsafeScreenshotName(name)) {
    return fail('invalid-screenshot-name', `${path}.name`);
  }

  const type = value.type;
  if (!isScreenshotType(type)) return fail('invalid-screenshot-type', `${path}.type`);

  const data = value.data;
  if (typeof data !== 'string') {
    return fail('invalid-screenshot-data', `${path}.data`);
  }
  if (data.length > MAX_SCREENSHOT_BASE64_LENGTH) {
    return fail('screenshot-too-large', `${path}.data`);
  }
  if (!isCanonicalBase64(data)) {
    return fail('invalid-screenshot-data', `${path}.data`);
  }
  const decodedLength = decodedBase64Length(data);
  if (decodedLength > MAX_SCREENSHOT_BYTES) return fail('screenshot-too-large', `${path}.data`);

  let bytes: Buffer;
  try {
    bytes = Buffer.from(data, 'base64');
  } catch {
    return fail('invalid-screenshot-data', `${path}.data`);
  }
  if (bytes.byteLength !== decodedLength) return fail('invalid-screenshot-data', `${path}.data`);
  if (detectedScreenshotType(bytes) !== type) return fail('screenshot-magic-mismatch', `${path}.data`);

  return { ok: true, value: Object.freeze({ name, type, data }) };
};

export const validatePitchforksGradesheet = (input: unknown): PitchforksGradesheetValidationResult => {
  if (!isRecord(input)) return fail('invalid-object', '$');
  const unknownRootField = hasOnlyFields(input, ROOT_FIELDS);
  if (unknownRootField !== null) return fail('unknown-field', `$.${unknownRootField}`);

  if (input.version !== 1 || typeof input.version !== 'number' || !Number.isInteger(input.version)) {
    return fail('invalid-version', '$.version');
  }
  if (!isStringWithin(input.tester, 80)) return fail('invalid-tester', '$.tester');
  if (!isStringWithin(input.device, 160)) return fail('invalid-device', '$.device');
  if (!Array.isArray(input.items) || input.items.length !== PITCHFORKS_GRADE_IDS.length) {
    return fail('invalid-items', '$.items');
  }

  const seen = new Set<string>();
  const items: PitchforksGradesheetItem[] = [];
  for (const [index, rawItem] of input.items.entries()) {
    const path = `$.items[${index}]`;
    if (!isRecord(rawItem)) return fail('invalid-item', path);
    const unknownItemField = hasOnlyFields(rawItem, ITEM_FIELDS);
    if (unknownItemField !== null) return fail('unknown-field', `${path}.${unknownItemField}`);

    const id = rawItem.id;
    if (typeof id !== 'string') return fail('unknown-item-id', `${path}.id`);
    if (!isPitchforksId(id)) return fail('unknown-item-id', `${path}.id`);
    if (seen.has(id)) return fail('duplicate-item-id', `${path}.id`);
    seen.add(id);

    const status = rawItem.status;
    if (!isStatus(status)) return fail('invalid-status', `${path}.status`);
    const notes = rawItem.notes;
    if (!isStringWithin(notes, 2000)) return fail('invalid-notes', `${path}.notes`);

    let screenshot: PitchforksGradesheetScreenshot | undefined;
    if (rawItem.screenshot !== undefined) {
      const checkedScreenshot = validateScreenshot(rawItem.screenshot, `${path}.screenshot`);
      if (!checkedScreenshot.ok) return checkedScreenshot;
      screenshot = checkedScreenshot.value;
    }

    items.push(Object.freeze(screenshot === undefined ? { id, status, notes } : { id, status, notes, screenshot }));
  }

  for (const id of PITCHFORKS_GRADE_IDS) {
    if (!seen.has(id)) return fail('missing-item-id', '$.items');
  }
  if (!items.some(item => item.status !== 'not-tested')) return fail('no-answered-items', '$.items');

  return {
    ok: true,
    value: Object.freeze({
      version: 1,
      tester: input.tester as string,
      device: input.device as string,
      items: Object.freeze(items),
    }),
  };
};

export const isAllowedPitchforksOrigin = (origin: string | null): boolean =>
  origin === 'https://nepalt-2.tail9baca8.ts.net:9402' || origin === 'http://127.0.0.1:4314';

export const isDevelopmentPitchforksEnvironment = (nodeEnv: string | undefined): boolean =>
  nodeEnv === 'development';
