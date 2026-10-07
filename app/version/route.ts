import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? 'unknown',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  })
}
