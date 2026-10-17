import { BUILD_SHA } from '@/lib/buildIdentity'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { name: 'reset-biology', buildSha: BUILD_SHA },
    { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  )
}