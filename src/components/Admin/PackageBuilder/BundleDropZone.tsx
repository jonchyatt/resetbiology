'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ComponentItem } from './ComponentItem'
import { Package } from 'lucide-react'

interface BundleComponent {
  id: string
  componentProductId: string
  quantity: number
  isOptional: boolean
  componentProduct: {
    name: string
    imageUrl?: string | null
    prices: Array<{
      unitAmount: number
      isPrimary: boolean
    }>
  }
}

interface BundleDropZoneProps {
  bundleId: string
  components: BundleComponent[]
  onRemoveComponent: (itemId: string) => void
  onToggleOptional: (itemId: string) => void
  onQuantityChange: (itemId: string, qty: number) => void
}

export function BundleDropZone({
  bundleId,
  components,
  onRemoveComponent,
  onToggleOptional,
  onQuantityChange
}: BundleDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: bundleId })

  const requiredComponents = components.filter(c => !c.isOptional)
  const optionalComponents = components.filter(c => c.isOptional)

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[300px] bg-gray-900/30 rounded-lg p-6 border-2 border-dashed transition-all ${
        isOver
          ? 'border-primary-400 bg-primary-900/20'
          : 'border-gray-600'
      }`}
    >
      {components.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Package className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Drag products here to build your package</p>
          <p className="text-sm text-gray-500">
            Drag peptides from the right to add them to this bundle
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Required Components */}
          {requiredComponents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full"></span>
                Required Components ({requiredComponents.length})
              </h3>
              <SortableContext
                items={requiredComponents.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {requiredComponents.map((component) => {
                    const primaryPrice = component.componentProduct.prices.find(p => p.isPrimary)
                    return (
                      <ComponentItem
                        key={component.id}
                        id={component.id}
                        name={component.componentProduct.name}
                        imageUrl={component.componentProduct.imageUrl}
                        price={primaryPrice?.unitAmount || 0}
                        quantity={component.quantity}
                        isOptional={component.isOptional}
                        onRemove={() => onRemoveComponent(component.id)}
                        onToggleOptional={() => onToggleOptional(component.id)}
                        onQuantityChange={(qty) => onQuantityChange(component.id, qty)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </div>
          )}

          {/* Optional Components */}
          {optionalComponents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Optional Add-ons ({optionalComponents.length})
              </h3>
              <SortableContext
                items={optionalComponents.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {optionalComponents.map((component) => {
                    const primaryPrice = component.componentProduct.prices.find(p => p.isPrimary)
                    return (
                      <ComponentItem
                        key={component.id}
                        id={component.id}
                        name={component.componentProduct.name}
                        imageUrl={component.componentProduct.imageUrl}
                        price={primaryPrice?.unitAmount || 0}
                        quantity={component.quantity}
                        isOptional={component.isOptional}
                        onRemove={() => onRemoveComponent(component.id)}
                        onToggleOptional={() => onToggleOptional(component.id)}
                        onQuantityChange={(qty) => onQuantityChange(component.id, qty)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
