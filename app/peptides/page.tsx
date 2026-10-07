import { PeptideTracker } from "@/components/Peptides/PeptideTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function PeptidesPage() {
  return (
    <ProtectedRoute>
      <div className="rb-launch">
        <VaultPromptModal trackerName="Peptide Tracker" trackerVerb="track your protocols and doses" />
        <PeptideTracker />
      </div>
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Peptide Tracker - Reset Biology",
  description: "Comprehensive peptide management system. Schedule doses, track progress, monitor side effects with IRB-compliant data sharing.",
}