import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
for (const href of ['/get-started', '/auth/login?returnTo=/portal']) {
  assert.match(home, new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
}

const launchFeatureHrefs = Array.from(home.matchAll(/href:\s*["']([^"']+)["']/g), ([, href]) => href);
assert.deepEqual(launchFeatureHrefs, ['/peptides', '/nutrition', '/journal', '/audio']);

for (const excludedHref of ['/store', '/subscription', '/pricing', '/education', '/breath']) {
  assert.doesNotMatch(home, new RegExp(`href=["']${excludedHref}(?:["'/])`));
}

async function main() {
  const paidAiResponse = await middleware(
    new NextRequest('https://resetbiology.com/api/foods/analyze-image', { method: 'POST' }),
  );
  assert.equal(paidAiResponse.status, 404, 'the paid OpenAI nutrition endpoint must be denied');
  assert.deepEqual(await paidAiResponse.json(), {
    error: 'Paid AI is unavailable during the free-first launch.',
  });

  const hiddenSurfaceResponse = await middleware(
    new NextRequest('https://resetbiology.com/store'),
  );
  assert.equal(hiddenSurfaceResponse.status, 307, 'commercial launch surfaces must redirect away');
  assert.equal(hiddenSurfaceResponse.headers.get('location'), 'https://resetbiology.com/get-started');

  console.log('RB-13 free-surface navigation and paid-OpenAI denial: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
