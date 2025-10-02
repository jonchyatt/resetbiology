'use client'

import { useState } from 'react'
import { Upload, ImageIcon } from 'lucide-react'

export function ImportButton({ action, label, icon }: {
  action: () => Promise<any>,
  label: string,
  icon: 'upload' | 'image'
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleClick = async () => {
    if (loading) return

    setLoading(true)
    setResult(null)

    try {
      const res = await action()
      setResult(res)

      // Show success message
      if (res.success) {
        alert(`✅ Success! ${label} completed.\n\nDetails:\n${JSON.stringify(res, null, 2)}`)
      } else {
        alert(`❌ Error: ${res.error || 'Unknown error'}`)
      }

      // Reload page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error:', error)
      alert(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const Icon = icon === 'upload' ? Upload : ImageIcon
  const colorClass = icon === 'upload'
    ? 'bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700'
    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${colorClass} text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : (
        <>
          <Icon className="w-5 h-5 mr-2" />
          {label}
        </>
      )}
    </button>
  )
}
