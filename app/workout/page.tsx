import { WorkoutTracker } from "@/components/Workout/WorkoutTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"

export default function WorkoutPage() {
  return (
    <ProtectedRoute>
      <WorkoutTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Workout Tracker - Reset Biology",
  description: "Custom fitness programs with analytics. Track your strength gains, endurance metrics, and body composition progress.",
}