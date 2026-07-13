// One-shot verification: every mutating (and listProducts) action in
// src/app/admin/store/actions.ts calls requireAdmin() BEFORE any prisma
// call, so with no session, execution never reaches the database.
// Server Actions can't be curled directly (they need a build-time encoded
// action ID from a real page load) -- this proves the order-of-operations
// property instead: requireAdmin() throws first, prisma.* is never reached.
// Run: npx tsx scripts/verify-store-actions-auth.mjs
const mod = await import('../src/app/admin/store/actions.ts');

const calls = [
  ['listProducts', () => mod.listProducts()],
  ['createProduct', () => mod.createProduct({ name: 'x', slug: 'x' })],
  ['updateProduct', () => mod.updateProduct('fake-id', { name: 'y' })],
  ['archiveProduct', () => mod.archiveProduct('fake-id')],
  ['upsertPrice', () => mod.upsertPrice('fake-id', { unitAmount: 100 })],
  ['deletePrice', () => mod.deletePrice('fake-id')],
  ['syncProductToStripe', () => mod.syncProductToStripe('fake-id')],
  ['importPeptides', () => mod.importPeptides()],
];

let allPass = true;
for (const [name, fn] of calls) {
  try {
    const result = await fn();
    console.log(`FAIL — ${name} did NOT throw (returned ${JSON.stringify(result)}) — requireAdmin() did not block`);
    allPass = false;
  } catch (err) {
    const msg = String(err?.message || err);
    // Any throw before a real DB mutation is the property under test — the
    // exact error shape (outside-request-scope vs auth0 vs a real redirect
    // in production) doesn't matter here, only that prisma was never reached.
    const reachedPrisma = /Mongo|prisma|ECONNREFUSED|querySrv|ENOTFOUND noop/i.test(msg);
    if (reachedPrisma) {
      console.log(`FAIL — ${name} reached a prisma/DB call before requireAdmin() blocked: ${msg.slice(0, 200)}`);
      allPass = false;
    } else {
      console.log(`PASS — ${name} blocked before any DB call: ${msg.slice(0, 120)}`);
    }
  }
}
process.exit(allPass ? 0 : 1);
