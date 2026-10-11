import type { MetadataRoute } from 'next'
import { listPeptideSlugs } from '@/data/peptide-education/generated'
import { listGuruSlugs } from '@/data/gurus/generated'

const BASE = 'https://resetbiology.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/', '/get-started', '/process', '/education', '/education/peptides', '/education/gurus', '/contact', '/privacy', '/terms',
    ...listPeptideSlugs().map((s) => `/education/peptides/${s}`),
    ...listGuruSlugs().map((s) => `/education/gurus/${s}`),
  ]
  return paths.map((p) => ({ url: `${BASE}${p}` }))
}
