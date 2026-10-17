import fs from 'node:fs'
import path from 'node:path'
import { TOOL_PAGES, getToolPage } from '../src/config/toolPages'

let failed = false
function check(label: string, pass: boolean, detail?: string) {
  if (pass) console.log(`[PASS] ${label}`)
  else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` - ${detail}` : ''}`)
  }
}

const root = path.join(__dirname, '..')
check('flag is off by default', process.env.NEXT_PUBLIC_RB_TOOL_PAGES !== 'true')
check('slugs are unique', new Set(TOOL_PAGES.map((t) => t.slug)).size === TOOL_PAGES.length)
check('unknown slug has no page', getToolPage('nope') === undefined)
for (const t of TOOL_PAGES) {
  check(`${t.slug}: description is not empty`, t.description.trim().length > 0)
  const srcFile = t.src.split(' ')[0]
  const text = fs.readFileSync(path.join(root, srcFile), 'utf8')
  check(`${t.slug}: description appears in ${srcFile}`, text.toLowerCase().includes(t.description.replace(/\.$/, '').toLowerCase()), t.description)
}
const page = fs.readFileSync(path.join(root, 'app/tools/[slug]/page.tsx'), 'utf8')
check('page 404s when flag off', /!TOOL_PAGES_ENABLED \|\| !tool\) notFound\(\)/.test(page))

if (failed) process.exit(1)
