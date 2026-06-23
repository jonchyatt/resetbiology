// ════════════════════════════════════════════════════════════════════════════
// isolate-lead-experiment.mjs — VALIDATE Jon's "lead-dominant MINUS no-lead" idea.
//
// Hypothesis: the Lead voice lives only in the "Lead Dominant" mix; the other 3
// voices live in BOTH "Lead Dominant" and "No Lead". So:
//     clean Lead  =  LeadDominant notes  −  NoLead notes  (matched by time+pitch)
// If this holds, the isolated onsets (a) reveal the TRUE vocal entry (fixing the
// ~6s-early bar) and (b) match the engraved pitches = the verify ground truth.
//
// Read-only experiment. Stages the two extractions for offline reuse. No deploy.
// Run:  node scripts/omr/isolate-lead-experiment.mjs
// ════════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const BLOB = 'https://vv03sd8jufykivax.public.blob.vercel-storage.com/vocal-trainer';
const LD_URL = `${BLOB}/1781240825294-lead-lida-rose-lead-dominant/template.json`;
const NL_URL = `${BLOB}/1781240827136-lead-lida-rose-no-lead/template.json`;
const OMR_TS = 'C:/Users/jonch/reset-biology-website/src/components/PitchDefender/omrTargets.ts';
const STAGE  = 'C:/Users/jonch/Projects/jarvis/data/vocal-trainer/runtime-logs';

const NM = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

async function load(url, stageName) {
  const p = `${STAGE}/${stageName}`;
  try {
    const j = await (await fetch(url)).json();
    fs.writeFileSync(p, JSON.stringify(j));
    return j;
  } catch (e) {
    console.log(`  (fetch fail ${stageName}: ${e.message} — using staged)`);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}

const ldJ = await load(LD_URL, 'ld-lida-lead-dominant.json');
const nlJ = await load(NL_URL, 'nl-lida-no-lead.json');
const LD = ldJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds })).sort((a, b) => a.t - b.t);
const NL = nlJ.notes.map((n) => ({ m: n.pitchMidi, t: n.startTimeSeconds, d: n.durationSeconds })).sort((a, b) => a.t - b.t);

// engraving: Lead pitches + relative score rhythm
const ts = fs.readFileSync(OMR_TS, 'utf8');
const eng = [...ts.matchAll(/pitchMidi:\s*(\d+),\s*startTimeSeconds:\s*([\d.]+),\s*durationSeconds:\s*([\d.]+)/g)]
  .map((m) => ({ m: +m[1], rel: +m[2], dur: +m[3] }));
const eMin = Math.min(...eng.map((n) => n.m)), eMax = Math.max(...eng.map((n) => n.m));

// ── isolation: an LD note is "background" (drop it) if NL has a note nearby in
//    time with a matching pitch. Two strictnesses to gauge sensitivity. ──
const TWIN = 0.35; // seconds
function explainedByNL(n, octaveFold) {
  for (const x of NL) {
    if (Math.abs(x.t - n.t) > TWIN) continue;
    const dpExact = Math.abs(x.m - n.m);
    const dpFold = Math.min(dpExact, Math.abs(((x.m - n.m) % 12 + 18) % 12 - 6) === 0 ? 0 : 12 - Math.abs((((x.m - n.m) % 12) + 12) % 12) > 1 ? 99 : 0);
    const dp = octaveFold ? Math.min(dpExact, ((Math.abs(x.m - n.m) % 12) <= 1 || (Math.abs(x.m - n.m) % 12) >= 11) ? 1 : 99) : dpExact;
    if (dp <= 1) return true;
  }
  return false;
}
const leadStrict = LD.filter((n) => !explainedByNL(n, false));
const leadFold   = LD.filter((n) => !explainedByNL(n, true));
const gate = (arr) => arr.filter((n) => n.m >= eMin - 1 && n.m <= eMax + 1); // drop overtone artifacts outside Lead range
const leadStrictG = gate(leadStrict);
const leadFoldG   = gate(leadFold);

// collapse consecutive same-pitch onsets within 0.12s (de-segment)
function collapse(arr) {
  const out = [];
  for (const n of arr) {
    const p = out[out.length - 1];
    if (p && p.m === n.m && n.t - p.t < 0.12) continue;
    out.push(n);
  }
  return out;
}
const leadFoldC = collapse(leadFoldG);

// pitch-class histogram cosine (isolated vs engraving) — quick "same melody?" check
function pcHist(arr) { const h = new Array(12).fill(0); for (const n of arr) h[((n.m % 12) + 12) % 12]++; return h; }
function cosine(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb) || 1); }
const cosFold = cosine(pcHist(leadFoldG), pcHist(eng));

console.log('═══ ISOLATION EXPERIMENT — Lida Rose Lead ═══');
console.log(`LeadDominant ${LD.length} notes (${nm(Math.min(...LD.map(n=>n.m)))}-${nm(Math.max(...LD.map(n=>n.m)))}) | first onset ${LD[0].t.toFixed(2)}s`);
console.log(`NoLead       ${NL.length} notes (${nm(Math.min(...NL.map(n=>n.m)))}-${nm(Math.max(...NL.map(n=>n.m)))}) | first onset ${NL[0].t.toFixed(2)}s`);
console.log(`Engraving    ${eng.length} notes (${nm(eMin)}-${nm(eMax)}) | rel-time first 6: ${eng.slice(0,6).map(n=>n.rel.toFixed(1)).join(' ')}`);
console.log('');
console.log(`isolated lead — strict:        ${leadStrict.length}  (range-gated ${leadStrictG.length})`);
console.log(`isolated lead — octave-fold:   ${leadFold.length}  (range-gated ${leadFoldG.length}, collapsed ${leadFoldC.length})`);
console.log(`TARGET = ${eng.length} engraved Lead notes`);
console.log(`pitch-class cosine (isolated foldG vs engraving): ${cosFold.toFixed(3)}`);
console.log('');
console.log(`★ TRUE VOCAL ENTRY (first isolated-lead onset, foldG): ${leadFoldG[0]?.t.toFixed(2)}s`);
console.log(`  vs LeadDominant first onset ${LD[0].t.toFixed(2)}s  vs current sync.json note0 0.708s`);
console.log('');
console.log('first 20 ISOLATED-LEAD (collapsed) onsets vs first 20 ENGRAVING pitches:');
for (let i = 0; i < 20; i++) {
  const a = leadFoldC[i], e = eng[i];
  console.log(`  ${String(i).padStart(2)}  iso ${a ? a.t.toFixed(2).padStart(6) + 's ' + nm(a.m).padEnd(4) : '   --    '}   eng ${e ? nm(e.m) : '--'}`);
}
console.log('');
console.log('LeadDominant first 10 onsets:', LD.slice(0,10).map(n=>`${n.t.toFixed(1)}${nm(n.m)}`).join(' '));
console.log('NoLead       first 10 onsets:', NL.slice(0,10).map(n=>`${n.t.toFixed(1)}${nm(n.m)}`).join(' '));

// stage the isolated lead for the sync rebuild
fs.writeFileSync(`${STAGE}/isolated-lead-lida.json`, JSON.stringify({
  song:'Lida Rose', voice:'Lead', method:'LeadDominant - NoLead (octave-fold, range-gated, collapsed)',
  durationSec: ldJ.durationSec, count: leadFoldC.length,
  notes: leadFoldC.map(n=>({ pitchMidi:n.m, startTimeSeconds:+n.t.toFixed(3), durationSeconds:+n.d.toFixed(3) })),
}, null, 1));
console.log(`\nwrote isolated-lead-lida.json (${leadFoldC.length} notes) for the sync rebuild`);
