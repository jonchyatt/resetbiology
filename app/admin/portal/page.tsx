"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Layout, Eye, EyeOff, ArrowLeft } from "lucide-react"

interface PortalModule {
  id: string
  slug: string
  label: string
  href: string
  icon: string
  colorFrom: string
  colorTo: string
  borderColor: string
  iconColor: string
  enabled: boolean
  order: number
}

export default function AdminPortalPage() {
  const [modules, setModules] = useState<PortalModule[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/portal-modules')
      .then(res => res.json())
      .then(data => {
        setModules(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function toggleModule(slug: string, currentEnabled: boolean) {
    setToggling(slug)
    // Optimistic update
    setModules(prev => prev.map(m =>
      m.slug === slug ? { ...m, enabled: !currentEnabled } : m
    ))

    try {
      const res = await fetch('/api/admin/portal-modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, enabled: !currentEnabled }),
      })
      if (!res.ok) {
        // Revert on failure
        setModules(prev => prev.map(m =>
          m.slug === slug ? { ...m, enabled: currentEnabled } : m
        ))
      }
    } catch {
      // Revert on failure
      setModules(prev => prev.map(m =>
        m.slug === slug ? { ...m, enabled: currentEnabled } : m
      ))
    }
    setToggling(null)
  }

  const enabledCount = modules.filter(m => m.enabled).length
  const disabledCount = modules.filter(m => !m.enabled).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/admin" className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Admin
            </Link>
            <div className="flex items-center gap-3">
              <Layout className="w-8 h-8 text-indigo-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">Portal Module Manager</h1>
                <p className="text-gray-400 mt-1">
                  Toggle modules on/off in the client portal. Changes take effect immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-8">
            <div className="bg-green-600/20 border border-green-400/30 rounded-lg px-4 py-2 backdrop-blur-sm">
              <span className="text-green-300 font-semibold">{enabledCount}</span>
              <span className="text-gray-400 ml-2 text-sm">Visible</span>
            </div>
            <div className="bg-gray-600/20 border border-gray-400/30 rounded-lg px-4 py-2 backdrop-blur-sm">
              <span className="text-gray-300 font-semibold">{disabledCount}</span>
              <span className="text-gray-400 ml-2 text-sm">Hidden</span>
            </div>
          </div>

          {/* Module Grid */}
          {loading ? (
            <div className="text-gray-400 text-center py-12">Loading modules...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl">
              {modules.map((mod) => (
                <div
                  key={mod.slug}
                  className={`bg-gradient-to-br ${mod.enabled ? 'from-gray-800/80 to-gray-900/80' : 'from-gray-800/40 to-gray-900/40'} backdrop-blur-sm rounded-xl p-5 border ${mod.enabled ? 'border-primary-400/20' : 'border-gray-600/20'} shadow-lg transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${mod.colorFrom} ${mod.colorTo} border ${mod.borderColor} flex items-center justify-center ${!mod.enabled ? 'opacity-40' : ''}`}>
                        <span className={`text-lg ${mod.iconColor} ${!mod.enabled ? 'opacity-50' : ''}`}>
                          {mod.icon.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className={`font-semibold ${mod.enabled ? 'text-white' : 'text-gray-500'}`}>
                          {mod.label}
                        </h3>
                        <p className="text-xs text-gray-500">{mod.href}</p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleModule(mod.slug, mod.enabled)}
                      disabled={toggling === mod.slug}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        mod.enabled ? 'bg-green-500' : 'bg-gray-600'
                      } ${toggling === mod.slug ? 'opacity-50' : ''}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        mod.enabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Status */}
                  <div className="mt-3 flex items-center gap-2">
                    {mod.enabled ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs text-green-400">Visible in portal</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs text-gray-500">Hidden from portal</span>
                      </>
                    )}
                    <span className="text-xs text-gray-600 ml-auto">Order: {mod.order}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
