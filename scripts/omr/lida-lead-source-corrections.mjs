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

export function applyLeadMeasureCorrections(page, measures, options = {}) {
  const part = options.part || 'Lead';
  const divisions = options.divisions || (page === '197' ? 6 : 12);
  const fullMeasureDuration = divisions * 4;

  const out = [];
  for (const measure of measures) {
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];

    if (page === '197' && part === 'Lead' && number === '4') {
      out.push(wholeNoteMeasure({
        number: '4',
        width: '338',
        step: 'B',
        alter: -1,
        octave: 3,
        duration: fullMeasureDuration,
      }));
      continue;
    }

    out.push(measure);
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
