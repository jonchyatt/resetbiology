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
  'How gritty or hydrated do your eyes feel before today’s work?',
  'Any neck/upper-trap tightness that might limit ocular range?',
  'What was the furthest clear Snellen line yesterday (near + far)?',
  'Rate today’s screen load (low / medium / brutal).',
];
