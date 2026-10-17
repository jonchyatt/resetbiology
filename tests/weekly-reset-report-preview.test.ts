import assert from 'node:assert/strict'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { reportToCsv } from '../src/lib/weeklyResetReport'
import { syntheticResetReport } from '../src/lib/weeklyResetReportFixture'
// tsx compiles JSX with the classic runtime, so the component needs React in scope.
;(globalThis as { React?: typeof React }).React = React

import { WeeklyResetReport } from '../src/components/Reports/WeeklyResetReport'

const html = renderToStaticMarkup(createElement(WeeklyResetReport, { previewReport: syntheticResetReport }))
assert.ok(html.includes('Weekly Reset report'), 'renders the heading')
assert.ok(html.includes('Chicken and rice bowl'), 'renders fixture rows')
assert.ok(html.includes('hypnosis: no records captured'), 'labels missing data')
assert.ok(!html.includes('Synthetic private text'), 'html never shows private text')
assert.ok(!reportToCsv(syntheticResetReport).includes('Synthetic private text'), 'csv never shows private text')
assert.equal(syntheticResetReport.totals.meal, 3)
console.log('[PASS] weekly Reset report preview renders synthetic data without private text')
