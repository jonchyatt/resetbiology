import { WorkoutTracker } from "@/components/Workout/WorkoutTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function WorkoutPage() {
  return (
    <ProtectedRoute>
      <VaultPromptModal trackerName="Workout Tracker" trackerVerb="log workouts and track strength gains" />
      <WorkoutTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Workout Tracker",
  description: "Custom fitness programs with analytics. Track logged sessions, sets, reps, and training history.",
}
