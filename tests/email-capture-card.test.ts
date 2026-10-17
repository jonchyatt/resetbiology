import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The flag is read once at module load, so each case imports a fresh copy.
async function render(flag: string | undefined): Promise<string> {
  if (flag === undefined) delete process.env.NEXT_PUBLIC_RB_EMAIL_CAPTURE
  else process.env.NEXT_PUBLIC_RB_EMAIL_CAPTURE = flag
  const id = require.resolve('../src/components/Newsletter/EmailCaptureCard')
  delete require.cache[id]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(id)
  return renderToStaticMarkup(createElement(mod.EmailCaptureCard, { source: 'tool-test' }))
}

async function main() {
  for (const flag of [undefined, 'false', 'TRUE', '1', '']) {
    assert.equal(await render(flag), '', `renders nothing when flag is ${JSON.stringify(flag)}`)
  }
  // Flag on: first paint is still empty because visibility waits on /api/newsletter/status.
  assert.equal(await render('true'), '', 'renders nothing before the status check resolves')
  console.log('[PASS] email capture card renders nothing when off or unresolved')
}

main().catch((error) => {
  console.error('[FAIL]', error)
  process.exit(1)
})
