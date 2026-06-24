// Manual corrections for Lida Rose Lead (Ewart) where Audiveris missed visible
// source notation. These are page-image-derived patches, not audio guesses.

function wholeNoteMeasure({ number, width, step, alter = null, octave, duration }) {
  return `    <measure number="${number}" width="${width}">
      <note>
        <pitch>
          <step>${step}</step>
${alter == null ? '' : `          <alter>${alter}</alter>\n`}          <octave>${octave}</octave>
        </pitch>
        <duration>${duration}</duration>
        <voice>1</voice>
        <type>whole</type>
      </note>
    </measure>`;
}

function transitionMeasure35({ duration }) {
  const half = duration / 2;
  return `    <measure number="14" width="240">
      <print new-system="yes"/>
      <attributes>
        <key>
          <fifths>1</fifths>
        </key>
        <time symbol="common">
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>
      <note>
        <pitch>
          <step>B</step>
          <octave>3</octave>
        </pitch>
        <duration>${half}</duration>
        <tie type="stop"/>
        <voice>1</voice>
        <type>half</type>
        <accidental>natural</accidental>
        <notations>
          <tied type="stop"></tied>
        </notations>
      </note>
      <note>
        <rest/>
        <duration>${half}</duration>
        <voice>1</voice>
        <type>half</type>
      </note>
    </measure>`;
}

function addNotationElement(noteXml, elementXml) {
  if (noteXml.includes(elementXml)) return noteXml;
  const indentedElement = elementXml
    .split('\n')
    .map((line) => `          ${line}`)
    .join('\n');
  if (/<notations>/.test(noteXml)) {
    return noteXml.replace(/(\s*)<\/notations>/, `$1${indentedElement}\n$1</notations>`);
  }
  return noteXml.replace(/\s*<\/note>$/, `\n        <notations>\n${indentedElement}\n        </notations>\n      </note>`);
}

function addTieElement(noteXml, type) {
  const tieXml = `<tie type="${type}"/>`;
  if (noteXml.includes(tieXml)) return noteXml;
  return noteXml.replace(/(\s*<voice>)/, `\n        ${tieXml}$1`);
}

function addBar34TransitionSlide(measureXml) {
  const notes = [...measureXml.matchAll(/<note\b[\s\S]*?<\/note>/g)].map((match) => match[0]);
  if (notes.length < 2) return measureXml;
  let out = measureXml;
  const first = addNotationElement(notes[0], '<slide type="start" number="1" line-type="wavy"></slide>');
  let second = addTieElement(notes[1], 'start');
  second = addNotationElement(second, '<tied type="start"></tied>');
  second = addNotationElement(second, '<slide type="stop" number="1" line-type="wavy"></slide>');
  out = out.replace(notes[0], first);
  out = out.replace(notes[1], second);
  return out;
}

// ── Audiveris rhythm/spelling repairs (printed-page + homophony verified) ──────
// m16 & m18 (global): Audiveris mis-read four printed quarter notes as a 2/3
// quarter-triplet, leaving each bar at 3 beats / 36 ticks. The three homophonic
// voices that parsed cleanly on p.197 (Tenor/Baritone/Bass) prove a 4-beat bar of
// plain quarters. A quarter-triplet member is <duration>8</duration> (at LCM 12)
// carrying a 3:2 <time-modification>; restore each to a plain quarter (12 ticks).
// True eighths (duration 6) are untouched, so m18's rest + 2 eighths + 2 quarters
// is preserved. Pitch sequence is unchanged — only durations move.
function deTripletizeQuarterTriplets(measureXml) {
  return measureXml.replace(/<note\b[\s\S]*?<\/note>/g, (note) => {
    let n = note;
    const isQuarterTriplet =
      /<time-modification>\s*<actual-notes>3<\/actual-notes>\s*<normal-notes>2<\/normal-notes>\s*<\/time-modification>/.test(n) &&
      /<duration>8<\/duration>/.test(n);
    if (isQuarterTriplet) {
      n = n.replace(/<duration>8<\/duration>/, '<duration>12</duration>');
      n = n.replace(/\s*<time-modification>[\s\S]*?<\/time-modification>/, '');
    }
    n = n.replace(/\s*<tuplet\b[^>]*>\s*<\/tuplet>/g, '');
    n = n.replace(/\s*<tuplet\b[^>]*\/>/g, '');
    n = n.replace(/\s*<notations>\s*<\/notations>/g, '');
    return n;
  });
}

