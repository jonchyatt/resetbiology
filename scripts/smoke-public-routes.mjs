// Smoke test for public routes. Usage: node scripts/smoke-public-routes.mjs [baseUrl]
// Default base is http://localhost:3000 (run `npm run dev` or `npm start` first).
// Read-only GETs. Fails on any non-2xx final response, a missing <title>, or a Next.js error page.
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

const routes = [
  '/', '/about', '/get-started', '/process', '/quiz', '/assessment', '/contact',
  '/privacy', '/terms', '/education', '/education/peptides', '/education/gurus',
  '/robots.txt', '/sitemap.xml',
]

// Also sample one detail page from the sitemap so the generated slug pages are covered.
async function sitemapSample() {
  try {
    const xml = await (await fetch(`${base}/sitemap.xml`)).text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
    return ['/education/peptides/', '/education/gurus/']
      .map((prefix) => locs.find((p) => p.startsWith(prefix) && p.length > prefix.length))
      .filter(Boolean)
  } catch {
    return []
  }
}

const failures = []
for (const path of [...routes, ...(await sitemapSample())]) {
  try {
    const res = await fetch(base + path, { redirect: 'follow' })
    const body = await res.text()
    const isHtml = (res.headers.get('content-type') || '').includes('text/html')
    const problems = []
    if (!res.ok) problems.push(`status ${res.status}`)
    if (isHtml && !/<title>[^<]+<\/title>/i.test(body)) problems.push('no <title>')
    if (isHtml && /Application error|Internal Server Error/i.test(body)) problems.push('error page')
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${path}${problems.length ? ' — ' + problems.join(', ') : ''}`)
    if (problems.length) failures.push(path)
  } catch (err) {
    console.log(`FAIL ${path} — ${err.message}`)
    failures.push(path)
  }
}
if (failures.length) {
  console.error(`\n${failures.length} route(s) failed`)
  process.exit(1)
}
console.log('\nAll public routes passed')
