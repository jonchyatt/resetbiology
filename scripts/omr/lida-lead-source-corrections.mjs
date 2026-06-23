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

export function applyLeadMeasureCorrections(page, measures, options = {}) {
  const part = options.part || 'Lead';
  const divisions = options.divisions || (page === '197' ? 6 : 12);
  const fullMeasureDuration = divisions * 4;

  const out = [];
  for (const measure of measures) {
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];

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
