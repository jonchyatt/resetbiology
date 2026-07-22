export const WORKOUT_PROTOCOL_ADAPTER_VERSION = '1.2.0' as const;

export type WorkoutProtocolAdapterErrorCode =
  | 'INVALID_PROTOCOL'
  | 'INVALID_PHASES'
  | 'INVALID_PHASE_DURATION'
  | 'INVALID_PHASE_RANGE'
  | 'INVALID_SESSIONS'
  | 'INVALID_SESSION_LABEL'
  | 'INVALID_FREQUENCY'
  | 'INVALID_SESSION_DURATION'
  | 'INVALID_PRESCRIPTION'
  | 'INVALID_DATE'
  | 'ONGOING_WINDOW_REQUIRED';

export class WorkoutProtocolAdapterError extends Error {
  readonly name = 'WorkoutProtocolAdapterError';

  constructor(
    readonly code: WorkoutProtocolAdapterErrorCode,
    message: string,
    readonly path: string
  ) {
    super(message);
  }
}

type UnknownRecord = Record<string, unknown>;

export type NormalizedWorkoutSession = Readonly<{
  key: string;
  label: string;
  prescription: Readonly<UnknownRecord>;
}>;

export type NormalizedWorkoutPhase = Readonly<{
  key: string;
  name: string;
  weekStart: number;
  weekEnd: number;
  durationWeeks: number;
  sessions: readonly NormalizedWorkoutSession[];
}>;

export type NormalizedWorkoutProtocol = Readonly<{
  adapterVersion: typeof WORKOUT_PROTOCOL_ADAPTER_VERSION;
  slug?: string;
  name: string;
  sessionsPerWeek: number;
  phases: readonly NormalizedWorkoutPhase[];
}>;

export type WorkoutProtocolCompileOptions = Readonly<{
  startDate: Date | string;
  clock: Date | string | (() => Date);
}>;

export type CompiledWorkoutPlan = Readonly<{
  adapterVersion: typeof WORKOUT_PROTOCOL_ADAPTER_VERSION;
  createdAt: string;
  startDate: string;
  protocol: NormalizedWorkoutProtocol;
  sessions: readonly Readonly<{
    id: string;
    phaseKey: string;
    week: number;
    sequence: number;
    sessionKey: string;
    title: string;
    scheduledDate: string;
    prescription: Readonly<UnknownRecord>;
  }>[];
}>;

const fail = (code: WorkoutProtocolAdapterErrorCode, path: string, message: string): never => {
  throw new WorkoutProtocolAdapterError(code, message, path);
};

const asRecord = (value: unknown, path: string, code: WorkoutProtocolAdapterErrorCode = 'INVALID_PROTOCOL'): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, path, 'Expected an object.');
  return value as UnknownRecord;
};

const nonBlank = (value: unknown, path: string, code: WorkoutProtocolAdapterErrorCode): string => {
  if (typeof value !== 'string' || !value.trim()) fail(code, path, 'Expected a non-blank string.');
  return (value as string).trim();
};

const positiveInteger = (value: unknown, path: string, code: WorkoutProtocolAdapterErrorCode): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(code, path, 'Expected a positive integer.');
  }
  return value as number;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
};

const hasPositiveNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const hasPositiveWorkTarget = (value: unknown) => {
  if (hasPositiveNumber(value)) return true;
  if (typeof value !== 'string') return false;
  const match = value.trim().match(/^(\d+)(?:\s*-\s*(\d+))?\s*(?:reps?|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)?$/i);
  if (!match) return false;
  const lower = Number(match[1]);
  const upper = match[2] === undefined ? undefined : Number(match[2]);
  return lower > 0 && (upper === undefined || upper > lower);
};

const hasPositiveSessionMinutes = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;

const positionalRepTokens = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d+(?:\s*-\s*\d+){2,}$/.test(value.trim())) return null;
  const tokens = value.trim().split(/\s*-\s*/);
  return tokens.map(Number);
};

const hasAuthoredWorkTarget = (record: UnknownRecord) =>
  ['reps', 'durationSeconds', 'durationMinutes', 'durationHours', 'holdSeconds']
    .some((field) => hasPositiveWorkTarget(record[field]));

