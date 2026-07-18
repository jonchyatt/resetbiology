"use client";

// Renders each cited dosing regimen for a library peptide as a selectable
// source, and exposes the citation-grounded dose value(s) it contains.
// CITATION-GROUNDED DOSING CONTRACT: every value shown here is either the
// regimen's own dose_value (verbatim) or a number found verbatim inside its
// quote — never computed, averaged, or invented.
import type { PeptideCard, StructuredRegimen } from "@/data/peptide-education/generated";

export type AdministrationType = "injection" | "oral" | "nasal" | "topical";

export interface DoseChip {
  value: number;
  unit: "mg" | "mcg" | null;
  raw: string;
}

// ponytail: digit-based numbers only (e.g. "250 mcg", "0.5 milligrams").
// Spelled-out numbers ("one milligram") are not extracted — no chip beats a
// wrong chip; the quote is still shown verbatim for the user to read.
const NUMBER_UNIT_RE = /(\d+(?:\.\d+)?)\s*(mcg|micrograms?|mg|milligrams?|iu|units?)?/gi;

export function extractDoseChips(quote: string, doseUnit: StructuredRegimen["dose_unit"]): DoseChip[] {
  if (!quote) return [];
  const chips: DoseChip[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  NUMBER_UNIT_RE.lastIndex = 0;
  while ((match = NUMBER_UNIT_RE.exec(quote))) {
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const wordUnit = match[2]?.toLowerCase();
    let unit: "mg" | "mcg" | null = doseUnit === "mg" || doseUnit === "mcg" ? doseUnit : null;
    if (!unit && wordUnit) {
      if (wordUnit.startsWith("mcg") || wordUnit.startsWith("micro")) unit = "mcg";
      else if (wordUnit.startsWith("mg") || wordUnit.startsWith("milli")) unit = "mg";
    }
    const key = `${value}-${unit ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ value, unit, raw: match[0].trim() });
    if (chips.length >= 6) break;
  }
  return chips;
}

const ROUTE_PATTERNS: Array<{ type: AdministrationType; re: RegExp }> = [
  { type: "injection", re: /\b(subq|sub-q|subcutaneous(?:ly)?|intramuscular(?:ly)?|\bim\b|injectable|injected|injection)\b/i },
  { type: "oral", re: /\b(oral(?:ly)?|capsule|tablet)\b/i },
  { type: "nasal", re: /\b(nasal|intranasal)\b/i },
  { type: "topical", re: /\b(topical(?:ly)?|transdermal|cream|gel)\b/i },
];

// Auto-maps administrationType ONLY from an unambiguous route citation
// (exactly one route keyword class present). Ambiguous ("inject it or take
// orally") or unrecognized quotes are skipped — left for the user to pick.
export function mapRouteToAdministrationType(regimens: StructuredRegimen[]): AdministrationType | null {
  for (const r of regimens) {
    if (r.field !== "route" || !r.quote) continue;
    const matches = ROUTE_PATTERNS.filter((p) => p.re.test(r.quote));
    if (matches.length === 1) return matches[0].type;
  }
  return null;
}

const URL_RE = /https?:\/\/[^\s\]\)]+/;

function CitationRef({ citation }: { citation: string }) {
  const urlMatch = citation.match(URL_RE);
  if (!urlMatch) {
    return <span className="text-amber-300/60 italic">{citation || "uncited"}</span>;
  }
  const url = urlMatch[0];
  const before = citation.slice(0, urlMatch.index);
  const after = citation.slice((urlMatch.index ?? 0) + url.length);
  return (
    <span className="text-amber-300/60 italic">
      {before}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200 underline not-italic">
        source
      </a>
      {after}
    </span>
  );
}

export interface RegimenSourcePickerProps {
  card: PeptideCard | null;
  loading: boolean;
  onSelectDose: (value: number, unit: "mg" | "mcg" | null) => void;
}

export function RegimenSourcePicker({ card, loading, onSelectDose }: RegimenSourcePickerProps) {
  if (loading) {
    return (
      <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-400 border border-gray-600/20">
        Loading cited dosing sources…
      </div>
    );
  }
  if (!card) return null;

  const doseRegimens = card.structured_regimens.filter((r) => r.field === "dose");

  if (doseRegimens.length === 0) {
    return (
      <div className="bg-gray-800/40 rounded-lg p-3 text-xs text-gray-300 border border-gray-600/20">
        No established dose in our sources for {card.peptide} — enter your own.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-amber-300/80 font-medium">Cited dosing sources — pick one, then edit freely</p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
        {doseRegimens.map((r, i) => {
          const chips = r.dose_value == null && r.is_range_or_multi ? extractDoseChips(r.quote, r.dose_unit) : [];
          return (
            <div key={i} className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-600/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-300 font-medium">{r.speaker || r.source_expert || "Unknown source"}</span>
                {r.dose_value != null && (
                  <button
                    type="button"
                    onClick={() => onSelectDose(r.dose_value as number, r.dose_unit === "mg" || r.dose_unit === "mcg" ? r.dose_unit : null)}
                    className="flex-shrink-0 bg-amber-300/30 hover:bg-amber-300/50 text-amber-100 border border-amber-200/40 px-2.5 py-1 rounded-md font-semibold transition-all"
                  >
                    Use {r.dose_value}{r.dose_unit ?? ""}
                  </button>
                )}
              </div>
              <p className="text-gray-400 leading-snug">&ldquo;{r.quote}&rdquo;</p>
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c, ci) => (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => onSelectDose(c.value, c.unit)}
                      className="bg-amber-300/15 hover:bg-amber-300/35 text-amber-200 border border-amber-200/30 px-2 py-0.5 rounded font-medium transition-all"
                    >
                      {c.raw}
                    </button>
                  ))}
                </div>
              )}
              {r.dose_value == null && chips.length === 0 && (
                <p className="text-gray-500 italic">cited, no extractable number — enter your own</p>
              )}
              <div className="pt-0.5 border-t border-gray-700/50 mt-1">
                <CitationRef citation={r.citation} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