// m25 (global) first note: the printed page shows E-natural, tied from m24's
// explicit E-natural. The Audiveris source exports it with no <alter> (= natural);
// normalizeLeadMeasure resets accidentals per measure and re-applies the Gb-major
// key signature, flatting it to Eb and manufacturing a cross-pitch tie (E♮ -> E♭).
// Restore the first pitched note to E-natural so the tie joins identical pitches.
function fixLeadTieStopNatural(measureXml) {
  let patched = false;
  return measureXml.replace(/<note\b[\s\S]*?<\/note>/g, (note) => {
    if (patched || !/<pitch>/.test(note) || !/<step>E<\/step>/.test(note)) return note;
    patched = true;
    let n = note.replace(/\s*<alter>-1<\/alter>/, '');
    if (/<accidental>[^<]*<\/accidental>/.test(n)) {
      n = n.replace(/<accidental>[^<]*<\/accidental>/, '<accidental>natural</accidental>');
    } else {
      n = n.replace(/(<type>[a-z]+<\/type>)/, '$1\n        <accidental>natural</accidental>');
    }
    return n;
  });
}

// Baritone (Oliver) printed bar 19 (generated m17): Audiveris read 7 of the bar's
// 8 eighth notes (Db4 C4 Db4 Db4 Db4 Db4 C4 = 42 ticks). The three homophonic
// voices that parsed cleanly prove 8 eighths; the dropped note is the bar's
// dominant Db4 (the two C4 lower-neighbors sit at beats 2 and 7, so the symmetric
// completion is a closing Db4). Append one Db4 eighth at the measure's own
// division (6 ticks at LCM 12, 3 ticks at native div 6).
function fixBaritoneBar19(measureXml) {
  if (/<note\b[\s\S]*?<\/note>\s*<\/measure>/.test(measureXml) === false) return measureXml;
  const dur = (measureXml.match(/<note\b[\s\S]*?<duration>(\d+)<\/duration>/) || [])[1] || '6';
  const eighth =
    `      <note>\n` +
    `        <pitch>\n          <step>D</step>\n          <alter>-1</alter>\n          <octave>4</octave>\n        </pitch>\n` +
    `        <duration>${dur}</duration>\n        <voice>1</voice>\n        <type>eighth</type>\n      </note>\n`;
  return measureXml.replace(/(\n?\s*)<\/measure>\s*$/, `\n${eighth}    </measure>`);
}

// Two half-notes in one bar (for homophonic 2-note bars Audiveris dropped, e.g.
// baritone "hop-ing"). duration = full-measure ticks; each half = duration/2.
function twoHalfMeasure({ number, width, notes, duration }) {
  const half = duration / 2;
  const noteXml = (n) => `      <note>
        <pitch>
          <step>${n.step}</step>
${n.alter == null ? '' : `          <alter>${n.alter}</alter>\n`}          <octave>${n.octave}</octave>
        </pitch>
        <duration>${half}</duration>
        <voice>1</voice>
        <type>half</type>
      </note>`;
  return `    <measure number="${number}" width="${width}">
${noteXml(notes[0])}
${noteXml(notes[1])}
    </measure>`;
}

