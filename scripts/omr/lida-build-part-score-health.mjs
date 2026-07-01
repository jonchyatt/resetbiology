import fs from 'fs';
import { normalizeLeadMeasure, PRINTED_FIFTHS } from './lida-lead-key-normalize.mjs';
import lidaContract from './songs/lida-rose.song.mjs';
import { resolveTempoBpm, notationTimingCheck } from './score-timing.mjs';

export function buildLidaPartScoreHealth(config) {
  const xmlFile = `public/musicxml/lida-rose-${config.slug}.musicxml`;
  const syncFile = `public/musicxml/lida-rose-${config.slug}-sync.json`;
  const reconciledFile = `public/musicxml/lida-rose-${config.slug}-reconciled.json`;
  const phrasesFile = `public/musicxml/lida-rose-${config.slug}-phrases.json`;
  const outFile = `public/musicxml/lida-rose-${config.slug}-score-health.json`;
  const noteMapFile = `public/musicxml/lida-rose-${config.slug}-note-map.json`;

  const xml = fs.readFileSync(xmlFile, 'utf8');
  const sync = readJson(syncFile);
  const reconciled = readJson(reconciledFile);
  const phraseManifest = fs.existsSync(phrasesFile) ? readJson(phrasesFile) : { phrases: [] };
  const expected = expectedFromPages(config.pages, config.part, config.applyCorrections);
  const actual = extractMeasurePitches(xml);
  const actualWhole = extractWholeNotes(xml);
  const noteMap = extractNoteMap(xml, phraseManifest.phrases || [], config.pageForMeasure);
  const fifths = [...new Set([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => Number(m[1])))];
  const noteCount = Object.values(actual).reduce((sum, notes) => sum + notes.length, 0);
  const allowedFifths = new Set([PRINTED_FIFTHS, ...(config.sectionTransitions || []).map((t) => t.nextKeyFifths)]);
  const checks = [];

  checks.push(check(
    'key-fifths',
    'Printed key',
    PRINTED_FIFTHS === -6 && fifths.length > 0 && fifths.every((f) => allowedFifths.has(f)),
    `expected ${[...allowedFifths].join(',')}; xml=${fifths.join(',') || 'none'} normalizer=${PRINTED_FIFTHS}`,
  ));

  const pitchErrors = [];
  for (const [measure, expectedNotes] of Object.entries(expected.pitchesByMeasure)) {
    const got = actual[measure] || [];
    if (got.join(' ') !== expectedNotes.join(' ')) {
      pitchErrors.push(`m${measure}: expected [${expectedNotes.join(' ')}], got [${got.join(' ')}]`);
    }
  }
  for (const [measure, got] of Object.entries(actual)) {
    if (!expected.pitchesByMeasure[measure] && got.length) {
      pitchErrors.push(`m${measure}: unexpected pitched notes [${got.join(' ')}]`);
    }
  }
  checks.push(check(
    'source-pitches',
    'Source pitch sequence',
    pitchErrors.length === 0,
    pitchErrors.length ? pitchErrors.slice(0, 5).join(' | ') : `${noteCount} pitches match pp.196-198 plus transition`,
  ));

  const expectedWhole = expected.wholeNotes.map((n) => `${n.measure}:${n.pitch}`);
  const gotWhole = actualWhole.map((n) => `${n.measure}:${n.pitch}`);
  checks.push(check(
    'whole-notes',
    'Whole-note survival',
    gotWhole.join(' ') === expectedWhole.join(' '),
    `expected [${expectedWhole.join(' ')}]; got [${gotWhole.join(' ')}]`,
  ));

  checks.push(check(
    'note-count',
    'Pitched note count',
    noteCount === expected.noteCount && noteCount === config.expectedNoteCount,
    `expected ${expected.noteCount}; got ${noteCount}`,
  ));

  const printedAuditErrors = comparePrintedAudit(xml, config.printedAuditMeasures);
  checks.push(check(
    'printed-score-audit',
    'Printed score audit',
    printedAuditErrors.length === 0,
    printedAuditErrors.length ? printedAuditErrors.join(' | ') : `${config.printedAuditMeasures.length} audit measures match`,
  ));

  const clefErrors = [];
  for (const measureMatch of xml.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const no = Number(measureMatch[1]);
    if (no <= 2) continue;
    const body = measureMatch[0];
    if (/<clef>/.test(body)) clefErrors.push(`m${no}: repeated clef`);
    if (/(<clef>|<key>)/.test(body) && !/<print\b[^>]*new-(?:system|page)="yes"/.test(body)) {
      clefErrors.push(`m${no}: clef/key without system break`);
    }
  }
  checks.push(check(
    'no-courtesy-clefs',
    'No stray courtesy clefs',
    clefErrors.length === 0,
    clefErrors.length ? clefErrors.join(' | ') : 'no later clefs in the line',
  ));

  const syncNotes = Array.isArray(sync.notes) ? sync.notes : [];
  const reconciledNotes = Array.isArray(reconciled.notes) ? reconciled.notes : [];
  checks.push(check(
    'sync-count',
    'Sync target count',
    syncNotes.length === noteCount && reconciledNotes.length === noteCount,
    `sync=${syncNotes.length}; reconciled=${reconciledNotes.length}; score=${noteCount}`,
  ));

  const bpm = resolveTempoBpm(lidaContract);
  const timing = notationTimingCheck(syncNotes, reconciledNotes, bpm);
  checks.push(check(
    'notation-timing',
    'Score-rhythm timing',
    /notation|score-rhythm/i.test(sync.source || '') && timing.ok,
    `source=${sync.source || 'missing'}; ${timing.detail}`,
  ));

  const payload = {
    song: 'Lida Rose',
    part: config.part,
    scoreVersion: config.scoreVersion,
    sourcePages: config.pages.map((p) => `${p.page}:${p.staff}`),
    generatedAt: new Date().toISOString(),
    keyFifths: -6,
    noteCount,
    wholeNotes: actualWhole,
    sectionTransitions: config.sectionTransitions || [],
    verificationStatus: sync.verificationStatus || 'UNVERIFIED',
    sync: {
      noteCount: syncNotes.length,
      reconciledCount: reconciledNotes.length,
      source: sync.source || null,
      verificationStatus: sync.verificationStatus || 'UNVERIFIED',
      audioStem: sync.audit?.audioStem || null,
      tempoBpm: bpm,
      secondsPerBeat: +(60 / bpm).toFixed(3),
      notationTiming: timing,
    },
    checks,
  };

  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 1)}\n`);
  fs.writeFileSync(noteMapFile, `${JSON.stringify({
    song: 'Lida Rose',
    part: config.part,
    scoreVersion: payload.scoreVersion,
    generatedAt: payload.generatedAt,
    notes: noteMap,
  }, null, 1)}\n`);

  console.log(`wrote ${outFile}`);
  console.log(`wrote ${noteMapFile}`);
  for (const c of checks) console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}`);
  if (checks.some((c) => c.status !== 'pass')) process.exit(1);
}

