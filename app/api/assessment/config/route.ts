import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { AssessmentConfig, defaultAssessmentConfig } from '@/config/assessmentConfig'

const CONFIG_PATH = path.join(process.cwd(), 'data', 'assessment-config.json')

async function readConfig(): Promise<AssessmentConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as AssessmentConfig
    if (!parsed.questions || parsed.questions.length === 0) {
      return { ...defaultAssessmentConfig }
    }
    return parsed
  } catch (_err) {
    return { ...defaultAssessmentConfig }
  }
}

export async function GET() {
  const config = await readConfig()
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } })
}
