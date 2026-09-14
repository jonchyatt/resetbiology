import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as ts from 'typescript'

const sourceUrl = new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url)
const sourceText = readFileSync(sourceUrl, 'utf8')
const source = ts.createSourceFile(sourceUrl.pathname, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function descendants<T extends ts.Node>(root: ts.Node, guard: (node: ts.Node) => node is T): T[] {
  const matches: T[] = []
  const visit = (node: ts.Node) => {
    if (guard(node)) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return matches
}

function functionText(name: string): string {
  const declaration = descendants(source, ts.isFunctionDeclaration)
    .find(node => node.name?.text === name)
  assert.ok(declaration, `missing ${name}`)
  return declaration.getText(source)
}

function variableText(name: string): string {
  const declaration = descendants(source, ts.isVariableDeclaration)
    .find(node => ts.isIdentifier(node.name) && node.name.text === name)
  assert.ok(declaration, `missing ${name}`)
  return declaration.getText(source)
}

const bodyStates = descendants(source, ts.isVariableDeclaration)
  .find(node => ts.isIdentifier(node.name) && node.name.text === 'ART_REVIEW_BODY_STATES')
assert.ok(bodyStates?.initializer && ts.isArrayLiteralExpression(bodyStates.initializer), 'body review states must be explicit')
assert.deepEqual(
  bodyStates.initializer.elements.map(element => ts.isStringLiteral(element) ? element.text : null),
  ['walk', 'burn-1', 'burn-2', 'burn-3', 'ash'],
)

const stormStates = descendants(source, ts.isVariableDeclaration)
  .find(node => ts.isIdentifier(node.name) && node.name.text === 'ART_REVIEW_STORM_STATES')
assert.ok(stormStates?.initializer && ts.isArrayLiteralExpression(stormStates.initializer), 'storm review states must be explicit')
assert.deepEqual(
  stormStates.initializer.elements.map(element => ts.isStringLiteral(element) ? element.text : null),
  ['dormant', 'gather-1', 'gather-2', 'gather-3', 'spent'],
)

const reviewGuard = descendants(source, ts.isIfStatement)
  .find(node => node.expression.getText(source) === 'isArtReview')
assert.ok(reviewGuard?.thenStatement && ts.isBlock(reviewGuard.thenStatement), 'artReview query must have a private initialization guard')
assert.ok(descendants(reviewGuard.thenStatement, ts.isReturnStatement).length > 0, 'private guard must return before normal setup')
const firstStorageRead = descendants(source, ts.isCallExpression)
  .filter(node => node.expression.getText(source) === 'localStorage.getItem')
  .find(node => node.pos > reviewGuard.end)
assert.ok(firstStorageRead, 'normal route storage read must remain discoverable')
assert.ok(firstStorageRead.pos > reviewGuard.end, 'artReview guard must return before any profile or preference read')

const runtimeText = functionText('buildArtReviewRuntime')
assert.match(runtimeText, /phase:\s*'raining'/, 'review runtime must stage real rain architecture')
assert.match(runtimeText, /runtime\.bolts/, 'review runtime must stage the real bolt path for spent Storm Heart')
const viewText = functionText('buildArtReviewView')
assert.match(viewText, /buildViewState/, 'review view must use the production ViewState builder')

const loopText = variableText('loop')
assert.match(loopText, /artReviewRef\.current/, 'render loop must have a private art-review branch')
assert.match(loopText, /renderView\(ctx, reviewView, assetsRef\.current\)/, 'fixture must use the real game canvas renderer')
assert.match(loopText, /drawArtReviewOverlay/, 'fixture must label the canvas as review-only')

assert.match(sourceText, /data-testid="pf3-art-review"/, 'private route must be visible in the DOM')
assert.match(sourceText, /does not start the microphone, read or write profile\/unlock storage/, 'private route must disclose isolation')
assert.match(sourceText, /data-testid=\{`pf3-art-review-body-\$\{state\}`\}/, 'body lifecycle controls must be real buttons')
assert.match(sourceText, /data-testid=\{`pf3-art-review-storm-\$\{state\}`\}/, 'Storm Heart controls must be real buttons')

console.log('pitchforks private art review isolation: PASS')
