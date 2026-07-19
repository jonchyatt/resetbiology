import { NutritionTracker } from "@/components/Nutrition/NutritionTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function NutritionPage() {
  return (
    <ProtectedRoute>
      <VaultPromptModal trackerName="Nutrition Tracker" trackerVerb="log meals and track macros" />
      <NutritionTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Nutrition Tracker - Reset Biology",
  description: "Track meals, macros, and the daily targets you set.",
}
