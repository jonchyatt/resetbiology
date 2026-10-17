// Flag-gated operator line for /privacy and /terms. Off until Jonathan confirms the
// Satori Enterprises, Inc. link to Reset Biology (approvals/2026-10-17-operator-line-legal-pages.md).
export const OPERATOR_NAME = 'Satori Enterprises, Inc.'

export function operatorLineText(flag: string | undefined = process.env.NEXT_PUBLIC_OPERATOR_LINE): string | null {
  return flag === 'on' ? `Reset Biology is operated by ${OPERATOR_NAME}` : null
}
