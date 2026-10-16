// Readable "Download my data" file (RB-FIX-7 I-7). Pure: takes the raw
// exportMemberData() result and reshapes it. No order/commerce tables, no
// internal ids, journal text decoded.
type Row = Record<string, any>
type Raw = { exportedAt: string; account: Row | null; data: Record<string, Row[]>; peptideNames?: Record<string, string> }

// Tables that are commerce or plumbing, never part of a member's own record.
const DROPPED = new Set([
  'peptide_orders', 'AffiliateTracking', 'SuccessDeposit', 'DriveSyncOutbox', 'ScheduledNotification',
  'NotificationDelivery', 'EmailFailureLog', 'PushSubscription', 'PushSubscriptionHealth', 'MigrationManifest',
  'VoiceUsageLog', 'AIUsage',
])

const day = (v: unknown) => (v ? String(v).slice(0, 10) : undefined)

/** Remove internal ids (id, userId, *Id) and empty values; keep dates and everything else. */
export function tidy(row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || /Id$/.test(k) || v === null || v === undefined || v === '') continue
    out[k] = v
  }
  return out
}
const tidyAll = (rows?: Row[]) => (rows ?? []).map(tidy)

function decodeJournal(r: Row): Row {
  let e: Row = {}
  try { e = typeof r.entry === 'string' ? JSON.parse(r.entry) : r.entry ?? {} } catch { e = { reflection: String(r.entry) } }
  return tidy({
    date: day(r.date),
    mood: r.mood,
    weight: r.weight,
    reflection: e.reasonsValidation,
    affirmations: tidy({ iAm: e.affirmationGoal, because: e.affirmationBecause, whichMeans: e.affirmationMeans }),
    notes: tidy({
      peptides: e.peptideNotes, workouts: e.workoutNotes, nutrition: e.nutritionNotes,
      breath: e.breathNotes, modules: e.moduleNotes,
    }),
    tasksCompleted: e.tasksCompleted && Object.keys(e.tasksCompleted).length ? e.tasksCompleted : undefined,
  })
}

export function shapeMemberExport(raw: Raw) {
  const d = raw.data ?? {}
  const a = raw.account ?? {}
  const names = new Map<string, string>()
  const catalog = raw.peptideNames ?? {}
  for (const dose of d.peptide_doses ?? []) if (dose.protocolId && dose.protocolName) names.set(dose.protocolId, dose.protocolName)
  // Drop empty sections' noise: prune empty arrays at the end.
  const out: Row = {
    README: {
      about: 'Your Reset Biology data, exactly as we hold it. Reset Biology sells nothing and shares nothing.',
      profile: 'Your name, username, email and preferences.',
      journal: 'Your daily journal entries: reflection, three affirmation lines, mood, weight, and the dose and activity notes.',
      peptides: 'Your protocols (what you take and when) and every dose you logged.',
      nutrition: 'Foods you logged, with amounts and nutrients.',
      workouts: 'Workout sessions, check-ins and programs.',
      breath: 'Breath practice sessions and your exercises.',
      mentalTraining: 'Memory (n-back), vision and module practice.',
      progress: 'Daily checklist ticks and points.',
      other: 'Anything else tied to your account, such as reminder settings.',
    },
    exportedAt: raw.exportedAt,
    profile: tidy({
      name: a.name, username: a.username, email: a.email, memberSince: day(a.createdAt),
      preferences: a.profileData ?? undefined, googleDriveConnected: a.googleDriveSyncEnabled ? true : undefined,
    }),
    journal: (d.JournalEntry ?? []).map(decodeJournal).sort((x, y) => String(x.date).localeCompare(String(y.date))),
    peptides: {
      protocols: (d.user_peptide_protocols ?? []).map((p) => tidy({
        peptide: catalog[p.peptideId] ?? names.get(p.id), startDate: day(p.startDate), endDate: day(p.endDate), dosage: p.dosage,
        frequency: p.frequency, timing: p.timing, notes: p.notes, active: p.isActive, administrationType: p.administrationType,
      })),
      doses: (d.peptide_doses ?? []).map((x) => tidy({
        date: x.localDate ?? day(x.doseDate), time: x.time, peptide: x.protocolName, dosage: x.dosage, notes: x.notes, sideEffects: x.sideEffects,
      })),
    },
    nutrition: [...tidyAll(d.FoodLog), ...tidyAll(d.FoodEntry)],
    workouts: {
      sessions: tidyAll(d.WorkoutSession), checkIns: tidyAll(d.WorkoutCheckIn),
      programs: tidyAll(d.WorkoutProgram), assignments: tidyAll(d.WorkoutAssignment), events: tidyAll(d.WorkoutEvent),
    },
    breath: { sessions: tidyAll(d.BreathSession), exercises: tidyAll(d.UserBreathExercise) },
    mentalTraining: {
      nBackSessions: tidyAll(d.NBackSession), nBackProgress: tidyAll(d.NBackProgress),
      visionSessions: [...tidyAll(d.VisionSession), ...tidyAll(d.VisionDailySession)], visionProgress: tidyAll(d.VisionProgress),
      modules: tidyAll(d.ModuleCompletion),
    },
    progress: { dailyChecklist: tidyAll(d.DailyTask), points: tidyAll(d.GamificationPoint), awards: tidyAll(d.DailyAward) },
    other: {} as Row,
  }
  const handled = new Set([
    'JournalEntry', 'user_peptide_protocols', 'peptide_doses', 'FoodLog', 'FoodEntry', 'WorkoutSession', 'WorkoutCheckIn',
    'WorkoutProgram', 'WorkoutAssignment', 'WorkoutEvent', 'BreathSession', 'UserBreathExercise', 'NBackSession', 'NBackProgress',
    'VisionSession', 'VisionDailySession', 'VisionProgress', 'ModuleCompletion', 'DailyTask', 'GamificationPoint', 'DailyAward',
  ])
  for (const [model, rows] of Object.entries(d)) {
    if (handled.has(model) || DROPPED.has(model) || !rows?.length) continue
    out.other[model] = tidyAll(rows)
  }
  return out
}
