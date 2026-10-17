import type { MetadataRoute } from 'next'
import { listPeptideSlugs } from '@/data/peptide-education/generated'
import { listGuruSlugs } from '@/data/gurus/generated'
import { TOOL_PAGES, TOOL_PAGES_ENABLED } from '@/config/toolPages'

const BASE = 'https://resetbiology.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/', '/get-started', '/process', '/education', '/education/peptides', '/education/gurus', '/contact', '/privacy', '/terms',
    ...listPeptideSlugs().map((s) => `/education/peptides/${s}`),
    ...listGuruSlugs().map((s) => `/education/gurus/${s}`),
    ...(TOOL_PAGES_ENABLED ? TOOL_PAGES.map((t) => `/tools/${t.slug}`) : []),
  ]
  return paths.map((p) => ({ url: `${BASE}${p}` }))
}
