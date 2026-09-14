import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as ts from 'typescript'

const arcadePath = new URL('../src/components/PitchDefender/PitchforksPracticeArcade.tsx', import.meta.url)
const hostPath = new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url)

function sourceFile(path: URL) {
  return ts.createSourceFile(path.pathname, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function descendants<T extends ts.Node>(root: ts.Node, guard: (node: ts.Node) => node is T): T[] {
  const matches: T[] = []
  const visit = (node: ts.Node) => {
    if (guard(node)) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return matches
}

function namedVariable(root: ts.SourceFile, name: string): ts.VariableDeclaration {
  const declaration = descendants(root, ts.isVariableDeclaration)
    .find(node => ts.isIdentifier(node.name) && node.name.text === name)
  assert.ok(declaration, `missing actual ${name} declaration`)
  return declaration
}

function jsxAttribute(element: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute {
  const attribute = element.attributes.properties.find(
    property => ts.isJsxAttribute(property) && property.name.text === name,
  )
  assert.ok(attribute, `missing ${name} attribute on ${element.tagName.getText()}`)
  return attribute
}

function identifierText(expression: ts.Expression | undefined): string | null {
  return expression && ts.isIdentifier(expression) ? expression.text : null
}

function callbackArrow(initializer: ts.Expression | undefined, label: string): ts.ArrowFunction {
  if (initializer && ts.isArrowFunction(initializer)) return initializer
  if (
    initializer
    && ts.isCallExpression(initializer)
    && identifierText(initializer.expression) === 'useCallback'
    && ts.isArrowFunction(initializer.arguments[0])
  ) {
    return initializer.arguments[0]
  }
  assert.fail(`${label} must be an actual callback`)
}

const arcade = sourceFile(arcadePath)
const host = sourceFile(hostPath)

const cards = namedVariable(arcade, 'PITCHFORKS_PRACTICE_CARDS')
assert.ok(cards.initializer && ts.isArrayLiteralExpression(cards.initializer), 'practice cards must be an actual array literal')
const worlds = cards.initializer.elements.map(element => {
  assert.ok(ts.isObjectLiteralExpression(element), 'each practice card must be an object')
  const world = element.properties.find(
    property => ts.isPropertyAssignment(property) && property.name.getText(arcade) === 'world',
  )
  assert.ok(world && ts.isStringLiteral(world.initializer), 'each practice card must carry a literal world id')
  return world.initializer.text
})
assert.deepEqual(
  [...worlds].sort(),
  ['bell-tower', 'cathedral', 'dungeon', 'village-gate'],
  'the entry surface must retain exactly the four real practice worlds',
)

const entryButtons = descendants(
  arcade,
  (node): node is ts.JsxOpeningLikeElement =>
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(arcade) === 'button',
).filter(button => {
  const testId = jsxAttribute(button, 'data-testid').initializer
  return !!testId && ts.isJsxExpression(testId) && ts.isTemplateExpression(testId.expression)
    && testId.expression.head.text === 'pitchforks-practice-enter-'
})
assert.equal(entryButtons.length, 1, 'all cards must share one real practice-entry button implementation')

const entryClick = jsxAttribute(entryButtons[0], 'onClick').initializer
assert.ok(entryClick && ts.isJsxExpression(entryClick) && entryClick.expression && ts.isArrowFunction(entryClick.expression),
  'practice-entry click must be an actual callback, not presentation-only markup')
assert.ok(ts.isCallExpression(entryClick.expression.body), 'practice-entry callback must call the host entry bridge')
assert.equal(identifierText(entryClick.expression.body.expression), 'enter', 'practice-entry callback must use the entry bridge')
assert.equal(entryClick.expression.body.arguments.length, 1, 'practice-entry callback must forward one world')
const forwardedWorld = entryClick.expression.body.arguments[0]
assert.ok(
  ts.isPropertyAccessExpression(forwardedWorld)
    && identifierText(forwardedWorld.expression) === 'card'
    && forwardedWorld.name.text === 'world',
  'practice-entry callback must forward card.world unchanged',
)

const entryBridge = namedVariable(host, 'enterPracticeArcade')
const entryBridgeCallback = callbackArrow(entryBridge.initializer, 'host practice bridge')
const silentlyRejectsNonVoicePractice = descendants(entryBridgeCallback.body, ts.isIfStatement).some(statement => {
  const condition = statement.expression
  const isVoiceGate = ts.isBinaryExpression(condition)
    && condition.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    && identifierText(condition.left) === 'inputMode'
    && ts.isStringLiteral(condition.right)
    && condition.right.text === 'voice'
  return isVoiceGate && ts.isReturnStatement(statement.thenStatement)
})
assert.equal(
  silentlyRejectsNonVoicePractice,
  false,
  'visible practice cards must not accept a click then silently return outside Voice Lightning',
)
const beginPreview = descendants(entryBridgeCallback.body, ts.isCallExpression)
  .find(call => identifierText(call.expression) === 'beginBossPreview')
assert.ok(beginPreview, 'host practice bridge must enter an assembled encounter')
assert.equal(beginPreview.arguments.length, 5, 'practice bridge must preserve all encounter-entry arguments')
const laneDeclaration = descendants(entryBridgeCallback.body, ts.isVariableDeclaration)
  .find(node => ts.isIdentifier(node.name) && node.name.text === 'lane')
assert.ok(laneDeclaration?.initializer && ts.isConditionalExpression(laneDeclaration.initializer), 'practice bridge must derive a real encounter lane')
const laneChoice = laneDeclaration.initializer
assert.ok(
  ts.isBinaryExpression(laneChoice.condition)
    && laneChoice.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    && identifierText(laneChoice.condition.left) === 'inputMode'
    && ts.isStringLiteral(laneChoice.condition.right)
    && laneChoice.condition.right.text === 'buttons'
    && ts.isStringLiteral(laneChoice.whenTrue)
    && laneChoice.whenTrue.text === 'ear'
    && ts.isStringLiteral(laneChoice.whenFalse)
    && laneChoice.whenFalse.text === 'voice',
  'practice bridge must enter ear practice from Listen & Tap and voice practice from Voice Lightning',
)
assert.deepEqual(
  {
    buttons: ts.isStringLiteral(laneChoice.whenTrue) ? laneChoice.whenTrue.text : null,
    voice: ts.isStringLiteral(laneChoice.whenFalse) ? laneChoice.whenFalse.text : null,
  },
  { buttons: 'ear', voice: 'voice' },
  'each explicitly selected lane must enter its approved runtime; do not hard-code Voice Lightning for every practice card',
)
assert.equal(identifierText(beginPreview.arguments[0]), 'lane', 'practice bridge must forward the derived lane into runtime setup')
assert.ok(
  ts.isCallExpression(beginPreview.arguments[1])
    && identifierText(beginPreview.arguments[1].expression) === 'pitchforksPracticeBossForWorld'
    && identifierText(beginPreview.arguments[1].arguments[0]) === 'world',
  'practice bridge must derive the boss from the selected world',
)
assert.equal(beginPreview.arguments[2].kind, ts.SyntaxKind.NullKeyword, 'practice entry must not fabricate earned-world progress')
assert.equal(beginPreview.arguments[3].kind, ts.SyntaxKind.TrueKeyword, 'practice entry must remain practice-only')
assert.equal(identifierText(beginPreview.arguments[4]), 'world', 'practice entry must forward the selected world into runtime setup')

const arcadeHost = descendants(
  host,
  (node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(host) === 'PitchforksPracticeArcade',
)
assert.equal(arcadeHost.length, 1, 'the four-card surface must be mounted once by the game host')
const hostBridge = jsxAttribute(arcadeHost[0], 'onEnterPractice').initializer
assert.ok(hostBridge && ts.isJsxExpression(hostBridge), 'mounted arcade must receive a host callback')
assert.equal(identifierText(hostBridge.expression), 'enterPracticeArcade', 'mounted arcade must receive the real entry bridge')

for (const functionName of [
  'advancePitchforksLogicalClock',
  'createPitchforksPauseGate',
  'transitionPitchforksPauseGate',
  'acceptsPitchforksPauseCallback',
] as const) {
  assert.ok(
    descendants(host, ts.isFunctionDeclaration).some(node => node.name?.text === functionName),
    `missing actual pause/resume state-machine function ${functionName}`,
  )
}

console.log('pitchforks repair integration AST contract: PASS')
