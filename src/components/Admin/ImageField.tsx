'use client';

import { useState, useEffect } from 'react';
import { ImageUpload } from './ImageUpload';

interface ImageFieldProps {
  name: string;
  defaultValue?: string | null;
  productId: string;
}

export function ImageField({ name, defaultValue, productId }: ImageFieldProps) {
  const [imageUrl, setImageUrl] = useState(defaultValue || '');

  // Update parent form's hidden input when image URL changes
  useEffect(() => {
    const hiddenInput = document.querySelector(`input[name="${name}"][data-product-id="${productId}"]`) as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.value = imageUrl;
    }
  }, [imageUrl, name, productId]);

  return (
    <div>
      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name={name}
        data-product-id={productId}
        value={imageUrl}
      />

      {/* Visual upload component */}
      <ImageUpload
        currentImageUrl={imageUrl}
        onImageUrlChange={setImageUrl}
        label="Product Image"
      />
    </div>
  );
}
