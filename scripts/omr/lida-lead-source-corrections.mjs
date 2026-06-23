// Manual corrections for Lida Rose Lead (Ewart) where Audiveris missed visible
// source notation. These are page-image-derived patches, not audio guesses.

const P196_MISSING_FINAL_WHOLE_NOTE = `    <measure number="9" width="131">
      <note>
        <pitch>
          <step>C</step>
          <alter>-1</alter>
          <octave>4</octave>
        </pitch>
        <duration>48</duration>
        <voice>1</voice>
        <type>whole</type>
      </note>
    </measure>`;

export function applyLeadMeasureCorrections(page, measures) {
  if (page !== '196') return measures;

  const out = [];
  for (const measure of measures) {
    out.push(measure);
    const number = (measure.match(/<measure\b[^>]*number="([^"]+)"/) || [])[1];
    if (number === '8') out.push(P196_MISSING_FINAL_WHOLE_NOTE);
  }
  return out;
}
