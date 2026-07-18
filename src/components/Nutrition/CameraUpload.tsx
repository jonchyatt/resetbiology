'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X, Loader2 } from 'lucide-react'

interface CameraUploadProps {
  onAnalysisComplete: (result: any) => void
  onClose: () => void
  mealType?: string
}

const VAULT_REQUIRED_MESSAGE =
  "Your photos aren't stored anywhere unless you connect your own Drive vault — you're in charge of what's yours. Connect your vault and every photo you take lands in YOUR Google Drive, under your control, not ours."

export function CameraUpload({ onAnalysisComplete, onClose, mealType = 'snack' }: CameraUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Vault-required notice: analysis + logging still proceed without a photo
  // (D2 fail-closed) — this just tells the user why the photo didn't attach,
  // and holds the analyzed result until they choose to continue.
  const [vaultNotice, setVaultNotice] = useState<string | null>(null)
  // Durable-retry notice: upload failed for a reason OTHER than vault_required
  // (network blip, 500, expired session) after retries. The photo is only
  // ever dropped by explicit user choice, never silently.
  const [photoSaveFailed, setPhotoSaveFailed] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [pendingResult, setPendingResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const RETRY_DELAYS_MS = [500, 1500] // 2 extra attempts, short backoff

  const attachPhotoOnce = async (
    file: File
  ): Promise<{ status: 'ok'; url: string } | { status: 'vault_required'; notice: string } | { status: 'error' }> => {
    try {
      const uploadForm = new FormData()
      uploadForm.append('image', file)
      const res = await fetch('/api/upload/image', { method: 'POST', body: uploadForm })
      const data = await res.json()

      if (res.ok && data.success) {
        return { status: 'ok', url: data.url }
      }
      if (res.status === 409 && data.error === 'vault_required') {
        return { status: 'vault_required', notice: data.message || VAULT_REQUIRED_MESSAGE }
      }
      return { status: 'error' }
    } catch {
      return { status: 'error' }
    }
  }

  // Client-owned durable retry: vault_required (409) is a permanent state
  // (no point retrying) and returns immediately. Any other failure (network
  // blip, 500, expired session) gets 2 automatic retries with short backoff
  // before giving up and handing back 'error' for the caller to hold pending.
  const attachPhoto = async (
    file: File
  ): Promise<{ status: 'ok'; url: string } | { status: 'vault_required'; notice: string } | { status: 'error' }> => {
    for (let attempt = 0; ; attempt++) {
      const result = await attachPhotoOnce(file)
      if (result.status !== 'error') return result
      if (attempt >= RETRY_DELAYS_MS.length) return result
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
    }
  }

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

      // Attach the original photo to the client's vault (durable retry —
      // see attachPhoto).
      const attachResult = await attachPhoto(selectedFile)
      const resultWithPhoto = {
        ...data,
        photoUrl: attachResult.status === 'ok' ? attachResult.url : null,
      }

      if (attachResult.status === 'vault_required') {
        // Vault not connected: hold the analyzed result and show the
        // notice instead of auto-closing — the log still proceeds fine
        // without a photo once the user continues.
        setPendingResult(resultWithPhoto)
        setVaultNotice(attachResult.notice)
        return
      }

      if (attachResult.status === 'error') {
        // Retries exhausted: hold the photo/result pending and let the
        // user explicitly retry or abandon it — never drop it silently.
        setPendingResult(resultWithPhoto)
        setPhotoSaveFailed(true)
        return
      }

      // Pass result to parent component
      onAnalysisComplete(resultWithPhoto)
      onClose()

    } catch (err: any) {
      console.error('Analysis error:', err)
      setError(err.message || 'Failed to analyze image. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  // User-triggered retry after the automatic retries in attachPhoto were
  // exhausted. On success, proceeds with the log flow using the new URL.
  const handleRetryPhotoSave = async () => {
    if (!selectedFile || !pendingResult) return

    setSavingPhoto(true)
    const attachResult = await attachPhoto(selectedFile)
    setSavingPhoto(false)

    if (attachResult.status === 'ok') {
      onAnalysisComplete({ ...pendingResult, photoUrl: attachResult.url })
      onClose()
      return
    }
    if (attachResult.status === 'vault_required') {
      setPhotoSaveFailed(false)
      setVaultNotice(attachResult.notice)
      return
    }
    // Still failing — stay in the photoSaveFailed state for another retry.
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

        {/* Vault-required notice — photo wasn't stored, but the log still works */}
        {vaultNotice && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg text-blue-200 text-sm space-y-2">
            <p>{vaultNotice}</p>
            <div className="flex gap-3">
              <a
                href="/connect-drive"
                className="text-primary-400 hover:text-primary-300 font-medium underline"
              >
                Connect your vault
              </a>
              <button
                type="button"
                onClick={() => {
                  onAnalysisComplete(pendingResult)
                  onClose()
                }}
                className="text-gray-300 hover:text-white font-medium underline"
              >
                Continue without photo
              </button>
            </div>
          </div>
        )}

        {/* Photo-save-failed notice — retries exhausted, photo held pending
            until the user explicitly retries or continues without it. */}
        {photoSaveFailed && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-400/20 rounded-lg text-amber-200 text-sm space-y-2">
            <p>Your photo isn&apos;t saved yet.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetryPhotoSave}
                disabled={savingPhoto}
                className="text-primary-400 hover:text-primary-300 font-medium underline disabled:opacity-50"
              >
                {savingPhoto ? 'Retrying...' : 'Retry saving photo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAnalysisComplete(pendingResult)
                  onClose()
                }}
                disabled={savingPhoto}
                className="text-gray-300 hover:text-white font-medium underline disabled:opacity-50"
              >
                Continue without photo
              </button>
            </div>
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
