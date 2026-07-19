import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const marketingSources = [
  'src/components/Navigation/Header.tsx',
  'src/components/Navigation/Footer.tsx',
  'app/page.tsx',
  'app/education/page.tsx',
  'app/process/page.tsx',
  'app/contact/page.tsx',
]

const quizHref = /\bhref\s*=\s*(?:\{\s*)?["']\/quiz["']\s*(?:\})?/
const violations = marketingSources.filter((source) => quizHref.test(readFileSync(resolve(source), 'utf8')))

if (violations.length > 0) {
  throw new Error(`Funnel lock violation: /quiz must not appear in a marketing href/Link context. Found in: ${violations.join(', ')}`)
}

console.log('Funnel lock passed: /get-started remains the sole marketing funnel.')
