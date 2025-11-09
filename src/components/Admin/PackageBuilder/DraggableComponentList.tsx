'use client'

import { useDraggable } from '@dnd-kit/core'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'

interface DraggableProductProps {
  id: string
  name: string
  imageUrl?: string | null
  price: number
  inBundle: boolean
}

function DraggableProduct({ id, name, imageUrl, price, inBundle }: DraggableProductProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: inBundle
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-gray-800/50 rounded-lg p-3 border transition-all ${
        inBundle
          ? 'opacity-40 cursor-not-allowed border-gray-700'
          : 'cursor-grab active:cursor-grabbing border-gray-700 hover:border-primary-400 hover:bg-gray-800/70'
      } ${isDragging ? 'opacity-50 scale-105' : ''}`}
      title={inBundle ? 'Already in bundle' : 'Drag to add to bundle'}
    >
      <div className="flex items-center gap-3">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            className="w-12 h-12 object-cover rounded border border-gray-600"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-white text-sm font-medium truncate">{name}</h4>
          <p className="text-gray-400 text-xs">${(price / 100).toFixed(2)}</p>
        </div>
        {!inBundle && <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        {inBundle && (
          <span className="text-xs text-gray-500 flex-shrink-0">Added</span>
        )}
      </div>
    </div>
  )
}

interface Product {
  id: string
  name: string
  imageUrl?: string | null
  prices: Array<{
    unitAmount: number
    isPrimary: boolean
  }>
}

interface DraggableComponentListProps {
  products: Product[]
  bundleComponents: string[] // IDs of products already in bundle
}

export function DraggableComponentList({ products, bundleComponents }: DraggableComponentListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 sticky top-8">
      <h3 className="text-xl font-bold text-white mb-4">Available Products</h3>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-400 focus:outline-none placeholder-gray-400"
        />
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          filtered.map(product => {
            const primaryPrice = product.prices.find(p => p.isPrimary)
            const inBundle = bundleComponents.includes(product.id)
            return (
              <DraggableProduct
                key={product.id}
                id={product.id}
                name={product.name}
                imageUrl={product.imageUrl}
                price={primaryPrice?.unitAmount || 0}
                inBundle={inBundle}
              />
            )
          })
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          <span className="text-primary-400 font-semibold">{filtered.length}</span> product{filtered.length !== 1 ? 's' : ''} available
        </p>
      </div>
    </div>
  )
}
