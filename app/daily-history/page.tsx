import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { JournalHistory } from "@/components/Journal/JournalHistory"

export const metadata = {
  title: "Daily History - Reset Biology",
  description: "Review your daily journal, peptides, nutrition, workouts, breath practice, and mindset modules in one place.",
}

export default function DailyHistoryPage() {
  return (
    <ProtectedRoute>
      <JournalHistory />
    </ProtectedRoute>
  )
}
