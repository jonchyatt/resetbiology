// Self-test for src/lib/peptide-chat-rate-limit.ts — run via:
//   npx tsx scripts/verify-rate-limit.mjs
// ponytail: repo has no "type":"module" in package.json, so tsx compiles this
// .ts to CJS and Node's ESM/CJS interop only exposes it via `default` here —
// production code is unaffected (Next's own bundler handles the real ESM).
import mod from '../src/lib/peptide-chat-rate-limit.ts';
const { checkRateLimit, CLIENT_LIMIT, GLOBAL_LIMIT, CLIENT_WINDOW_MS } = mod;

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

let t = 1_000_000; // arbitrary base "now" in ms

// (a) (limit+1)th request for a single client trips scope:'client'
for (let i = 0; i < CLIENT_LIMIT; i++) {
  const r = checkRateLimit('ip-A', t);
  assert(r.ok === true, `client req ${i + 1}/${CLIENT_LIMIT} for ip-A ok`);
}
const overLimit = checkRateLimit('ip-A', t);
assert(overLimit.ok === false && overLimit.scope === 'client', `(${CLIENT_LIMIT}+1)th request for ip-A rejected with scope:'client'`);
assert(overLimit.ok === false && overLimit.retryAfterSec > 0, 'rejected response carries retryAfterSec > 0');

// (d) a different IP is limited independently (its own bucket still has room)
const otherIp = checkRateLimit('ip-B', t);
assert(otherIp.ok === true, 'ip-B (different client) unaffected by ip-A exhaustion');

// (c) fresh window after expiry passes again
const afterExpiry = checkRateLimit('ip-A', t + CLIENT_WINDOW_MS + 1);
assert(afterExpiry.ok === true, 'ip-A request in a fresh window (post-expiry) passes again');

// (b) global ceiling trips independently of per-client — spread requests
// across many distinct IPs (each under its own per-client limit) until the
// shared global ceiling is exhausted.
let t2 = 5_000_000;
let globalTripped = false;
let clientIndex = 0;
outer: for (let batch = 0; batch < GLOBAL_LIMIT + 50; batch++) {
  clientIndex++;
  const key = `global-probe-${clientIndex}`;
  const r = checkRateLimit(key, t2);
  if (!r.ok) {
    assert(r.scope === 'global', 'global ceiling trip reports scope:"global" (not client, since each probe IP is fresh)');
    globalTripped = true;
    break outer;
  }
}
assert(globalTripped, `global circuit breaker trips within ${GLOBAL_LIMIT + 50} distinct-client requests`);

console.log('\nAll rate-limit self-tests passed.');
