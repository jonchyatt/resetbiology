import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../app/api/foods/analyze-image/route.ts', import.meta.url), 'utf8')
const edgeAuth = readFileSync(new URL('../src/lib/auth0-edge.ts', import.meta.url), 'utf8')
const camera = readFileSync(new URL('../src/components/Nutrition/CameraUpload.tsx', import.meta.url), 'utf8')
const quickAdd = readFileSync(new URL('../src/components/Nutrition/FoodQuickAdd.tsx', import.meta.url), 'utf8')

const exactMessage = 'Photo analysis is temporarily unavailable. Use Search to log your meal manually.'

const authIndex = route.indexOf('await auth0Edge.getSession()')
const unavailableIndex = route.indexOf("error: 'photo_analysis_unavailable'")
assert.ok(authIndex >= 0, 'photo analysis route must authenticate')
assert.ok(unavailableIndex > authIndex, 'authentication must happen before the unavailable response')
assert.match(route, /import \{ auth0Edge \} from '@\/lib\/auth0-edge'/, 'route must use the existing database-free session client')
assert.match(route, /if \(!session\?\.user\) \{[\s\S]*?status: 401/, 'the signed Auth0 session must gate unauthenticated callers without a user-database lookup')
assert.match(route, /ok: false[\s\S]*?error: 'photo_analysis_unavailable'[\s\S]*?message: PHOTO_ANALYSIS_UNAVAILABLE[\s\S]*?status: 503/, 'authenticated callers must receive the stable 503 contract')
assert.ok(route.includes(exactMessage), 'server response must preserve the exact member-facing message')

for (const prohibited of [
  /OpenAI/,
  /OPENAI_API_KEY/,
  /gpt-4o-mini/,
  /completions\.create/,
  /prisma/i,
  /getUserFromSession/,
  /from ['"]@\/lib\/auth0['"]/,
  /aIUsage/,
  /req\.json/,
  /imageBase64/,
  /compressImageForAI/,
  /base64ToBuffer/,
  /fetch\(/,
]) {
  assert.doesNotMatch(route, prohibited, `route must not retain ${prohibited}`)
}

for (const prohibited of [/from ['"][^'"]*prisma[^'"]*['"]/i, /new PrismaClient/, /syncUserToDatabase/, /beforeSessionSaved/, /from ['"]\.\/auth0['"]/, /from ['"]@\/lib\/auth0['"]/]) {
  assert.doesNotMatch(edgeAuth, prohibited, `database-free session client must not retain ${prohibited}`)
}

assert.ok(camera.includes(exactMessage), 'camera notice must preserve the exact member-facing message')
assert.match(camera, /role="dialog"/, 'camera notice must expose dialog semantics')
assert.match(camera, /aria-modal="true"/, 'camera notice must be modal')
assert.match(camera, /aria-labelledby="photo-analysis-title"/, 'dialog must reference its heading')
assert.match(camera, /aria-describedby="photo-analysis-description"/, 'dialog must reference its description')
assert.match(camera, /role="status"/, 'unavailable notice must be politely announced')
assert.match(camera, /aria-live="polite"/, 'unavailable notice must use a polite live region')
assert.match(camera, /aria-label="Close photo logging notice"/, 'icon close must have an accessible name')
assert.match(camera, /primaryActionRef\.current\?\.focus\(\)/, 'dialog must initially focus the Search fallback')
assert.match(camera, /event\.key === 'Escape'[\s\S]*?onClose\(\)/, 'Escape must close through the focus-restoring callback')
assert.match(camera, /onClick=\{onUseSearch\}/, 'Search fallback must use the parent handoff')
assert.match(camera, />\s*Use Search instead\s*</, 'Search fallback must remain visible')
assert.match(camera, /blue-(?:400|500)/, 'containment must include a calm blue informational accent')
assert.match(camera, /amber-(?:400|500)/, 'containment must include calm amber opportunity framing')
assert.match(camera, /ponytail: Phase 1 contains paid photo inference/, 'temporary containment must name its Phase 2c upgrade path')

for (const prohibited of [
  /type="file"/,
  /capture="environment"/,
  /FileReader/,
  /navigator\.mediaDevices/,
  /\/api\/foods\/analyze-image/,
  /\/api\/upload\/image/,
  /\/api\/foods\/log/,
  /Analyze Food/,
]) {
  assert.doesNotMatch(camera, prohibited, `contained camera UI must not retain ${prohibited}`)
}

assert.match(quickAdd, /ref=\{cameraButtonRef\}/, 'camera entrypoint must remain focusable and visible')
assert.match(quickAdd, /setShowCameraModal\(true\)/, 'camera entrypoint must still open the notice')
assert.match(quickAdd, /const closeCameraModal = \(\) => \{[\s\S]*?cameraButtonRef\.current\?\.focus\(\)/, 'close, Cancel, and Escape must restore Camera focus')
assert.match(quickAdd, /const useSearchFromCamera = \(\) => \{[\s\S]*?setActiveTab\('search'\)[\s\S]*?searchInputRef\.current\?\.focus\(\)/, 'fallback must activate Search and focus its input')
assert.match(quickAdd, /ref=\{searchInputRef\}[\s\S]*?placeholder="Search foods or brands"/, 'the existing Search field must receive the handoff ref')
assert.match(quickAdd, /<CameraUpload[\s\S]*?onClose=\{closeCameraModal\}[\s\S]*?onUseSearch=\{useSearchFromCamera\}/, 'Camera notice must receive both focus-managed callbacks')

for (const capability of [
  "setActiveTab('favorites')",
  "fetch('/api/nutrition/favorites'",
  'fetch("/api/foods/search?q=" + query',
  'fetch("/api/foods/log"',
  'localDate: localDayKey(now)',
]) {
  assert.ok(quickAdd.includes(capability), `FoodQuickAdd must preserve ${capability}`)
}

assert.ok(
  quickAdd.includes('className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"'),
  'the Phase 1.0 responsive header class must remain intact',
)

console.log('nutrition photo paid-inference containment contract: PASS')
