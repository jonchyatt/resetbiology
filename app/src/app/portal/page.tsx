import { Dashboard } from "@/components/Portal/Dashboard"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"

export default function PortalPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}