import assert from 'node:assert/strict';
import { RequestCookies, ResponseCookies } from '@edge-runtime/cookies';
import { TransactionStore } from '@auth0/nextjs-auth0/server';
import { getAuth0TransactionCookieDomain } from '../src/lib/auth0-transaction-cookie';

const secret = 'test-secret-that-is-long-enough-for-encryption';
const state = 'valid-state';

function requestCookies(cookieHeader?: string): RequestCookies {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  return new RequestCookies(headers);
}

async function main() {
  assert.equal(
    getAuth0TransactionCookieDomain('https://resetbiology.com'),
    'resetbiology.com',
    'the production callback host must share its transaction cookie with aliases',
  );
  assert.equal(
    getAuth0TransactionCookieDomain('http://localhost:3000'),
    undefined,
    'localhost must retain host-only transaction cookies',
  );

  const store = new TransactionStore({
    secret,
    cookieOptions: {
      domain: 'resetbiology.com',
      path: '/',
      secure: true,
      sameSite: 'lax',
    },
    enableParallelTransactions: true,
  });
  const responseHeaders = new Headers();
  const responseCookies = new ResponseCookies(responseHeaders);

  await store.save(responseCookies, {
    state,
    nonce: 'nonce',
    codeVerifier: 'verifier',
    responseType: 'code',
    returnTo: '/portal',
  });

  const setCookie = responseHeaders.get('set-cookie');
  assert.ok(setCookie, 'state creation must set a transaction cookie');
  const cookieHeader = setCookie.split(';', 1)[0];

  const valid = await store.get(requestCookies(cookieHeader), state);
  assert.equal(valid?.payload.state, state, 'valid state must validate');

  const missing = await store.get(requestCookies(), state);
  assert.equal(missing, null, 'missing state cookie must be rejected');

  const mismatched = await store.get(requestCookies(cookieHeader), 'different-state');
  assert.equal(mismatched, null, 'mismatched state must be rejected');

  const callbackCookies = new ResponseCookies(new Headers());
  await store.delete(callbackCookies, state);
  const replay = await store.get(requestCookies(), state);
  assert.equal(replay, null, 'replayed state must be rejected after deletion');

  console.log('auth0 transaction state regression: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
