export type VisionSessionBlock = {
  title: string;
  description: string;
  duration: string;
  exerciseIds: string[];
  intent: string;
  cues: string[];
};

export type VisionWave = {
  key: string;
  title: string;
  duration: string;
  rhythm: string;
  goals: string[];
  recovery: string[];
  blocks: VisionSessionBlock[];
};

export const visionWaves: VisionWave[] = [
  {
    key: 'neuro-primer',
    title: 'Neuro-Ocular Primer',
    duration: 'Weeks 1-2',
    rhythm: '5 sessions per week • ~18 minutes',
    goals: [
      'Downshift sympathetic tone before every drill',
      'Re-teach convergence/divergence with conscious pace',
      'Collect near/far Snellen baselines inside the trainer',
    ],
    recovery: ['Micro eye massages hourly', 'Blue-light breaks every 45 minutes'],
    blocks: [
      {
        title: 'Downshift + hydrate',
        description: 'Parasympathetic entry stacked with awareness of micro-movements.',
        duration: '4 min',
        exerciseIds: ['palming-reset', 'box-breath-vision'],
        intent: 'Calm ocular nerves and prep tear film before neural work.',
        cues: ['Zero shoulder tension', 'Exhale longer than inhale'],
      },
      {
        title: 'Mechanics lab',
        description: 'Foundational convergence/divergence work at slow intent.',
        duration: '8 min',
        exerciseIds: ['focus-pushups', 'smooth-tracking'],
        intent: 'Teach eyes to glide rather than jump.',
        cues: ['0.5 cm increments', 'Head locked via gentle nod'],
      },
      {
        title: 'Calibration moment',
        description: 'Use Snellen trainer + figure-eight fixation to log clarity.',
        duration: '6 min',
        exerciseIds: ['figure8-fixation'],
        intent: 'Finish with focus that sticks.',
        cues: ['Breathe between loops', 'Note blur timing'],
      },
    ],
  },
  {
    key: 'movement-integration',
    title: 'Movement Integration',
    duration: 'Weeks 3-4',
    rhythm: '5 sessions per week • ~22 minutes',
    goals: [
      'Expand peripheral awareness while seated and walking',
      'Blend head control + locomotion + ocular tasks',
      'Introduce distance toggling without losing calm',
    ],
    recovery: ['Neck CARs daily', 'Vision-free walks in natural light on weekends'],
    blocks: [
      {
        title: 'Priming & posture',
        description: 'Same downshift stack plus gentle cervical check-in.',
        duration: '4 min',
        exerciseIds: ['palming-reset'],
        intent: 'Keep parasympathetic tone high before adding movement.',
        cues: ['Scan jaw tension', 'Set tripod stance'],
      },
      {
        title: 'Peripheral activation',
        description: 'Seated → standing mapping of environment edges.',
        duration: '8 min',
        exerciseIds: ['peripheral-pointing', 'mirror-scan'],
        intent: 'Reduce tunnel vision habits.',
        cues: ['Call color before pointing', 'Keep ribs stacked'],
      },
      {
        title: 'Dynamic distance',
        description: 'Walks + trombone toggles to stress accommodation.',
        duration: '10 min',
        exerciseIds: ['focus-trombone', 'snellen-layering-walks'],
        intent: 'Tie gains to gait and daily tasks.',
        cues: ['Add heel-to-toe pattern', 'Read aloud your letters'],
      },
    ],
  },
  {
    key: 'resilience-build',
    title: 'Resilience & Speed',
    duration: 'Weeks 5-6',
    rhythm: '4 sessions per week • ~24 minutes',
    goals: [
      'Increase saccade speed without sacrificing clarity',
      'Sharpen laterality & depth perception for sport/work',
      'Stress test long-distance Snellen targets under fatigue',
    ],
    recovery: ['Cool towel on eyes post-session', 'Extra palming between high-speed sets'],
    blocks: [
      {
        title: 'Activation',
        description: 'Breath-led focus to avoid sympathetic spikes.',
        duration: '4 min',
        exerciseIds: ['box-breath-vision'],
        intent: 'Arrive calm even when workload kicks up.',
        cues: ['Count box beats', 'Notice micro saccades'],
      },
      {
        title: 'Speed stack',
        description: 'Metronome-guided saccades + laterality combos.',
        duration: '12 min',
        exerciseIds: ['eye-jumps', 'laterality-ladder'],
        intent: 'Boost reading & sport-specific quickness.',
        cues: ['60 → 80 bpm once accuracy ≥ 90%', 'Cross-call cues aloud'],
      },
      {
        title: 'Integration & proof',
        description: 'Finish with mirror scan or Snellen walks to prove control under fatigue.',
        duration: '8 min',
        exerciseIds: ['mirror-scan', 'snellen-layering-walks'],
        intent: 'Lock in gains with real-world motion.',
        cues: ['Film yourself weekly', 'Log furthest clear line'],
      },
    ],
  },
];

