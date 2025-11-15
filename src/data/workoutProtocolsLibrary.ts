import { CuratedWorkoutProtocol } from '@/types/workout';

export const curatedWorkoutProtocols: CuratedWorkoutProtocol[] = [
  {
    slug: 'cellular-strength-stack',
    name: 'Cellular Prime Strength Stack',
    summary: 'Eight-week strength blueprint aligned with peptide-driven hypertrophy and connective tissue resilience.',
    goal: 'Progressive strength & lean mass',
    trainingLevel: 'intermediate',
    tags: ['strength', 'hypertrophy', 'peptide-synergy'],
    focusAreas: ['Lower/Upper split', 'Posterior chain integrity', 'Neural drive'],
    equipment: ['Barbell', 'Dumbbell', 'Cable', 'Sled/Bike'],
    durationWeeks: 8,
    sessionsPerWeek: 4,
    readinessGuidelines: [
      'If HRV is suppressed >8% below baseline, cap RPE at 7',
      'Require >6.5h sleep before Heavy A day',
      'Knee or elbow pain >4/10 swap to tempo-controlled accessory work',
    ],
    aiInsights: [
      'Programs posterior chain work before pressing for better scapular control',
      'Front-loads neural work when CJC/Ipamorelin timing peaks',
      'Micro-deload baked every 3rd week for connective tissue',
    ],
    progressionNotes: 'Weeks 1-2 technique accumulation, 3-6 double progression, 7 deload, 8 re-peak.',
    researchLinks: [
      { label: 'Velocity-based loading', url: 'https://pubmed.ncbi.nlm.nih.gov/29369271/' },
      { label: 'In-season tendon care', url: 'https://pubmed.ncbi.nlm.nih.gov/29589892/' },
    ],
    phases: [
      {
        key: 'foundation',
        name: 'Foundation & Tissue Prep',
        focus: ['Tempo control', 'Midline stability'],
        durationWeeks: 2,
        notes: 'All main lifts capped at RPE 7, 3-1-1 tempo to groove positions.',
        sessions: [
          {
            key: 'foundation-strength-a',
            title: 'Lower Neural Prime',
            goal: 'Reinforce squat hinge pattern with tendon prep',
            durationMinutes: 55,
            intensity: 'moderate',
            readinessTips: ['Skip jumps if ankles feel stiff; swap to bike sprints'],
            blocks: [
              {
                key: 'primer',
                label: 'Primer Circuit',
                focus: 'Tissue perfusion',
                exercises: [
                  {
                    key: '90-90-breath',
                    name: '90/90 breathing + rib lift',
                    pattern: 'Breathing',
                    sets: [{ durationSeconds: 60 }],
                    cues: ['Exhale fully', 'Feel hamstrings anchor pelvis'],
                  },
                  {
                    key: 'sissy-squat-hold',
                    name: 'Sissy squat ISO',
                    pattern: 'Isometric',
                    sets: [{ durationSeconds: 45, rir: '2' }],
                    cues: ['Drive knees forward', 'Stay tall'],
                  },
                ],
              },
              {
                key: 'main',
                label: 'Strength Stack',
                focus: 'Squat pattern',
                notes: '3-1-1 tempo submaximal',
                exercises: [
                  {
                    key: 'front-squat',
                    name: 'Front squat',
                    pattern: 'Squat',
                    equipment: ['Barbell'],
                    sets: [
                      { reps: 5, tempo: '3111', rir: '3' },
                      { reps: 5, tempo: '3111', rir: '2' },
                      { reps: 5, tempo: '3011', rir: '2' },
                    ],
                    cues: ['Elbows high', 'Exhale through sticking point'],
                    swapOptions: ['Safety bar squat'],
                  },
                  {
                    key: 'rdl',
                    name: 'Romanian deadlift',
                    pattern: 'Hinge',
                    equipment: ['Barbell'],
                    sets: [
                      { reps: 8, tempo: '4011', rir: '2' },
                      { reps: 8, tempo: '4011', rir: '1' },
                    ],
                  },
                  {
                    key: 'reverse-sled',
                    name: 'Reverse sled drag',
                    pattern: 'Conditioning',
                    sets: [
                      { durationSeconds: 45 },
                      { durationSeconds: 45 },
                      { durationSeconds: 45 },
                    ],
                    cues: ['Drive through big toe', 'Stay upright'],
                  },
                ],
              },
            ],
          },
          {
            key: 'foundation-upper',
            title: 'Upper Press Integrity',
            goal: 'Pressing stability and scap control',
            durationMinutes: 50,
            intensity: 'moderate',
            blocks: [
              {
                key: 'activation',
                label: 'Activation',
                focus: 'Scapular upward rotation',
                exercises: [
                  {
                    key: 'wall-slide',
                    name: 'Wall slide with lift off',
                    pattern: 'Mobility',
                    sets: [{ reps: 12 }, { reps: 12 }],
                  },
                ],
              },
              {
                key: 'pressing',
                label: 'Press Strength',
                focus: 'Horizontal press',
                exercises: [
                  {
                    key: 'db-floor-press',
                    name: 'Dumbbell floor press',
                    pattern: 'Press',
                    equipment: ['Dumbbell'],
                    sets: [
                      { reps: 10, rir: '2' },
                      { reps: 10, rir: '1' },
                      { reps: 8, rir: '1' },
                    ],
                  },
                  {
                    key: 'half-kneeling-row',
                    name: 'Half kneeling single arm row',
                    pattern: 'Row',
                    sets: [
                      { reps: 12, rir: '2' },
                      { reps: 12, rir: '2' },
                    ],
                  },
                  {
                    key: 'bike-finish',
                    name: 'Assault bike waves',
                    pattern: 'Conditioning',
                    sets: [
                      { durationSeconds: 30 },
                      { durationSeconds: 30 },
                      { durationSeconds: 30 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'progressive-overload',
        name: 'Progressive Overload',
        focus: ['Neural drive', 'Hypertrophy'],
        durationWeeks: 4,
        sessions: [
          {
            key: 'strength-a',
            title: 'Lower Intensive',
            goal: 'Wave loading squat + posterior density',
            durationMinutes: 65,
            intensity: 'high',
            readinessTips: ['Only push above RPE 8 if readiness score > 80'],
            blocks: [
              {
                key: 'wave',
                label: 'Wave Load',
                focus: 'Squat',
                exercises: [
                  {
                    key: 'back-squat',
                    name: 'Back squat',
                    pattern: 'Squat',
                    equipment: ['Barbell'],
                    sets: [
                      { reps: 5, rir: '3' },
                      { reps: 3, rir: '2' },
                      { reps: 2, rir: '2' },
                      { reps: 5, rir: '2' },
                      { reps: 3, rir: '1' },
                      { reps: 2, rir: '1' },
                    ],
                    cues: ['Use belts only on second wave'],
                  },
                ],
              },
              {
                key: 'density',
                label: 'Posterior Density',
                focus: 'Hamstrings + glutes',
                exercises: [
                  {
                    key: 'trapbar-rdl',
                    name: 'Trap bar RDL',
                    pattern: 'Hinge',
                    sets: [
                      { reps: 10, rir: '2' },
                      { reps: 10, rir: '1' },
                    ],
                  },
                  {
                    key: 'hamstring-curl',
                    name: 'Nordic eccentric',
                    pattern: 'Hamstring',
                    sets: [{ reps: 6 }, { reps: 6 }],
                  },
                  {
                    key: 'sled-push',
                    name: 'Sled push',
                    pattern: 'Conditioning',
                    sets: [{ durationSeconds: 30 }, { durationSeconds: 30 }],
                  },
                ],
              },
            ],
          },
          {
            key: 'upper-power',
            title: 'Upper Power',
            goal: 'Contrast pressing & scapular balance',
            durationMinutes: 60,
            intensity: 'high',
            blocks: [
              {
                key: 'power',
                label: 'Contrast',
                focus: 'Speed + strength',
                exercises: [
                  {
                    key: 'bench-press',
                    name: 'Bench press',
                    pattern: 'Press',
                    equipment: ['Barbell'],
                    sets: [
                      { reps: 4, rir: '3' },
                      { reps: 3, rir: '2' },
                      { reps: 2, rir: '1' },
                    ],
                  },
                  {
                    key: 'medball-chest',
                    name: 'Explosive med ball chest pass',
                    pattern: 'Power',
                    sets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }],
                  },
                ],
              },
              {
                key: 'stability',
                label: 'Stability',
                focus: 'Scap balance',
                exercises: [
                  {
                    key: 'single-arm-landmine',
                    name: 'Single-arm landmine press',
                    pattern: 'Press',
                    sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
                  },
                  {
                    key: 'facepull',
                    name: 'Cable face pull',
                    pattern: 'Upper back',
                    sets: [{ reps: 15 }, { reps: 15 }, { reps: 15 }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'peak-reset',
        name: 'Peak + Reset',
        focus: ['Performance', 'Deload'],
        durationWeeks: 2,
        notes: 'Alternate heavy singles with low-intent tissue work.',
        sessions: [
          {
            key: 'taper',
            title: 'Performance Taper',
            goal: 'Expose heavy singles then flush tissue',
            durationMinutes: 50,
            intensity: 'moderate',
            blocks: [
              {
                key: 'heavy-single',
                label: 'Heavy Single',
                focus: 'Main lift confidence',
                exercises: [
                  {
                    key: 'front-squat-top',
                    name: 'Front squat top single',
                    pattern: 'Squat',
                    sets: [{ reps: 1, rir: '1' }, { reps: 1, rir: '1' }],
                  },
                ],
              },
              {
                key: 'reset',
                label: 'Reset',
                focus: 'Blood flow + breathing',
                exercises: [
                  {
                    key: 'tempo-stepup',
                    name: 'Tempo step-up',
                    pattern: 'Unilateral',
                    sets: [{ reps: 8 }, { reps: 8 }],
                  },
                  {
                    key: 'zonespin',
                    name: 'Zone 2 spin',
                    pattern: 'Conditioning',
                    sets: [{ durationSeconds: 600 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'metabolic-protocol',
    name: 'Metabolic Flex Accelerator',
    summary: 'High-output conditioning with carb cycling hooks and low-equipment freedom.',
    goal: 'Metabolic flexibility & aerobic base',
    trainingLevel: 'all levels',
    tags: ['conditioning', 'fat-loss', 'aerobic'],
    focusAreas: ['Zone 2 base', 'Lactate clearance', 'Core control'],
    equipment: ['Rower', 'Bike', 'Bodyweight', 'Bands'],
    durationWeeks: 6,
    sessionsPerWeek: 5,
    readinessGuidelines: [
      'If resting HR >10% above baseline shift to low-day option',
      'For soreness >5/10 replace repeat sprints with marches',
    ],
    aiInsights: [
      'Auto rotates knee-friendly locomotion each week',
      'Stacks nasal breathing cues to reinforce vagal tone',
    ],
    progressionNotes: 'Density increases weekly; deload built into week 4.',
    researchLinks: [
      { label: 'Low intensity steady state benefits', url: 'https://pubmed.ncbi.nlm.nih.gov/25603798/' },
    ],
    phases: [
      {
        key: 'aerobic-foundation',
        name: 'Aerobic Foundation',
        focus: ['Zone 2', 'Breathing mechanics'],
        durationWeeks: 2,
        sessions: [
          {
            key: 'zone2-flow',
            title: 'Zone 2 Flow',
            goal: 'Build repeatable energy systems',
            durationMinutes: 40,
            intensity: 'low',
            blocks: [
              {
                key: 'breath-prep',
                label: 'Breath Prep',
                focus: 'Nasal control',
                exercises: [
                  {
                    key: 'box-breath',
                    name: 'Box breathing',
                    pattern: 'Breathing',
                    sets: [{ durationSeconds: 300 }],
                  },
                ],
              },
              {
                key: 'steady-state',
                label: 'Steady Output',
                focus: 'Cycle through modalities',
                exercises: [
                  {
                    key: 'bike-zone2',
                    name: 'Bike zone 2 ride',
                    pattern: 'Conditioning',
                    sets: [{ durationSeconds: 1200 }],
                  },
                  {
                    key: 'march',
                    name: 'Weighted march',
                    pattern: 'Core',
                    sets: [{ durationSeconds: 600 }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'density',
        name: 'Density Build',
        focus: ['Intervals', 'Core integrity'],
        durationWeeks: 3,
        sessions: [
          {
            key: 'interval-ladder',
            title: 'Interval Ladder',
            goal: 'Push-pull EMOM contrast',
            durationMinutes: 45,
            intensity: 'high',
            blocks: [
              {
                key: 'emom',
                label: 'EMOM Ladder',
                focus: 'Engine',
                exercises: [
                  {
                    key: 'row-sprint',
                    name: 'Row sprint',
                    pattern: 'Conditioning',
                    sets: [{ durationSeconds: 45 }, { durationSeconds: 40 }, { durationSeconds: 35 }],
                  },
                  {
                    key: 'pushup-cluster',
                    name: 'Hand-release push-up cluster',
                    pattern: 'Press',
                    sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }],
                  },
                  {
                    key: 'reverse-lunge',
                    name: 'Reverse lunge + knee drive',
                    pattern: 'Unilateral',
                    sets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'reset-flow',
        name: 'Reset Flow',
        focus: ['Breath', 'Mobility'],
        durationWeeks: 1,
        sessions: [
          {
            key: 'active-recovery',
            title: 'Active Recovery',
            goal: 'Gentle movement pairing',
            durationMinutes: 35,
            intensity: 'low',
            blocks: [
              {
                key: 'mobility',
                label: 'Mobility',
                focus: 'Hip / thoracic',
                exercises: [
                  {
                    key: 'copenhagens',
                    name: 'Copenhagen plank',
                    pattern: 'Core',
                    sets: [{ durationSeconds: 30 }, { durationSeconds: 30 }],
                  },
                ],
              },
              {
                key: 'breath-walk',
                label: 'Breath Walk',
                focus: 'Nasal tempo walk',
                exercises: [
                  {
                    key: 'walk',
                    name: 'Nasal cadence walk',
                    pattern: 'Conditioning',
                    sets: [{ durationSeconds: 900 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'mobility-reset',
    name: 'Mobility & Recovery Reset',
    summary: 'Daily short practices to maintain tissue quality and calm CNS.',
    goal: 'Longevity & recovery',
    trainingLevel: 'all levels',
    tags: ['mobility', 'recovery', 'daily'],
    focusAreas: ['Spine decompression', 'Hip capsule', 'Parasympathetic tone'],
    equipment: ['Yoga block', 'Foam roller', 'Band'],
    durationWeeks: 4,
    sessionsPerWeek: 6,
    readinessGuidelines: [
      'If soreness extreme, double breath section length',
      'Great on rest days or nights with poor sleep',
    ],
    aiInsights: ['Auto-matches breath cadence to nutrition tracker stress data.'],
    progressionNotes: 'Additions weekly, never more than 25 minutes.',
    researchLinks: [
      { label: 'Parasympathetic recovery', url: 'https://pubmed.ncbi.nlm.nih.gov/32042189/' },
    ],
    phases: [
      {
        key: 'reset',
        name: 'Reset',
        focus: ['Downregulate'],
        durationWeeks: 4,
        sessions: [
          {
            key: 'evening-downshift',
            title: 'Evening Downshift',
            goal: 'Calm CNS, decompress spine',
            durationMinutes: 20,
            intensity: 'low',
            blocks: [
              {
                key: 'breath',
                label: 'Breath Wave',
                focus: 'Parasympathetic',
                exercises: [
                  {
                    key: 'cadence-breath',
                    name: '4-7-8 breathing',
                    pattern: 'Breathing',
                    sets: [{ durationSeconds: 420 }],
                  },
                ],
              },
              {
                key: 'mobility',
                label: 'Mobility Flow',
                focus: 'Spine',
                exercises: [
                  {
                    key: 'thread-needle',
                    name: 'Thread the needle',
                    pattern: 'Mobility',
                    sets: [{ reps: 12 }, { reps: 12 }],
                  },
                  {
                    key: 'band-hip-capsule',
                    name: 'Banded hip capsule rocks',
                    pattern: 'Mobility',
                    sets: [{ reps: 15 }, { reps: 15 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
