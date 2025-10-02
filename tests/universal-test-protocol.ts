import { test, expect, Page } from '@playwright/test'

export interface TestScenario {
  name: string
  url: string
  actions: TestAction[]
  assertions?: TestAssertion[]
}

export interface TestAction {
  type: 'click' | 'fill' | 'select' | 'check' | 'navigate' | 'wait' | 'scroll' | 'hover'
  selector?: string
  text?: string
  value?: string
  timeout?: number
  description?: string
}

export interface TestAssertion {
  type: 'visible' | 'hidden' | 'text' | 'count' | 'url' | 'attribute'
  selector?: string
  expected?: string | number
  description?: string
}

export class UniversalTestRunner {
  constructor(private page: Page) {}

  async runTestScenario(scenario: TestScenario) {
    console.log(`🧪 Running test scenario: ${scenario.name}`)
    
    // Navigate to the page
    await this.page.goto(scenario.url)
    await this.page.waitForLoadState('networkidle')
    
    // Execute all actions
    for (let index = 0; index < scenario.actions.length; index++) {
      const action = scenario.actions[index]
      console.log(`  📝 Step ${index + 1}: ${action.description || action.type}`)
      await this.executeAction(action)
    }
    
    // Run all assertions
    if (scenario.assertions) {
      for (let index = 0; index < scenario.assertions.length; index++) {
        const assertion = scenario.assertions[index]
        console.log(`  ✅ Assertion ${index + 1}: ${assertion.description || assertion.type}`)
        await this.executeAssertion(assertion)
      }
    }
    
    console.log(`✅ Test scenario completed: ${scenario.name}`)
  }

  private async executeAction(action: TestAction) {
    const { type, selector, text, value, timeout } = action
    
    switch (type) {
      case 'click':
        if (!selector) throw new Error('Selector required for click action')
        if (text) {
          await this.page.click(`text=${text}`, { timeout })
        } else {
          await this.page.click(selector, { timeout })
        }
        break
        
      case 'fill':
        if (!selector || value === undefined) throw new Error('Selector and value required for fill action')
        await this.page.fill(selector, value, { timeout })
        break
        
      case 'select':
        if (!selector || !value) throw new Error('Selector and value required for select action')
        await this.page.selectOption(selector, value, { timeout })
        break
        
      case 'check':
        if (!selector) throw new Error('Selector required for check action')
        await this.page.check(selector, { timeout })
        break
        
      case 'navigate':
        if (!value) throw new Error('URL required for navigate action')
        await this.page.goto(value)
        await this.page.waitForLoadState('networkidle')
        break
        
      case 'wait':
        const waitTime = timeout || 1000
        await this.page.waitForTimeout(waitTime)
        break
        
      case 'scroll':
        if (selector) {
          await this.page.locator(selector).scrollIntoViewIfNeeded()
        } else {
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        }
        break
        
      case 'hover':
        if (!selector) throw new Error('Selector required for hover action')
        await this.page.hover(selector, { timeout })
        break
        
      default:
        throw new Error(`Unknown action type: ${type}`)
    }
  }

  private async executeAssertion(assertion: TestAssertion) {
    const { type, selector, expected } = assertion
    
    switch (type) {
      case 'visible':
        if (!selector) throw new Error('Selector required for visible assertion')
        await expect(this.page.locator(selector)).toBeVisible()
        break
        
      case 'hidden':
        if (!selector) throw new Error('Selector required for hidden assertion')
        await expect(this.page.locator(selector)).not.toBeVisible()
        break
        
      case 'text':
        if (!selector) throw new Error('Selector required for text assertion')
        if (expected === undefined) throw new Error('Expected value required for text assertion')
        await expect(this.page.locator(selector)).toContainText(expected as string)
        break
        
      case 'count':
        if (!selector) throw new Error('Selector required for count assertion')
        if (expected === undefined) throw new Error('Expected value required for count assertion')
        await expect(this.page.locator(selector)).toHaveCount(expected as number)
        break
        
      case 'url':
        if (expected === undefined) throw new Error('Expected value required for url assertion')
        await expect(this.page).toHaveURL(expected as string)
        break
        
      case 'attribute':
        if (!selector) throw new Error('Selector required for attribute assertion')
        if (expected === undefined) throw new Error('Expected value required for attribute assertion')
        // Expected format: "attributeName:expectedValue"
        const [attrName, attrValue] = (expected as string).split(':')
        await expect(this.page.locator(selector)).toHaveAttribute(attrName, attrValue)
        break
        
      default:
        throw new Error(`Unknown assertion type: ${type}`)
    }
  }
}

// Pre-built test scenarios for common Reset Biology workflows
export const commonTestScenarios: TestScenario[] = [
  {
    name: 'Navigation Flow Test',
    url: 'http://localhost:3000',
    actions: [
      { type: 'click', text: 'Portal', description: 'Navigate to portal' },
      { type: 'wait', timeout: 1000 },
      { type: 'click', text: 'Peptide Tracker', description: 'Open peptide tracker' },
      { type: 'wait', timeout: 1000 },
    ],
    assertions: [
      { type: 'visible', selector: 'text=Peptide Tracker', expected: '', description: 'Peptide tracker page loaded' },
      { type: 'visible', selector: 'text=Active Protocols', expected: '', description: 'Active protocols section visible' }
    ]
  },
  
  {
    name: 'Breath Training Flow Test',
    url: 'http://localhost:3000/breath',
    actions: [
      { type: 'click', selector: '[data-testid="start-session"]', description: 'Start breath session' },
      { type: 'wait', timeout: 2000 },
      { type: 'click', selector: '[data-testid="pause-session"]', description: 'Pause session' },
    ],
    assertions: [
      { type: 'visible', selector: 'text=Session Paused', expected: '', description: 'Session paused successfully' }
    ]
  },
  
  {
    name: 'Peptide Protocol Addition Flow',
    url: 'http://localhost:3000/peptides',
    actions: [
      { type: 'click', text: 'library', description: 'Navigate to library tab' },
      { type: 'click', text: 'Add to My Protocols', description: 'Add first protocol' },
      { type: 'click', text: 'current', description: 'Go to current protocols' },
    ],
    assertions: [
      { type: 'visible', selector: 'text=Ipamorelin', expected: '', description: 'Protocol was added successfully' },
      { type: 'visible', selector: 'text=View Schedule', expected: '', description: 'View Schedule button available' },
      { type: 'visible', selector: 'text=Log Dose', expected: '', description: 'Log Dose button available' }
    ]
  }
]

// Multi-click test generator (like breath app)
export function generateMultiClickTest(
  name: string,
  url: string,
  clickSelector: string,
  clickCount: number,
  expectedResult: string
): TestScenario {
  const actions: TestAction[] = []
  
  for (let i = 0; i < clickCount; i++) {
    actions.push({
      type: 'click',
      selector: clickSelector,
      description: `Click ${i + 1} of ${clickCount}`
    })
    actions.push({
      type: 'wait',
      timeout: 500
    })
  }
  
  return {
    name,
    url,
    actions,
    assertions: [
      {
        type: 'visible',
        selector: `text=${expectedResult}`,
        expected: '',
        description: `Expected result after ${clickCount} clicks`
      }
    ]
  }
}

// Parameterized test runner
export function createParameterizedTest(
  baseName: string,
  baseUrl: string,
  parameters: Array<{
    name: string,
    actions: TestAction[],
    assertions: TestAssertion[]
  }>
): TestScenario[] {
  return parameters.map(param => ({
    name: `${baseName} - ${param.name}`,
    url: baseUrl,
    actions: param.actions,
    assertions: param.assertions
  }))
}