function check(id, label, passed, detail) {
  return { id, label, status: passed ? 'pass' : 'fail', detail };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function expectedFromPages(pages, partName, applyCorrections) {
  const pitchesByMeasure = {};
  const wholeNotes = [];
  let outMeasure = 0;

  for (const page of pages) {
    const sourceXml = fs.readFileSync(page.file, 'utf8');
    const part = getPartInner(sourceXml, page.staff);
    const divisions = Number((part.match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 1);
    const sourceMeasures = (part.match(/<measure\b[\s\S]*?<\/measure>/g) || []).map(normalizeLeadMeasure);
    const correctedMeasures = applyCorrections(
      page.page,
      sourceMeasures,
      { part: partName, divisions },
    );
    for (const measure of correctedMeasures) {
      outMeasure++;
      const pitches = extractPitchesFromMeasure(measure);
      if (pitches.length) pitchesByMeasure[String(outMeasure)] = pitches;
      for (const pitch of extractWholeNotesFromMeasure(measure)) {
        wholeNotes.push({ measure: outMeasure, pitch });
      }
    }
  }

  while (outMeasure > 0 && !pitchesByMeasure[String(outMeasure)]) outMeasure--;
  for (const key of Object.keys(pitchesByMeasure)) {
    if (Number(key) > outMeasure) delete pitchesByMeasure[key];
  }

  return {
    pitchesByMeasure,
    wholeNotes: wholeNotes.filter((n) => n.measure <= outMeasure),
    noteCount: Object.values(pitchesByMeasure).reduce((sum, notes) => sum + notes.length, 0),
  };
}

function getPartInner(sourceXml, id) {
  for (const partBlock of sourceXml.split('<part id="').slice(1)) {
    const match = partBlock.match(/^([^"]+)"/);
    if (!match || match[1] !== id) continue;
    const end = partBlock.indexOf('</part>');
    if (end < 0) throw new Error(`part ${id}: missing </part>`);
    return partBlock.slice(partBlock.indexOf('>') + 1, end);
  }
  throw new Error(`part ${id} not found`);
}

function extractMeasurePitches(xmlText) {
  const out = {};
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const notes = extractPitchesFromMeasure(measureMatch[0]);
    if (notes.length) out[measureMatch[1]] = notes;
  }
  return out;
}

function extractPitchesFromMeasure(measureXml) {
  const notes = [];
  for (const noteMatch of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
    const noteXml = noteMatch[0];
    if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
    const pitch = noteXml.match(/<pitch>[\s\S]*?<step>([A-G])<\/step>[\s\S]*?(?:<alter>(-?\d+)<\/alter>[\s\S]*?)?<octave>(\d+)<\/octave>[\s\S]*?<\/pitch>/);
    if (!pitch) continue;
    notes.push(spelledPitch(pitch[1], pitch[2] ? Number(pitch[2]) : 0, pitch[3]));
  }
  return notes;
}

function extractWholeNotes(xmlText) {
  const out = [];
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    for (const pitch of extractWholeNotesFromMeasure(measureMatch[0])) {
      out.push({ measure: Number(measureMatch[1]), pitch });
    }
  }
  return out;
}

function extractNoteMap(xmlText, phrases, pageForMeasure) {
  const out = [];
  let index = 0;
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const measure = Number(measureMatch[1]);
    for (const noteMatch of measureMatch[0].matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
      const pitch = extractPitchesFromMeasure(noteXml)[0];
      if (!pitch) continue;
      index++;
      const phrase = phrases.find((p) => index >= p.noteStart && index <= p.noteEnd) ?? null;
      out.push({
        index,
        measure,
        page: pageForMeasure(measure),
        pitch,
        phraseId: phrase?.id ?? null,
        phraseLabel: phrase?.label ?? null,
        phraseShortLabel: phrase?.shortLabel ?? null,
      });
    }
  }
  return out;
}

function extractWholeNotesFromMeasure(measureXml) {
  const out = [];
  for (const noteMatch of measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)) {
    const noteXml = noteMatch[0];
    if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
    if (!/<type>whole<\/type>/.test(noteXml) && !/<duration>48<\/duration>/.test(noteXml)) continue;
    const pitch = extractPitchesFromMeasure(noteXml)[0];
    if (pitch) out.push(pitch);
  }
  return out;
}

