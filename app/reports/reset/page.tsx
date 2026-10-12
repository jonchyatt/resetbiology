import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";
import { WeeklyResetReport } from "@/components/Reports/WeeklyResetReport";

export const metadata = { title: "Weekly Reset report | Reset Biology", description: "Private exportable weekly Reset report." };

export default function ResetReportPage() {
  return <ProtectedRoute><WeeklyResetReport /></ProtectedRoute>;
}
