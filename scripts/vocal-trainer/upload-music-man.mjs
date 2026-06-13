// Batch-upload Music Man barbershop part tracks to the vocal-trainer library.
//
// Uploads audio-only (notes:[]) — the in-app "Extract vocal line" button
// (VocalTrainerIII library) backfills the BasicPitch melody + contour afterward,
// exactly like the 20 Lead/Baritone tracks already in the library.
//
// Title convention MUST match the existing entries so the in-app parser groups
// them:  "<Part> - <Song> - <Mix>"  e.g. "Tenor - Wells Fargo - No Tenor".
//
// Usage:
//   node scripts/vocal-trainer/upload-music-man.mjs                 # Tenor + Bass, dry-run
//   node scripts/vocal-trainer/upload-music-man.mjs --go            # actually upload
//   node scripts/vocal-trainer/upload-music-man.mjs --go --parts Tenor,Bass,Lead,Baritone
//   node scripts/vocal-trainer/upload-music-man.mjs --go --base https://resetbiology.com
//
// Idempotent: fetches the live library first and skips any title already present.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const GO = has('--go');
const BASE = val('--base', 'https://resetbiology.com').replace(/\/$/, '');
const PARTS = val('--parts', 'Tenor,Bass').split(',').map((s) => s.trim()).filter(Boolean);
const ROOT = val('--root', 'C:/Users/jonch/Music/MusicMan/MusicManStuff');
const AUDIO_RE = /\.(m4a|mp3|wav|ogg)$/i;
const MIME = { '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

function log(...a) { console.log(...a); }

async function fetchExistingTitles() {
  try {
    const r = await fetch(`${BASE}/api/vocal-trainer/library`, { cache: 'no-store' });
    const j = await r.json();
    const set = new Set((j.templates || []).map((t) => String(t.title).trim().toLowerCase()));
    return set;
  } catch (e) {
    log(`⚠ could not read existing library (${e.message}); proceeding without dedupe`);
    return new Set();
  }
}

function collect() {
  const jobs = [];
  for (const part of PARTS) {
    const dir = path.join(ROOT, part);
    if (!fs.existsSync(dir)) { log(`⚠ missing part dir: ${dir}`); continue; }
    for (const name of fs.readdirSync(dir).sort()) {
      if (!AUDIO_RE.test(name)) continue;
      const ext = path.extname(name).toLowerCase();
      const stem = name.replace(AUDIO_RE, '');          // "Wells Fargo - No Tenor"
      const title = `${part} - ${stem}`;                // "Tenor - Wells Fargo - No Tenor"
      jobs.push({ part, file: path.join(dir, name), filename: name, ext, title });
    }
  }
  return jobs;
}

async function uploadOne(job) {
  const buf = fs.readFileSync(job.file);
  const fd = new FormData();
  fd.append('audio', new Blob([buf], { type: MIME[job.ext] || 'audio/mp4' }), job.filename);
  fd.append('template', JSON.stringify({ title: job.title, notes: [], tempo: 100, durationSec: 0 }));
  const r = await fetch(`${BASE}/api/vocal-trainer/upload`, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

(async () => {
  const existing = await fetchExistingTitles();
  const jobs = collect();
  const todo = jobs.filter((j) => !existing.has(j.title.toLowerCase()));
  const skip = jobs.length - todo.length;

  log(`Endpoint : ${BASE}`);
  log(`Parts    : ${PARTS.join(', ')}`);
  log(`Found    : ${jobs.length} audio files`);
  log(`Already  : ${skip} (skipped)`);
  log(`To upload: ${todo.length}`);
  log(GO ? '── UPLOADING ──' : '── DRY RUN (pass --go to upload) ──');
  todo.forEach((j) => log(`   ${GO ? '↑' : '·'} ${j.title}  (${(fs.statSync(j.file).size / 1048576).toFixed(2)} MB)`));

  if (!GO) { log('\nDry run complete. Re-run with --go to upload.'); return; }

  let ok = 0, fail = 0;
  for (const j of todo) {
    try {
      const res = await uploadOne(j);
      ok++;
      log(`✓ ${j.title}  → id ${res.id}`);
    } catch (e) {
      fail++;
      log(`✗ ${j.title}  → ${e.message}`);
    }
  }
  log(`\nDone. uploaded=${ok} failed=${fail} skipped=${skip}`);
})();