const validatePrescription = (exercise: UnknownRecord, path: string) => {
  if (Object.prototype.hasOwnProperty.call(exercise, 'sets')) {
    const sets = exercise.sets;
    if (typeof sets === 'number') {
      if (!Number.isInteger(sets) || sets <= 0) {
        fail('INVALID_PRESCRIPTION', `${path}.sets`, 'Expected sets to be a positive integer or non-empty array.');
      }
      const positionals = positionalRepTokens(exercise.reps);
      if (positionals !== null) {
        if (positionals.length !== sets || positionals.some((reps) => reps <= 0)) {
          fail('INVALID_PRESCRIPTION', `${path}.reps`, 'Expected positional reps to contain one positive integer per set.');
        }
        return;
      }
      if (!hasAuthoredWorkTarget(exercise)) {
        fail('INVALID_PRESCRIPTION', path, 'Expected an authored exercise prescription.');
      }
      return;
    }
    if (Array.isArray(sets)) {
      if (sets.length === 0) fail('INVALID_PRESCRIPTION', `${path}.sets`, 'Expected sets to be a positive integer or non-empty array.');
      const allSetsHaveWorkTargets = sets.every((set) => {
      const record = set && typeof set === 'object' && !Array.isArray(set) ? (set as UnknownRecord) : null;
      return Boolean(record && hasAuthoredWorkTarget(record));
      });
      if (!allSetsHaveWorkTargets) {
        fail('INVALID_PRESCRIPTION', `${path}.sets`, 'Expected every set to contain an authored positive work target.');
      }
      return;
    }
    fail('INVALID_PRESCRIPTION', `${path}.sets`, 'Expected sets to be a positive integer or non-empty array.');
  }

  if (!hasAuthoredWorkTarget(exercise)) fail('INVALID_PRESCRIPTION', path, 'Expected an authored exercise prescription.');
};

const validateExercises = (exercises: unknown, path: string) => {
  if (!Array.isArray(exercises) || exercises.length === 0) fail('INVALID_PRESCRIPTION', path, 'Expected a non-empty exercise array.');
  (exercises as unknown[]).forEach((exercise, index) => {
    const record = asRecord(exercise, `${path}[${index}]`, 'INVALID_PRESCRIPTION');
    nonBlank(record.name, `${path}[${index}].name`, 'INVALID_PRESCRIPTION');
    validatePrescription(record, `${path}[${index}]`);
  });
};

const validateSessionPrescription = (session: UnknownRecord, path: string) => {
  if (session.exercises !== undefined) {
    validateExercises(session.exercises, `${path}.exercises`);
    return;
  }

  if (!Array.isArray(session.blocks) || session.blocks.length === 0) {
    fail('INVALID_PRESCRIPTION', path, 'Expected authored exercises or non-empty blocks.');
  }
  (session.blocks as unknown[]).forEach((block, index) => {
    const record = asRecord(block, `${path}.blocks[${index}]`, 'INVALID_PRESCRIPTION');
    validateExercises(record.exercises, `${path}.blocks[${index}].exercises`);
  });
};

const parsePhases = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // The typed error below intentionally conceals parser-specific details.
    }
  }
  return fail('INVALID_PHASES', 'phases', 'Expected a phases array or JSON array string.');
};

const resolveDate = (value: Date | string, path: string): Date => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_DATE', path, 'Expected a valid date.');
  return date;
};

const sessionLabel = (session: UnknownRecord, path: string) => {
  const optionalLabel = (value: unknown, field: 'title' | 'name') => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') fail('INVALID_SESSION_LABEL', `${path}.${field}`, 'Expected a string.');
    return (value as string).trim() || undefined;
  };
  const title = optionalLabel(session.title, 'title');
  const name = optionalLabel(session.name, 'name');
  if (!title && !name) fail('INVALID_SESSION_LABEL', path, 'Expected a non-blank title or name.');
  if (title && name && title !== name) fail('INVALID_SESSION_LABEL', path, 'title and name conflict.');
  return title ?? name!;
};

