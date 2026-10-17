// "At a glance" facts for the funder page. Every entry restates something already on the page
// and already in the application (docs/grants/VERIZON-WEBSITE-SECTION.md). Add no number that is
// not listed there; tests/funder-page.test.ts fails on any figure outside ALLOWED_FIGURES.

export const ALLOWED_FIGURES = ['$10,000', '1,200'] as const;

export const FUNDER_FACTS: { label: string; value: string; source: string }[] = [
  { label: 'Where', value: 'Saint George, Utah', source: 'Q30' },
  { label: 'Practice size', value: 'One-person anesthesia practice', source: 'Q30' },
  { label: 'People served', value: 'About 1,200 a year', source: 'Q14.2' },
  { label: 'Grant', value: '$10,000', source: 'Q29' },
  { label: 'Would buy', value: 'HIFEM chair and red-light therapy equipment', source: 'Q29, Q31' },
  { label: 'Who benefits', value: 'Free co-op members with perimenopausal symptoms', source: 'Q31' },
];