export const visionMetrics = [
  {
    label: 'Near point of convergence',
    target: '< 5 cm',
    howTo: 'Use focus pushups and record the closest distance before blur or diplopia.',
  },
  {
    label: 'Far Snellen distance',
    target: '3 m clear 20/20 line',
    howTo: 'Use the Snellen trainer or printed chart and log the furthest clean line.',
  },
  {
    label: 'Smooth pursuit stability',
    target: '45°/sec without head drift',
    howTo: 'Film smooth tracking and count frames where head leaves midline.',
  },
  {
    label: 'Peripheral awareness score',
    target: '≥ 10 objects per sweep',
    howTo: 'Peripheral pointing drill – number of distinct objects identified per minute.',
  },
];

export const readinessPrompts = [
  "How gritty or hydrated do your eyes feel before today's work?",
  'Any neck/upper-trap tightness that might limit ocular range?',
  'What was the furthest clear Snellen line yesterday (near + far)?',
  "Rate today's screen load (low / medium / brutal).",
];

// ============================================
// 12-WEEK MASTER VISION PROGRAM
// ============================================
// Based on ScreenFit model: Daily baseline + progressive exercises
// Each week has 5 training days with specific focus

export type DailySession = {
  day: number; // 1-5 (Mon-Fri)
  title: string;
  focus: string;
  baselineMinutes: number; // Snellen baseline check
  exerciseMinutes: number; // Progressive exercises
  exerciseIds: string[]; // From visionExercises
  coachingCues: string[];
};

export type WeeklyPlan = {
  week: number;
  title: string;
  phase: string;
  goals: string[];
  sessions: DailySession[];
  weekendRecovery: string[];
};

export type VisionMasterProgram = {
  id: string;
  name: string;
  totalWeeks: number;
  description: string;
  weeklyPlans: WeeklyPlan[];
};

