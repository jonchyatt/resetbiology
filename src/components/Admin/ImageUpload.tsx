'use client';

import { X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageUrlChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ currentImageUrl, onImageUrlChange, label = "Product Image" }: ImageUploadProps) {
  const handleClear = () => {
    onImageUrlChange('');
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

      {/* URL input */}
      <div className="flex items-center gap-2 border-2 border-dashed rounded-lg p-4 border-gray-600 bg-gray-800/30">
        <ImageIcon className="w-5 h-5 text-primary-400 shrink-0" />
        <input
          type="url"
          value={currentImageUrl || ''}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
        />
      </div>
      <p className="text-xs text-gray-500">Paste a public image URL</p>
    </div>
  );
}
