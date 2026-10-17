import { parseStoreClick } from '../src/lib/storeClicks'

let failed = false
function check(label: string, pass: boolean) {
  if (pass) console.log(`[PASS] ${label}`)
  else { failed = true; console.error(`[FAIL] ${label}`) }
}

check('known seller key accepted', parseStoreClick({ sellerKey: 'Foundation Protocol' })?.sellerKey === 'Foundation Protocol')
check('unknown key rejected', parseStoreClick({ sellerKey: 'nope' }) === null)
check('prototype key rejected', parseStoreClick({ sellerKey: 'constructor' }) === null)
check('non-object rejected', parseStoreClick('x') === null && parseStoreClick(null) === null)
if (failed) process.exit(1)
