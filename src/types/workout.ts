export type ProtocolIntensity = 'low' | 'moderate' | 'high';

export interface ProtocolExerciseSet {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  tempo?: string;
  rir?: string;
  restSeconds?: number;
  instructions?: string;
}

export interface ProtocolExercise {
  key: string;
  name: string;
  pattern: string;
  equipment?: string[];
  description?: string;
  videoUrl?: string;
  cues?: string[];
  swapOptions?: string[];
  sets: ProtocolExerciseSet[];
}

export interface ProtocolBlock {
  key: string;
  label: string;
  focus: string;
  notes?: string;
  structure?: string;
  exercises: ProtocolExercise[];
}

export interface ProtocolSession {
  key: string;
  title: string;
  goal: string;
  description?: string;
  durationMinutes: number;
  intensity: ProtocolIntensity;
  readinessTips?: string[];
  blocks: ProtocolBlock[];
}

export interface ProtocolPhase {
  key: string;
  name: string;
  focus: string[];
  durationWeeks: number;
  notes?: string;
  progressionModel?: string;
  sessions: ProtocolSession[];
}

export interface ResearchLink {
  label: string;
  url: string;
}

// W4: bank-verified structured citation. Every URL shipped on one of these
// must have been resolved (curl/fetch) by the session that added it -- see
// data/rb-workout-rework/runtime-logs/scratch-2026-07-18-aedf/ticket-W4.md.
export interface ProtocolCitation {
  label: string;
  journal: string;
  year: number;
  url: string;
  pmid?: string;
}

export interface CuratedWorkoutProtocol {
  slug: string;
  name: string;
  summary: string;
  goal: string;
  trainingLevel: string;
  tags: string[];
  focusAreas: string[];
  equipment: string[];
  durationWeeks: number;
  sessionsPerWeek: number;
  readinessGuidelines: string[];
  aiInsights: string[];
  progressionNotes: string;
  researchLinks: ResearchLink[];
  // W4 education block -- giver-voice, source-derived, never invented.
  whoItsFor: string;
  evidenceSummary: string;
  progressionRule: string;
  deloadRule: string;
  citations: ProtocolCitation[];
  phases: ProtocolPhase[];
}

export interface WorkoutProtocolRecord {
  id: string;
  slug: string;
  name: string;
  summary?: string | null;
  goal?: string | null;
  level?: string | null;
  durationWeeks?: number | null;
  sessionsPerWeek?: number | null;
  tags?: string[];
  focusAreas?: string[];
  equipment?: string[] | null;
  readinessNotes?: string[] | null;
  aiInsights?: string[] | null;
  researchLinks?: ResearchLink[] | null;
  phases?: ProtocolPhase[];
  // W4: flattened out of the aiInsights JSON column by getAvailableWorkoutProtocols
  // (no dedicated schema column -- see workoutProtocolService.ts).
  whoItsFor?: string | null;
  evidenceSummary?: string | null;
  progressionRule?: string | null;
  deloadRule?: string | null;
  citations?: ProtocolCitation[] | null;
}

export interface AssignmentPersonalization {
  availableEquipment?: string[];
  sessionTimePreference?: 'morning' | 'midday' | 'evening';
  goalPriority?: string;
  mobilityConstraints?: string[];
  recoveryFocus?: string;
}

export type PlanSessionStatus = 'planned' | 'in-progress' | 'completed' | 'skipped';

export interface PlanSessionBlock {
  label: string;
  focus: string;
  notes?: string;
  exercises: ProtocolExercise[];
}

export interface AssignmentPlanSession {
  id: string;
  phaseKey: string;
  week: number;
  sequence: number;
  sessionKey: string;
  title: string;
  summary: string;
  scheduledDate?: string;
  intensity: ProtocolIntensity;
  durationMinutes: number;
  status: PlanSessionStatus;
  readinessTips?: string[];
  blocks: PlanSessionBlock[];
  sessionNotes?: string | null;
  updatedAt?: string;
}

export interface AssignmentPlan {
  createdAt: string;
  personalization?: AssignmentPersonalization;
  sessions: AssignmentPlanSession[];
}

export type WorkoutAssignmentStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface WorkoutAssignmentRecord {
  id: string;
  protocolId: string;
  status: WorkoutAssignmentStatus;
  startDate?: string;
  endDate?: string;
  plan?: AssignmentPlan;
  currentSessionIndex: number;
  progress?: {
    completedSessions: number;
    skippedSessions: number;
  };
  protocol?: {
    name: string;
    summary?: string;
    tags?: string[];
    level?: string | null;
    goal?: string;
  };
}

export interface WorkoutCheckInRecord {
  id: string;
  readinessScore?: number;
  energyLevel?: number;
  sorenessLevel?: number;
  sleepHours?: number;
  stressLevel?: number;
  mood?: string;
  notes?: string;
  createdAt: string;
  assignmentId?: string;
}
