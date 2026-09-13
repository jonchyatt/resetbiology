import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  isAllowedPitchforksOrigin,
  isDevelopmentPitchforksEnvironment,
  MAX_REQUEST_BYTES,
  validatePitchforksGradesheet,
  type PitchforksGradesheetPayload,
} from './pitchforksGradesheet';

const RECEIPT_DIRECTORY = 'D:/jarvis-evidence-archive/pitchforks-rework/gradesheets';
export const PITCHFORKS_PROCEDURE_ID = 'pf3-staff-physical-2026-09-10' as const;
export const PITCHFORKS_GAMEPLAY_BASELINE_COMMIT = '6769a6ab94942a0433e9ae15582c8413830654d8' as const;

export type PitchforksGradesheetReceipt = Readonly<PitchforksGradesheetPayload & {
  id: string;
  savedAt: string;
  type: 'gradesheet-submission';
  acceptance: 'unreviewed';
  procedureId: typeof PITCHFORKS_PROCEDURE_ID;
  gameplayBaselineCommit: typeof PITCHFORKS_GAMEPLAY_BASELINE_COMMIT;
}>;

type PublicErrorCode =
  | 'origin_not_allowed'
  | 'invalid_content_type'
  | 'invalid_content_length'
  | 'payload_too_large'
  | 'invalid_json'
  | 'invalid_gradesheet'
  | 'receipt_save_failed';

type RouteDependencies = Readonly<{
  getNodeEnv: () => string | undefined;
  createId: () => string;
  now: () => Date;
  saveReceipt: (receipt: PitchforksGradesheetReceipt) => Promise<void>;
}>;

class RequestBodyError extends Error {
  constructor(readonly code: 'invalid' | 'too-large') {
    super(code);
    this.name = 'RequestBodyError';
  }
}

export const isJsonContentType = (value: string | null): boolean => {
  if (value === null) return false;
  const parts = value.split(';').map(part => part.trim());
  if (parts[0]?.toLowerCase() !== 'application/json') return false;
  return parts.length === 1 || (parts.length === 2 && /^charset\s*=\s*"?utf-8"?$/iu.test(parts[1] ?? ''));
};

const declaredBodyLength = (value: string | null): number | null => {
  if (value === null) return null;
  if (!/^[0-9]+$/u.test(value)) throw new RequestBodyError('invalid');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed > MAX_REQUEST_BYTES) throw new RequestBodyError('too-large');
  if (!Number.isSafeInteger(parsed)) throw new RequestBodyError('invalid');
  return parsed;
};

export const readBoundedPitchforksJson = async (request: Request): Promise<unknown> => {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    throw new RequestBodyError('invalid');
  }

  declaredBodyLength(request.headers.get('content-length'));
  const body = request.body;
  if (body === null) throw new RequestBodyError('invalid');

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new RequestBodyError('invalid');
      byteLength += value.byteLength;
      if (byteLength > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError('too-large');
      }
      chunks.push(value);
    }
  } catch (caught) {
    if (caught instanceof RequestBodyError) throw caught;
    throw new RequestBodyError('invalid');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new RequestBodyError('invalid');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError('invalid');
  }
};

const jsonError = (status: number, code: PublicErrorCode, message: string): Response =>
  Response.json(
    { error: { code, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  );

const notFound = (): Response => new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });

const savePitchforksGradesheetReceipt = async (receipt: PitchforksGradesheetReceipt): Promise<void> => {
  await mkdir(RECEIPT_DIRECTORY, { recursive: true });
  const receiptPath = join(RECEIPT_DIRECTORY, `${receipt.id}.json`);
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, { encoding: 'utf8', flag: 'wx' });
};

const defaultDependencies: RouteDependencies = {
  getNodeEnv: () => process.env.NODE_ENV,
  createId: randomUUID,
  now: () => new Date(),
  saveReceipt: savePitchforksGradesheetReceipt,
};

export const createPitchforksGradesheetPostHandler = (
  overrides: Partial<RouteDependencies> = {},
) => {
  const dependencies: RouteDependencies = { ...defaultDependencies, ...overrides };

  return async function pitchforksGradesheetPost(request: Request): Promise<Response> {
    if (!isDevelopmentPitchforksEnvironment(dependencies.getNodeEnv())) return notFound();

    if (!isAllowedPitchforksOrigin(request.headers.get('origin'))) {
      return jsonError(403, 'origin_not_allowed', 'Request origin is not allowed.');
    }

    let raw: unknown;
    try {
      raw = await readBoundedPitchforksJson(request);
    } catch (caught) {
      if (caught instanceof RequestBodyError && caught.code === 'too-large') {
        return jsonError(413, 'payload_too_large', 'Request body exceeds 24 MiB.');
      }
      if (!isJsonContentType(request.headers.get('content-type'))) {
        return jsonError(400, 'invalid_content_type', 'Request must use JSON.');
      }
      if (request.headers.get('content-length') !== null) {
        try {
          declaredBodyLength(request.headers.get('content-length'));
        } catch (lengthError) {
          if (lengthError instanceof RequestBodyError && lengthError.code === 'too-large') {
            return jsonError(413, 'payload_too_large', 'Request body exceeds 24 MiB.');
          }
          return jsonError(400, 'invalid_content_length', 'Request content length is invalid.');
        }
      }
      return jsonError(400, 'invalid_json', 'Request body is not valid JSON.');
    }

    const validated = validatePitchforksGradesheet(raw);
    if (!validated.ok) return jsonError(400, 'invalid_gradesheet', 'Gradesheet payload is invalid.');

    let id: string;
    let savedAt: string;
    try {
      id = dependencies.createId();
      savedAt = dependencies.now().toISOString();
    } catch {
      return jsonError(500, 'receipt_save_failed', 'Receipt could not be saved.');
    }

    const receipt: PitchforksGradesheetReceipt = Object.freeze({
      ...validated.value,
      id,
      savedAt,
      type: 'gradesheet-submission',
      acceptance: 'unreviewed',
      procedureId: PITCHFORKS_PROCEDURE_ID,
      gameplayBaselineCommit: PITCHFORKS_GAMEPLAY_BASELINE_COMMIT,
    });

    try {
      await dependencies.saveReceipt(receipt);
    } catch {
      return jsonError(500, 'receipt_save_failed', 'Receipt could not be saved.');
    }

    return Response.json(
      { id, savedAt },
      { status: 201, headers: { 'cache-control': 'no-store' } },
    );
  };
};