export const visionMasterProgram: VisionMasterProgram = {
  id: 'screenfit-12week',
  name: 'ScreenFit Vision Recovery Program',
  totalWeeks: 12,
  description: 'Complete 12-week vision restoration program combining daily Snellen baseline measurements with progressive eye exercises from the ScreenFit methodology.',
  weeklyPlans: [
    // PHASE 1: FOUNDATION (Weeks 1-2)
    {
      week: 1,
      title: 'Neural Reset',
      phase: 'Foundation',
      goals: [
        'Establish baseline Snellen measurements (near + far)',
        'Learn parasympathetic downshift techniques',
        'Build awareness of eye tension patterns'
      ],
      sessions: [
        {
          day: 1,
          title: 'Baseline Day',
          focus: 'Establish your starting point',
          baselineMinutes: 5,
          exerciseMinutes: 10,
          exerciseIds: ['palming-reset', 'box-breath-vision'],
          coachingCues: ['Record both near and far Snellen scores', 'Note any blur patterns']
        },
        {
          day: 2,
          title: 'Downshift Practice',
          focus: 'Master the parasympathetic reset',
          baselineMinutes: 3,
          exerciseMinutes: 12,
          exerciseIds: ['palming-reset', 'box-breath-vision'],
          coachingCues: ['Focus on exhale length', 'Notice warmth from palms']
        },
        {
          day: 3,
          title: 'Focus Introduction',
          focus: 'Begin convergence training',
          baselineMinutes: 3,
          exerciseMinutes: 15,
          exerciseIds: ['palming-reset', 'focus-pushups'],
          coachingCues: ['Start at comfortable distance', 'Stop before strain']
        },
        {
          day: 4,
          title: 'Mechanics Basics',
          focus: 'Eye movement quality',
          baselineMinutes: 3,
          exerciseMinutes: 15,
          exerciseIds: ['box-breath-vision', 'smooth-tracking'],
          coachingCues: ['Head stays still', 'Eyes glide, never jerk']
        },
        {
          day: 5,
          title: 'Week 1 Assessment',
          focus: 'Measure progress',
          baselineMinutes: 5,
          exerciseMinutes: 10,
          exerciseIds: ['palming-reset', 'figure8-fixation'],
          coachingCues: ['Compare to Day 1 baselines', 'Log any improvements']
        }
      ],
      weekendRecovery: ['Eye massage morning & evening', 'Blue light glasses all screen time', '20-20-20 rule hourly']
    },
    {
      week: 2,
      title: 'Building Habits',
      phase: 'Foundation',
      goals: [
        'Solidify daily practice routine',
        'Improve convergence control',
        'Add figure-8 fixation work'
      ],
      sessions: [
        {
          day: 1,
          title: 'Convergence Focus',
          focus: 'Push near point closer',
          baselineMinutes: 3,
          exerciseMinutes: 15,
          exerciseIds: ['palming-reset', 'focus-pushups', 'figure8-fixation'],
          coachingCues: ['Exhale as target approaches', 'Log your near point']
        },
        {
          day: 2,
          title: 'Smooth Pursuit Day',
          focus: 'Eliminate jerky movements',
          baselineMinutes: 3,
          exerciseMinutes: 15,
          exerciseIds: ['box-breath-vision', 'smooth-tracking', 'figure8-fixation'],
          coachingCues: ['Count 4 seconds per loop', 'No head movement']
        },
        {
          day: 3,
          title: 'Distance Work',
          focus: 'Challenge far focus',
          baselineMinutes: 5,
          exerciseMinutes: 12,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Step back 2cm when clear', 'Breathe between toggles']
        },
        {
          day: 4,
          title: 'Combo Training',
          focus: 'Stack multiple skills',
          baselineMinutes: 3,
          exerciseMinutes: 18,
          exerciseIds: ['focus-pushups', 'smooth-tracking', 'figure8-fixation'],
          coachingCues: ['Quality over speed', 'Rest between exercises']
        },
        {
          day: 5,
          title: 'Phase 1 Completion',
          focus: 'Foundation assessment',
          baselineMinutes: 5,
          exerciseMinutes: 12,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Full baseline test', 'Record improvements from Week 1']
        }
      ],
      weekendRecovery: ['Outdoor time without screens', 'Distance gazing practice', 'Natural light exposure']
    },
    // PHASE 2: INTEGRATION (Weeks 3-4)
    {
      week: 3,
      title: 'Peripheral Awakening',
      phase: 'Integration',
      goals: [
        'Expand peripheral awareness',
        'Reduce tunnel vision habits',
        'Integrate movement with vision'
      ],
      sessions: [
        {
          day: 1,
          title: 'Peripheral Introduction',
          focus: 'Widen your visual field',
          baselineMinutes: 3,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'peripheral-pointing'],
          coachingCues: ['Eyes stay center', 'Notice edges of vision']
        },
        {
          day: 2,
          title: 'Mirror Work',
          focus: 'Stability under scanning',
          baselineMinutes: 3,
          exerciseMinutes: 18,
          exerciseIds: ['box-breath-vision', 'mirror-scan', 'peripheral-pointing'],
          coachingCues: ['Head stays locked', 'Full range eye movement']
        },
        {
          day: 3,
          title: 'Movement Combo',
          focus: 'Eyes + body coordination',
          baselineMinutes: 3,
          exerciseMinutes: 20,
          exerciseIds: ['focus-pushups', 'mirror-scan', 'snellen-layering-walks'],
          coachingCues: ['Slow heel-to-toe walks', 'Read as you move']
        },
        {
          day: 4,
          title: 'Distance Toggle',
          focus: 'Rapid accommodation shifts',
          baselineMinutes: 3,
          exerciseMinutes: 18,
          exerciseIds: ['focus-trombone', 'peripheral-pointing'],
          coachingCues: ['One breath per toggle', 'Maintain peripheral awareness']
        },
        {
          day: 5,
          title: 'Week 3 Review',
          focus: 'Integration assessment',
          baselineMinutes: 5,
          exerciseMinutes: 15,
          exerciseIds: ['palming-reset', 'snellen-layering-walks'],
          coachingCues: ['Test peripheral count', 'Log Snellen progress']
        }
      ],
      weekendRecovery: ['Walking in nature (eyes relaxed)', 'No close-up screens for 4+ hours', 'Peripheral games outdoors']
    },
    {
      week: 4,
      title: 'Dynamic Vision',
      phase: 'Integration',
      goals: [
        'Cement peripheral skills',
        'Add walking drills',
        'Stress test accommodation'
      ],
      sessions: [
        {
          day: 1,
          title: 'Walking Vision',
          focus: 'Vision in motion',
          baselineMinutes: 3,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'snellen-layering-walks', 'focus-trombone'],
          coachingCues: ['Maintain clarity while walking', 'Slow controlled steps']
        },
        {
          day: 2,
          title: 'Peripheral Challenge',
          focus: 'Push peripheral limits',
          baselineMinutes: 3,
          exerciseMinutes: 20,
          exerciseIds: ['peripheral-pointing', 'mirror-scan'],
          coachingCues: ['Add category rules', 'Count objects per sweep']
        },
        {
          day: 3,
          title: 'Full Stack',
          focus: 'All skills combined',
          baselineMinutes: 3,
          exerciseMinutes: 22,
          exerciseIds: ['box-breath-vision', 'focus-pushups', 'peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Quality at every station', 'Breathe between switches']
        },
        {
          day: 4,
          title: 'Distance Mastery',
          focus: 'Far vision development',
          baselineMinutes: 5,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'focus-trombone', 'mirror-scan'],
          coachingCues: ['Push far distance', 'Step back when clear']
        },
        {
          day: 5,
          title: 'Phase 2 Complete',
          focus: 'Integration mastery test',
          baselineMinutes: 5,
          exerciseMinutes: 15,
          exerciseIds: ['peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Record peripheral score', 'Full Snellen assessment']
        }
      ],
      weekendRecovery: ['Outdoor sports/activities', 'Distance viewing practice', 'Screen break day']
    },
    // PHASE 3: SPEED & RESILIENCE (Weeks 5-6)
    {
      week: 5,
      title: 'Speed Introduction',
      phase: 'Speed & Resilience',
      goals: [
        'Introduce saccade speed training',
        'Build reading endurance',
        'Maintain peripheral gains'
      ],
      sessions: [
        {
          day: 1,
          title: 'Saccade Basics',
          focus: 'Fast eye jumps',
          baselineMinutes: 3,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'eye-jumps'],
          coachingCues: ['Start at 60 bpm', 'Accuracy before speed']
        },
        {
          day: 2,
          title: 'Speed + Peripheral',
          focus: 'Dual challenge',
          baselineMinutes: 3,
          exerciseMinutes: 22,
          exerciseIds: ['eye-jumps', 'peripheral-pointing'],
          coachingCues: ['Maintain peripheral awareness', 'No head bobbing']
        },
        {
          day: 3,
          title: 'Laterality Intro',
          focus: 'Cross-body coordination',
          baselineMinutes: 3,
          exerciseMinutes: 22,
          exerciseIds: ['box-breath-vision', 'laterality-ladder', 'eye-jumps'],
          coachingCues: ['Call left/right aloud', 'Eye-hand sync']
        },
        {
          day: 4,
          title: 'Endurance Stack',
          focus: 'Extended focus work',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['focus-pushups', 'eye-jumps', 'snellen-layering-walks'],
          coachingCues: ['Push duration', 'Breathe through fatigue']
        },
        {
          day: 5,
          title: 'Week 5 Assessment',
          focus: 'Speed baseline',
          baselineMinutes: 5,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'eye-jumps', 'laterality-ladder'],
          coachingCues: ['Record max bpm', 'Log accuracy at speed']
        }
      ],
      weekendRecovery: ['Extra palming sessions', 'Cool towel on eyes', 'Sleep prioritization']
    },
    {
      week: 6,
      title: 'Resilience Building',
      phase: 'Speed & Resilience',
      goals: [
        'Push saccade speed higher',
        'Stress test under fatigue',
        'Solidify laterality'
      ],
      sessions: [
        {
          day: 1,
          title: 'Speed Push',
          focus: 'Increase tempo',
          baselineMinutes: 3,
          exerciseMinutes: 22,
          exerciseIds: ['palming-reset', 'eye-jumps', 'laterality-ladder'],
          coachingCues: ['Add 5 bpm if 90%+ accuracy', 'Quality over speed']
        },
        {
          day: 2,
          title: 'Fatigue Protocol',
          focus: 'Vision under stress',
          baselineMinutes: 3,
          exerciseMinutes: 25,
          exerciseIds: ['focus-pushups', 'eye-jumps', 'mirror-scan', 'snellen-layering-walks'],
          coachingCues: ['No rest between drills', 'Maintain quality']
        },
        {
          day: 3,
          title: 'Laterality Mastery',
          focus: 'Cross-body perfection',
          baselineMinutes: 3,
          exerciseMinutes: 22,
          exerciseIds: ['laterality-ladder', 'eye-jumps', 'peripheral-pointing'],
          coachingCues: ['Add complexity', 'Verbal cues required']
        },
        {
          day: 4,
          title: 'Combo Challenge',
          focus: 'All speed skills',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['box-breath-vision', 'eye-jumps', 'laterality-ladder', 'focus-trombone'],
          coachingCues: ['Push limits safely', 'Rest if blur persists']
        },
        {
          day: 5,
          title: 'Phase 3 Complete',
          focus: 'Speed mastery test',
          baselineMinutes: 5,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'eye-jumps', 'snellen-layering-walks'],
          coachingCues: ['Record best bpm', 'Full Snellen test']
        }
      ],
      weekendRecovery: ['Extra rest', 'Massage around eyes', 'Hydration focus']
    },
    // PHASE 4: ADVANCED (Weeks 7-8)
    {
      week: 7,
      title: 'Advanced Peripheral',
      phase: 'Advanced',
      goals: [
        'Maximize peripheral range',
        'Add cognitive load',
        'Dual-task mastery'
      ],
      sessions: [
        {
          day: 1,
          title: 'Peripheral Push',
          focus: 'Maximum range',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['palming-reset', 'peripheral-pointing', 'mirror-scan'],
          coachingCues: ['Push to edges', 'Add category filtering']
        },
        {
          day: 2,
          title: 'Cognitive Stack',
          focus: 'Vision + thinking',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['laterality-ladder', 'peripheral-pointing', 'focus-trombone'],
          coachingCues: ['Add math challenges', 'Verbal responses required']
        },
        {
          day: 3,
          title: 'Movement Integration',
          focus: 'Walking + cognitive',
          baselineMinutes: 3,
          exerciseMinutes: 26,
          exerciseIds: ['snellen-layering-walks', 'laterality-ladder', 'eye-jumps'],
          coachingCues: ['Complex walking patterns', 'Maintain clarity']
        },
        {
          day: 4,
          title: 'Full Challenge',
          focus: 'All advanced skills',
          baselineMinutes: 3,
          exerciseMinutes: 26,
          exerciseIds: ['peripheral-pointing', 'eye-jumps', 'laterality-ladder', 'mirror-scan'],
          coachingCues: ['No rest between', 'Push limits']
        },
        {
          day: 5,
          title: 'Week 7 Review',
          focus: 'Advanced assessment',
          baselineMinutes: 5,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Record peripheral max', 'Log Snellen progress']
        }
      ],
      weekendRecovery: ['Sport with peripheral focus', 'Driving awareness practice', 'Natural vision time']
    },
    {
      week: 8,
      title: 'Speed Mastery',
      phase: 'Advanced',
      goals: [
        'Peak saccade performance',
        'Reading speed application',
        'Sport-ready vision'
      ],
      sessions: [
        {
          day: 1,
          title: 'Speed Peak',
          focus: 'Maximum tempo',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['palming-reset', 'eye-jumps', 'laterality-ladder'],
          coachingCues: ['Push to 80+ bpm', 'Maintain 85% accuracy']
        },
        {
          day: 2,
          title: 'Reading Application',
          focus: 'Speed to reading',
          baselineMinutes: 3,
          exerciseMinutes: 24,
          exerciseIds: ['eye-jumps', 'focus-trombone', 'snellen-layering-walks'],
          coachingCues: ['Read aloud at each jump', 'Comprehension counts']
        },
        {
          day: 3,
          title: 'Sport Simulation',
          focus: 'Dynamic tracking',
          baselineMinutes: 3,
          exerciseMinutes: 26,
          exerciseIds: ['smooth-tracking', 'eye-jumps', 'peripheral-pointing', 'laterality-ladder'],
          coachingCues: ['Simulate sport scenarios', 'Varied speeds']
        },
        {
          day: 4,
          title: 'Peak Performance',
          focus: 'All skills maxed',
          baselineMinutes: 3,
          exerciseMinutes: 28,
          exerciseIds: ['eye-jumps', 'laterality-ladder', 'peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Personal best attempts', 'Record all metrics']
        },
        {
          day: 5,
          title: 'Phase 4 Complete',
          focus: 'Advanced mastery',
          baselineMinutes: 5,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'eye-jumps', 'peripheral-pointing'],
          coachingCues: ['Full assessment', 'Compare to Week 1']
        }
      ],
      weekendRecovery: ['Active recovery', 'Sport participation', 'Real-world application']
    },
    // PHASE 5: DISTANCE MASTERY (Weeks 9-10)
    {
      week: 9,
      title: 'Far Vision Focus',
      phase: 'Distance Mastery',
      goals: [
        'Push far vision limits',
        'Distance progression with readers',
        'Outdoor distance work'
      ],
      sessions: [
        {
          day: 1,
          title: 'Distance Baseline',
          focus: 'Far vision assessment',
          baselineMinutes: 8,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Full far Snellen test', 'Record max clear distance']
        },
        {
          day: 2,
          title: 'Reader Progression',
          focus: 'Near + readers training',
          baselineMinutes: 5,
          exerciseMinutes: 22,
          exerciseIds: ['focus-pushups', 'focus-trombone'],
          coachingCues: ['Use reader glasses if available', 'Track distance progression']
        },
        {
          day: 3,
          title: 'Distance Challenge',
          focus: 'Push far limits',
          baselineMinutes: 5,
          exerciseMinutes: 22,
          exerciseIds: ['box-breath-vision', 'focus-trombone', 'snellen-layering-walks'],
          coachingCues: ['Step back 5cm when clear', 'Outdoor practice if possible']
        },
        {
          day: 4,
          title: 'Near-Far Toggle',
          focus: 'Rapid accommodation',
          baselineMinutes: 5,
          exerciseMinutes: 24,
          exerciseIds: ['focus-pushups', 'focus-trombone', 'eye-jumps'],
          coachingCues: ['Speed up toggles', 'Maintain clarity both ends']
        },
        {
          day: 5,
          title: 'Week 9 Review',
          focus: 'Distance progress',
          baselineMinutes: 8,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Record new far max', 'Log reader glasses stage']
        }
      ],
      weekendRecovery: ['Outdoor distance viewing', 'No close screens', 'Nature walks']
    },
    {
      week: 10,
      title: 'Vision Range',
      phase: 'Distance Mastery',
      goals: [
        'Maximize total vision range',
        'Near point optimization',
        'Full spectrum clarity'
      ],
      sessions: [
        {
          day: 1,
          title: 'Near Point Push',
          focus: 'Minimize near point',
          baselineMinutes: 5,
          exerciseMinutes: 22,
          exerciseIds: ['palming-reset', 'focus-pushups'],
          coachingCues: ['Push closer in 0.5cm increments', 'Exhale on approach']
        },
        {
          day: 2,
          title: 'Range Expansion',
          focus: 'Both ends simultaneously',
          baselineMinutes: 5,
          exerciseMinutes: 24,
          exerciseIds: ['focus-trombone', 'focus-pushups', 'snellen-layering-walks'],
          coachingCues: ['Alternate near and far', 'Track both improvements']
        },
        {
          day: 3,
          title: 'Sustained Clarity',
          focus: 'Hold focus longer',
          baselineMinutes: 5,
          exerciseMinutes: 24,
          exerciseIds: ['figure8-fixation', 'focus-trombone', 'smooth-tracking'],
          coachingCues: ['Extend hold times', '10+ seconds per distance']
        },
        {
          day: 4,
          title: 'Peak Range',
          focus: 'Maximum range test',
          baselineMinutes: 5,
          exerciseMinutes: 26,
          exerciseIds: ['focus-pushups', 'focus-trombone', 'snellen-layering-walks'],
          coachingCues: ['Personal best near + far', 'Record all metrics']
        },
        {
          day: 5,
          title: 'Phase 5 Complete',
          focus: 'Distance mastery assessment',
          baselineMinutes: 8,
          exerciseMinutes: 18,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Full range test', 'Compare to Week 1 baselines']
        }
      ],
      weekendRecovery: ['Distance viewing all day', 'Minimize close work', 'Outdoor activities']
    },
    // PHASE 6: INTEGRATION & MAINTENANCE (Weeks 11-12)
    {
      week: 11,
      title: 'Full Integration',
      phase: 'Integration & Maintenance',
      goals: [
        'Combine all learned skills',
        'Real-world application',
        'Build sustainable habits'
      ],
      sessions: [
        {
          day: 1,
          title: 'Complete Stack',
          focus: 'All skills rotation',
          baselineMinutes: 5,
          exerciseMinutes: 25,
          exerciseIds: ['palming-reset', 'focus-pushups', 'peripheral-pointing', 'eye-jumps'],
          coachingCues: ['Touch each skill area', 'Quality check all']
        },
        {
          day: 2,
          title: 'Real World Sim',
          focus: 'Daily life application',
          baselineMinutes: 3,
          exerciseMinutes: 25,
          exerciseIds: ['snellen-layering-walks', 'peripheral-pointing', 'focus-trombone'],
          coachingCues: ['Simulate work scenarios', 'Apply to daily tasks']
        },
        {
          day: 3,
          title: 'Stress Test',
          focus: 'Performance under pressure',
          baselineMinutes: 3,
          exerciseMinutes: 28,
          exerciseIds: ['eye-jumps', 'laterality-ladder', 'peripheral-pointing', 'focus-trombone'],
          coachingCues: ['No breaks between', 'Maintain all quality']
        },
        {
          day: 4,
          title: 'Habit Building',
          focus: 'Sustainable practice',
          baselineMinutes: 5,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'focus-pushups', 'smooth-tracking'],
          coachingCues: ['Design your maintenance routine', 'Plan post-program']
        },
        {
          day: 5,
          title: 'Week 11 Review',
          focus: 'Integration check',
          baselineMinutes: 5,
          exerciseMinutes: 20,
          exerciseIds: ['palming-reset', 'peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Full skill assessment', 'Identify weak areas']
        }
      ],
      weekendRecovery: ['Apply skills everywhere', 'No dedicated practice (test integration)', 'Notice improvements']
    },
    {
      week: 12,
      title: 'Graduation & Maintenance',
      phase: 'Integration & Maintenance',
      goals: [
        'Final comprehensive assessment',
        'Establish maintenance protocol',
        'Celebrate achievements'
      ],
      sessions: [
        {
          day: 1,
          title: 'Final Prep',
          focus: 'Pre-assessment review',
          baselineMinutes: 5,
          exerciseMinutes: 22,
          exerciseIds: ['palming-reset', 'focus-pushups', 'eye-jumps'],
          coachingCues: ['Polish all skills', 'Prepare for final test']
        },
        {
          day: 2,
          title: 'Comprehensive Test A',
          focus: 'Distance + mechanics',
          baselineMinutes: 10,
          exerciseMinutes: 18,
          exerciseIds: ['focus-trombone', 'smooth-tracking', 'figure8-fixation'],
          coachingCues: ['Record all baselines', 'Near + far Snellen']
        },
        {
          day: 3,
          title: 'Comprehensive Test B',
          focus: 'Speed + peripheral',
          baselineMinutes: 5,
          exerciseMinutes: 22,
          exerciseIds: ['eye-jumps', 'peripheral-pointing', 'laterality-ladder'],
          coachingCues: ['Record speed metrics', 'Peripheral count']
        },
        {
          day: 4,
          title: 'Integration Final',
          focus: 'Full skill demonstration',
          baselineMinutes: 5,
          exerciseMinutes: 25,
          exerciseIds: ['focus-pushups', 'eye-jumps', 'peripheral-pointing', 'snellen-layering-walks'],
          coachingCues: ['Demonstrate all skills', 'Final recording']
        },
        {
          day: 5,
          title: 'Graduation Day',
          focus: 'Celebrate & plan forward',
          baselineMinutes: 10,
          exerciseMinutes: 15,
          exerciseIds: ['palming-reset', 'focus-trombone'],
          coachingCues: ['Final Snellen comparison', 'Design maintenance routine', 'Celebrate your progress!']
        }
      ],
      weekendRecovery: ['Celebrate completion', 'Begin maintenance protocol', 'Share results']
    }
  ]
};

// Helper to get today's session based on enrollment
export function getTodaySession(
  enrollmentStartDate: Date,
  currentDate: Date = new Date()
): { week: number; day: number; session: DailySession | null; isRestDay: boolean } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceStart = Math.floor((currentDate.getTime() - enrollmentStartDate.getTime()) / msPerDay);

  // Calculate week and day
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  const dayOfWeek = (daysSinceStart % 7) + 1; // 1-7 (Mon-Sun)

  // Check if program is complete
  if (weekNumber > 12) {
    return { week: 12, day: 5, session: null, isRestDay: false };
  }

  // Weekends are rest days (days 6 and 7)
  if (dayOfWeek > 5) {
    const weekPlan = visionMasterProgram.weeklyPlans[weekNumber - 1];
    return { week: weekNumber, day: dayOfWeek, session: null, isRestDay: true };
  }

  // Get the specific session
  const weekPlan = visionMasterProgram.weeklyPlans[weekNumber - 1];
  if (!weekPlan) {
    return { week: weekNumber, day: dayOfWeek, session: null, isRestDay: false };
  }

  const session = weekPlan.sessions.find(s => s.day === dayOfWeek) || null;
  return { week: weekNumber, day: dayOfWeek, session, isRestDay: false };
}
