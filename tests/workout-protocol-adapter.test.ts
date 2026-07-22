import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKOUT_PROTOCOL_ADAPTER_VERSION,
  WorkoutProtocolAdapterError,
  compileWorkoutProtocol,
  normalizeWorkoutProtocol,
  snapshotWorkoutProtocol,
} from '../src/lib/workoutProtocolAdapter';

const compileOptions = {
  startDate: '2026-07-20T00:00:00.000Z',
  clock: '2026-07-21T12:00:00.000Z',
} as const;

const dayOffsets = (sessions: readonly { scheduledDate: string }[]) =>
  sessions.map((session) => (new Date(session.scheduledDate).getTime() - new Date(compileOptions.startDate).getTime()) / 86_400_000);

const rehitProtocol = {
  slug: 'rehit-sprint-protocol',
  name: 'REHIT Sprint Protocol',
  sessionsPerWeek: 3,
  phases: [
    {
      name: 'Week 1',
      weekStart: 1,
      weekEnd: 1,
      sessions: ['Monday', 'Wednesday', 'Friday'].map((name) => ({
        name: `REHIT ${name} 10s`,
        exercises: [{ name: 'All-Out Sprint', sets: 2, durationSeconds: 10 }],
      })),
    },
    {
      name: 'Weeks 2-3',
      weekStart: 2,
      weekEnd: 3,
      sessions: ['Monday', 'Wednesday', 'Friday'].map((name) => ({
        name: `REHIT ${name} 15s`,
        exercises: [{ name: 'All-Out Sprint', sets: 2, durationSeconds: 15 }],
      })),
    },
    {
      name: 'Weeks 4-6',
      weekStart: 4,
      weekEnd: 6,
      sessions: ['Monday', 'Wednesday', 'Friday'].map((name) => ({
        name: `REHIT ${name} 20s`,
        exercises: [{ name: 'All-Out Sprint', sets: 2, durationSeconds: 20 }],
      })),
    },
  ],
};

const durationOnlyProtocol = {
  name: 'Curated typed fixture',
  sessionsPerWeek: 2,
  phases: [
    {
      key: 'foundation',
      name: 'Foundation',
      durationWeeks: 2,
      sessions: [{
        key: 'lower',
        title: 'Lower Neural Prime',
        durationMinutes: 55,
        blocks: [{
          key: 'main',
          label: 'Strength Stack',
          focus: 'Squat',
          exercises: [{
            key: 'front-squat',
            name: 'Front squat',
            pattern: 'Squat',
            sets: [{ reps: 5, tempo: '3111', rir: '2' }],
          }],
        }],
      }],
    },
    {
      key: 'build',
      name: 'Build',
      durationWeeks: 1,
      sessions: [{
        key: 'upper',
        title: 'Upper Power',
        durationMinutes: 45,
        blocks: [{
          key: 'main',
          label: 'Press Strength',
          focus: 'Press',
          exercises: [{ key: 'bench', name: 'Bench press', pattern: 'Press', sets: [{ reps: 3, rir: '1' }] }],
        }],
      }],
    },
  ],
} as const;

const rangeProtocol = {
  name: 'Range fixture',
  sessionsPerWeek: 1,
  phases: [
    { name: 'Start', weekStart: 1, weekEnd: 2, sessions: [{ name: 'Session A', exercises: [{ name: 'Wall sit', sets: 2, holdSeconds: 60 }] }] },
    { name: 'Finish', weekStart: 3, weekEnd: 4, sessions: [{ name: 'Session B', exercises: [{ name: 'Bike', durationMinutes: 30 }] }] },
  ],
};

test('REHIT range fixture compiles six weeks of three named sessions into exactly 18 sessions', () => {
  const result = compileWorkoutProtocol(rehitProtocol, compileOptions);
  assert.equal(result.adapterVersion, WORKOUT_PROTOCOL_ADAPTER_VERSION);
  assert.equal(result.adapterVersion, '1.2.0');
  assert.equal(result.protocol.phases.reduce((sum, phase) => sum + phase.durationWeeks, 0), 6);
  assert.equal(result.sessions.length, 18);
  assert.ok(result.sessions.every((session) => session.title.length > 0));
  assert.deepEqual(dayOffsets(result.sessions), [0, 2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32, 35, 37, 39]);
  assert.deepEqual(result.sessions[0].prescription.exercises, rehitProtocol.phases[0].sessions[0].exercises);
});

