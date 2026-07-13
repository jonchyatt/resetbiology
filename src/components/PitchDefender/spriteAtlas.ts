export const REQUIRED_FRAMES = [
  'idle-a', 'idle-b', 'dive-down', 'dive-bank', 'explode-a', 'explode-b',
] as const

type FrameName = typeof REQUIRED_FRAMES[number]
type FrameRect = { x: number, y: number, w: number, h: number }

export type AtlasMeta = {
  id: string
  displayName: string
  currentCapacity: 1
  futureCapacity: 1 | 2 | 3 | 4
  chipAnchors: Array<[number, number]>
}

export type SpriteAtlas = {
  image: HTMLImageElement
  frames: Record<FrameName, FrameRect>
  frameW: number
  frameH: number
  meta?: AtlasMeta
}

export type AtlasLoadResult =
  | { status: 'ready', atlas: SpriteAtlas }
  | { status: 'failed' }

const atlasCache = new Map<string, Promise<AtlasLoadResult>>()
const requiredFrameSet = new Set<string>(REQUIRED_FRAMES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

function validateMeta(value: unknown): AtlasMeta | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.displayName !== 'string') {
    throw new Error('Atlas meta must provide string id/displayName values')
  }
  if (value.currentCapacity !== 1 || !Number.isInteger(value.futureCapacity)
      || (value.futureCapacity as number) < 1 || (value.futureCapacity as number) > 4) {
    throw new Error('Atlas meta capacity must be current=1 and future=1..4')
  }
  if (!Array.isArray(value.chipAnchors) || value.chipAnchors.length !== value.futureCapacity) {
    throw new Error('Atlas meta chipAnchors must match futureCapacity')
  }
  const chipAnchors = value.chipAnchors.map((candidate): [number, number] => {
    if (!Array.isArray(candidate) || candidate.length !== 2
        || candidate.some(point => typeof point !== 'number' || !Number.isFinite(point) || point < 0 || point > 1)) {
      throw new Error('Atlas meta chipAnchors must be normalized x,y pairs')
    }
    return [candidate[0], candidate[1]]
  })
  return {
    id: value.id,
    displayName: value.displayName,
    currentCapacity: 1,
    futureCapacity: value.futureCapacity as AtlasMeta['futureCapacity'],
    chipAnchors,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Image decode failed: ${url}`))
    image.src = url
  })
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Atlas JSON fetch failed (${response.status}): ${url}`)
  return response.json()
}

function validateAtlas(json: unknown, image: HTMLImageElement, expectedMetaId?: string): SpriteAtlas {
  if (!isRecord(json) || !isRecord(json.frames)) throw new Error('Atlas JSON has no frames object')
  if (!isPositiveInteger(json.frameW) || !isPositiveInteger(json.frameH)) {
    throw new Error('Atlas frameW/frameH must be positive integers')
  }
  if (!isPositiveInteger(image.naturalWidth) || !isPositiveInteger(image.naturalHeight)) {
    throw new Error('Decoded atlas image has invalid dimensions')
  }

  const frames = {} as Record<FrameName, FrameRect>
  for (const name of REQUIRED_FRAMES) {
    const candidate = json.frames[name]
    if (!isRecord(candidate)) throw new Error(`Atlas is missing required frame: ${name}`)
    const { x, y, w, h } = candidate
    const integerRect = Number.isInteger(x) && Number.isInteger(y) && isPositiveInteger(w) && isPositiveInteger(h)
    if (!integerRect || (x as number) < 0 || (y as number) < 0) {
      throw new Error(`Atlas frame ${name} must use a non-negative integer origin and positive integer size`)
    }
    if ((x as number) + w > image.naturalWidth || (y as number) + h > image.naturalHeight) {
      throw new Error(`Atlas frame ${name} is outside the decoded image bounds`)
    }
    frames[name] = { x: x as number, y: y as number, w, h }
  }
  const meta = validateMeta(json.meta)
  if (expectedMetaId && meta?.id !== expectedMetaId) {
    throw new Error(`Atlas meta id must match ${expectedMetaId}`)
  }
  return { image, frames, frameW: json.frameW, frameH: json.frameH, meta }
}

export function loadSpriteAtlas(jsonUrl: string, imageUrl: string, expectedMetaId?: string): Promise<AtlasLoadResult> {
  const cacheKey = `${jsonUrl}\u0000${imageUrl}\u0000${expectedMetaId ?? ''}`
  const cached = atlasCache.get(cacheKey)
  if (cached) return cached

  const load = Promise.all([fetchJson(jsonUrl), loadImage(imageUrl)])
    .then(([json, image]) => ({ status: 'ready', atlas: validateAtlas(json, image, expectedMetaId) }) as const)
    .catch((error: unknown): AtlasLoadResult => {
      console.error(`Sprite atlas failed for ${jsonUrl} + ${imageUrl}`, error)
      return { status: 'failed' }
    })
  atlasCache.set(cacheKey, load)
  return load
}

export function drawAtlasSprite(
  ctx: CanvasRenderingContext2D,
  atlas: SpriteAtlas,
  frameName: string,
  x: number,
  y: number,
  scale: number,
): boolean {
  if (!requiredFrameSet.has(frameName)) return false
  const frame = atlas.frames[frameName as FrameName]
  if (!frame) return false
  ctx.drawImage(
    atlas.image,
    frame.x, frame.y, frame.w, frame.h,
    x, y, frame.w * scale, frame.h * scale,
  )
  return true
}
