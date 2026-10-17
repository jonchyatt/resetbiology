import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PatronWall } from '../src/components/Patrons/PatronWall'
import { PATRONS } from '../src/config/patrons'
import { SYNTHETIC_PATRONS } from './fixtures/patrons.synthetic'

function main() {
  assert.equal(PATRONS.length, 0, 'no real patron is committed without a reviewed change')
  const empty = renderToStaticMarkup(createElement(PatronWall, { patrons: [] }))
  assert.match(empty, /first patrons will be named/)
  const html = renderToStaticMarkup(createElement(PatronWall, { patrons: SYNTHETIC_PATRONS, sample: true }))
  assert.match(html, /Sample Patron A/)
  assert.match(html, /Sample Patron B/)
  assert.doesNotMatch(html, /no consent/, 'entries without consent never render')
  assert.match(html, /Not real people/)
  console.log('[PASS] patron wall: empty state, consent filter, sample banner')
}
main()
