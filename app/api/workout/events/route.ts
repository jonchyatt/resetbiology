import { NextResponse } from 'next/server';
import type { SessionData } from '@auth0/nextjs-auth0/types';
import type { UserResolution } from '@/lib/getUserFromSession';
import {
  WorkoutEventLedgerError,
  acceptWorkoutEvent,
  type WorkoutEventReceipt,
  type WorkoutEventStore,
} from '@/lib/workout/eventService';
import { MAX_WORKOUT_EVENT_BYTES, WorkoutEventContractError } from '@/lib/workout/events';

type PublicErrorCode =
  | 'unauthorized'
  | 'verify_email'
  | 'identity_lookup_failed'
  | 'invalid_event'
  | 'account_mismatch'
  | 'replay_conflict'
  | 'ledger_unavailable'
  | 'ledger_corrupt';

type RouteOutcome =
  | Readonly<{ ok: true; receipt: WorkoutEventReceipt }>
  | Readonly<{ ok: false; status: number; error: PublicErrorCode }>;

type WorkoutEventRouteDependencies = Readonly<{
  getSession(request: Request): Promise<SessionData | null>;
  resolveUser(session: SessionData): Promise<UserResolution | null>;
  loadStore(): Promise<WorkoutEventStore>;
  acceptEvent(
    store: WorkoutEventStore,
    trustedUserId: string,
    rawEvent: unknown,
  ): Promise<WorkoutEventReceipt>;
  getDeploymentCommit(): string | null;
}>;

class InvalidWorkoutEventRequestError extends Error {
  readonly name = 'InvalidWorkoutEventRequestError';
}

const errorOutcome = (status: number, error: PublicErrorCode): RouteOutcome =>
  Object.freeze({ ok: false, status, error });

const isJsonContentType = (value: string | null): boolean => {
  if (value === null) return false;
  const parts = value.split(';').map(part => part.trim());
  if (parts[0]?.toLowerCase() !== 'application/json') return false;
  if (parts.length === 1) return true;
  return parts.length === 2 && /^charset\s*=\s*"?utf-8"?$/i.test(parts[1] ?? '');
};

const declaredBodyIsTooLarge = (value: string | null): boolean => {
  if (value === null || !/^[0-9]+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > MAX_WORKOUT_EVENT_BYTES;
};

const readBoundedJsonObject = async (request: Request): Promise<Record<string, unknown>> => {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    throw new InvalidWorkoutEventRequestError();
  }
  if (declaredBodyIsTooLarge(request.headers.get('content-length'))) {
    throw new InvalidWorkoutEventRequestError();
  }
  if (request.body === null) throw new InvalidWorkoutEventRequestError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_WORKOUT_EVENT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new InvalidWorkoutEventRequestError();
      }
      chunks.push(value);
    }
  } catch (caught) {
    if (caught instanceof InvalidWorkoutEventRequestError) throw caught;
    throw new InvalidWorkoutEventRequestError();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new InvalidWorkoutEventRequestError();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidWorkoutEventRequestError();
  }
  return parsed as Record<string, unknown>;
};

const mapAcceptanceError = (caught: unknown): RouteOutcome => {
  if (caught instanceof WorkoutEventContractError) {
    if (caught.code === 'ACCOUNT_PARTITION') return errorOutcome(403, 'account_mismatch');
    if (caught.code === 'REPLAY_CONFLICT') return errorOutcome(409, 'replay_conflict');
    return errorOutcome(400, 'invalid_event');
  }
  if (caught instanceof WorkoutEventLedgerError) {
    if (caught.code === 'LEDGER_CORRUPT') return errorOutcome(500, 'ledger_corrupt');
    return errorOutcome(503, 'ledger_unavailable');
  }
  return errorOutcome(503, 'ledger_unavailable');
};

const createWorkoutEventPostHandler = (dependencies: WorkoutEventRouteDependencies) =>
  async function workoutEventPost(request: Request): Promise<Response> {
    let outcome: RouteOutcome;
    let session: SessionData | null;
    try {
      session = await dependencies.getSession(request);
    } catch {
      session = null;
    }

    if (!session?.user) {
      outcome = errorOutcome(401, 'unauthorized');
    } else {
      let resolution: UserResolution | null;
      try {
        resolution = await dependencies.resolveUser(session);
      } catch {
        resolution = null;
      }

      if (resolution?.status === 'unverified_email') {
        outcome = errorOutcome(403, 'verify_email');
      } else if (resolution === null) {
        outcome = errorOutcome(503, 'identity_lookup_failed');
      } else {
        try {
          const rawEvent = await readBoundedJsonObject(request);
          const store = await dependencies.loadStore();
          const receipt = await dependencies.acceptEvent(store, resolution.user.id, rawEvent);
          outcome = Object.freeze({ ok: true, receipt });
        } catch (caught) {
          outcome = caught instanceof InvalidWorkoutEventRequestError
            ? errorOutcome(400, 'invalid_event')
            : mapAcceptanceError(caught);
        }
      }
    }

    const deploymentCommit = dependencies.getDeploymentCommit()?.trim().toLowerCase();
    const headers = deploymentCommit && /^[0-9a-f]{40}$/.test(deploymentCommit)
      ? { 'x-rb-deployment-commit': deploymentCommit }
      : undefined;
    return outcome.ok
      ? NextResponse.json(outcome.receipt, { status: 200, headers })
      : NextResponse.json({ error: outcome.error }, { status: outcome.status, headers });
  };

const productionDependencies: WorkoutEventRouteDependencies = {
  getSession: async () => (await import('@/lib/auth0')).auth0.getSession(),
  resolveUser: async session => (await import('@/lib/getUserFromSession')).resolveUserFromSession(session),
  loadStore: async () => (await import('@/lib/workout/prismaEventStore')).prismaWorkoutEventStore,
  acceptEvent: acceptWorkoutEvent,
  getDeploymentCommit: () => process.env.VERCEL_GIT_COMMIT_SHA ?? null,
};

export const POST = Object.assign(createWorkoutEventPostHandler(productionDependencies), {
  testContract: {
    createWorkoutEventPostHandler,
    readBoundedJsonObject,
    isJsonContentType,
    declaredBodyIsTooLarge,
  },
});