test('durationWeeks-only curated fixture retains title labels and authored block prescriptions', () => {
  const result = compileWorkoutProtocol(durationOnlyProtocol, compileOptions);
  assert.equal(result.sessions.length, 3);
  assert.equal(result.sessions[0].title, 'Lower Neural Prime');
  assert.deepEqual(
    result.sessions[0].prescription.blocks,
    durationOnlyProtocol.phases[0].sessions[0].blocks
  );
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.protocol.phases[0].sessions[0].prescription));
  assert.deepEqual(dayOffsets(result.sessions), [0, 7, 14]);
});

test('inclusive range fixture produces its exact reviewed session count', () => {
  const result = compileWorkoutProtocol(rangeProtocol, compileOptions);
  assert.equal(result.sessions.length, 4);
  assert.deepEqual(result.sessions.map((session) => session.week), [1, 2, 3, 4]);
});

test('uses actual weekly template counts for deterministic in-week placement', () => {
  [
    [1, [0]],
    [2, [0, 3]],
    [3, [0, 2, 4]],
    [4, [0, 1, 3, 5]],
    [7, [0, 1, 2, 3, 4, 5, 6]],
  ].forEach(([count, expectedOffsets]) => {
    const protocol = {
      name: `Count ${count}`,
      sessionsPerWeek: 1,
      phases: [{
        name: 'Week one', durationWeeks: 1,
        sessions: Array.from({ length: count as number }, (_, index) => ({
          name: `Session ${index + 1}`,
          exercises: [{ name: 'Run', durationSeconds: 30 }],
        })),
      }],
    };
    assert.deepEqual(dayOffsets(compileWorkoutProtocol(protocol, compileOptions).sessions), expectedOffsets);
  });
});

test('same input and supplied clock produces a byte-stable versioned snapshot', () => {
  const inputBeforeCompile = JSON.stringify(rehitProtocol);
  assert.equal(
    snapshotWorkoutProtocol(rehitProtocol, compileOptions),
    snapshotWorkoutProtocol(rehitProtocol, compileOptions)
  );
  assert.equal(JSON.stringify(rehitProtocol), inputBeforeCompile);
});

test('accepts JSON-string phases and validated authored string work targets', () => {
  const result = normalizeWorkoutProtocol({
    name: 'String shape',
    sessionsPerWeek: 1,
    phases: JSON.stringify([{
      name: 'One',
      durationWeeks: 1,
      sessions: [{
        name: 'Intervals',
        totalDuration: '45-60 minutes',
        exercises: [
          { name: 'Nordic curl', sets: 2, reps: '6-8' },
          { name: 'Full Nordic curl', sets: 3, reps: '10-12' },
          { name: 'Intervals', sets: [{ reps: '6-8' }, { durationSeconds: '15-20 seconds' }] },
        ],
      }],
    }]),
  });
  assert.equal(result.phases[0].sessions[0].label, 'Intervals');
  assert.equal(result.phases[0].sessions[0].prescription.totalDuration, '45-60 minutes');
});

const validExercise = { name: 'Run', durationMinutes: 5 };

const assertAdapterError = (
  protocol: unknown,
  code: WorkoutProtocolAdapterError['code'],
  path: string,
  message: string
) => {
  const matchError = (error: unknown) => {
    assert.ok(error instanceof WorkoutProtocolAdapterError);
    assert.equal(error.code, code);
    assert.equal(error.path, path);
    assert.equal(error.message, message);
    return true;
  };
  assert.throws(() => normalizeWorkoutProtocol(protocol), matchError);
  assert.throws(() => snapshotWorkoutProtocol(protocol, compileOptions), matchError);
};

const assertCompileError = (
  options: { startDate: Date | string; clock: Date | string | (() => Date) },
  code: WorkoutProtocolAdapterError['code'],
  path: string,
  message: string
) => {
  assert.throws(() => compileWorkoutProtocol(rangeProtocol, options), (error: unknown) => {
    assert.ok(error instanceof WorkoutProtocolAdapterError);
    assert.equal(error.code, code);
    assert.equal(error.path, path);
    assert.equal(error.message, message);
    return true;
  });
};

