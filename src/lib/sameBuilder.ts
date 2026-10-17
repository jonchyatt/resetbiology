// "From the same builder" link-outs. Off unless NEXT_PUBLIC_RB_SAME_BUILDER is
// exactly 'true' AND NEXT_PUBLIC_RB_SAME_BUILDER_URL is an https URL. Both are
// read as literals so Next inlines them at build time. The public domain is
// Jonathan's call, so no URL is hardcoded here.
export function resolveSameBuilderUrl(flag: string | undefined, url: string | undefined): string | null {
  if (flag !== 'true') return null
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

export const sameBuilderUrl = resolveSameBuilderUrl(
  process.env.NEXT_PUBLIC_RB_SAME_BUILDER,
  process.env.NEXT_PUBLIC_RB_SAME_BUILDER_URL,
)
