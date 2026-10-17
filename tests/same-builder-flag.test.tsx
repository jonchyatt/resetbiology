import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveSameBuilderUrl } from '../src/lib/sameBuilder'
import { OutboundLink } from '../src/components/Outbound/OutboundLink'
import { SameBuilderRow } from '../src/components/Outbound/SameBuilderRow'

assert.equal(resolveSameBuilderUrl(undefined, 'https://example.com'), null, 'flag unset is off')
assert.equal(resolveSameBuilderUrl('false', 'https://example.com'), null)
assert.equal(resolveSameBuilderUrl('true', undefined), null, 'flag on without URL is off')
assert.equal(resolveSameBuilderUrl('true', 'http://example.com'), null, 'non-https is off')
assert.equal(resolveSameBuilderUrl('true', 'not a url'), null)
assert.equal(resolveSameBuilderUrl('true', 'https://example.com'), 'https://example.com/')

// With no env set in this process the row must render nothing.
assert.equal(renderToStaticMarkup(createElement(SameBuilderRow)), '', 'row renders nothing when flag is off')

const link = renderToStaticMarkup(createElement(OutboundLink, { href: 'https://example.com/', children: 'Go' }))
assert.ok(link.includes('leaves this site'), 'link carries the leaves-this-site label')
assert.ok(link.includes('rel="noopener noreferrer"'))
console.log('same-builder-flag: ok')
