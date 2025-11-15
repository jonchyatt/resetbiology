export type VisionExercise = {
  id: string;
  title: string;
  category: 'downshift' | 'mechanics' | 'peripheral' | 'speed' | 'integration';
  duration: string;
  intensity: 'low' | 'moderate' | 'high';
  summary: string;
  focus: string[];
  equipment?: string[];
  breathingCue?: string;
  distanceTargets?: {
    near?: string;
    far?: string;
  };
  checkpoints: string[];
  guidance: {
    heading: string;
    detail: string;
  }[];
  progression?: string;
  layering?: string;
};

export const visionExercises: VisionExercise[] = [
  {
    id: 'palming-reset',
    title: 'Palming Reset',
    category: 'downshift',
    duration: '3 min',
    intensity: 'low',
    summary: 'Darkness + warmth + diaphragmatic breathing to downshift the nervous system before neural drills.',
    focus: ['parasympathetic', 'hydration', 'tension release'],
    breathingCue: 'Inhale 4 sec nose • hold 2 • exhale 6 through lips.',
    checkpoints: [
      'Seat bones heavy, spine tall.',
      'Rub palms to create heat then cup over sockets without pressure.',
      'Exhale until you feel abdominal wall soften; notice when the darkness deepens.',
    ],
    guidance: [
      { heading: 'Vision cue', detail: 'Imagine distant horizon lines to widen field even with eyes closed.' },
      { heading: 'Body cue', detail: 'Relax jaw and tongue to reduce trigeminal stress on ocular nerves.' },
    ],
    layering: 'Use between high-focus tasks or as step one of every session.',
  },
  {
    id: 'focus-pushups',
    title: 'Focus Pushups',
    category: 'mechanics',
    duration: '6 min',
    intensity: 'moderate',
    summary: 'Classic near-to-far bead drill to teach convergence/divergence control at conscious speeds.',
    focus: ['accommodation', 'distance control'],
    equipment: ['Pencil/card', 'measuring tape'],
    distanceTargets: { near: '10 cm', far: '60 cm' },
    checkpoints: [
      'Start at arm’s length with sharp focus.',
      'Slide target toward nose in 0.5 cm increments while keeping shoulders stacked.',
      'Pause where blur appears, breathe out, reclaim clarity, continue.',
    ],
    guidance: [
      { heading: 'Near-vision cue', detail: 'Exhale as the card approaches to keep parasympathetic tone high.' },
      { heading: 'Far-vision cue', detail: 'If clarity holds at 60 cm, step back 2 cm and repeat.' },
    ],
    progression: 'Add metronome at 50 bpm once movement is smooth; bump tempo +5 bpm weekly.',
  },
  {
    id: 'smooth-tracking',
    title: 'Smooth Tracking',
    category: 'mechanics',
    duration: '8 min',
    intensity: 'moderate',
    summary: 'Slow figure-eight pursuit work to polish eye-only movement and quiet the cervical spine.',
    focus: ['smooth pursuit', 'neck freedom'],
    equipment: ['Wall target', 'metronome (optional)'],
    checkpoints: [
      'Anchor chin with a light nod; imagine ears growing tall.',
      'Trace horizontal infinity sign with eyes only for 60 sec.',
      'Switch to vertical loops, then diagonal sequences.',
    ],
    guidance: [
      { heading: 'Tempo cue', detail: 'Count 4 seconds per loop; no jerky jumps allowed.' },
      { heading: 'Breath cue', detail: 'Inhale along the left arc, exhale along the right.' },
    ],
    progression: 'Add mild head turns after week 2 to simulate walking environments.',
  },
  {
    id: 'peripheral-pointing',
    title: 'Peripheral Pointing',
    category: 'peripheral',
    duration: '10 min',
    intensity: 'moderate',
    summary: 'Identifies objects without direct gaze to expand spatial mapping and reduce tunnel vision.',
    focus: ['peripheral awareness', 'proprioception'],
    equipment: ['Room objects', 'sticky dots'],
    checkpoints: [
      'Stare at a central focal point on wall.',
      'Call out the color/shape of items detected in the edges.',
      'Point toward targets without letting pupils leave the center.',
    ],
    guidance: [
      { heading: 'Cognitive cue', detail: 'Stack difficulty by adding category rules (e.g., only blue objects).' },
      { heading: 'Physical cue', detail: 'Keep rib flare down; only arms move.' },
    ],
    layering: 'Pair with walking drills once seated version feels trivial.',
  },
  {
    id: 'focus-trombone',
    title: 'Focus Trombone',
    category: 'mechanics',
    duration: '6 min',
    intensity: 'moderate',
    summary: 'Dynamic near/far toggles inspired by optometry accommodative therapy.',
    focus: ['accommodation', 'depth perception'],
    equipment: ['Two cards with letters'],
    distanceTargets: { near: '15 cm', far: '90 cm' },
    checkpoints: [
      'Alternate reading near card vs. far card every inhale/exhale.',
      'Say the letter aloud to confirm clarity.',
      'Add gentle step-back once accuracy hits 95%.',
    ],
    guidance: [
      { heading: 'Timing', detail: 'One respiratory cycle per switch keeps motion steady.' },
      { heading: 'Error handling', detail: 'If blur persists longer than 2 sec, move closer and reset.' },
    ],
  },
  {
    id: 'eye-jumps',
    title: 'Eye Jumps',
    category: 'speed',
    duration: '8 min',
    intensity: 'high',
    summary: 'High-velocity saccades between targets to sharpen reaction time and reading endurance.',
    focus: ['saccades', 'speed'],
    equipment: ['Two wall targets'],
    checkpoints: [
      'Place targets 60° apart at eye level.',
      'Jump gaze between them on metronome beats.',
      'Add diagonal targets for extra challenge.',
    ],
    guidance: [
      { heading: 'Metronome', detail: 'Start 60 bpm; add +5 bpm once accuracy ≥ 90% for two sessions.' },
      { heading: 'Posture', detail: 'Glutes lightly engaged, avoid head bobbing.' },
    ],
    progression: 'In week 3, read aloud the letter at each target before switching.',
  },
  {
    id: 'laterality-ladder',
    title: 'Laterality Ladder',
    category: 'integration',
    duration: '7 min',
    intensity: 'moderate',
    summary: 'Cross-body ocular + limb coordination to reduce midline confusion and boost depth perception.',
    focus: ['laterality', 'midline'],
    equipment: ['Floor tape', 'letter cards'],
    checkpoints: [
      'Eyes track letter moving left-right while opposite hand touches floor markers.',
      'Call out left/right each rep to reinforce mapping.',
      'Finish with alphabet visualization eyes closed.',
    ],
    guidance: [
      { heading: 'Rhythm', detail: 'Use 3-count cadence: look, call, tap.' },
      { heading: 'Breath', detail: 'Nasal breath throughout; sigh out if tension spikes.' },
    ],
    layering: 'Great middle block before high-speed drills.',
  },
  {
    id: 'mirror-scan',
    title: 'Mirror Scan',
    category: 'peripheral',
    duration: '5 min',
    intensity: 'moderate',
    summary: 'Mirror provides instant feedback on head stillness while eyes sweep in quadrants.',
    focus: ['stability', 'awareness'],
    equipment: ['Full-length mirror'],
    checkpoints: [
      'Stand one meter away; soften knees.',
      'Trace rectangle path with eyes while ensuring head stays centered.',
      'Reverse directions; finish with diagonal zig-zag scans.',
    ],
    guidance: [
      { heading: 'Quality check', detail: 'If head drifts >1 cm, slow down and reset posture.' },
      { heading: 'Integration', detail: 'Hum quietly to add auditory task for dual-load practice.' },
    ],
  },
  {
    id: 'snellen-layering-walks',
    title: 'Snellen Layering Walks',
    category: 'integration',
    duration: '5 min',
    intensity: 'moderate',
    summary: 'Walk heel-to-toe while reading down a projected Snellen line to cement gains in motion.',
    focus: ['gait', 'vision'],
    equipment: ['Printed/onscreen chart'],
    checkpoints: [
      'Start 2 m from chart, heel-to-toe walk toward/away.',
      'Read next lower line each step.',
      'Switch to E-directional cues midday to vary stimulus.',
    ],
    guidance: [
      { heading: 'Anchor', detail: 'Keep crown lifted, imagine strings pulling upward.' },
      { heading: 'Tempo', detail: 'One syllable per step; slow down if blur creeps in.' },
    ],
  },
  {
    id: 'box-breath-vision',
    title: 'Box Breath Vision Prep',
    category: 'downshift',
    duration: '4 min',
    intensity: 'low',
    summary: 'Box breathing plus soft focus on a single point to prime for accuracy work.',
    focus: ['calm', 'focus'],
    checkpoints: [
      'Pick a neutral object at eye height.',
      'Inhale 4, hold 4, exhale 4, hold 4 while eyes remain gently fixed.',
      'Repeat for four rounds before harder drills.',
    ],
    guidance: [
      { heading: 'Vision cue', detail: 'Notice micro-movements; try to minimize them each hold.' },
    ],
  },
  {
    id: 'figure8-fixation',
    title: 'Figure 8 Fixation',
    category: 'mechanics',
    duration: '7 min',
    intensity: 'moderate',
    summary: 'Large infinity tracing with varied distances to challenge fixation and prevent fatigue.',
    focus: ['fixation', 'endurance'],
    checkpoints: [
      'Project or imagine a 1m-wide infinity symbol.',
      'Follow path clockwise 60 sec, counterclockwise 60 sec.',
      'Change symbol size (large > small) each minute.',
    ],
    guidance: [
      { heading: 'Distance layering', detail: 'Alternate near (40 cm) vs. far (2 m) projections every loop.' },
    ],
    progression: 'Add light head nods on the vertical midline after week 2.',
  },
];

export const visionExerciseMap = visionExercises.reduce<Record<string, VisionExercise>>((acc, exercise) => {
  acc[exercise.id] = exercise;
  return acc;
}, {});