export const normalizeWorkoutProtocol = (input: unknown): NormalizedWorkoutProtocol => {
  const protocol = asRecord(input, 'protocol');
  const name = nonBlank(protocol.name, 'protocol.name', 'INVALID_PROTOCOL');
  if (protocol.durationWeeks === 0) {
    fail('ONGOING_WINDOW_REQUIRED', 'protocol.durationWeeks', 'Finite plan compilation requires an explicit bounded window for ongoing protocols.');
  }
  const sessionsPerWeek = positiveInteger(protocol.sessionsPerWeek, 'protocol.sessionsPerWeek', 'INVALID_FREQUENCY');
  const phases = parsePhases(protocol.phases);
  if (phases.length === 0) fail('INVALID_PHASES', 'phases', 'Expected at least one phase.');

  let expectedWeekStart = 1;
  const normalizedPhases = phases.map((phaseValue, phaseIndex) => {
    const path = `phases[${phaseIndex}]`;
    const phase = asRecord(phaseValue, path, 'INVALID_PHASES');
    const hasDuration = phase.durationWeeks !== undefined;
    const hasRange = phase.weekStart !== undefined || phase.weekEnd !== undefined;
    if (phase.durationWeeks === 0) {
      fail('ONGOING_WINDOW_REQUIRED', `${path}.durationWeeks`, 'Finite plan compilation requires an explicit bounded window for ongoing protocols.');
    }
    if (hasDuration && hasRange) fail('INVALID_PHASE_DURATION', path, 'durationWeeks conflicts with weekStart/weekEnd.');
    if (!hasDuration && !hasRange) fail('INVALID_PHASE_DURATION', path, 'Expected durationWeeks or weekStart/weekEnd.');

    const weekStart = hasDuration
      ? expectedWeekStart
      : positiveInteger(phase.weekStart, `${path}.weekStart`, 'INVALID_PHASE_RANGE');
    const weekEnd = hasDuration
      ? weekStart + positiveInteger(phase.durationWeeks, `${path}.durationWeeks`, 'INVALID_PHASE_DURATION') - 1
      : positiveInteger(phase.weekEnd, `${path}.weekEnd`, 'INVALID_PHASE_RANGE');
    if (weekEnd < weekStart) fail('INVALID_PHASE_RANGE', path, 'weekEnd must be on or after weekStart.');
    if (weekStart !== expectedWeekStart) fail('INVALID_PHASE_RANGE', path, 'Phase ranges must be ordered, contiguous, and non-overlapping.');

    if (!Array.isArray(phase.sessions) || phase.sessions.length === 0) {
      fail('INVALID_SESSIONS', `${path}.sessions`, 'Expected a non-empty sessions array.');
    }

    const sessions = (phase.sessions as unknown[]).map((sessionValue, sessionIndex) => {
      const sessionPath = `${path}.sessions[${sessionIndex}]`;
      const session = asRecord(sessionValue, sessionPath, 'INVALID_SESSIONS');
      if (session.durationMinutes !== undefined && !hasPositiveSessionMinutes(session.durationMinutes)) {
        fail('INVALID_SESSION_DURATION', `${sessionPath}.durationMinutes`, 'Expected durationMinutes to be a finite positive integer number.');
      }
      validateSessionPrescription(session, sessionPath);
      return freeze({
        key: typeof session.key === 'string' && session.key.trim() ? session.key.trim() : `${phaseIndex + 1}-${sessionIndex + 1}`,
        label: sessionLabel(session, sessionPath),
        prescription: freeze(clone(session)),
      });
    });

    expectedWeekStart = weekEnd + 1;
    return freeze({
      key: typeof phase.key === 'string' && phase.key.trim() ? phase.key.trim() : `phase-${phaseIndex + 1}`,
      name: nonBlank(phase.name, `${path}.name`, 'INVALID_PHASES'),
      weekStart,
      weekEnd,
      durationWeeks: weekEnd - weekStart + 1,
      sessions: freeze(sessions),
    });
  });

  const normalized: NormalizedWorkoutProtocol = {
    adapterVersion: WORKOUT_PROTOCOL_ADAPTER_VERSION,
    ...(typeof protocol.slug === 'string' && protocol.slug.trim() ? { slug: protocol.slug.trim() } : {}),
    name,
    sessionsPerWeek,
    phases: freeze(normalizedPhases),
  };
  return freeze(normalized);
};

export const compileWorkoutProtocol = (
  input: unknown,
  options: WorkoutProtocolCompileOptions
): CompiledWorkoutPlan => {
  const protocol = normalizeWorkoutProtocol(input);
  const startDate = resolveDate(options.startDate, 'options.startDate');
  const clockValue = typeof options.clock === 'function' ? options.clock() : options.clock;
  const createdAt = resolveDate(clockValue, 'options.clock').toISOString();
  let sequence = 0;
  const sessions: Array<CompiledWorkoutPlan['sessions'][number]> = [];

  protocol.phases.forEach((phase) => {
    for (let week = phase.weekStart; week <= phase.weekEnd; week += 1) {
      phase.sessions.forEach((session, sessionIndex) => {
        const scheduledDate = new Date(startDate.getTime());
        scheduledDate.setUTCDate(
          scheduledDate.getUTCDate() + (week - 1) * 7 + Math.floor(sessionIndex * 7 / phase.sessions.length)
        );
        sequence += 1;
        sessions.push(freeze({
          id: `${phase.key}-w${week}-${session.key}-${sequence}`,
          phaseKey: phase.key,
          week,
          sequence,
          sessionKey: session.key,
          title: session.label,
          scheduledDate: scheduledDate.toISOString(),
          prescription: session.prescription,
        }));
      });
    }
  });

  return freeze({
    adapterVersion: WORKOUT_PROTOCOL_ADAPTER_VERSION,
    createdAt,
    startDate: startDate.toISOString(),
    protocol,
    sessions: freeze(sessions),
  });
};

export const snapshotWorkoutProtocol = (input: unknown, options: WorkoutProtocolCompileOptions) =>
  JSON.stringify(compileWorkoutProtocol(input, options));
