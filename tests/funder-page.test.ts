import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

// tsx compiles the page with the classic JSX runtime, which needs React in scope.
// eslint-disable-next-line @typescript-eslint/no-require-imports
;(globalThis as { React?: unknown }).React = require('react')

const pagePath = '../app/community/womens-health/page'

function load() {
  const id = require.resolve(pagePath)
  delete require.cache[id]
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(id)
}

function main() {
  // Hidden unless the flag is exactly "on".
  for (const flag of [undefined, 'true', 'ON', '1', '']) {
    if (flag === undefined) delete process.env.NEXT_PUBLIC_FUNDER_PAGE
    else process.env.NEXT_PUBLIC_FUNDER_PAGE = flag
    assert.throws(() => renderToStaticMarkup(createElement(load().default)), /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/, `404 when flag is ${JSON.stringify(flag)}`)
  }

  // Stays noindex and nofollow until Jonathan changes it on purpose.
  const mod = load()
  assert.equal(mod.metadata.robots.index, false, 'page is noindex')
  assert.equal(mod.metadata.robots.follow, false, 'page is nofollow')

  // The sitemap never lists it.
  assert.ok(!readFileSync('app/sitemap.ts', 'utf8').includes('womens-health'), 'sitemap omits the funder page')

  // Flag on: strip renders, and carries no figure beyond the two from the application.
  process.env.NEXT_PUBLIC_FUNDER_PAGE = 'on'
  const html = renderToStaticMarkup(createElement(load().default))
  assert.ok(html.includes('aria-label="At a glance"'), 'at-a-glance strip renders')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FUNDER_FACTS, ALLOWED_FIGURES } = require('../src/config/funderFacts')
  for (const fact of FUNDER_FACTS) {
    assert.ok(html.includes(fact.value.replace(/'/g, '&#x27;')), `strip shows "${fact.value}"`)
    assert.ok(fact.source, `${fact.label} names its application question`)
    const figures: string[] = fact.value.match(/\$?\d[\d,]*/g) ?? []
    for (const figure of figures) {
      assert.ok((ALLOWED_FIGURES as readonly string[]).includes(figure), `figure ${figure} in "${fact.label}" is not from the application`)
    }
  }
  console.log('[PASS] funder page: flag gate, noindex, sitemap, evidence strip uses only attributed figures')
}

try {
  main()
} catch (error) {
  console.error('[FAIL]', error)
  process.exit(1)
}
