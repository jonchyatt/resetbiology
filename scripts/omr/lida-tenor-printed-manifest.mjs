export const TENOR_SCORE_VERSION = 'lida-rose-tenor-six-flat-115-unverified';
export const EXPECTED_TENOR_NOTE_COUNT = 115;
export const TENOR_PAGE_BOUNDARIES = [
  { page: 196, measureStart: 1, measureEnd: 9 },
  { page: 197, measureStart: 10, measureEnd: 21 },
  { page: 198, measureStart: 22, measureEnd: 34 },
  { page: 199, measureStart: 35, measureEnd: Infinity },
];

export const TENOR_SECTION_TRANSITIONS = [
  {
    fromMeasure: 34,
    toMeasure: 35,
    source: 'page-198 bar 34 into page-199 bar 35',
    nextPage: 199,
    nextKeyFifths: 1,
    detail: 'D4 holds into the next G-major section for two beats',
  },
];

export const PRINTED_TENOR_AUDIT_MEASURES = [
  { measure: 5, source: 'page-196 Jacey lyric "sky"', notes: [{ pitch: 'F4', beats: 4, type: 'whole' }] },
  { measure: 9, source: 'page-196 Jacey lyric "shy"', notes: [{ pitch: 'F4', beats: 4, type: 'whole' }] },
  { measure: 13, source: 'page-197 Jacey lyric "chime"', notes: [{ pitch: 'Gb4', beats: 4, type: 'whole' }] },
  { measure: 21, source: 'page-197 Jacey lyric "name"', notes: [{ pitch: 'F4', beats: 4, type: 'whole' }] },
  { measure: 29, source: 'page-198 Jacey lyric "fine"', notes: [{ pitch: 'G4', beats: 4, type: 'whole' }] },
  {
    measure: 35,
    source: 'page-199 Jacey held transition',
    notes: [{ pitch: 'D4', beats: 2, type: 'half' }],
    requiredXml: ['<fifths>1</fifths>', '<tie type="stop"/>', '<tied type="stop"></tied>'],
  },
];

export function pageForTenorMeasure(measure) {
  return TENOR_PAGE_BOUNDARIES.find((boundary) => (
    measure >= boundary.measureStart && measure <= boundary.measureEnd
  ))?.page ?? null;
}