export function applyLeadMeasureCorrections(page, measures, options = {}) {
  const part = options.part || 'Lead';
  const divisions = options.divisions || (page === '197' ? 6 : 12);
  const fullMeasureDuration = divisions * 4;

  const out = [];
  for (const measure of measures) {
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];

    // De-tripletize the two under-read tuplet bars (global m16 = p197 local 6,
    // global m18 = p197 local 8). Verified 4-beat against the homophonic voices.
    if (page === '197' && part === 'Lead' && (number === '6' || number === '8')) {
      out.push(deTripletizeQuarterTriplets(measure));
      continue;
    }
    // Restore global m25 (p198 local 4) first note to E-natural (kills the cross-pitch tie).
    if (page === '198' && part === 'Lead' && number === '4') {
      out.push(fixLeadTieStopNatural(measure));
      continue;
    }

    // ── Baritone (Oliver) held-bar inserts + bar-19 rhythm fix ──────────────────
    // Audiveris dropped Oliver's phrase-end held whole notes entirely (printed bars
    // 9 "shy", 13 "chime", 21 "name") and under-read printed bar 19 by one eighth.
    // Held pitches read from the printed page (the source has no copy of these bars
    // to defer to); octaves kept in Oliver's 3-4 range. chime = Cb4 is the contract's
    // named value; shy = F3 and name = Cb4 are page-image reads (flagged for review).
    if (page === '196' && part === 'Baritone' && number === '8') {
      out.push(measure);                                                          // printed bar 8
      out.push(wholeNoteMeasure({ number: '900', width: '131', step: 'F', octave: 3, duration: fullMeasureDuration })); // 9 "shy" = F3
      continue;
    }
    if (page === '197' && part === 'Baritone' && number === '3') {
      out.push(measure);                                                          // printed bar 12
      out.push(wholeNoteMeasure({ number: '913', width: '131', step: 'C', alter: -1, octave: 4, duration: fullMeasureDuration })); // 13 "chime" = Cb4
      continue;
    }
    if (page === '197' && part === 'Baritone' && number === '9') {
      out.push(fixBaritoneBar19(measure));                                        // printed bar 19: 7 -> 8 eighths
      continue;
    }
    if (page === '197' && part === 'Baritone' && number === '10') {
      out.push(measure);                                                          // printed bar 20
      out.push(wholeNoteMeasure({ number: '921', width: '131', step: 'C', alter: -1, octave: 4, duration: fullMeasureDuration })); // 21 "name" = Cb4
      continue;
    }

    // Restore the 3 baritone bars Audiveris dropped to SILENCE (Oliver sings; the
    // gate passed them as full-rests). These REPLACE the empty source measures.
    //   bar 5  "sky"     = F3   — same Cb4-Lead cadence as "shy" (HIGH confidence)
    //   bar 25 "hop-ing" = Db4, Bb3 — chord C#m→Eb; Bb3 completes the Eb triad (HIGH),
    //                                 Db4 root-doubles the C#m (MODERATE — verify)
    //   bar 29 "fine"    = Eb3  — doubles the Lead's held Eb4 an octave down (MODERATE — verify)
    if (page === '196' && part === 'Baritone' && number === '5') {
      out.push(wholeNoteMeasure({ number: '905', width: '129', step: 'F', octave: 3, duration: fullMeasureDuration }));
      continue;
    }
    if (page === '198' && part === 'Baritone' && number === '4') {
      out.push(twoHalfMeasure({ number: '925', width: '208', notes: [{ step: 'D', alter: -1, octave: 4 }, { step: 'B', alter: -1, octave: 3 }], duration: fullMeasureDuration }));
      continue;
    }
    if (page === '198' && part === 'Baritone' && number === '8') {
      out.push(wholeNoteMeasure({ number: '929', width: '126', step: 'E', alter: -1, octave: 3, duration: fullMeasureDuration }));
      continue;
    }

    if (page === '198' && part === 'Lead' && number === '8') {
      out.push(wholeNoteMeasure({
        number: '8',
        width: '126',
        step: 'E',
        alter: -1,
        octave: 4,
        duration: fullMeasureDuration,
      }));
      continue;
    }

    if (page === '198' && part === 'Lead' && number === '13') {
      out.push(addBar34TransitionSlide(measure));
      continue;
    }

    if (page === '198' && part === 'Lead' && number === '14') {
      out.push(transitionMeasure35({ duration: fullMeasureDuration }));
      continue;
    }

    if (page === '197' && part === 'Lead' && number === '4') {
      out.push(wholeNoteMeasure({
        number: '4',
        width: '338',
        step: 'C',
        alter: -1,
        octave: 4,
        duration: fullMeasureDuration,
      }));
    }

    out.push(measure);
    if (page === '197' && part === 'Lead' && number === '10') {
      out.push(wholeNoteMeasure({
        number: '11',
        width: '131',
        step: 'C',
        alter: -1,
        octave: 4,
        duration: fullMeasureDuration,
      }));
    }
    if (page === '196' && part === 'Lead' && number === '8') {
      out.push(wholeNoteMeasure({
        number: '9',
        width: '131',
        step: 'C',
        alter: -1,
        octave: 4,
        duration: fullMeasureDuration,
      }));
    }
  }
  return out;
}
