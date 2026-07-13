import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(Boolean)
const protectedPatterns = [
  /^src\/components\/PitchDefender\/RetroBlaster\.tsx$/,
  /^app\/pitch-defender\/retro\/page\.tsx$/,
  /^src\/components\/PitchDefender\/Pitchforks.*\.tsx$/,
  /^src\/components\/PitchDefender\/(DrillMode|PitchDefender|VocalTrainerIII|NoteRunner).*\.tsx$/,
  /^src\/components\/PitchDefender\/(audioEngine|pitchMath|types)\.ts$/,
  /^src\/lib\/(fsrs|usePitchDetection)\.ts$/,
]
const protectedChanges = changed.filter(path => protectedPatterns.some(pattern => pattern.test(path)))
assert(protectedChanges.length === 0, `protected files changed: ${protectedChanges.join(', ')}`)

const assetPath = resolve(root, 'public/sprites/retro-blaster-space-backdrop-r15a.png')
const asset = await readFile(assetPath)
const metadata = await sharp(asset).metadata()
assert(metadata.width === 640 && metadata.height === 360 && metadata.format === 'png',
  `backdrop must be native 640x360 PNG; got ${metadata.width}x${metadata.height} ${metadata.format}`)

const [renderer, shell] = await Promise.all([
  readFile(resolve(root, 'src/components/PitchDefender/retroBlasterRenderer.ts'), 'utf8'),
  readFile(resolve(root, 'src/components/PitchDefender/RetroBlasterII.tsx'), 'utf8'),
])
assert(renderer.indexOf("image.src = '/sprites/retro-blaster-space-backdrop-r15a.png'") < renderer.indexOf('export function render'),
  'backdrop is not initialized outside the render loop')
assert(renderer.includes("spaceBackdrop = { status: 'failed' }"), 'backdrop failure does not latch')
assert(renderer.includes('const phase = reducedMotion ? 0 : now'), 'reduced motion does not freeze parallax')
assert(shell.includes("const CRT_KEY = 'retro_blaster_crt'"), 'CRT key drifted')
assert(shell.includes("window.innerWidth >= 768"), 'CRT breakpoint drifted')
assert(shell.includes('pointer-events-none'), 'CRT overlay can capture input')
assert(shell.includes('data-retro-vocal-meter'), 'protected JSX vocal meter marker missing')

const sha = createHash('sha256').update(asset).digest('hex')
console.log(`PASS R1.5a visual contract: protected diff clean; backdrop=640x360 PNG sha256=${sha}; load failure/reduced-motion/CRT/vocal-meter contracts present`)
