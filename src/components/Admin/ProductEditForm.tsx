'use client';

import { useState } from 'react';
import { ImageUpload } from './ImageUpload';

interface ProductEditFormProps {
  product: any;
  editProductAction: (formData: FormData) => Promise<void>;
}

export function ProductEditForm({ product, editProductAction }: ProductEditFormProps) {
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Add the image URL to form data (it might have been updated via upload)
    formData.set('imageUrl', imageUrl);

    await editProductAction(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="productId" value={product.id} />

      {/* Basic Info Section */}
      <div className="border-b border-gray-700 pb-3 mb-3">
        <h4 className="text-sm font-semibold text-primary-300 mb-3">Basic Information</h4>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400">Product Name</label>
            <input
              name="name"
              defaultValue={product.name}
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Description</label>
            <textarea
              name="description"
              defaultValue={product.description || ''}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
            />
          </div>

          {/* Image Upload Component */}
          <ImageUpload
            currentImageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            label="Product Image"
          />
        </div>
      </div>

      {/* Protocol Management Section */}
      <div className="border-b border-gray-700 pb-3 mb-3">
        <h4 className="text-sm font-semibold text-secondary-300 mb-3">Peptide Protocol Settings</h4>

        <div className="space-y-3">
          {/* Enable Tracking Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isTrackable"
              id={`trackable-${product.id}`}
              defaultChecked={product.isTrackable}
              value="true"
              className="rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor={`trackable-${product.id}`} className="text-sm text-white font-medium">
              Enable in Peptide Tracker
            </label>
          </div>

          {/* Protocol Fields - Grid Layout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400">Purpose</label>
              <select
                name="protocolPurpose"
                defaultValue={product.protocolPurpose || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              >
                <option value="">Select...</option>
                <option value="Fat Loss">Fat Loss</option>
                <option value="Healing">Healing</option>
                <option value="Performance">Performance</option>
                <option value="Longevity">Longevity</option>
                <option value="Sleep">Sleep</option>
                <option value="Immunity">Immunity</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400">Dosage Range</label>
              <input
                name="protocolDosageRange"
                placeholder="e.g., 0.5mg-2.5mg"
                defaultValue={product.protocolDosageRange || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Frequency</label>
              <input
                name="protocolFrequency"
                placeholder="e.g., 3x per week"
                defaultValue={product.protocolFrequency || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Timing</label>
              <input
                name="protocolTiming"
                placeholder="e.g., AM or PM"
                defaultValue={product.protocolTiming || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Duration</label>
              <input
                name="protocolDuration"
                placeholder="e.g., 8 weeks on/off"
                defaultValue={product.protocolDuration || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400">Vial Amount</label>
              <input
                name="vialAmount"
                placeholder="e.g., 10mg"
                defaultValue={product.vialAmount || ''}
                className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400">Reconstitution Instructions</label>
            <input
              name="reconstitutionInstructions"
              placeholder="e.g., 2ml BAC water"
              defaultValue={product.reconstitutionInstructions || ''}
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Syringe Units (for calculator)</label>
            <input
              name="syringeUnits"
              type="number"
              step="0.1"
              placeholder="e.g., 10"
              defaultValue={product.syringeUnits || ''}
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium py-2 rounded text-sm"
      >
        Save All Changes
      </button>
    </form>
  );
}
