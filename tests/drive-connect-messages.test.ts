import assert from 'node:assert/strict'
import { driveErrorMessage, DRIVE_SCOPE_MISSING_MESSAGE, DRIVE_CALLBACK_FAILED_MESSAGE, DRIVE_GENERIC_ERROR_MESSAGE } from '../src/lib/driveConnectMessages'

assert.equal(driveErrorMessage('drive_scope_missing'), DRIVE_SCOPE_MISSING_MESSAGE)
assert.equal(driveErrorMessage('callback_failed'), DRIVE_CALLBACK_FAILED_MESSAGE)
assert.equal(driveErrorMessage('session_required'), DRIVE_GENERIC_ERROR_MESSAGE)
assert.equal(driveErrorMessage(null), DRIVE_GENERIC_ERROR_MESSAGE)
console.log('drive-connect-messages: ok')
