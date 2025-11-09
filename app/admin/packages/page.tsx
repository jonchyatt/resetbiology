'use client'

import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { BundleDropZone } from '@/components/Admin/PackageBuilder/BundleDropZone'
import { DraggableComponentList } from '@/components/Admin/PackageBuilder/DraggableComponentList'
import { calculatePricingSummary, formatPrice, formatSavingsPercent } from '@/lib/bundlePricing'
import { Package, Plus, DollarSign, Save, Trash2, Eye, EyeOff, ArrowLeft, ExternalLink } from 'lucide-react'

interface Bundle {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  active: boolean
  storefront: boolean
  bundlePriceOverride: number | null
  bundleItems: Array<{
    id: string
    componentProductId: string
    quantity: number
    isOptional: boolean
    componentProduct: {
      id: string
      name: string
      imageUrl?: string | null
      prices: Array<{
        unitAmount: number
        isPrimary: boolean
      }>
    }
  }>
  prices: Array<{
    id: string
    unitAmount: number
    isPrimary: boolean
  }>
}

interface Product {
  id: string
  name: string
  imageUrl?: string | null
  isBundle?: boolean
  prices: Array<{
    unitAmount: number
    isPrimary: boolean
  }>
}

export default function PackageBuilderPage() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Form states
  const [showNewBundleForm, setShowNewBundleForm] = useState(false)
  const [newBundleName, setNewBundleName] = useState('')
  const [newBundleSlug, setNewBundleSlug] = useState('')
  const [priceOverrideEnabled, setPriceOverrideEnabled] = useState(false)
  const [priceOverrideValue, setPriceOverrideValue] = useState<number>(0)

  const selectedBundle = bundles.find(b => b.id === selectedBundleId)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedBundle) {
      setPriceOverrideEnabled(selectedBundle.bundlePriceOverride !== null)
      setPriceOverrideValue(selectedBundle.bundlePriceOverride || 0)
    }
  }, [selectedBundle])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch bundles
      const bundlesRes = await fetch('/api/admin/bundles')
      const bundlesData = await bundlesRes.json()
      setBundles(bundlesData.bundles || [])

      // Fetch all products (non-bundles)
      const productsRes = await fetch('/api/products?excludeBundles=true&includeInactive=true')
      const productsData = await productsRes.json()

      setProducts(productsData.products || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createBundle() {
    if (!newBundleName || !newBundleSlug) return

    try {
      const res = await fetch('/api/admin/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBundleName,
          slug: newBundleSlug,
          description: ''
        })
      })

      const data = await res.json()
      if (res.ok) {
        await fetchData()
        setSelectedBundleId(data.bundle.id)
        setNewBundleName('')
        setNewBundleSlug('')
        setShowNewBundleForm(false)
      }
    } catch (error) {
      console.error('Error creating bundle:', error)
    }
  }

  async function deleteBundle(bundleId: string) {
    if (!confirm('Are you sure you want to delete this bundle?')) return

    try {
      const res = await fetch(`/api/admin/bundles?id=${bundleId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchData()
        setSelectedBundleId(null)
      }
    } catch (error) {
      console.error('Error deleting bundle:', error)
    }
  }

  async function toggleBundleActive(bundleId: string, active: boolean) {
    try {
      const res = await fetch('/api/admin/bundles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bundleId, active: !active })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error toggling bundle active:', error)
    }
  }

  async function toggleBundleStorefront(bundleId: string, storefront: boolean) {
    try {
      const res = await fetch('/api/admin/bundles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bundleId, storefront: !storefront })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error toggling bundle storefront:', error)
    }
  }

  async function updatePriceOverride() {
    if (!selectedBundleId) return

    const override = priceOverrideEnabled ? priceOverrideValue : null

    try {
      const res = await fetch('/api/admin/bundles/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: selectedBundleId,
          priceOverride: override
        })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error updating price override:', error)
    }
  }

  async function addComponent(componentId: string) {
    if (!selectedBundleId) return

    try {
      const res = await fetch('/api/admin/bundles/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: selectedBundleId,
          componentId
        })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error adding component:', error)
    }
  }

  async function removeComponent(itemId: string) {
    try {
      const res = await fetch(`/api/admin/bundles/components?itemId=${itemId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error removing component:', error)
    }
  }

  async function toggleOptional(itemId: string) {
    const item = selectedBundle?.bundleItems.find(i => i.id === itemId)
    if (!item) return

    try {
      const res = await fetch('/api/admin/bundles/components', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          isOptional: !item.isOptional
        })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error toggling optional:', error)
    }
  }

  async function updateQuantity(itemId: string, quantity: number) {
    try {
      const res = await fetch('/api/admin/bundles/components', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
    }
  }

  async function reorderComponents(componentIds: string[]) {
    if (!selectedBundleId) return

    try {
      const res = await fetch('/api/admin/bundles/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId: selectedBundleId,
          componentIds
        })
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error reordering components:', error)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || !selectedBundleId) return

    // Product dragged from available list to bundle
    if (over.id === selectedBundleId && active.id !== selectedBundleId) {
      addComponent(active.id as string)
    }

    // Reordering within bundle
    if (over.id !== selectedBundleId && selectedBundle) {
      const oldIndex = selectedBundle.bundleItems.findIndex(c => c.id === active.id)
      const newIndex = selectedBundle.bundleItems.findIndex(c => c.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(selectedBundle.bundleItems, oldIndex, newIndex)
        reorderComponents(newOrder.map(c => c.id))
      }
    }
  }

  // Calculate pricing summary
  const pricingSummary = selectedBundle ? calculatePricingSummary(
    selectedBundle.prices.find(p => p.isPrimary)?.unitAmount || 0,
    selectedBundle.bundleItems.map(item => ({
      product: {
        prices: item.componentProduct.prices
      },
      quantity: item.quantity,
      isOptional: item.isOptional
    }))
  ) : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </a>
            <Package className="w-10 h-10 text-primary-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Package Builder</h1>
              <p className="text-gray-400">Create bundled peptide protocols</p>
            </div>
          </div>
        </div>

        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-12 gap-8">
            {/* Left Sidebar: Bundle List */}
            <div className="col-span-3 space-y-4">
              <button
                onClick={() => setShowNewBundleForm(!showNewBundleForm)}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Bundle
              </button>

              {/* New Bundle Form */}
              {showNewBundleForm && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Bundle name"
                    value={newBundleName}
                    onChange={(e) => {
                      setNewBundleName(e.target.value)
                      setNewBundleSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                    }}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-primary-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="URL slug"
                    value={newBundleSlug}
                    onChange={(e) => setNewBundleSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-primary-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createBundle}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowNewBundleForm(false)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Bundle List */}
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                {bundles.map(bundle => (
                  <button
                    key={bundle.id}
                    onClick={() => setSelectedBundleId(bundle.id)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedBundleId === bundle.id
                        ? 'bg-primary-500/20 border-2 border-primary-400'
                        : 'bg-gray-800/50 border border-gray-700 hover:border-primary-400'
                    }`}
                  >
                    <h3 className="text-white font-medium mb-1">{bundle.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {bundle.bundleItems.length} component{bundle.bundleItems.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {bundle.active && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                          Active
                        </span>
                      )}
                      {bundle.storefront && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                          On Store
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Center: Bundle Editor */}
            <div className="col-span-6">
              {selectedBundle ? (
                <div className="space-y-6">
                  {/* Bundle Info Card */}
                  <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {selectedBundle.name}
                        </h2>
                        <p className="text-gray-400 text-sm">/{selectedBundle.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleBundleActive(selectedBundle.id, selectedBundle.active)}
                          className={`p-2 rounded transition-colors ${
                            selectedBundle.active
                              ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                          title={selectedBundle.active ? 'Active' : 'Inactive'}
                        >
                          {selectedBundle.active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => toggleBundleStorefront(selectedBundle.id, selectedBundle.storefront)}
                          className={`px-4 py-2 rounded transition-colors ${
                            selectedBundle.storefront
                              ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {selectedBundle.storefront ? 'On Store' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => deleteBundle(selectedBundle.id)}
                          className="p-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded transition-colors"
                          title="Delete bundle"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    {pricingSummary && (
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-900/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm mb-1">Bundle Price</p>
                          <p className="text-2xl font-bold text-white">
                            {formatPrice(pricingSummary.bundlePrice)}
                          </p>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-4">
                          <p className="text-gray-400 text-sm mb-1">Retail Total</p>
                          <p className="text-2xl font-bold text-gray-300">
                            {formatPrice(pricingSummary.totalRetail)}
                          </p>
                        </div>
                        <div className="bg-green-900/20 border border-green-400/30 rounded-lg p-4">
                          <p className="text-green-400 text-sm mb-1">Savings</p>
                          <p className="text-2xl font-bold text-green-300">
                            {formatPrice(pricingSummary.savings)}
                          </p>
                          <p className="text-xs text-green-400 mt-1">
                            {formatSavingsPercent(pricingSummary.savingsPercent)} off
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Price Override */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={priceOverrideEnabled}
                          onChange={(e) => {
                            setPriceOverrideEnabled(e.target.checked)
                            if (!e.target.checked) {
                              updatePriceOverride()
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="font-medium">Manual Price Override</span>
                      </label>

                      {priceOverrideEnabled && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <DollarSign className="w-5 h-5 text-gray-400" />
                            <input
                              type="number"
                              step="0.01"
                              value={(priceOverrideValue / 100).toFixed(2)}
                              onChange={(e) => {
                                const cents = Math.round(parseFloat(e.target.value || '0') * 100)
                                setPriceOverrideValue(cents)
                              }}
                              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-primary-400 focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={updatePriceOverride}
                            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drop Zone */}
                  <BundleDropZone
                    bundleId={selectedBundle.id}
                    components={selectedBundle.bundleItems}
                    onRemoveComponent={removeComponent}
                    onToggleOptional={toggleOptional}
                    onQuantityChange={updateQuantity}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                  <Package className="w-20 h-20 mb-4 opacity-50" />
                  <p className="text-xl font-medium mb-2">No Bundle Selected</p>
                  <p className="text-sm text-gray-500">
                    Select a bundle from the left or create a new one
                  </p>
                </div>
              )}
            </div>

            {/* Right Sidebar: Available Products */}
            <div className="col-span-3">
              <DraggableComponentList
                products={products}
                bundleComponents={selectedBundle?.bundleItems.map(i => i.componentProductId) || []}
              />
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId && (
              <div className="bg-gray-800 rounded-lg p-3 border border-primary-400 shadow-xl">
                <p className="text-white font-medium">
                  {products.find(p => p.id === activeId)?.name || 'Component'}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
