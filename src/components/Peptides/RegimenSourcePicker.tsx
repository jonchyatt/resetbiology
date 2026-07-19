"use client";

// Renders each cited dosing regimen for a library peptide as a selectable
// source, and exposes the citation-grounded dose value(s) it contains.
// CITATION-GROUNDED DOSING CONTRACT: a tappable dose value is shown ONLY when
// the regimen's own structured dose_value is set (verbatim, never scraped
// from free text) AND is_range_or_multi is false. Free-text quotes are never
// number-scraped — a range/multi or dose_value-null regimen shows the quote
// + citation only, dose is left for manual entry. (Verifier S1, 2026-07-18:
// the prior regex-based extractDoseChips scraped peptide-name digits,
// durations, and frequencies out of quotes and presented them as cited
// doses — deleted, not patched.)
import type { PeptideCard, StructuredRegimen } from "@/data/peptide-education/generated";

export type AdministrationType = "injection" | "oral" | "nasal" | "topical";

// mg<->mcg is the only conversion this app defines (existing ×1000
// convention, reused from DosageCalculator's calculateDosage). IU has no
// defined conversion — callers must pass it through verbatim.
export function formatUnitConversion(value: number, unit: "mg" | "mcg" | "iu" | null): string | null {
  if (unit === "mg") return `= ${(value * 1000).toLocaleString()} mcg`;
  if (unit === "mcg") return `= ${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} mg`;
  return null;
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
          // Structured-value gate only — no free-text scraping. See
          // CITATION-GROUNDED DOSING CONTRACT above.
          const hasCitableDose = r.dose_value != null && !r.is_range_or_multi;
          const unit = r.dose_unit === "mg" || r.dose_unit === "mcg" ? r.dose_unit : null;
          const conversion = hasCitableDose ? formatUnitConversion(r.dose_value as number, r.dose_unit) : null;
          return (
            <div key={i} className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-600/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-300 font-medium">{r.speaker || r.source_expert || "Unknown source"}</span>
                {hasCitableDose && (
                  <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => onSelectDose(r.dose_value as number, unit)}
                      className="bg-amber-300/30 hover:bg-amber-300/50 text-amber-100 border border-amber-200/40 px-2.5 py-1 rounded-md font-semibold transition-all"
                    >
                      Use {r.dose_value}{r.dose_unit ?? ""}
                    </button>
                    {conversion && <span className="text-amber-300/50">{conversion}</span>}
                  </div>
                )}
              </div>
              <p className="text-gray-400 leading-snug">&ldquo;{r.quote}&rdquo;</p>
              {!hasCitableDose && (
                <p className="text-gray-500 italic">cited, no single dose value — enter your own</p>
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
