import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/auth/', '/test-session', '/portal-test', '/pitch-defender/crepe-benchmark', '/pitch-defender/note-entry', '/pitch-defender/staff-tester', '/pitch-defender/score-verify', '/pitch-defender/pitchforks-sprites', '/store', '/product/', '/subscription', '/order/energybits', '/order/non-peptide', '/pitch-defender/pitchforks', '/pitch-defender/pitchforks-2', '/pitch-defender/retro', '/pitch-defender/vocal-trainer', '/pitch-defender/vocal-trainer-2'],
    }],
    sitemap: 'https://resetbiology.com/sitemap.xml',
  }
}
