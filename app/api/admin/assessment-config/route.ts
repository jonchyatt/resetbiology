import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { requireAdmin } from '@/lib/adminGuard'
import { AssessmentConfig, defaultAssessmentConfig } from '@/config/assessmentConfig'

const CONFIG_PATH = path.join(process.cwd(), 'data', 'assessment-config.json')

async function readConfig(): Promise<AssessmentConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as AssessmentConfig
    if (!parsed.questions || parsed.questions.length === 0) {
      return { ...defaultAssessmentConfig, updatedAt: new Date().toISOString() }
    }
    return parsed
  } catch (error) {
    return { ...defaultAssessmentConfig, updatedAt: new Date().toISOString() }
  }
}

export async function GET() {
  await requireAdmin('/admin/assessments')
  const config = await readConfig()
  return NextResponse.json(config)
}

export async function PUT(request: Request) {
  await requireAdmin('/admin/assessments')

  try {
    const body = (await request.json()) as AssessmentConfig
    const configToSave: AssessmentConfig = {
      ...body,
      updatedAt: new Date().toISOString(),
    }
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
    await fs.writeFile(CONFIG_PATH, JSON.stringify(configToSave, null, 2), 'utf-8')
    return NextResponse.json(configToSave)
  } catch (error) {
    console.error('Failed to save assessment config', error)
    return NextResponse.json({ error: 'Unable to save config' }, { status: 500 })
  }
}
