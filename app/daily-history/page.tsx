import { SameBuilderRow } from "@/components/Outbound/SameBuilderRow"
import { EmailCaptureCard } from "@/components/Newsletter/EmailCaptureCard"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { JournalHistory } from "@/components/Journal/JournalHistory"

export const metadata = {
  title: "Daily History",
  description: "Review your daily journal, peptides, nutrition, workouts, breath practice, and mindset modules in one place.",
}

export default function DailyHistoryPage() {
  return (
    <ProtectedRoute>
      <JournalHistory />
      <EmailCaptureCard source="tool-journal" />
      <SameBuilderRow />
    </ProtectedRoute>
  )
}
