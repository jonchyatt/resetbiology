import { notFound } from "next/navigation";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";
import { WeeklyResetReport } from "@/components/Reports/WeeklyResetReport";

export const metadata = { title: "Weekly Reset report | Reset Biology", description: "Private exportable weekly Reset report." };

export default function ResetReportPage() {
  // Hidden until the local seat sets NEXT_PUBLIC_RB_REPORTS=1.
  if (process.env.NEXT_PUBLIC_RB_REPORTS !== "1") notFound();
  return <ProtectedRoute><WeeklyResetReport /></ProtectedRoute>;
}
