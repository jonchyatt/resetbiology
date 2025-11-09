/**
 * Bundle pricing calculation utilities
 * Handles auto-calculation and manual overrides for peptide packages
 */

interface BundleComponent {
  product: {
    prices: Array<{
      unitAmount: number
      isPrimary: boolean
    }>
  }
  quantity: number
  isOptional: boolean
}

interface PricingSummary {
  totalRetail: number
  bundlePrice: number
  savings: number
  savingsPercent: number
}

/**
 * Calculate the total price for a bundle
 * @param components - Array of bundle components with product pricing
 * @param priceOverride - Optional manual price override (in cents)
 * @returns Price in cents
 */
export function calculateBundlePrice(
  components: BundleComponent[],
  priceOverride?: number | null
): number {
  // If manual override exists, use it
  if (priceOverride !== null && priceOverride !== undefined) {
    return priceOverride
  }

  // Auto-calculate: sum of (component price * quantity) for required items only
  return components
    .filter(c => !c.isOptional) // Only count required components in auto-price
    .reduce((sum, component) => {
      const primaryPrice = component.product.prices.find(p => p.isPrimary)
      const price = primaryPrice?.unitAmount || 0
      return sum + (price * component.quantity)
    }, 0)
}

/**
 * Calculate pricing summary including savings
 * @param bundlePrice - Final bundle price (after override if applicable)
 * @param components - Array of all bundle components
 * @returns Pricing breakdown with savings
 */
export function calculatePricingSummary(
  bundlePrice: number,
  components: BundleComponent[]
): PricingSummary {
  // Calculate total retail price (all components, including optional)
  const totalRetail = components.reduce((sum, component) => {
    const primaryPrice = component.product.prices.find(p => p.isPrimary)
    const price = primaryPrice?.unitAmount || 0
    return sum + (price * component.quantity)
  }, 0)

  const savings = totalRetail - bundlePrice
  const savingsPercent = totalRetail > 0 ? (savings / totalRetail) * 100 : 0

  return {
    totalRetail,
    bundlePrice,
    savings: Math.max(0, savings), // Don't show negative savings
    savingsPercent: Math.max(0, savingsPercent)
  }
}

/**
 * Format price in dollars
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format savings percentage
 */
export function formatSavingsPercent(percent: number): string {
  return `${percent.toFixed(1)}%`
}

/**
 * Check if bundle has any optional components
 */
export function hasOptionalComponents(components: BundleComponent[]): boolean {
  return components.some(c => c.isOptional)
}

/**
 * Get required components only
 */
export function getRequiredComponents(components: BundleComponent[]): BundleComponent[] {
  return components.filter(c => !c.isOptional)
}

/**
 * Get optional components only
 */
export function getOptionalComponents(components: BundleComponent[]): BundleComponent[] {
  return components.filter(c => c.isOptional)
}