function spelledPitch(step, alter, octave) {
  const suffix = alter === -2 ? 'bb' : alter === -1 ? 'b' : alter === 1 ? '#' : alter === 2 ? '##' : '';
  return `${step}${suffix}${octave}`;
}

function comparePrintedAudit(xmlText, printedAuditMeasures) {
  const measureNotes = extractMeasureNotes(xmlText);
  const errors = [];
  for (const audit of printedAuditMeasures) {
    const got = measureNotes[String(audit.measure)] || [];
    const gotSummary = got.map(noteSummary).join(' ');
    const expectedSummary = audit.notes.map(noteSummary).join(' ');
    if (gotSummary !== expectedSummary) {
      errors.push(`m${audit.measure}: expected [${expectedSummary}], got [${gotSummary}] (${audit.source})`);
    }
    const measureXml = getMeasureXml(xmlText, audit.measure);
    for (const required of audit.requiredXml || []) {
      if (!measureXml.includes(required)) {
        errors.push(`m${audit.measure}: missing required notation ${required} (${audit.source})`);
      }
    }
  }
  return errors;
}

function getMeasureXml(xmlText, measure) {
  return xmlText.match(new RegExp(`<measure number="${measure}"[\\s\\S]*?<\\/measure>`))?.[0] || '';
}

function extractMeasureNotes(xmlText) {
  const out = {};
  for (const measureMatch of xmlText.matchAll(/<measure number="(\d+)"[\s\S]*?<\/measure>/g)) {
    const divisions = Number((measureMatch[0].match(/<divisions>(\d+)<\/divisions>/) || [])[1] || 12);
    const notes = [];
    for (const noteMatch of measureMatch[0].matchAll(/<note\b[\s\S]*?<\/note>/g)) {
      const noteXml = noteMatch[0];
      if (/<rest\b/.test(noteXml) || /<chord\s*\/?\s*>/.test(noteXml)) continue;
      const pitch = extractPitchesFromMeasure(noteXml)[0];
      if (!pitch) continue;
      const duration = Number((noteXml.match(/<duration>(\d+)<\/duration>/) || [])[1] || 0);
      const type = (noteXml.match(/<type>([^<]+)<\/type>/) || [])[1] || '';
      const dots = (noteXml.match(/<dot\s*\/>/g) || []).length;
      notes.push({ pitch, beats: duration / divisions, type, ...(dots ? { dots } : {}) });
    }
    if (notes.length) out[measureMatch[1]] = notes;
  }
  return out;
}

function noteSummary(note) {
  const dots = note.dots ? `.${note.dots}` : '';
  return `${note.pitch}:${note.beats}:${note.type}${dots}`;
}
