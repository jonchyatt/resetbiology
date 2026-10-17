import { operatorLineText } from '../src/components/Legal/operatorLine'

let failed = false
function check(label: string, pass: boolean) {
  if (pass) console.log(`[PASS] ${label}`)
  else { failed = true; console.error(`[FAIL] ${label}`) }
}

check('flag unset renders nothing', operatorLineText(undefined) === null)
check('flag off renders nothing', operatorLineText('off') === null)
check('empty flag renders nothing', operatorLineText('') === null)
check('flag on names the operator', operatorLineText('on') === 'Reset Biology is operated by Satori Enterprises, Inc.')

if (failed) process.exit(1)
