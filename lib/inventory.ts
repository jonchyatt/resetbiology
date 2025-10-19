import { prisma } from './prisma';

/**
 * Reduces inventory for a product and creates an audit trail
 * Returns true if successful, false if insufficient inventory
 */
export async function reduceInventory(
  productId: string,
  quantity: number = 1,
  orderId?: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Get product with bundle items
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        bundleComponents: {
          include: {
            componentProduct: true
          }
        }
      }
    });

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    // If inventory tracking is disabled, nothing to do
    if (!product.trackInventory) {
      console.log(`[inventory] Product ${product.name} doesn't track inventory - skipping reduction`);
      return { success: true };
    }

    // If this is a bundle, reduce component inventory instead
    if (product.isBundle && product.bundleComponents.length > 0) {
      console.log(`[inventory] Processing bundle: ${product.name} with ${product.bundleComponents.length} components`);

      for (const bundleItem of product.bundleComponents) {
        const componentQty = bundleItem.quantity * quantity;
        const result = await reduceInventory(
          bundleItem.componentProductId,
          componentQty,
          orderId,
          `Part of bundle: ${product.name}`
        );

        if (!result.success) {
          return {
            success: false,
            message: `Failed to reduce inventory for bundle component: ${bundleItem.componentProduct.name}`
          };
        }
      }

      // Create transaction for the bundle itself (for tracking)
      await prisma.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: 'bundle_sale',
          quantity: -quantity,
          previousQty: 0,
          newQty: 0,
          reason: reason || `Bundle sold (${quantity}x)`,
          orderId
        }
      });

      return { success: true };
    }

    // Regular product - reduce inventory
    const currentQty = product.quantityAvailable ?? 0;
    const newQty = currentQty - quantity;

    // Check if we have enough stock (unless backorder is allowed)
    if (!product.allowBackorder && newQty < 0) {
      return {
        success: false,
        message: `Insufficient inventory for ${product.name}. Available: ${currentQty}, Requested: ${quantity}`
      };
    }

    // Update product quantity
    await prisma.product.update({
      where: { id: productId },
      data: {
        quantityAvailable: Math.max(0, newQty) // Never go below 0
      }
    });

    // Create inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'purchase',
        quantity: -quantity,
        previousQty: currentQty,
        newQty: Math.max(0, newQty),
        reason: reason || `Customer purchase (${quantity}x)`,
        orderId
      }
    });

    console.log(`[inventory] Reduced ${product.name} from ${currentQty} to ${Math.max(0, newQty)}`);

    return { success: true };
  } catch (error) {
    console.error('[inventory] Error reducing inventory:', error);
    return { success: false, message: 'Internal error reducing inventory' };
  }
}

/**
 * Restocks inventory for a product
 */
export async function restockInventory(
  productId: string,
  quantity: number,
  createdBy?: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    if (!product.trackInventory) {
      return { success: false, message: 'Product does not track inventory' };
    }

    const currentQty = product.quantityAvailable ?? 0;
    const newQty = currentQty + quantity;

    await prisma.product.update({
      where: { id: productId },
      data: {
        quantityAvailable: newQty
      }
    });

    await prisma.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'restock',
        quantity: quantity,
        previousQty: currentQty,
        newQty: newQty,
        reason: reason || `Inventory restocked (+${quantity})`,
        createdBy
      }
    });

    console.log(`[inventory] Restocked ${product.name} from ${currentQty} to ${newQty}`);

    return { success: true };
  } catch (error) {
    console.error('[inventory] Error restocking inventory:', error);
    return { success: false, message: 'Internal error restocking inventory' };
  }
}
