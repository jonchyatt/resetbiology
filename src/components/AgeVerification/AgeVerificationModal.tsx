'use client'

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function AgeVerificationModal() {
  const [show, setShow] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    // Check if user has already consented in this session
    const consented = sessionStorage.getItem('ageConsent') === 'true';
    setHasConsented(consented);

    // Show modal immediately if not consented
    if (!consented) {
      setShow(true);
    }
  }, []);

  const handleConsent = () => {
    sessionStorage.setItem('ageConsent', 'true');
    setHasConsented(true);
    setShow(false);
  };

  if (hasConsented || !show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-primary-400/20">
        {/* Icon and Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-primary-500/20 p-4 rounded-full mb-4">
            <Shield className="w-12 h-12 text-primary-400" />
          </div>
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            Age Consent
          </h2>
        </div>

        {/* Content */}
        <div className="mb-8 text-center">
          <p className="text-gray-300 text-lg mb-4">
            You must be <span className="text-primary-400 font-bold text-2xl">21 years of age or older</span> to purchase peptide research products.
          </p>
          <p className="text-gray-400 text-sm mb-4">
            By clicking "I Consent", you confirm that you are 21 or older and agree to our terms of service.
          </p>
          <p className="text-xs text-gray-500 italic">
            Research peptides are for research purposes only.
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleConsent}
          className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary-500/50"
        >
          I Consent - I am 21 or Older
        </button>
      </div>
    </div>
  );
}
