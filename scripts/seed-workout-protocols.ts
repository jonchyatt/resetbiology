/**
 * Seed script for research-based workout protocols
 *
 * Each protocol is based on peer-reviewed research and includes:
 * - Scientific rationale
 * - Specific protocols from studies
 * - Progressive phases
 * - Research citations
 *
 * Run with: npx tsx scripts/seed-workout-protocols.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORKOUT_PROTOCOLS = [
  // ============================================
  // 1. DR. KEITH BAAR - TENDON & COLLAGEN PROTOCOL
  // ============================================
  {
    slug: 'tendon-collagen-repair',
    name: 'Tendon & Collagen Repair Protocol',
    summary: 'Research-backed protocol from Dr. Keith Baar (UC Davis) for tendon healing and collagen synthesis. Uses targeted isometrics with collagen supplementation timing.',
    goal: 'Repair and strengthen tendons, ligaments, and connective tissue',
    level: 'all',
    durationWeeks: 12,
    sessionsPerWeek: 7,
    tags: ['tendon-health', 'injury-recovery', 'collagen', 'isometrics', 'dr-keith-baar'],
    focusAreas: ['tendons', 'ligaments', 'connective-tissue', 'joints'],
    equipment: {
      required: [],
      optional: ['resistance-band', 'wall', 'towel']
    },
    readinessNotes: [
      'Take 15g hydrolyzed collagen + vitamin C 30-60 minutes before exercise',
      'Tendons become refractory after ~10 minutes of loading. Short sessions are optimal.',
      'Wait 6-8 hours between sessions for collagen synthesis window to reset'
    ],
    aiInsights: {
      keyPrinciple: 'Tendons need mechanical load to orient collagen fibers properly. Isometrics provide sustained tension without movement, maximizing "creep effect" for collagen remodeling.',
      supplementation: '15g hydrolyzed collagen (from skin source) + 50mg vitamin C, 30-60 min pre-exercise',
      frequency: 'Can train same tendon 2x daily with 6-8 hour gap',
      progression: 'Progress by increasing perceived effort (not hold time) within pain-free range'
    },
    researchLinks: [
      { label: 'Dr. Keith Baar - UC Davis Research Profile', url: 'https://health.ucdavis.edu/physiology/faculty/baar.html' },
      { label: 'Tim Ferriss Podcast #797 - Dr. Keith Baar on Tendon Repair', url: 'https://tim.blog/2025/02/26/dr-keith-baar/' },
      { label: 'Using load to improve tendon tissue engineering (2024)', url: 'https://www.sciencedirect.com/science/article/pii/S0945053X24001434' }
    ],
    phases: [
      {
        name: 'Phase 1: Initial Loading',
        weekStart: 1,
        weekEnd: 4,
        description: 'Gentle isometric holds to stimulate collagen synthesis without overloading damaged tissue',
        sessions: [
          {
            name: 'Daily Tendon Loading',
            exercises: [
              {
                name: 'Wall Isometric Hold (Target Area)',
                sets: 3,
                holdSeconds: 30,
                restSeconds: 60,
                intensity: '30% perceived effort',
                notes: 'Press into wall with affected limb. Should be completely pain-free. Multiple positions (bent, straight, overhead for arm).'
              },
              {
                name: 'Isometric Extension',
                sets: 3,
                holdSeconds: 30,
                restSeconds: 60,
                intensity: '30% perceived effort',
                notes: 'For tennis elbow: extend wrist against resistance. For Achilles: point toes against resistance.'
              },
              {
                name: 'Isometric Rotation (if applicable)',
                sets: 2,
                holdSeconds: 30,
                restSeconds: 60,
                intensity: '30% perceived effort',
                notes: 'For forearm: pronate and supinate against fixed resistance'
              }
            ],
            totalDuration: '10 minutes',
            collagenTiming: 'Take collagen supplement 30-60 min before'
          }
        ]
      },
      {
        name: 'Phase 2: Progressive Loading',
        weekStart: 5,
        weekEnd: 8,
        description: 'Gradually increase intensity while maintaining pain-free execution',
        sessions: [
          {
            name: 'Progressive Tendon Loading',
            exercises: [
              {
                name: 'Isometric Hold (Multiple Angles)',
                sets: 4,
                holdSeconds: 30,
                restSeconds: 45,
                intensity: '40-50% perceived effort',
                notes: 'Perform at 3 different joint angles to load full tendon length'
              },
              {
                name: 'Slow Eccentric (Controlled)',
                sets: 3,
                reps: 8,
                tempo: '5 seconds down',
                intensity: 'Light load',
                notes: 'Introduce slow eccentrics only if isometrics are pain-free'
              }
            ],
            totalDuration: '12-15 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Functional Integration',
        weekStart: 9,
        weekEnd: 12,
        description: 'Progress to dynamic movements while maintaining tendon health',
        sessions: [
          {
            name: 'Functional Tendon Training',
            exercises: [
              {
                name: 'Heavy Isometrics',
                sets: 3,
                holdSeconds: 30,
                restSeconds: 60,
                intensity: '60-70% perceived effort',
                notes: 'Can now push harder while staying pain-free'
              },
              {
                name: 'Eccentric-Concentric Movements',
                sets: 3,
                reps: 10,
                tempo: '3 seconds each direction',
                notes: 'Full range of motion with control'
              },
              {
                name: 'Sport/Activity-Specific Movement',
                sets: 2,
                reps: 8,
                notes: 'Gradually reintroduce movements from your activity'
              }
            ],
            totalDuration: '15-20 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 2. ISOMETRIC BLOOD PRESSURE PROTOCOL
  // ============================================
  {
    slug: 'isometric-blood-pressure',
    name: 'Isometric Blood Pressure Reduction Protocol',
    summary: 'Research shows isometric exercise produces the greatest blood pressure reductions compared to aerobic, dynamic resistance, or HIIT. Meta-analysis of 270 trials confirms efficacy.',
    goal: 'Lower systolic and diastolic blood pressure naturally',
    level: 'beginner',
    durationWeeks: 8,
    sessionsPerWeek: 3,
    tags: ['blood-pressure', 'heart-health', 'isometrics', 'cardiovascular', 'hypertension'],
    focusAreas: ['cardiovascular', 'blood-pressure', 'heart'],
    equipment: {
      required: [],
      optional: ['handgrip-dynamometer', 'wall', 'chair']
    },
    readinessNotes: [
      'Consult physician before starting if you have uncontrolled hypertension or heart conditions',
      'Consider tracking blood pressure before and after the 8-week protocol',
      'Breathe normally during holds - do not hold your breath'
    ],
    aiInsights: {
      keyFinding: 'Meta-analysis of 270 trials (15,827 participants) found isometric exercise produced the largest BP reductions compared to all other exercise types',
      expectedResults: 'Average reductions: SBP -6.77 to -9.7 mmHg, DBP -3.96 to -4.8 mmHg (equivalent to medication monotherapy)',
      optimalProtocol: '4 × 2-minute contractions at 30% MVC, 3x/week for 8+ weeks',
      mechanism: 'Improved endothelial function, reduced arterial stiffness, autonomic nervous system modulation'
    },
    researchLinks: [
      { label: 'Isometric Exercise Training: Mechanisms and Protocol Application (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8758172/' },
      { label: 'Isometric training for blood pressure: Systematic review (Nature)', url: 'https://www.nature.com/articles/hr2015111' },
      { label: 'Evidence-based guide to isometric training in hypertension', url: 'https://clinicalhypertension.biomedcentral.com/articles/10.1186/s40885-022-00232-3' },
      { label: 'Mayo Clinic - Isometric exercise and blood pressure', url: 'https://www.mayoclinichealthsystem.org/hometown-health/speaking-of-health/isometric-exercise-and-blood-pressure' }
    ],
    phases: [
      {
        name: 'Phase 1: Foundation',
        weekStart: 1,
        weekEnd: 2,
        description: 'Learn proper form and breathing. Start with shorter holds.',
        sessions: [
          {
            name: 'Isometric BP Session (3x/week)',
            exercises: [
              {
                name: 'Isometric Handgrip Squeeze',
                sets: 4,
                holdSeconds: 90,
                restSeconds: 60,
                intensity: '30% maximum grip',
                notes: 'Squeeze at moderate intensity - should be challenging but sustainable. Breathe normally throughout. Alternate hands each set.'
              },
              {
                name: 'Wall Sit Hold',
                sets: 2,
                holdSeconds: 60,
                restSeconds: 90,
                intensity: '30% perceived effort',
                notes: 'Back flat against wall, thighs parallel to floor. Reduce depth if too challenging.'
              }
            ],
            totalDuration: '12-15 minutes'
          }
        ]
      },
      {
        name: 'Phase 2: Standard Protocol',
        weekStart: 3,
        weekEnd: 6,
        description: 'Full research protocol: 4 × 2-minute holds at 30% MVC',
        sessions: [
          {
            name: 'Full Isometric BP Protocol',
            exercises: [
              {
                name: 'Bilateral Handgrip Isometrics',
                sets: 4,
                holdSeconds: 120,
                restSeconds: 60,
                intensity: '30% maximum voluntary contraction',
                notes: 'This is the research-validated protocol. 2 sets per hand, alternating. Total 8 minutes of work.'
              },
              {
                name: 'Isometric Leg Extension',
                sets: 2,
                holdSeconds: 90,
                restSeconds: 60,
                intensity: '30% effort',
                notes: 'Seated, extend legs and hold. Can use wall or chair for support.'
              }
            ],
            totalDuration: '15-18 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Maintenance',
        weekStart: 7,
        weekEnd: 8,
        description: 'Continue protocol and measure BP changes. This becomes your ongoing routine.',
        sessions: [
          {
            name: 'Maintenance Protocol',
            exercises: [
              {
                name: 'Bilateral Handgrip Isometrics',
                sets: 4,
                holdSeconds: 120,
                restSeconds: 60,
                intensity: '30-35% MVC',
                notes: 'Can slightly increase intensity if well-tolerated'
              },
              {
                name: 'Wall Sit or Plank Hold',
                sets: 2,
                holdSeconds: 90,
                restSeconds: 60,
                intensity: '30% effort',
                notes: 'Choose either based on preference'
              }
            ],
            totalDuration: '15-20 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 3. LYMPHATIC REBOUNDING PROTOCOL
  // ============================================
  {
    slug: 'lymphatic-rebounding',
    name: 'Lymphatic Activation Rebounding Protocol',
    summary: 'Mini-trampoline exercises to stimulate lymphatic flow. The "health bounce" technique activates lymphatic valves through gentle vertical oscillation.',
    goal: 'Improve lymphatic circulation and drainage',
    level: 'beginner',
    durationWeeks: 4,
    sessionsPerWeek: 5,
    tags: ['lymphatic', 'rebounding', 'detox', 'immune', 'low-impact'],
    focusAreas: ['lymphatic-system', 'immune', 'circulation'],
    equipment: {
      required: ['mini-trampoline'],
      optional: ['stability-bar']
    },
    readinessNotes: [
      'Start very gently if new to rebounding. Use stability bar if balance is a concern.',
      'Consult physician if you have lymphedema, recent surgery, or balance disorders',
      'Drink water before and after to support lymphatic function'
    ],
    aiInsights: {
      mechanism: 'The lymphatic system has no pump - it relies on muscle contractions and body movement. Rebounding creates rhythmic acceleration/deceleration that opens and closes lymphatic valves.',
      nasaStudy: '1980 NASA study found rebounding 68% more efficient than jogging for oxygen consumption',
      healthBounce: 'The "health bounce" (feet stay on mat) can increase lymph flow 15-30x according to lymphologists',
      boneBenefit: 'The G-force loading also supports bone density without joint impact'
    },
    researchLinks: [
      { label: 'NASA Journal of Applied Physiology Study (1980)', url: 'https://www.jumpsport.com/blog/the-science-behind-trampolining-and-how-it-improves-health/' },
      { label: 'Rebounding effectiveness on lymphedema (IJPTR)', url: 'https://ijptr.net/a-study-to-assess-the-effectiveness-of-rebounding-exercise-on-lymphedema-shailendra-mehta/' },
      { label: 'Trampoline exercise for balance in older adults', url: 'https://www.springfreetrampoline.com/blogs/beyond-the-bounce/trampoline-benefits-lymphatic-system' }
    ],
    phases: [
      {
        name: 'Phase 1: Health Bounce Foundation',
        weekStart: 1,
        weekEnd: 1,
        description: 'Master the gentle "health bounce" - the foundation of lymphatic activation',
        sessions: [
          {
            name: 'Beginner Lymphatic Session',
            exercises: [
              {
                name: 'Health Bounce (Feet Stay on Mat)',
                sets: 2,
                durationMinutes: 2,
                restSeconds: 60,
                intensity: 'Very gentle - feet never leave the mat',
                notes: 'Simply bounce up and down gently. Knees slightly bent. This alone activates lymphatic valves. Most important exercise in the protocol.'
              },
              {
                name: 'Arm Circles While Bouncing',
                sets: 1,
                durationMinutes: 1,
                notes: 'Small arm circles forward, then backward, while doing health bounce'
              }
            ],
            totalDuration: '5-6 minutes',
            frequency: 'Once or twice daily'
          }
        ]
      },
      {
        name: 'Phase 2: Building Duration',
        weekStart: 2,
        weekEnd: 2,
        description: 'Gradually increase bouncing time while maintaining gentle intensity',
        sessions: [
          {
            name: 'Intermediate Lymphatic Session',
            exercises: [
              {
                name: 'Health Bounce',
                sets: 1,
                durationMinutes: 5,
                intensity: 'Gentle rhythmic bouncing',
                notes: 'Build up to continuous 5-minute bouncing'
              },
              {
                name: 'Twist Bounce',
                sets: 1,
                durationMinutes: 2,
                notes: 'Gently twist torso left and right while bouncing - aids thoracic duct drainage'
              },
              {
                name: 'Arm Pumps While Bouncing',
                sets: 1,
                durationMinutes: 2,
                notes: 'Pump arms up and down in rhythm with bounce - activates axillary (armpit) lymph nodes'
              }
            ],
            totalDuration: '10-12 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Full Protocol',
        weekStart: 3,
        weekEnd: 4,
        description: 'Complete lymphatic activation routine',
        sessions: [
          {
            name: 'Full Lymphatic Activation',
            exercises: [
              {
                name: 'Health Bounce Warmup',
                sets: 1,
                durationMinutes: 3,
                intensity: 'Gentle',
                notes: 'Warm up lymphatic system'
              },
              {
                name: 'Jogging Bounce',
                sets: 1,
                durationMinutes: 3,
                intensity: 'Moderate - feet can leave mat',
                notes: 'Light jogging motion on trampoline'
              },
              {
                name: 'Twist and Reach',
                sets: 1,
                durationMinutes: 2,
                notes: 'Twist and reach arms overhead alternating sides'
              },
              {
                name: 'Knee Lifts',
                sets: 1,
                durationMinutes: 2,
                notes: 'March in place with high knees - activates inguinal lymph nodes'
              },
              {
                name: 'Cool Down Health Bounce',
                sets: 1,
                durationMinutes: 3,
                intensity: 'Very gentle',
                notes: 'Return to gentle health bounce to flush system'
              }
            ],
            totalDuration: '13-15 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 4. BFR BODYWEIGHT TRAINING PROTOCOL
  // ============================================
  {
    slug: 'bfr-bodyweight',
    name: 'Blood Flow Restriction Bodyweight Protocol',
    summary: 'Achieve muscle growth with bodyweight exercises using blood flow restriction. Research shows BFR with low loads produces 10-20% strength gains in 4-6 weeks.',
    goal: 'Build muscle and strength using only bodyweight with BFR bands',
    level: 'intermediate',
    durationWeeks: 6,
    sessionsPerWeek: 3,
    tags: ['bfr', 'bodyweight', 'muscle-growth', 'strength', 'occlusion-training'],
    focusAreas: ['muscle-hypertrophy', 'strength', 'endurance'],
    equipment: {
      required: ['bfr-bands'],
      optional: ['resistance-band', 'pull-up-bar']
    },
    readinessNotes: [
      'Start with 40-50% limb occlusion pressure. Arms: 100-150mmHg, Legs: 150-200mmHg',
      'Do NOT use if you have blood clots, peripheral vascular disease, or are pregnant',
      'Keep bands inflated for entire exercise set, release during rest between exercises',
      'You should feel a "pumped" sensation and mild discomfort, but not numbness or tingling'
    ],
    aiInsights: {
      mechanism: 'BFR creates metabolic stress that triggers muscle protein synthesis at low loads (20-40% 1RM) that would normally require 70%+ 1RM',
      protocol: 'Standard: 30-15-15-15 reps (75 total) with 30 second rest, at 20-40% 1RM equivalent',
      results: 'Meta-analysis shows strength improvements of 10-20% in 4-6 weeks, comparable to heavy resistance training',
      frequency: 'Can train 2-4x weekly, some research supports daily for short periods (1-3 weeks)'
    },
    researchLinks: [
      { label: 'BFR Therapy for Rehabilitation (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8811521/' },
      { label: 'BFR Exercise Methodology and Safety (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6530612/' },
      { label: 'Systemic Effects of BFR Training', url: 'https://ijspt.scholasticahq.com/article/25791-the-systemic-effects-of-blood-flow-restriction-training-a-systematic-review' },
      { label: 'BFR and High-Performance Athletes (APS)', url: 'https://journals.physiology.org/doi/full/10.1152/japplphysiol.00982.2020' }
    ],
    phases: [
      {
        name: 'Phase 1: BFR Introduction',
        weekStart: 1,
        weekEnd: 2,
        description: 'Learn BFR application and master the 30-15-15-15 protocol',
        sessions: [
          {
            name: 'Upper Body BFR Day',
            exercises: [
              {
                name: 'BFR Push-ups',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                intensity: 'BFR bands on upper arms at 50% occlusion',
                notes: 'Keep bands on for all 4 sets. Use knees if needed to hit reps.'
              },
              {
                name: 'BFR Tricep Dips (bench)',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                notes: 'Bands stay on from push-ups'
              },
              {
                name: 'BFR Bicep Curls (no weight)',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                notes: 'Just squeeze and curl - the BFR makes it challenging'
              }
            ],
            totalDuration: '20-25 minutes'
          },
          {
            name: 'Lower Body BFR Day',
            exercises: [
              {
                name: 'BFR Bodyweight Squats',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                intensity: 'BFR bands on upper thighs at 50-60% occlusion',
                notes: 'Full depth if possible. Burn will be intense.'
              },
              {
                name: 'BFR Walking Lunges',
                sets: 3,
                reps: 20,
                restSeconds: 45,
                notes: 'Alternate legs, 10 each side per set'
              },
              {
                name: 'BFR Calf Raises',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                notes: 'Can do single leg for more challenge'
              }
            ],
            totalDuration: '20-25 minutes'
          }
        ]
      },
      {
        name: 'Phase 2: Progressive Overload',
        weekStart: 3,
        weekEnd: 4,
        description: 'Increase difficulty through exercise variations while maintaining BFR protocol',
        sessions: [
          {
            name: 'Upper Body BFR Advanced',
            exercises: [
              {
                name: 'BFR Decline Push-ups',
                sets: 4,
                reps: '30-15-15-15',
                restSeconds: 30,
                notes: 'Feet elevated on step or chair'
              },
              {
                name: 'BFR Diamond Push-ups',
                sets: 3,
                reps: '20-12-12',
                restSeconds: 30,
                notes: 'Hands together under chest'
              },
              {
                name: 'BFR Pike Push-ups',
                sets: 3,
                reps: '15-10-10',
                restSeconds: 45,
                notes: 'Hips high, targets shoulders'
              }
            ],
            totalDuration: '25-30 minutes'
          },
          {
            name: 'Lower Body BFR Advanced',
            exercises: [
              {
                name: 'BFR Bulgarian Split Squats',
                sets: 3,
                reps: '20-15-15 each leg',
                restSeconds: 30,
                notes: 'Rear foot elevated on bench'
              },
              {
                name: 'BFR Jump Squats (controlled)',
                sets: 3,
                reps: 15,
                restSeconds: 45,
                notes: 'Small jumps, soft landing'
              },
              {
                name: 'BFR Glute Bridge Hold',
                sets: 3,
                holdSeconds: 30,
                restSeconds: 30,
                notes: 'Squeeze glutes hard at top'
              }
            ],
            totalDuration: '25-30 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Intensity Peak',
        weekStart: 5,
        weekEnd: 6,
        description: 'Maximum BFR training intensity before deload',
        sessions: [
          {
            name: 'Full Body BFR Blast',
            exercises: [
              {
                name: 'BFR Push-up Variations (circuit)',
                sets: 3,
                reps: '15 regular, 10 diamond, 10 wide',
                restSeconds: 20,
                notes: 'Bands on arms throughout'
              },
              {
                name: 'BFR Squat Complex',
                sets: 3,
                reps: '15 squats + 10 jump squats + 20 pulse squats',
                restSeconds: 45,
                notes: 'Brutal metabolic stress - this is the goal!'
              },
              {
                name: 'BFR Arm Finisher',
                sets: 2,
                reps: '50 bicep curls + 50 tricep extensions',
                notes: 'No weight, just BFR. Race to 50.'
              }
            ],
            totalDuration: '30-35 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 5. ZONE 2 MITOCHONDRIAL PROTOCOL
  // ============================================
  {
    slug: 'zone-2-mitochondrial',
    name: 'Zone 2 Mitochondrial Biogenesis Protocol',
    summary: 'Build metabolic health and mitochondrial density through sustained low-intensity cardio. Activates PGC-1α pathway for mitochondrial production.',
    goal: 'Increase mitochondrial density and metabolic efficiency',
    level: 'all',
    durationWeeks: 8,
    sessionsPerWeek: 4,
    tags: ['zone-2', 'cardio', 'mitochondria', 'metabolic-health', 'longevity', 'fat-burning'],
    focusAreas: ['cardiovascular', 'mitochondrial-health', 'fat-oxidation'],
    equipment: {
      required: [],
      optional: ['heart-rate-monitor', 'bike', 'treadmill', 'rower']
    },
    readinessNotes: [
      'Zone 2 = 60-70% of max HR. Max HR ≈ 220 - your age.',
      'You should be able to hold a conversation, but it takes effort',
      'Cumulative time matters most - more sustainable sessions = more mitochondria',
      'Some evidence suggests fasted Zone 2 enhances fat oxidation adaptations'
    ],
    aiInsights: {
      mechanism: 'Sustained Zone 2 activates PGC-1α, the master regulator of mitochondrial biogenesis. This creates new mitochondria in slow-twitch muscle fibers.',
      duration: 'Research suggests 60-120 minutes per session for optimal mitochondrial adaptations',
      alternative: 'Peter Attia also recommends 1x weekly Zone 5 session (4x4 minutes) for VO2max',
      timeline: 'Capillary and mitochondrial changes visible within weeks in untrained individuals'
    },
    researchLinks: [
      { label: 'Zone 2 Training: Myth or Scientific Reality (Sci-Sport)', url: 'https://sci-sport.com/en/zone-2-the-ideal-intensity-myth-or-scientific-reality-255/' },
      { label: 'Mitochondrial Health and Longevity (Healthspan)', url: 'https://gethealthspan.com/science/article/zone-2-endurance-training-longevity-mitochondrial-health' },
      { label: 'Exercise Training and Mitochondrial Function (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9603958/' },
      { label: 'Zone 2 and Metabolic Health (Levels)', url: 'https://www.levels.com/blog/the-metabolic-benefits-of-slow-steady-zone-2-exercise' }
    ],
    phases: [
      {
        name: 'Phase 1: Building Base',
        weekStart: 1,
        weekEnd: 3,
        description: 'Establish Zone 2 habit with moderate duration sessions',
        sessions: [
          {
            name: 'Zone 2 Session (4x weekly)',
            exercises: [
              {
                name: 'Zone 2 Cardio (any modality)',
                durationMinutes: 30,
                intensity: '60-70% max heart rate',
                notes: 'Walk briskly, easy jog, bike, swim, row - any activity that keeps you in zone. Should be conversational.'
              }
            ],
            totalDuration: '30-45 minutes including warmup/cooldown',
            heartRateGuidance: 'Example: Age 40 → Max HR 180 → Zone 2 = 108-126 bpm'
          }
        ]
      },
      {
        name: 'Phase 2: Duration Building',
        weekStart: 4,
        weekEnd: 6,
        description: 'Extend session length for greater mitochondrial stimulus',
        sessions: [
          {
            name: 'Extended Zone 2 Session',
            exercises: [
              {
                name: 'Zone 2 Cardio',
                durationMinutes: 45,
                intensity: '60-70% max heart rate',
                notes: 'Consistency is key. Better to do 45min easy than 20min hard.'
              }
            ],
            totalDuration: '45-60 minutes'
          },
          {
            name: 'Long Zone 2 Session (1x weekly)',
            exercises: [
              {
                name: 'Zone 2 Long Session',
                durationMinutes: 60,
                intensity: '60-70% max heart rate',
                notes: 'One longer session per week builds significant metabolic base'
              }
            ],
            totalDuration: '60-75 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Adding Zone 5',
        weekStart: 7,
        weekEnd: 8,
        description: 'Add one high-intensity session for VO2max while maintaining Zone 2 base',
        sessions: [
          {
            name: 'Zone 2 Session (3x weekly)',
            exercises: [
              {
                name: 'Zone 2 Cardio',
                durationMinutes: 50,
                intensity: '60-70% max heart rate',
                notes: 'Maintain Zone 2 foundation'
              }
            ]
          },
          {
            name: 'Zone 5 HIIT Session (1x weekly)',
            exercises: [
              {
                name: 'Warmup',
                durationMinutes: 10,
                intensity: 'Zone 2',
                notes: 'Essential - don\'t skip'
              },
              {
                name: '4x4 Intervals',
                sets: 4,
                durationMinutes: 4,
                restMinutes: 4,
                intensity: '90-95% max heart rate (Zone 5)',
                notes: 'Peter Attia protocol. Go HARD for 4 min, recover for 4 min. 4 rounds.'
              },
              {
                name: 'Cool Down',
                durationMinutes: 5,
                intensity: 'Zone 1-2',
                notes: 'Easy movement until heart rate drops'
              }
            ],
            totalDuration: '45 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 6. ECCENTRIC STRENGTH PROTOCOL (NORDIC)
  // ============================================
  {
    slug: 'eccentric-nordic-strength',
    name: 'Eccentric Strength & Injury Prevention Protocol',
    summary: 'Nordic curls and eccentric-focused exercises to build bulletproof hamstrings, quads, and connective tissue. Proven to reduce hamstring injury risk by 50%+.',
    goal: 'Build eccentric strength and prevent lower body injuries',
    level: 'intermediate',
    durationWeeks: 10,
    sessionsPerWeek: 2,
    tags: ['eccentric', 'nordic-curl', 'injury-prevention', 'hamstrings', 'strength'],
    focusAreas: ['hamstrings', 'quadriceps', 'injury-prevention', 'athletic-performance'],
    equipment: {
      required: [],
      optional: ['nordic-curl-strap', 'partner', 'loaded-barbell-anchor']
    },
    readinessNotes: [
      'Start with assisted/partial range if unable to do full Nordic. Progress slowly.',
      'Expect significant DOMS (muscle soreness) initially - this is normal with eccentrics',
      'Essential: 5-10 min light cardio + dynamic stretching before eccentric work',
      'Research shows LOW volume (2x/week) is equally effective as high volume'
    ],
    aiInsights: {
      injuryPrevention: 'Nordic curls reduce hamstring injury incidence significantly in athletes',
      muscleAdaptation: 'Eccentrics shift muscle optimum length, protecting against strain injuries',
      protocol: 'Mjølsnes protocol: 10 weeks, 2x/week, builds to 3 sets of 12 reps',
      microDosing: 'Recent research supports "micro-dosing" - low volume is equally effective'
    },
    researchLinks: [
      { label: 'Nordic Hamstring Exercise Volume Meta-Analysis (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6942028/' },
      { label: '4-Week NHE Protocol Results (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7735695/' },
      { label: 'NHE as Staple Exercise for Athletes (Bret Contreras)', url: 'https://bretcontreras.com/nordic-ham-curl-staple-exercise-athletes/' },
      { label: 'Sports Medicine Nordic Curl Research', url: 'https://link.springer.com/article/10.1007/s40279-019-01178-7' }
    ],
    phases: [
      {
        name: 'Phase 1: Introduction (Weeks 1-2)',
        weekStart: 1,
        weekEnd: 2,
        description: 'Learn movement patterns with assisted variations',
        sessions: [
          {
            name: 'Eccentric Foundation (2x/week)',
            exercises: [
              {
                name: 'Assisted Nordic Curl',
                sets: 2,
                reps: 5,
                tempo: '3-5 seconds lowering',
                notes: 'Use hands to catch yourself and push back up. Focus only on the lowering (eccentric) phase. Go as low as you can control.'
              },
              {
                name: 'Romanian Deadlift (light)',
                sets: 3,
                reps: 10,
                tempo: '3 seconds lowering',
                notes: 'Focus on slow eccentric - hamstrings should feel stretch'
              },
              {
                name: 'Eccentric Leg Curl (if available)',
                sets: 2,
                reps: 8,
                tempo: '4 seconds lowering',
                notes: 'Lift with both legs, lower with one'
              }
            ],
            totalDuration: '20-25 minutes'
          }
        ]
      },
      {
        name: 'Phase 2: Building Volume (Weeks 3-6)',
        weekStart: 3,
        weekEnd: 6,
        description: 'Progressively increase reps while maintaining control',
        sessions: [
          {
            name: 'Nordic Progression (2x/week)',
            exercises: [
              {
                name: 'Nordic Curl',
                sets: 3,
                reps: '6-8',
                tempo: '3-5 seconds lowering',
                notes: 'Progress to less assistance as strength builds. Week 3-4: aim for 6 reps. Week 5-6: aim for 8 reps.'
              },
              {
                name: 'Reverse Nordic Curl (Quads)',
                sets: 2,
                reps: 8,
                tempo: '3 seconds lowering',
                notes: 'Kneeling, lean back keeping hips extended. Targets quads eccentrically.'
              },
              {
                name: 'Single Leg Romanian Deadlift',
                sets: 2,
                reps: 8,
                tempo: '3 seconds down',
                notes: 'Unilateral eccentric loading'
              }
            ],
            totalDuration: '25-30 minutes'
          }
        ]
      },
      {
        name: 'Phase 3: Full Protocol (Weeks 7-10)',
        weekStart: 7,
        weekEnd: 10,
        description: 'Complete Mjølsnes-style Nordic protocol',
        sessions: [
          {
            name: 'Full Nordic Protocol (2x/week)',
            exercises: [
              {
                name: 'Nordic Curl',
                sets: 3,
                reps: '10-12',
                tempo: 'Controlled lowering',
                notes: 'By now you should be able to do full range Nordics. If not, continue with partial range - that is also effective.'
              },
              {
                name: 'Razor Curl / Glute-Ham Raise',
                sets: 2,
                reps: 8,
                notes: 'If equipment available - similar but different angle'
              },
              {
                name: 'Eccentric Calf Drops',
                sets: 2,
                reps: 15,
                tempo: '3 seconds lowering',
                notes: 'Stand on step, rise on both feet, lower on one. Achilles tendon health.'
              }
            ],
            totalDuration: '25-30 minutes'
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 7. COLD EXPOSURE BROWN FAT PROTOCOL
  // ============================================
  {
    slug: 'cold-exposure-brown-fat',
    name: 'Cold Exposure Brown Fat Activation Protocol',
    summary: 'Progressive cold exposure to activate brown adipose tissue (BAT) and increase non-shivering thermogenesis. Based on human cold acclimation research.',
    goal: 'Activate brown fat, increase metabolic rate, and improve cold tolerance',
    level: 'beginner',
    durationWeeks: 4,
    sessionsPerWeek: 7,
    tags: ['cold-exposure', 'brown-fat', 'thermogenesis', 'metabolism', 'hormesis'],
    focusAreas: ['metabolism', 'brown-fat', 'resilience', 'hormesis'],
    equipment: {
      required: [],
      optional: ['cold-shower', 'ice-bath', 'cold-plunge']
    },
    readinessNotes: [
      'Never do cold exposure alone if using ice baths. Start gradually.',
      'Avoid if you have heart conditions, Raynaud\'s disease, or are pregnant',
      'Goal is to reach point just before shivering - this activates BAT without excessive stress',
      'Morning cold exposure may enhance cortisol awakening response'
    ],
    aiInsights: {
      batActivation: 'Brown fat activated at mild cold (16-19°C/60-66°F) - doesn\'t require extreme cold',
      duration: 'Research shows 2-6 hours of mild cold exposure daily for 14 days significantly increases BAT activity',
      shortExposure: 'Even 15-30 minutes daily of cool exposure can induce structural changes in BAT',
      metabolism: 'Cold acclimation increased non-shivering thermogenesis from 10.8% to 17.8%'
    },
    researchLinks: [
      { label: 'Cold acclimation recruits human brown fat (JCI)', url: 'https://www.jci.org/articles/view/68993' },
      { label: 'Intermittent Cold Exposure and Brown Fat (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3895006/' },
      { label: 'Acute Cold Exposure Meta-Analysis (PMC)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9273773/' },
      { label: 'Fat cells directly sense temperature (PNAS)', url: 'https://www.pnas.org/doi/10.1073/pnas.1310261110' }
    ],
    phases: [
      {
        name: 'Phase 1: Cool Introduction',
        weekStart: 1,
        weekEnd: 1,
        description: 'Begin with mild temperature changes that are easily tolerable',
        sessions: [
          {
            name: 'Daily Cool Exposure',
            exercises: [
              {
                name: 'End Shower Cold',
                durationSeconds: 30,
                temperature: 'Cool (not cold) - around 68°F/20°C',
                notes: 'End regular shower with 30 seconds of cool water. Focus on breathing calmly.'
              },
              {
                name: 'Cool Room Sleep',
                durationHours: 8,
                temperature: '66-68°F (19-20°C)',
                notes: 'Lower bedroom temperature. This alone activates brown fat overnight.'
              }
            ],
            totalDuration: '30 seconds active + overnight passive'
          }
        ]
      },
      {
        name: 'Phase 2: Progressive Cold',
        weekStart: 2,
        weekEnd: 2,
        description: 'Increase duration and decrease temperature gradually',
        sessions: [
          {
            name: 'Cold Shower Protocol',
            exercises: [
              {
                name: 'Cold Shower',
                durationSeconds: 60,
                temperature: 'Cold - around 60°F/15°C',
                notes: 'Start lukewarm, transition to cold. Breathe deeply through the discomfort.'
              },
              {
                name: 'Cool Environment Time',
                durationMinutes: 30,
                temperature: 'Light clothing in 65°F/18°C room',
                notes: 'Spend time in cool environment with minimal clothing - t-shirt/shorts'
              }
            ]
          }
        ]
      },
      {
        name: 'Phase 3: Cold Immersion Introduction',
        weekStart: 3,
        weekEnd: 3,
        description: 'Introduce full cold water immersion if desired',
        sessions: [
          {
            name: 'Cold Immersion Day',
            exercises: [
              {
                name: 'Cold Shower',
                durationMinutes: 2,
                temperature: '55-60°F (13-15°C)',
                notes: 'Full 2 minutes of cold. Focus: calm breathing, relaxed muscles.'
              }
            ]
          },
          {
            name: 'Cold Plunge Day (optional)',
            exercises: [
              {
                name: 'Cold Plunge/Ice Bath',
                durationMinutes: '2-3',
                temperature: '50-59°F (10-15°C)',
                notes: 'If you have access to cold plunge. Enter slowly, breathe, stay 2-3 min.'
              }
            ]
          }
        ]
      },
      {
        name: 'Phase 4: Maintenance Protocol',
        weekStart: 4,
        weekEnd: 4,
        description: 'Establish sustainable cold exposure routine',
        sessions: [
          {
            name: 'Daily Cold Protocol',
            exercises: [
              {
                name: 'Morning Cold Shower',
                durationMinutes: '2-3',
                temperature: 'As cold as tap goes',
                notes: 'This becomes your daily practice'
              },
              {
                name: 'Weekly Cold Plunge (optional)',
                durationMinutes: '3-5',
                frequency: '1-2x per week',
                notes: 'Deeper cold exposure 1-2x weekly for continued adaptation'
              }
            ]
          }
        ]
      }
    ],
    isPublic: true
  },

  // ============================================
  // 8. MOBILITY & JOINT HEALTH PROTOCOL
  // ============================================
  {
    slug: 'mobility-joint-health',
    name: 'Daily Mobility & Joint Health Protocol',
    summary: 'Comprehensive joint health routine combining controlled articular rotations (CARs), dynamic stretching, and joint-specific movements for longevity.',
    goal: 'Maintain and improve joint range of motion and health',
    level: 'all',
    durationWeeks: 0, // Ongoing
    sessionsPerWeek: 7,
    tags: ['mobility', 'joints', 'flexibility', 'longevity', 'daily-practice'],
    focusAreas: ['joints', 'mobility', 'flexibility', 'injury-prevention'],
    equipment: {
      required: [],
      optional: ['foam-roller', 'lacrosse-ball', 'yoga-mat']
    },
    readinessNotes: [
      'Small daily practice beats occasional long sessions',
      'Move through full range without pain. Some discomfort is OK, sharp pain is not.',
      'Exhale as you move deeper into ranges'
    ],
    aiInsights: {
      cars: 'Controlled Articular Rotations (CARs) maintain joint capsule health through full range movement',
      useItOrLoseIt: 'Joints that aren\'t moved through full range will lose that range over time',
      dailyDose: 'Even 5-10 minutes of daily mobility work has significant long-term benefits',
      morningRoutine: 'Best done in morning to assess daily mobility and "oil" the joints'
    },
    researchLinks: [
      { label: 'Kinstretch/FRC Methodology', url: 'https://www.functionalanatomyseminars.com/' }
    ],
    phases: [
      {
        name: 'Daily Morning Routine',
        weekStart: 1,
        weekEnd: 0,
        description: 'Ongoing daily practice - takes only 10-15 minutes',
        sessions: [
          {
            name: 'Morning Joint Mobility',
            exercises: [
              {
                name: 'Neck CARs',
                reps: 3,
                direction: 'Each direction',
                tempo: 'Slow and controlled',
                notes: 'Chin to chest, ear to shoulder, look up, roll around. Full circles both directions.'
              },
              {
                name: 'Shoulder CARs',
                reps: 3,
                direction: 'Each direction',
                notes: 'Big arm circles, trying to make the biggest circle possible while keeping core tight'
              },
              {
                name: 'Thoracic Spine Rotation',
                reps: 10,
                direction: 'Each side',
                notes: 'Seated or standing, rotate upper back while keeping hips still'
              },
              {
                name: 'Hip CARs',
                reps: 3,
                direction: 'Each direction, each leg',
                notes: 'Standing, lift knee, rotate out, extend back, rotate in. Full circle around hip socket.'
              },
              {
                name: 'Ankle CARs',
                reps: 5,
                direction: 'Each direction, each ankle',
                notes: 'Big circles with the ankle - point, circle out, flex, circle in'
              },
              {
                name: 'Wrist CARs',
                reps: 5,
                direction: 'Each direction',
                notes: 'Full circles with wrists - important for pressing and grip'
              },
              {
                name: 'Spine Waves (Cat-Cow)',
                reps: 10,
                notes: 'Articulate through each vertebra, not just hinging'
              },
              {
                name: 'Deep Squat Hold',
                holdSeconds: 60,
                notes: 'Sit in deep squat, work on keeping heels down. Use support if needed.'
              }
            ],
            totalDuration: '10-15 minutes'
          }
        ]
      }
    ],
    isPublic: true
  }
]

async function main() {
  console.log('Seeding research-based workout protocols...')

  for (const protocol of WORKOUT_PROTOCOLS) {
    const existing = await prisma.workoutProtocol.findUnique({
      where: { slug: protocol.slug }
    })

    if (existing) {
      console.log(`Updating: ${protocol.name}`)
      await prisma.workoutProtocol.update({
        where: { slug: protocol.slug },
        data: protocol as any
      })
    } else {
      console.log(`Creating: ${protocol.name}`)
      await prisma.workoutProtocol.create({
        data: protocol as any
      })
    }
  }

  console.log('Done! Seeded', WORKOUT_PROTOCOLS.length, 'workout protocols')
  console.log('\nProtocols created:')
  WORKOUT_PROTOCOLS.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.slug})`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
