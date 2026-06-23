// Independent printed-score audit points for Lida Rose Lead (Ewart).
// These are read from public/score/page-196.jpg and page-197.jpg crops, not
// derived from the Audiveris note stream. Keep this small and explicit: it is
// the guardrail for the places where OMR has already lied to us.

export const LEAD_SCORE_VERSION = 'lida-rose-lead-six-flat-115';
export const EXPECTED_LEAD_NOTE_COUNT = 115;
export const LEAD_PAGE_BOUNDARIES = [
  { page: 196, measureStart: 1, measureEnd: 9 },
  { page: 197, measureStart: 10, measureEnd: 20 },
  { page: 198, measureStart: 21, measureEnd: Infinity },
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
];

export function pageForLeadMeasure(measure) {
  return LEAD_PAGE_BOUNDARIES.find((boundary) => (
    measure >= boundary.measureStart && measure <= boundary.measureEnd
  ))?.page ?? null;
}
