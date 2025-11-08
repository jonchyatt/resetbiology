import { getPage } from './persistent-browser'

async function runCommand(command: string) {
  const page = await getPage()

  switch (command) {
    case 'goto-peptides':
      await page.goto('https://resetbiology.com/peptides')
      console.log('✅ Navigated to peptides page')
      break

    case 'click-edit':
      await page.locator('button[title="Edit Protocol"]').first().click()
      console.log('✅ Clicked Edit button')
      break

    case 'reload':
      await page.reload()
      console.log('✅ Reloaded page')
      break

    default:
      console.log('Unknown command:', command)
  }
}

const command = process.argv[2]
runCommand(command)
