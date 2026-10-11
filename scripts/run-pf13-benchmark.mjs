import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const repo = process.cwd()
const staticDir = resolve(repo, 'scripts/pf13-standalone')
const bundle = resolve(staticDir, 'pf13-runner.js')
const entry = resolve(repo, 'scripts/pf13-standalone-runner.ts')
const build = spawnSync(resolve(repo, 'node_modules/.bin/esbuild.cmd'), [entry, '--bundle', '--format=iife', '--platform=browser', '--target=es2020', `--outfile=${bundle}`], { cwd: repo, encoding: 'utf8', shell: true })
if (build.error || build.status !== 0) {
  process.stderr.write((build.stdout ?? '') + (build.stderr ?? '') + (build.error?.message ?? ''))
  process.exit(build.status || 1)
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm' }
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const relative = decodeURIComponent(url.pathname)
    const path = relative.startsWith('/models/')
      ? resolve(repo, 'public', relative.slice(1))
      : relative.startsWith('/onnxruntime-web/')
        ? resolve(repo, 'node_modules/onnxruntime-web/dist', relative.slice('/onnxruntime-web/'.length))
        : resolve(staticDir, relative === '/' ? 'index.html' : relative.slice(1))
    if (!path.startsWith(staticDir) && !path.startsWith(resolve(repo, 'public', 'models')) && !path.startsWith(resolve(repo, 'node_modules/onnxruntime-web/dist'))) throw new Error('path traversal')
    const body = await readFile(path)
    response.writeHead(200, { 'content-type': contentTypes[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('not found')
  }
})

await new Promise((resolveReady) => server.listen(4315, '127.0.0.1', resolveReady))
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage()
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') console.error(`[browser] ${message.text()}`) })
  page.on('pageerror', (error) => console.error(`[pageerror] ${error.message}`))
  await page.goto('http://127.0.0.1:4315/', { waitUntil: 'domcontentloaded', timeout: 300_000 })
  const result = await page.evaluate(async () => {
    if (!window.__runPf13Benchmark) throw new Error('PF13 runner was not installed')
    return window.__runPf13Benchmark()
  })
  const output = resolve(repo, 'data/pitchforks-rework/results/PF13-STANDALONE-DETECTOR-BENCHMARK-2026-10-10.json')
  await mkdir(join(repo, 'data/pitchforks-rework/results'), { recursive: true })
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ fixtures: result.fixtures, windows: result.windows, detectorSlots: result.detectorSlots, pestoMinSamples: result.pestoMinSamples, byteIdenticalNonTiming: result.byteIdenticalNonTiming, metrics: result.passes.map(({ pass, metrics }) => ({ pass, metrics })) }, null, 2))
} finally {
  await browser.close()
  server.close()
}
