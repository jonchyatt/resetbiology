import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { ModuleLibrary } from "@/components/Audio/ModuleLibrary"

export default function AudioPage() {
  return (
    <ProtectedRoute>
      <div className="rb-surface">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="mx-auto max-w-5xl rb-card">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Hypnosis</h1>
                <p className="text-base text-slate-300">Choose a session and continue your practice.</p>
              </div>
              <a href="/portal" className="min-h-11 px-3 py-3 text-sm font-semibold text-primary-300 hover:text-primary-200">
                Back to portal
              </a>
            </div>
            <ModuleLibrary userId="current-user" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}