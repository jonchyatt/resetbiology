// Independent source audit points for Lida Rose Baritone (Oliver).
// These are generated from the corrected Audiveris source staff map. Add
// page-image-derived corrections here when Oliver's printed line is visually
// audited the same way Ewart's Lead line was.

export const BARITONE_SCORE_VERSION = 'lida-rose-baritone-six-flat-106';
export const EXPECTED_BARITONE_NOTE_COUNT = 106;
export const BARITONE_PAGE_BOUNDARIES = [
  { page: 196, measureStart: 1, measureEnd: 8 },
  { page: 197, measureStart: 9, measureEnd: 18 },
  { page: 198, measureStart: 19, measureEnd: Infinity },
];

export const PRINTED_BARITONE_AUDIT_MEASURES = [
  {
    measure: 4,
    source: 'page-196 Oliver first active Lida Rose measure',
    notes: [
      { pitch: 'Cb4', beats: 1, type: 'quarter' },
      { pitch: 'Bb3', beats: 1, type: 'quarter' },
      { pitch: 'A3', beats: 1, type: 'quarter' },
      { pitch: 'Bb3', beats: 1, type: 'quarter' },
    ],
  },
  {
    measure: 9,
    source: 'page-197 Oliver chapel-bell system opening',
    notes: [
      { pitch: 'Cb4', beats: 2, type: 'half' },
      { pitch: 'Gb3', beats: 2, type: 'half' },
    ],
  },
  {
    measure: 18,
    source: 'page-197 Oliver end of sweetheart system',
    notes: [
      { pitch: 'Cb4', beats: 1, type: 'quarter' },
      { pitch: 'Cb4', beats: 1, type: 'quarter' },
      { pitch: 'A3', beats: 1, type: 'quarter' },
      { pitch: 'Bb3', beats: 1, type: 'quarter' },
    ],
  },
  {
    measure: 31,
    source: 'page-198 Oliver final active Lida Rose measure before page-turn residue',
    notes: [
      { pitch: 'Gb3', beats: 2, type: 'half' },
      { pitch: 'G3', beats: 2, type: 'half' },
    ],
  },
];

export function pageForBaritoneMeasure(measure) {
  const match = BARITONE_PAGE_BOUNDARIES.find((p) => measure >= p.measureStart && measure <= p.measureEnd);
  return match?.page ?? null;
}