test('rejects malformed and contradictory input with exact typed error details', () => {
  assertAdapterError(null, 'INVALID_PROTOCOL', 'protocol', 'Expected an object.');
  assertAdapterError(
    { name: 'Invalid JSON', sessionsPerWeek: 1, phases: '{not-json' },
    'INVALID_PHASES', 'phases', 'Expected a phases array or JSON array string.'
  );
  assertAdapterError(
    { name: 'JSON object', sessionsPerWeek: 1, phases: '{}' },
    'INVALID_PHASES', 'phases', 'Expected a phases array or JSON array string.'
  );
  assertAdapterError(
    { name: 'Missing phases', sessionsPerWeek: 1, phases: [] },
    'INVALID_PHASES', 'phases', 'Expected at least one phase.'
  );
  assertAdapterError(
    { name: 'Non-array sessions', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: {} }] },
    'INVALID_SESSIONS', 'phases[0].sessions', 'Expected a non-empty sessions array.'
  );
  assertAdapterError(
    { name: 'Empty sessions', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [] }] },
    'INVALID_SESSIONS', 'phases[0].sessions', 'Expected a non-empty sessions array.'
  );
  assertAdapterError(
    { name: 'Overlap', sessionsPerWeek: 1, phases: [
      { name: 'One', weekStart: 1, weekEnd: 2, sessions: [{ name: 'A', exercises: [validExercise] }] },
      { name: 'Two', weekStart: 2, weekEnd: 3, sessions: [{ name: 'B', exercises: [validExercise] }] },
    ] },
    'INVALID_PHASE_RANGE', 'phases[1]', 'Phase ranges must be ordered, contiguous, and non-overlapping.'
  );
  assertAdapterError(
    { name: 'Gap', sessionsPerWeek: 1, phases: [
      { name: 'One', weekStart: 1, weekEnd: 1, sessions: [{ name: 'A', exercises: [validExercise] }] },
      { name: 'Two', weekStart: 3, weekEnd: 3, sessions: [{ name: 'B', exercises: [validExercise] }] },
    ] },
    'INVALID_PHASE_RANGE', 'phases[1]', 'Phase ranges must be ordered, contiguous, and non-overlapping.'
  );
  assertAdapterError(
    { name: 'Inverted', sessionsPerWeek: 1, phases: [{ name: 'One', weekStart: 2, weekEnd: 1, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_PHASE_RANGE', 'phases[0]', 'weekEnd must be on or after weekStart.'
  );
  assertAdapterError(
    { name: 'Conflict', sessionsPerWeek: 1, phases: [{ name: 'Conflict', durationWeeks: 1, weekStart: 1, weekEnd: 1, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_PHASE_DURATION', 'phases[0]', 'durationWeeks conflicts with weekStart/weekEnd.'
  );
  assertAdapterError(
    { name: 'Negative phase', sessionsPerWeek: 1, phases: [{ name: 'Negative', durationWeeks: -1, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_PHASE_DURATION', 'phases[0].durationWeeks', 'Expected a positive integer.'
  );
  assertAdapterError(
    { name: 'Blank labels', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ title: ' ', name: ' ', exercises: [validExercise] }] }] },
    'INVALID_SESSION_LABEL', 'phases[0].sessions[0]', 'Expected a non-blank title or name.'
  );
  assertAdapterError(
    { name: 'Frequency', sessionsPerWeek: 0, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_FREQUENCY', 'protocol.sessionsPerWeek', 'Expected a positive integer.'
  );
  assertAdapterError(
    { name: 'Fractional frequency', sessionsPerWeek: 1.5, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_FREQUENCY', 'protocol.sessionsPerWeek', 'Expected a positive integer.'
  );
  assertAdapterError(
    { name: 'Fractional phase', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1.5, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'INVALID_PHASE_DURATION', 'phases[0].durationWeeks', 'Expected a positive integer.'
  );
  ['15', '15-20 minutes', null, 0, -1, 15.5, NaN, Infinity].forEach((durationMinutes) => {
    assertAdapterError(
      { name: 'Invalid session duration', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', durationMinutes, exercises: [validExercise] }] }] },
      'INVALID_SESSION_DURATION', 'phases[0].sessions[0].durationMinutes', 'Expected durationMinutes to be a finite positive integer number.'
    );
  });
  const fallback = normalizeWorkoutProtocol({
    name: 'Title fallback', sessionsPerWeek: 1,
    phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ title: ' ', name: 'Valid name', exercises: [validExercise] }] }],
  });
  assert.equal(fallback.phases[0].sessions[0].label, 'Valid name');
});

test('rejects invalid injected start dates and clocks with exact public errors', () => {
  assertCompileError(
    { startDate: 'not-a-date', clock: compileOptions.clock },
    'INVALID_DATE', 'options.startDate', 'Expected a valid date.'
  );
  assertCompileError(
    { startDate: compileOptions.startDate, clock: 'not-a-clock' },
    'INVALID_DATE', 'options.clock', 'Expected a valid date.'
  );
});

test('fails closed on the real ongoing mobility sentinel without a plan or snapshot', () => {
  assertAdapterError(
    {
      name: 'Daily Mobility & Joint Health Protocol',
      durationWeeks: 0,
      sessionsPerWeek: 7,
      phases: [{
        name: 'Daily Morning Routine', weekStart: 1, weekEnd: 0,
        sessions: [{ name: 'Morning Joint Mobility', exercises: [{ name: 'Neck CARs', reps: 3 }] }],
      }],
    },
    'ONGOING_WINDOW_REQUIRED', 'protocol.durationWeeks', 'Finite plan compilation requires an explicit bounded window for ongoing protocols.'
  );
  assertAdapterError(
    { name: 'Ongoing phase', sessionsPerWeek: 1, phases: [{ name: 'Daily', durationWeeks: 0, sessions: [{ name: 'A', exercises: [validExercise] }] }] },
    'ONGOING_WINDOW_REQUIRED', 'phases[0].durationWeeks', 'Finite plan compilation requires an explicit bounded window for ongoing protocols.'
  );
});

test('rejects explicit invalid set shapes at the exact sets path without snapshots', () => {
  [0, -1, 1.5, [], null, { reps: 5 }, '2'].forEach((sets) => {
    assertAdapterError(
      { name: 'Invalid sets', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [{ name: 'Run', sets, reps: 5 }] }] }] },
      'INVALID_PRESCRIPTION', 'phases[0].sessions[0].exercises[0].sets', 'Expected sets to be a positive integer or non-empty array.'
    );
  });
});

