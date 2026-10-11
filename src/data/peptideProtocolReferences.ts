export interface PeptideProtocolReference {
  id: string;
  name: string;
  purpose: string;
  doseRange: string;
  vialAmount: string;
  reconstitution: string;
  timing: string;
  frequency: string;
  duration: string;
  source: string;
  sourcePath: string;
}

// These are source-attributed protocol references from the existing peptide
// education corpus. They are not individualized recommendations.
export const peptideProtocolReferences: PeptideProtocolReference[] = [
  {
    id: "reference-bpc-157",
    name: "BPC-157",
    purpose: "Healing",
    doseRange: "250–750 mcg",
    vialAmount: "10 mg",
    reconstitution: "3 mL",
    timing: "AM/PM",
    frequency: "Every day",
    duration: "8 weeks on, 8 weeks off",
    source: "Hunter Williams + Jay Campbell Cheat Sheet 2023",
    sourcePath: "src/data/peptide-education/bpc-157.json",
  },
  {
    id: "reference-ipamorelin",
    name: "Ipamorelin",
    purpose: "Fat Loss",
    doseRange: "200–400 mcg",
    vialAmount: "12 mg",
    reconstitution: "3 mL",
    timing: "AM/PM",
    frequency: "5 days on, 2 days off",
    duration: "8 weeks on, 8 weeks off",
    source: "Hunter Williams + Jay Campbell Cheat Sheet 2023",
    sourcePath: "src/data/peptide-education/ipamorelin.json",
  },
  {
    id: "reference-semaglutide",
    name: "Semaglutide",
    purpose: "Fat Loss",
    doseRange: "0.25–2 mg",
    vialAmount: "3 mg",
    reconstitution: "2 mL",
    timing: "AM",
    frequency: "Once per week",
    duration: "8 weeks on, 8 weeks off",
    source: "Hunter Williams + Jay Campbell Cheat Sheet 2023",
    sourcePath: "src/data/peptide-education/semaglutide.json",
  },
  {
    id: "reference-tirzepatide",
    name: "Tirzepatide",
    purpose: "Fat Loss",
    doseRange: "2.5–15 mg",
    vialAmount: "10 mg",
    reconstitution: "1 mL",
    timing: "AM",
    frequency: "Once per week",
    duration: "8 weeks on, 8 weeks off",
    source: "Hunter Williams + Jay Campbell Cheat Sheet 2023",
    sourcePath: "src/data/peptide-education/tirzepatide.json",
  },
  {
    id: "reference-retatrutide",
    name: "Retatrutide",
    purpose: "Metabolic",
    doseRange: "1–12 mg",
    vialAmount: "10 mg",
    reconstitution: "1 mL",
    timing: "As documented by source",
    frequency: "As documented by source",
    duration: "As documented by source",
    source: "Hunter Williams corpus references",
    sourcePath: "src/data/peptide-education/retatrutide.json",
  },
];
