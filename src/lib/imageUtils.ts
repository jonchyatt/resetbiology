import sharp from 'sharp'

/**
 * Compress image to reduce API costs for OpenAI Vision
 * Resizes to max 1024px and reduces quality to 80%
 *
 * @param imageBuffer - Original image buffer
 * @returns Compressed image as base64 string
 */
export async function compressImageForAI(imageBuffer: Buffer): Promise<string> {
  try {
    const compressed = await sharp(imageBuffer)
      .resize(1024, 1024, {
        fit: 'inside',         // Maintain aspect ratio
        withoutEnlargement: true // Don't upscale small images
      })
      .jpeg({ quality: 80 })   // Good balance between size and quality
      .toBuffer()

    return compressed.toString('base64')
  } catch (error) {
    console.error('Image compression error:', error)
    throw new Error('Failed to compress image')
  }
}

/**
 * Convert base64 string to Buffer
 * Handles both with and without data URI prefix
 *
 * @param base64 - Base64 string (with or without data:image/...;base64, prefix)
 * @returns Image buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  // Remove data URI prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

/**
 * Calculate estimated OpenAI Vision cost based on image detail level
 *
 * @param detail - "low" or "high" detail level
 * @returns Estimated cost in USD
 */
export function estimateVisionCost(detail: 'low' | 'high' = 'low'): number {
  // GPT-4o-mini pricing (as of Jan 2025)
  if (detail === 'low') {
    // Low detail: 85 tokens (fixed)
    // Input: $0.15 per 1M tokens
    return (85 / 1_000_000) * 0.15 // ~$0.00001275
  } else {
    // High detail: ~765 tokens (typical 1024x1024 image)
    return (765 / 1_000_000) * 0.15 // ~$0.00011475
  }
}