test('rejects zero and metadata-only set entries without falling through to exercise targets', () => {
  [[{ reps: 0 }], [{ note: 'keep this tidy' }]].forEach((sets) => {
    assertAdapterError(
      { name: 'Unusable set entry', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [{ name: 'Run', sets, reps: 5 }] }] }] },
      'INVALID_PRESCRIPTION', 'phases[0].sessions[0].exercises[0].sets', 'Expected every set to contain an authored positive work target.'
    );
  });
  assertAdapterError(
    { name: 'Count only', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [{ name: 'Run', sets: 2, durationMinutes: 0 }] }] }] },
    'INVALID_PRESCRIPTION', 'phases[0].sessions[0].exercises[0]', 'Expected an authored exercise prescription.'
  );
});

test('preserves real four-set BFR positional reps when token count matches sets', () => {
  const result = normalizeWorkoutProtocol({
    name: 'BFR fixture', sessionsPerWeek: 1,
    phases: [{
      name: 'BFR', durationWeeks: 1,
      sessions: [{ name: 'BFR Session', totalDuration: '15-20 minutes', exercises: [{ name: 'BFR Leg Press', sets: 4, reps: '30-15-15-15' }] }],
    }],
  });
  const prescription = result.phases[0].sessions[0].prescription;
  assert.equal(prescription.totalDuration, '15-20 minutes');
  assert.deepEqual(prescription.exercises, [{ name: 'BFR Leg Press', sets: 4, reps: '30-15-15-15' }]);
  assert.equal(Object.prototype.hasOwnProperty.call(prescription, 'durationMinutes'), false);
});

test('rejects invalid authored ranges and mismatched BFR positionals exactly', () => {
  ['8-6', '8-8', '0-8', '8-0', '-6-8', '6.5-8', 'six-eight'].forEach((reps) => {
    assertAdapterError(
      { name: 'Invalid range', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [{ name: 'Nordic curl', sets: 2, reps }] }] }] },
      'INVALID_PRESCRIPTION', 'phases[0].sessions[0].exercises[0]', 'Expected an authored exercise prescription.'
    );
  });
  ['30-15-15', '30-15-0-15', '30-15-15-15-15'].forEach((reps) => {
    assertAdapterError(
      { name: 'Invalid BFR', sessionsPerWeek: 1, phases: [{ name: 'Start', durationWeeks: 1, sessions: [{ name: 'A', exercises: [{ name: 'BFR Leg Press', sets: 4, reps }] }] }] },
      'INVALID_PRESCRIPTION', 'phases[0].sessions[0].exercises[0].reps', 'Expected positional reps to contain one positive integer per set.'
    );
  });
});
