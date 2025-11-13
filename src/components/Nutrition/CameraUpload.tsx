'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X, Loader2 } from 'lucide-react'

interface CameraUploadProps {
  onAnalysisComplete: (result: any) => void
  onClose: () => void
  mealType?: string
}

export function CameraUpload({ onAnalysisComplete, onClose, mealType = 'snack' }: CameraUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    if (!selectedFile || !previewUrl) return

    try {
      setAnalyzing(true)
      setError(null)

      // Convert image to base64 (remove data:image/...;base64, prefix)
      const base64 = previewUrl.split(',')[1]

      // Call AI analysis API
      const response = await fetch('/api/foods/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mealType
        })
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Analysis failed')
      }

      // Pass result to parent component
      onAnalysisComplete(data)
      onClose()

    } catch (err: any) {
      console.error('Analysis error:', err)
      setError(err.message || 'Failed to analyze image. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full border border-primary-400/30 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary-400" />
            Snap Your Meal
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={analyzing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-400/30 rounded-lg text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Image preview */}
        {previewUrl ? (
          <div className="mb-6">
            <img
              src={previewUrl}
              alt="Food preview"
              className="w-full h-64 object-contain rounded-lg bg-gray-700/50"
            />
            <button
              onClick={() => {
                setSelectedFile(null)
                setPreviewUrl(null)
                setError(null)
              }}
              className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
              disabled={analyzing}
            >
              Choose different image
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment" // Prefer back camera on mobile
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-8 border-2 border-dashed border-primary-400/30 rounded-lg hover:border-primary-400/60 hover:bg-primary-500/5 transition-all"
            >
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-primary-400" />
                <div>
                  <p className="text-white font-semibold">
                    Take Photo or Upload
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Max 10MB • JPG, PNG, HEIC
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* AI Info */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <p className="text-xs text-blue-300">
            AI will analyze your food photo and estimate calories, protein, carbs, and fats.
            You can edit the results before saving.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={analyzing}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || analyzing}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Analyze Food
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
