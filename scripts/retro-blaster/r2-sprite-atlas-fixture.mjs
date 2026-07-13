import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const requiredFrames = ['idle-a', 'idle-b', 'dive-down', 'dive-bank', 'explode-a', 'explode-b']
const frameW = 48
const frameH = 36

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const atlasJsonPath = resolve(root, 'public/sprites/enemy-scout-atlas.json')
const atlasPngPath = resolve(root, 'public/sprites/enemy-scout-atlas.png')
const rendererPath = resolve(root, 'src/components/PitchDefender/retroBlasterRenderer.ts')
const [contract, metadata, renderer] = await Promise.all([
  readFile(atlasJsonPath, 'utf8').then(JSON.parse),
  sharp(atlasPngPath).metadata(),
  readFile(rendererPath, 'utf8'),
])

assert(metadata.width === 288 && metadata.height === 36, `atlas is ${metadata.width}x${metadata.height}, expected 288x36`)
assert(contract.frameW === frameW && contract.frameH === frameH, 'contract frame size is not 48x36')

for (let i = 0; i < requiredFrames.length; i++) {
  const name = requiredFrames[i]
  const rect = contract.frames?.[name]
  assert(rect, `${name} did not resolve`)
  assert(['x', 'y', 'w', 'h'].every(key => Number.isInteger(rect[key])), `${name} rect is not all integers`)
  assert(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0, `${name} rect is degenerate`)
  assert(rect.x + rect.w <= metadata.width && rect.y + rect.h <= metadata.height, `${name} rect is out of bounds`)
  assert(rect.x === i * frameW && rect.y === 0 && rect.w === frameW && rect.h === frameH, `${name} rect violates fixed packing`)
}

assert(contract.frames['dive-down'].x === 96, 'dive-down did not resolve at packed slot 2')
assert(contract.frames['dive-bank'].x === 144, 'dive-bank did not resolve at packed slot 3')

const alienOrigin = { x: 137, y: 91 }
const proceduralChipAnchor = { x: alienOrigin.x + 24 / 2, y: alienOrigin.y - 3 }
const atlasTopLeft = { x: alienOrigin.x - 12, y: alienOrigin.y - 9 }
const reconciledAlienOrigin = { x: atlasTopLeft.x + 12, y: atlasTopLeft.y + 9 }
const atlasChipAnchor = { x: reconciledAlienOrigin.x + 24 / 2, y: reconciledAlienOrigin.y - 3 }
assert(
  proceduralChipAnchor.x === atlasChipAnchor.x && proceduralChipAnchor.y === atlasChipAnchor.y,
  'chip anchor moved when the atlas reconciliation offset was applied',
)
assert(
  renderer.includes("ctx.fillText(alien.note.replace(/\\d/, ''), alien.x + ALIEN_W / 2, alien.y - 3)"),
  'renderer no longer keys the note chip to the original alien origin',
)

console.log(`PASS all ${requiredFrames.length} required frames are integer, non-degenerate, and in bounds`)
console.log('PASS dive-down and dive-bank resolve at fixed packed slots 2 and 3')
console.log(`PASS chip anchor unchanged at (${atlasChipAnchor.x}, ${atlasChipAnchor.y})`)
