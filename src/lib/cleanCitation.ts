// Display-only scrub of machine citations in generated education text:
// library ids, YouTube ids, thread ids, raw URLs and the key name baseline_protocol.
// The stored data is untouched.
export function cleanCitation(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/,?\s*https?:\/\/[^\s),]+/g, '')
    .replace(/[a-z0-9]+(?:-+[a-z0-9]+)*-{2,3}[0-9a-f]{8}\b,?\s*/g, '')
    .replace(/\(([A-Za-z0-9_-]{11})\s+(?=\d{1,2}:\d)/g, '(')
    .replace(/\s*threadId[:=]?\s*[0-9a-f]{12,}/g, '')
    .replace(/baseline_protocol/g, 'baseline protocol')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/\(\s*\)/g, '')
    .replace(/\(\(/g, '(')
    .replace(/ {2,}/g, ' ');
}
