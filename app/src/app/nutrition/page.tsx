import { NutritionTracker } from "@/components/Nutrition/NutritionTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"

export default function NutritionPage() {
  return (
    <ProtectedRoute>
      <NutritionTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Nutrition Tracker - Reset Biology",
  description: "Automated meal plans optimized for peptide effectiveness. Track macros with peptide-specific recommendations.",
}