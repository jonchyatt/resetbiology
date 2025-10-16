'use client';

import { useState, useEffect } from 'react';

interface PurposeCheckboxesProps {
  defaultValue?: string | null;
  productId: string;
}

const PURPOSES = [
  'Fat Loss',
  'Healing',
  'Performance',
  'Longevity',
  'Sleep',
  'Immunity',
  'Cognitive',
  'Anti-Aging',
  'Recovery',
  'Muscle Growth'
];

export function PurposeCheckboxes({ defaultValue, productId }: PurposeCheckboxesProps) {
  // Parse the comma-separated string into an array
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>(() => {
    if (!defaultValue) return [];
    return defaultValue.split(',').map(p => p.trim()).filter(Boolean);
  });

  // Update hidden input when selections change
  useEffect(() => {
    const hiddenInput = document.querySelector(`input[name="protocolPurpose"][data-product-id="${productId}"]`) as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.value = selectedPurposes.join(', ');
    }
  }, [selectedPurposes, productId]);

  const togglePurpose = (purpose: string) => {
    setSelectedPurposes(prev => {
      if (prev.includes(purpose)) {
        return prev.filter(p => p !== purpose);
      } else {
        return [...prev, purpose];
      }
    });
  };

  return (
    <div>
      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name="protocolPurpose"
        data-product-id={productId}
        value={selectedPurposes.join(', ')}
      />

      <label className="text-xs text-gray-400 block mb-2">
        Purpose (select all that apply)
      </label>

      <div className="grid grid-cols-2 gap-2">
        {PURPOSES.map(purpose => (
          <label
            key={purpose}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
              selectedPurposes.includes(purpose)
                ? 'bg-primary-500/20 border-primary-400/50 text-white'
                : 'bg-gray-800/50 border-gray-600/50 text-gray-300 hover:border-primary-400/30'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedPurposes.includes(purpose)}
              onChange={() => togglePurpose(purpose)}
              className="rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
            />
            <span className="text-sm">{purpose}</span>
          </label>
        ))}
      </div>

      {selectedPurposes.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          Selected: {selectedPurposes.join(', ')}
        </div>
      )}
    </div>
  );
}
