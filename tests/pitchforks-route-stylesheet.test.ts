import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import type { Declaration, Root, Rule } from 'postcss'

const page = readFileSync(new URL('../app/pitch-defender/pitchforks-3/page.tsx', import.meta.url), 'utf8')
const playSurface = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
const stylesheet = readFileSync(new URL('../src/components/PitchDefender/PitchforksPlayLayout.module.css', import.meta.url), 'utf8')

assert.match(
  page,
  /import\s+styles\s+from\s+['"]@\/components\/PitchDefender\/PitchforksPlayLayout\.module\.css['"]/
)
assert.match(page, /className=\{styles\.playRoot\}/)

const closeSmashPortalStart = playSurface.indexOf('{closeSmashGuideOpen &&')
assert.notEqual(closeSmashPortalStart, -1, 'missing Close Smash portal')
const closeSmashPortalEnd = playSurface.indexOf(')}', closeSmashPortalStart)
assert.notEqual(closeSmashPortalEnd, -1, 'unterminated Close Smash portal')
const closeSmashPortal = playSurface.slice(closeSmashPortalStart, closeSmashPortalEnd)
assert.match(closeSmashPortal, /playRootRef\.current\s*\?\?\s*document\.body/)
assert.match(playSurface, /<div ref=\{playRootRef\} className="pf3-play-root/)

const cssRoot = postcss.parse(stylesheet)

function findRule(selectorPart: string, mediaPart?: string): Rule {
  let match: Rule | undefined
  const visit = (root: Root | Rule) => {
    root.walkRules(rule => {
      if (!match && rule.parent?.type === 'root' && rule.selector.includes(selectorPart)) match = rule
    })
  }

  if (mediaPart) {
    cssRoot.walkAtRules('media', media => {
      if (media.params.includes(mediaPart)) media.walkRules(rule => {
        if (!match && rule.selector.includes(selectorPart)) match = rule
      })
    })
  } else {
    visit(cssRoot)
  }

  assert.ok(match, `missing CSS rule for ${selectorPart}${mediaPart ? ` in ${mediaPart}` : ''}`)
  return match
}

function declarationValue(rule: Rule, property: string): string {
  const declaration = rule.nodes?.find((node): node is Declaration => node.type === 'decl' && node.prop === property)
  assert.ok(declaration, `missing ${property} declaration in ${rule.selector}`)
  return declaration.value
}

assert.equal(declarationValue(findRule("[data-testid='pf3-action-toolbar']"), 'overflow-x'), 'auto')
assert.equal(declarationValue(findRule("[data-testid='pf3-tuner-feedback']"), 'flex'), '0 0 auto')

const mobileClose = findRule(
  "> [data-testid='pf3-close-smash-control']",
  'max-width: 37.5rem',
)
assert.equal(declarationValue(mobileClose, 'order'), '1')
assert.equal(declarationValue(mobileClose, 'width'), '7.25rem')
assert.equal(declarationValue(mobileClose, 'min-width'), '7.25rem')

for (const selector of ['pf3-replay-notes', 'pf3-staff-drawer-toggle', 'pf3-options-drawer-toggle']) {
  assert.equal(declarationValue(findRule(selector, 'max-width: 37.5rem'), 'order'), '1')
}

const landscapeDock = findRule("[data-testid='pf3-learning-dock']", 'orientation: landscape')
assert.equal(declarationValue(landscapeDock, 'flex'), '0 0 auto')
assert.equal(declarationValue(landscapeDock, 'min-height'), 'auto')
assert.equal(declarationValue(landscapeDock, 'overflow-y'), 'visible')

const landscapeRoot = findRule('> :global(.pf3-play-root)', 'orientation: landscape')
assert.equal(declarationValue(landscapeRoot, 'overflow-y'), 'auto')
assert.equal(declarationValue(landscapeRoot, 'overflow-x'), 'hidden')

const guide = findRule("pitchforks-close-smash-guide")
assert.equal(declarationValue(guide, 'background-color'), '#180719')
assert.equal(declarationValue(guide, 'overflow-y'), 'auto')
assert.equal(declarationValue(guide, 'isolation'), 'isolate')
