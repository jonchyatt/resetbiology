export type BarcodeKind = 'upc-a' | 'ean-13';

export function normalizeBarcode(input: string): { code: string; kind: BarcodeKind } | null {
  const raw = input.trim().replace(/[\s-]/g, '');
  if (!/^\d+$/.test(raw)) return null;
  if (raw.length === 12 && validCheckDigit(raw)) return { code: raw, kind: 'upc-a' };
  if (raw.length === 13 && validCheckDigit(raw)) return { code: raw, kind: 'ean-13' };
  if (raw.length === 11) {
    const upc = `0${raw}`;
    return validCheckDigit(upc) ? { code: upc, kind: 'upc-a' } : null;
  }
  if (raw.length === 12) {
    const ean = `0${raw}`;
    return validCheckDigit(ean) ? { code: ean, kind: 'ean-13' } : null;
  }
  return null;
}

export function validCheckDigit(code: string): boolean {
  if (!/^\d{12,13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reduce((total, digit, index) => {
    const fromRight = digits.length - index;
    return total + digit * (fromRight % 2 === 1 ? 3 : 1);
  }, 0);
  return (10 - (sum % 10)) % 10 === check;
}
