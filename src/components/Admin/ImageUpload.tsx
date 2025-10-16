'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageUrlChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ currentImageUrl, onImageUrlChange, label = "Product Image" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      // Update the image URL
      onImageUrlChange(data.url);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleClear = () => {
    onImageUrlChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-primary-300">
        {label}
      </label>

      {/* Current Image Preview */}
      {currentImageUrl && (
        <div className="relative inline-block">
          <img
            src={currentImageUrl}
            alt="Product preview"
            className="w-32 h-32 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
          dragActive
            ? 'border-primary-400 bg-primary-900/20'
            : 'border-gray-600 hover:border-primary-400/50 bg-gray-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-gray-300">Uploading to Imgur...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
              {currentImageUrl ? (
                <ImageIcon className="w-6 h-6 text-primary-400" />
              ) : (
                <Upload className="w-6 h-6 text-primary-400" />
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary-400 hover:text-primary-300 font-medium text-sm"
              >
                Click to upload
              </button>
              <span className="text-gray-400 text-sm"> or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Manual URL Input (fallback) */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
          Or paste image URL manually
        </summary>
        <input
          type="url"
          value={currentImageUrl || ''}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="mt-2 w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
        />
      </details>
    </div>
  );
}
