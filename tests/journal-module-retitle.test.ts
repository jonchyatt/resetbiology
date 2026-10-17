import assert from 'node:assert/strict'
import { retitleModuleNotes, moduleTitle } from '../src/data/audio-library'

const title = moduleTitle('mmm1-reset-relationship-food')
assert.notEqual(title, 'mmm1-reset-relationship-food')
assert.equal(
  retitleModuleNotes('Mental mastery module mmm1-reset-relationship-food completed at 7:05 AM'),
  `Mental mastery module ${title} completed at 7:05 AM`,
)
// already-titled and unknown ids are left alone
assert.equal(retitleModuleNotes(`module ${title} completed`), `module ${title} completed`)
assert.equal(retitleModuleNotes('module mmm99-unknown completed'), 'module mmm99-unknown completed')
// an id that is a prefix of another is not clipped
assert.equal(retitleModuleNotes('mmm1-reset-relationship-food-extra'), 'mmm1-reset-relationship-food-extra')
assert.equal(retitleModuleNotes(undefined), undefined)
console.log('journal-module-retitle: ok')
