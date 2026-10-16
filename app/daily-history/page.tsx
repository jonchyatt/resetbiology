import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { JournalExplorer } from "@/components/Journal/JournalExplorer"

export const metadata = {
  title: "Daily Journal - Reset Biology",
  description: "Search and organize your private daily journal and linked activity history.",
}

export default function DailyHistoryPage() {
  return (
    <ProtectedRoute>
      <JournalExplorer />
    </ProtectedRoute>
  )
}
