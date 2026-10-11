import { PeptideHistoryReport } from "@/components/Peptides/PeptideHistoryReport";
import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";

export const metadata = {
  title: "Personal Peptide History | Reset Biology",
  description: "Review and export your personal peptide records.",
};

export default function PeptideHistoryPage() {
  // Hidden until the local seat sets NEXT_PUBLIC_RB_REPORTS=1.
  if (process.env.NEXT_PUBLIC_RB_REPORTS !== "1") notFound();
  return (
    <ProtectedRoute>
      <PeptideHistoryReport />
    </ProtectedRoute>
  );
}
