export const workoutPrograms = [
  {
    key: "peptide-strength",
    name: "Peptide Enhancement Strength",
    description: "Optimized for peptide therapy clients",
    frequency: "3x per week",
    duration: "45–60 min",
    template: [
      { name: "Back Squat", category: "Strength", sets: [{ reps: 5, weight: 0 }, { reps: 5, weight: 0 }, { reps: 5, weight: 0 }] },
      { name: "Bench Press", category: "Strength", sets: [{ reps: 5, weight: 0 }, { reps: 5, weight: 0 }, { reps: 5, weight: 0 }] },
      { name: "Pull-up", category: "Calisthenics", sets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }, { reps: 8, weight: 0 }] },
    ]
  },
  {
    key: "metabolic-accel",
    name: "Metabolic Acceleration",
    description: "High-intensity circuit training",
    frequency: "4x per week",
    duration: "30–45 min",
    template: [
      { name: "Kettlebell Swing", category: "Power", sets: [{ reps: 15, weight: 0 }, { reps: 15, weight: 0 }, { reps: 15, weight: 0 }] },
      { name: "Burpee", category: "Conditioning", sets: [{ reps: 12, weight: 0 }, { reps: 12, weight: 0 }, { reps: 12, weight: 0 }] },
      { name: "Row (Machine)", category: "Conditioning", sets: [{ reps: 500, weight: 0 }] },
    ]
  },
  {
    key: "recovery-mobility",
    name: "Recovery & Mobility",
    description: "Active recovery sessions",
    frequency: "Daily",
    duration: "20–30 min",
    template: [
      { name: "Plank", category: "Core", sets: [{ reps: 60, weight: 0 }, { reps: 45, weight: 0 }] },
      { name: "Russian Twist", category: "Core", sets: [{ reps: 20, weight: 0 }, { reps: 20, weight: 0 }] },
      { name: "Hip Thrust", category: "Strength", sets: [{ reps: 15, weight: 0 }, { reps: 15, weight: 0 }] },
    ]
  }
]