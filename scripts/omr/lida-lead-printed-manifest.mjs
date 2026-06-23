// Independent printed-score audit points for Lida Rose Lead (Ewart).
// These are read from public/score/page-196.jpg and page-197.jpg crops, not
// derived from the Audiveris note stream. Keep this small and explicit: it is
// the guardrail for the places where OMR has already lied to us.

export const LEAD_SCORE_VERSION = 'lida-rose-lead-six-flat-118';
export const EXPECTED_LEAD_NOTE_COUNT = 118;
export const LEAD_PAGE_BOUNDARIES = [
  { page: 196, measureStart: 1, measureEnd: 9 },
  { page: 197, measureStart: 10, measureEnd: 21 },
  { page: 198, measureStart: 22, measureEnd: 34 },
  { page: 199, measureStart: 35, measureEnd: Infinity },
];

export const LEAD_SECTION_TRANSITIONS = [
  {
    fromMeasure: 34,
    toMeasure: 35,
    source: 'page-198 bar 34 into page-199 bar 35',
    nextPage: 199,
    nextKeyFifths: 1,
    nextTime: 'common',
    trainingTarget: true,
    detail: 'same B-natural held into the next section for two beats',
  },
];

export const PRINTED_LEAD_AUDIT_MEASURES = [
  {
    measure: 9,
    source: 'page-196 Ewart end of first Lida Rose system, lyric "shy"',
    notes: [{ pitch: 'Cb4', beats: 4, type: 'whole' }],
  },
  {
    measure: 13,
    source: 'page-197 Ewart end of chapel-bell system, lyric "chime"',
    notes: [{ pitch: 'Cb4', beats: 4, type: 'whole' }],
  },
  {
    measure: 14,
    source: 'page-197 Ewart second system, lyrics "Ding, dong"',
    notes: [
      { pitch: 'Bb3', beats: 2, type: 'half' },
      { pitch: 'Gb3', beats: 2, type: 'half' },
    ],
  },
  {
    measure: 15,
    source: 'page-197 Ewart second system, lyric "ding, at the"',
    notes: [
      { pitch: 'C4', beats: 3, type: 'half', dots: 1 },
      { pitch: 'Ab3', beats: 0.5, type: 'eighth' },
      { pitch: 'Gb3', beats: 0.5, type: 'eighth' },
    ],
  },
  {
    measure: 21,
    source: 'page-197 Ewart end of sweetheart system, lyric "name"',
    notes: [{ pitch: 'Cb4', beats: 4, type: 'whole' }],
  },
  {
    measure: 29,
    source: 'page-198 Ewart second system, lyric "fine"',
    notes: [{ pitch: 'Eb4', beats: 4, type: 'whole' }],
  },
  {
    measure: 34,
    source: 'page-198 Ewart end of song into page-199 measure 35',
    notes: [
      { pitch: 'Bb3', beats: 2, type: 'half' },
      { pitch: 'B3', beats: 2, type: 'half' },
    ],
    requiredXml: [
      '<slide type="start" number="1" line-type="wavy"></slide>',
      '<slide type="stop" number="1" line-type="wavy"></slide>',
      '<tie type="start"/>',
      '<tied type="start"></tied>',
      '<fermata type="upright"',
    ],
  },
  {
    measure: 35,
    source: 'page-199 Ewart start of next section, held transition note',
    notes: [{ pitch: 'B3', beats: 2, type: 'half' }],
    requiredXml: [
      '<fifths>1</fifths>',
      '<time symbol="common">',
      '<tie type="stop"/>',
      '<tied type="stop"></tied>',
      '<accidental>natural</accidental>',
    ],
  },
];

export function pageForLeadMeasure(measure) {
  return LEAD_PAGE_BOUNDARIES.find((boundary) => (
    measure >= boundary.measureStart && measure <= boundary.measureEnd
  ))?.page ?? null;
}
