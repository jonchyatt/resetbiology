import { SameBuilderRow } from "@/components/Outbound/SameBuilderRow"
import { EmailCaptureCard } from "@/components/Newsletter/EmailCaptureCard"
import { PeptideTracker } from "@/components/Peptides/PeptideTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function PeptidesPage() {
  return (
    <ProtectedRoute>
      <VaultPromptModal trackerName="Peptide Tracker" trackerVerb="track your protocols and doses" />
      <PeptideTracker />
      <EmailCaptureCard source="tool-peptides" />
      <SameBuilderRow />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Peptide Tracker",
  description: "Comprehensive peptide management system. Track peptide protocols and doses, set reminders, and note how you feel.",
}