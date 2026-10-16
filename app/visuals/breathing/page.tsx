import { isAdminRequest } from "@/lib/adminGuard";
import VisualStudio from "./VisualStudio";

export const metadata = {
  title: "Meditation Visuals",
  description: "Calm, breath-synced visuals for meditation and breathing practice.",
};

// Export (developer commands) and internal preset names are admin-only.
export default async function MeditationVisualsPage() {
  const isAdmin = await isAdminRequest();
  return <VisualStudio isAdmin={isAdmin} />;
}
