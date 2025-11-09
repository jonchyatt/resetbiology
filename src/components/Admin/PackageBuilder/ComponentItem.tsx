'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'

interface ComponentItemProps {
  id: string
  name: string
  imageUrl?: string | null
  price: number
  quantity: number
  isOptional: boolean
  onRemove: () => void
  onToggleOptional: () => void
  onQuantityChange: (qty: number) => void
}

export function ComponentItem({
  id,
  name,
  imageUrl,
  price,
  quantity,
  isOptional,
  onRemove,
  onToggleOptional,
  onQuantityChange
}: ComponentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800/50 rounded-lg p-4 flex items-center gap-4 border transition-all ${
        isOptional
          ? 'border-blue-400/40 bg-blue-900/10'
          : 'border-gray-700'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-white transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Product Image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="w-16 h-16 object-cover rounded border border-gray-600"
        />
      )}

      {/* Product Info */}
      <div className="flex-1">
        <h4 className="text-white font-medium">{name}</h4>
        <p className="text-gray-400 text-sm">${(price / 100).toFixed(2)} each</p>
        <p className="text-gray-500 text-xs mt-1">
          Total: ${((price * quantity) / 100).toFixed(2)}
        </p>
      </div>

      {/* Quantity */}
      <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">Qty</label>
        <input
          type="number"
          min="1"
          max="99"
          value={quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (val > 0 && val <= 99) {
              onQuantityChange(val)
            }
          }}
          className="w-16 px-2 py-1 bg-gray-700 text-white rounded text-center border border-gray-600 focus:border-primary-400 focus:outline-none"
        />
      </div>

      {/* Optional Toggle */}
      <label className="flex flex-col items-center gap-1 cursor-pointer">
        <span className="text-xs text-gray-400">Optional</span>
        <input
          type="checkbox"
          checked={isOptional}
          onChange={onToggleOptional}
          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </label>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded transition-all"
        title="Remove from bundle"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}
