import { PeptideTracker } from "@/components/Peptides/PeptideTracker"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"

export default function PeptidesPage() {
  return (
    <ProtectedRoute>
      <PeptideTracker />
    </ProtectedRoute>
  )
}

export const metadata = {
  title: "Peptide Tracker - Reset Biology",
  description: "Comprehensive peptide management system. Schedule doses, track progress, monitor side effects with IRB-compliant data sharing.",
}