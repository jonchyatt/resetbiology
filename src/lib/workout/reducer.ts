import {
  WORKOUT_UNDO_EVENT_TYPE,
  WorkoutEventContractError,
  classifyWorkoutReplay,
  verifyWorkoutEvent,
  type WorkoutEvent,
  type WorkoutEventId,
} from './events';

export const MAX_WORKOUT_EVENT_BATCH = 10_000;

export type WorkoutEventProjection = Readonly<{
  accountId: string | null;
  history: readonly WorkoutEvent[];
  activeEvents: readonly WorkoutEvent[];
  compensatedEventIds: readonly WorkoutEventId[];
}>;

function reductionFail(code: 'BATCH_TOO_LARGE' | 'UNDO_TARGET_MISSING' | 'UNDO_OF_UNDO' | 'DOUBLE_COMPENSATION', path: string, message: string): never {
  throw new WorkoutEventContractError(code, path, message);
}

const freezeProjection = (projection: {
  accountId: string | null;
  history: WorkoutEvent[];
  activeEvents: WorkoutEvent[];
  compensatedEventIds: WorkoutEventId[];
}): WorkoutEventProjection => Object.freeze({
  accountId: projection.accountId,
  history: Object.freeze(projection.history),
  activeEvents: Object.freeze(projection.activeEvents),
  compensatedEventIds: Object.freeze(projection.compensatedEventIds),
});

export const reduceWorkoutEvents = async (events: readonly WorkoutEvent[]): Promise<WorkoutEventProjection> => {
  if (!Array.isArray(events)) reductionFail('BATCH_TOO_LARGE', '$', 'Workout event batch must be an array.');
  if (events.length > MAX_WORKOUT_EVENT_BATCH) {
    reductionFail('BATCH_TOO_LARGE', '$', `Workout event batch must not exceed ${MAX_WORKOUT_EVENT_BATCH} events.`);
  }

  let accountId: string | null = null;
  const history: WorkoutEvent[] = [];
  const activeById = new Map<WorkoutEventId, WorkoutEvent>();
  const seenById = new Map<WorkoutEventId, WorkoutEvent>();
  const compensatedByTarget = new Map<WorkoutEventId, WorkoutEventId>();

  for (let index = 0; index < events.length; index += 1) {
    const event = await verifyWorkoutEvent(events[index]);
    if (accountId === null) accountId = event.accountId;
    if (event.accountId !== accountId) {
      throw new WorkoutEventContractError('ACCOUNT_PARTITION', `$[${index}].accountId`, 'Workout event batch contains multiple accounts.');
    }

    const existing = seenById.get(event.eventId);
    if (existing !== undefined) {
      const replay = await classifyWorkoutReplay(existing, event);
      if (replay === 'duplicate') continue;
      throw new WorkoutEventContractError('REPLAY_CONFLICT', `$[${index}].eventId`, 'Event identity was reused with different content.');
    }

    if (event.type === WORKOUT_UNDO_EVENT_TYPE) {
      const targetId = event.compensatesEventId;
      if (targetId === undefined) reductionFail('UNDO_TARGET_MISSING', `$[${index}].compensatesEventId`, 'Undo event is missing its target.');
      const target = seenById.get(targetId);
      if (target === undefined) {
        reductionFail('UNDO_TARGET_MISSING', `$[${index}].compensatesEventId`, 'Undo target must occur earlier in append order.');
      }
      if (target.type === WORKOUT_UNDO_EVENT_TYPE) {
        reductionFail('UNDO_OF_UNDO', `$[${index}].compensatesEventId`, 'Undo event cannot target another Undo event.');
      }
      if (compensatedByTarget.has(targetId)) {
        reductionFail('DOUBLE_COMPENSATION', `$[${index}].compensatesEventId`, 'Event has already been compensated.');
      }
      compensatedByTarget.set(targetId, event.eventId);
      activeById.delete(targetId);
    } else {
      activeById.set(event.eventId, event);
    }

    seenById.set(event.eventId, event);
    history.push(event);
  }

  return freezeProjection({
    accountId,
    history,
    activeEvents: [...activeById.values()],
    compensatedEventIds: [...compensatedByTarget.keys()],
  });
};
