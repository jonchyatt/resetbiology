// Usage: BASE=http://localhost:3079 node scripts/checks/no-auth-profile-on-public.mjs
// Logged-out load of public pages must make zero requests to /auth/profile.
import { chromium } from 'playwright';

const base = process.env.BASE || 'http://localhost:3079';
// Public pages only: protected pages (/nutrition, /peptides, ...) deliberately probe /auth/profile via ProtectedRoute.
const paths = ['/', '/privacy', '/terms', '/about', '/contact', '/education/peptides'];
const browser = await chromium.launch();
let bad = 0;
for (const p of paths) {
  const page = await (await browser.newContext()).newPage();
  const hits = [];
  page.on('request', (r) => { if (r.url().includes('/auth/profile')) hits.push(r.url()); });
  await page.goto(base + p, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(4000);
  console.log(`${p}: /auth/profile requests = ${hits.length}`);
  bad += hits.length;
}
await browser.close();
console.log(bad === 0 ? 'PASS' : 'FAIL');
process.exit(bad === 0 ? 0 : 1);
