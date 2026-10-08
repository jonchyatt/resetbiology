import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const launchSurfaces = [
  'app/page.tsx',
  'app/get-started/page.tsx',
  'app/peptides/page.tsx',
  'app/nutrition/page.tsx',
  'app/daily-history/page.tsx',
  'app/modules/page.tsx',
  'src/components/Portal/EnhancedDashboard.tsx',
];

for (const surface of launchSurfaces) {
  assert.match(read(surface), /rb-launch/, `${surface} must use the shared launch surface`);
}

const header = read('src/components/Navigation/Header.tsx');
assert.match(header, /bg-slate-950/);
assert.match(header, /border-slate-800/);
for (const route of ['/peptides', '/nutrition', '/journal', '/audio']) {
  assert.match(header, new RegExp(`href=["']${route}["']`), `${route} must remain in launch navigation`);
}
for (const excludedRoute of ['/order', '/store', '/pricing', '/subscription', '/education']) {
  assert.doesNotMatch(header, new RegExp(`href=["']${excludedRoute}(?:["'/])`), `${excludedRoute} must stay out of launch navigation`);
}

const home = read('app/page.tsx');
assert.match(home, /Free to start/);
assert.doesNotMatch(home, /Satori Living Foundation/);

console.log(`RB-15 restyled free-launch checker: PASS (${launchSurfaces.length} surfaces)`);
