import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatCard } from '../src/components/NBack/StatCard'

const render = (accuracy: number | null) =>
  renderToStaticMarkup(createElement(StatCard, { icon: null, label: 'Letter', hits: 0, misses: 0, falses: 0, accuracy }))

const empty = render(null)
assert.ok(empty.includes('–'), 'null accuracy renders an en dash')
assert.ok(!empty.includes('0%'), 'null accuracy never renders 0%')
assert.ok(empty.includes('text-gray-400'), 'null accuracy is muted')
assert.ok(render(86.4).includes('86%'))
assert.ok(render(0).includes('>0%<'))
console.log('nback-statcard-render: ok')
