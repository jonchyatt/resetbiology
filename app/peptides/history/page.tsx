import { PeptideHistoryReport } from "@/components/Peptides/PeptideHistoryReport";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";

export const metadata = {
  title: "Personal Peptide History | Reset Biology",
  description: "Review and export your personal peptide records.",
};

export default function PeptideHistoryPage() {
  return (
    <ProtectedRoute>
      <PeptideHistoryReport />
    </ProtectedRoute>
  );
}
