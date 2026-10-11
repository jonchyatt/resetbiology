import { PeptideTracker } from "@/components/Peptides/PeptideTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function PeptidesPage() {
  return (
    <ProtectedRoute>
      <VaultPromptModal trackerName="Peptide Tracker" trackerVerb="track your protocols and doses" />
      <PeptideTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Peptide Tracker - Reset Biology",
  description: "Personal peptide tracking: schedule doses, track progress, and record side effects.",
}