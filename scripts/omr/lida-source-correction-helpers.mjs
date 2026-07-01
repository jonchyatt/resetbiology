export function pitchedNote({
  step,
  alter = null,
  octave,
  duration,
  type,
  dots = 0,
  accidental = null,
  tie = null,
  tied = null,
  fermata = false,
  voice = 1,
}) {
  const alterXml = alter == null ? '' : `          <alter>${alter}</alter>\n`;
  const accidentalXml = accidental ? `        <accidental>${accidental}</accidental>\n` : '';
  const tieXml = tie ? `        <tie type="${tie}"/>\n` : '';
  const dotXml = '        <dot/>\n'.repeat(dots);
  const notations = [];
  if (tied) notations.push(`          <tied type="${tied}"></tied>`);
  if (fermata) notations.push('          <fermata type="upright"></fermata>');
  const notationsXml = notations.length
    ? `        <notations>\n${notations.join('\n')}\n        </notations>\n`
    : '';

  return `      <note>
        <pitch>
          <step>${step}</step>
${alterXml}          <octave>${octave}</octave>
        </pitch>
        <duration>${duration}</duration>
${tieXml}        <voice>${voice}</voice>
        <type>${type}</type>
${dotXml}${accidentalXml}${notationsXml}      </note>`;
}

export function restNote({ duration, type, measure = false, voice = 1 }) {
  return `      <note>
        <rest${measure ? ' measure="yes"' : ''}/>
        <duration>${duration}</duration>
        <voice>${voice}</voice>
        <type>${type}</type>
      </note>`;
}

export function measureXml({ number, width = 200, attributes = '', print = '', notes }) {
  const printXml = print ? `\n      ${print}` : '';
  const attributesXml = attributes ? `\n      ${attributes}` : '';
  return `    <measure number="${number}" width="${width}">${printXml}${attributesXml}
${notes.join('\n')}
    </measure>`;
}

export function wholeNoteMeasure({ number, width = 200, step, alter = null, octave, duration }) {
  return measureXml({
    number,
    width,
    notes: [pitchedNote({ step, alter, octave, duration, type: 'whole' })],
  });
}

export function twoHalfMeasure({ number, width = 200, notes, duration }) {
  const half = duration / 2;
  return measureXml({
    number,
    width,
    notes: notes.map((note) => pitchedNote({ ...note, duration: half, type: 'half' })),
  });
}

export function transitionHalfThenRest({
  number = '35',
  width = 240,
  step,
  alter = null,
  octave,
  duration,
  accidental = null,
}) {
  const half = duration / 2;
  return measureXml({
    number,
    width,
    print: '<print new-system="yes"/>',
    attributes: `<attributes>
        <key>
          <fifths>1</fifths>
        </key>
        <time symbol="common">
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
      </attributes>`,
    notes: [
      pitchedNote({
        step,
        alter,
        octave,
        duration: half,
        type: 'half',
        tie: 'stop',
        tied: 'stop',
        accidental,
      }),
      restNote({ duration: half, type: 'half' }),
    ],
  });
}

export function addLeadingQuarterRest(measureXmlText, divisions) {
  if (/<note\b[\s\S]*?<rest\b/.test(measureXmlText)) return measureXmlText;
  return measureXmlText.replace(
    /(<measure\b[^>]*>\s*)/,
    `$1\n${restNote({ duration: divisions, type: 'quarter' })}\n`,
  );
}

export function deTripletizeQuarterTriplets(measureXmlText, divisions) {
  const tripletQuarterDuration = Math.round((divisions * 2) / 3);
  return measureXmlText.replace(/<note\b[\s\S]*?<\/note>/g, (note) => {
    let out = note;
    const isQuarterTriplet =
      /<type>quarter<\/type>/.test(out) &&
      new RegExp(`<duration>${tripletQuarterDuration}<\\/duration>`).test(out) &&
      /<time-modification>\s*<actual-notes>3<\/actual-notes>\s*<normal-notes>2<\/normal-notes>\s*<\/time-modification>/.test(out);
    if (isQuarterTriplet) {
      out = out.replace(new RegExp(`<duration>${tripletQuarterDuration}<\\/duration>`), `<duration>${divisions}</duration>`);
      out = out.replace(/\s*<time-modification>[\s\S]*?<\/time-modification>/, '');
    }
    out = out.replace(/\s*<tuplet\b[^>]*>\s*<\/tuplet>/g, '');
    out = out.replace(/\s*<tuplet\b[^>]*\/>/g, '');
    out = out.replace(/\s*<notations>\s*<\/notations>/g, '');
    return out;
  });
}

export function addTieStartToLastPitchedNote(measureXmlText) {
  const notes = [...measureXmlText.matchAll(/<note\b[\s\S]*?<\/note>/g)].map((m) => m[0]);
  const lastPitched = [...notes].reverse().find((note) => /<pitch>/.test(note) && !/<rest\b/.test(note));
  if (!lastPitched) return measureXmlText;
  let patched = lastPitched;
  if (!/<tie type="start"\/>/.test(patched)) {
    patched = patched.replace(/(\s*<voice>)/, '\n        <tie type="start"/>$1');
  }
  if (!/<tied[^>]*type="start"/.test(patched)) {
    patched = patched.replace(/\s*<\/note>$/, '\n        <notations>\n          <tied type="start"></tied>\n        </notations>\n      </note>');
  }
  return measureXmlText.replace(lastPitched, patched);
}
