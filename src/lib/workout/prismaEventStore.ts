import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import {
  createWorkoutEventIdentityCollisionError,
  type WorkoutEventStore,
  type WorkoutEventStoreCreateInput,
  type WorkoutEventStoreRecord,
} from './eventService';

const WORKOUT_EVENT_SELECT = {
  id: true,
  userId: true,
  eventId: true,
  schemaVersion: true,
  digest: true,
  type: true,
  occurredAt: true,
  payload: true,
  compensatesEventId: true,
  acceptedAt: true,
} as const;

type WorkoutEventDelegate = Readonly<{
  create(args: Readonly<{
    data: WorkoutEventStoreCreateInput;
    select: typeof WORKOUT_EVENT_SELECT;
  }>): Promise<WorkoutEventStoreRecord>;
  findUnique(args: Readonly<{
    where: Readonly<{
      userId_eventId: Readonly<{ userId: string; eventId: string }>;
    }>;
    select: typeof WORKOUT_EVENT_SELECT;
  }>): Promise<WorkoutEventStoreRecord | null>;
}>;

const redactedUnavailable = (): Error => new Error('Workout event persistence unavailable.');

const hasExactIdentityTarget = (caught: Prisma.PrismaClientKnownRequestError): boolean => {
  const target = caught.meta?.target;
  return (
    Array.isArray(target) &&
    target.length === 2 &&
    target[0] === 'userId' &&
    target[1] === 'eventId'
  );
};

const isTypedP2002 = (caught: unknown): caught is Prisma.PrismaClientKnownRequestError =>
  caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';

export const createPrismaWorkoutEventStore = (delegate: WorkoutEventDelegate): WorkoutEventStore => {
  const findByIdentity = (userId: string, eventId: string): Promise<WorkoutEventStoreRecord | null> =>
    delegate.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: WORKOUT_EVENT_SELECT,
    });

  return Object.freeze({
    findByIdentity,
    async create(input: WorkoutEventStoreCreateInput): Promise<WorkoutEventStoreRecord> {
      try {
        return await delegate.create({
          data: {
            userId: input.userId,
            eventId: input.eventId,
            schemaVersion: input.schemaVersion,
            digest: input.digest,
            type: input.type,
            occurredAt: input.occurredAt,
            payload: input.payload,
            compensatesEventId: input.compensatesEventId,
          },
          select: WORKOUT_EVENT_SELECT,
        });
      } catch (caught) {
        if (isTypedP2002(caught) && hasExactIdentityTarget(caught)) {
          throw createWorkoutEventIdentityCollisionError(['userId', 'eventId']);
        }

        let winner: WorkoutEventStoreRecord | null;
        try {
          winner = await findByIdentity(input.userId, input.eventId);
        } catch {
          throw redactedUnavailable();
        }

        if (winner !== null) {
          throw createWorkoutEventIdentityCollisionError(['userId', 'eventId']);
        }
        throw redactedUnavailable();
      }
    },
  });
};

export const prismaWorkoutEventStore = createPrismaWorkoutEventStore(
  prisma.workoutEvent as unknown as WorkoutEventDelegate,
);
