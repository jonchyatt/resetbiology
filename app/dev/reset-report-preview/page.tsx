import { notFound } from 'next/navigation'
import { WeeklyResetReport } from '@/components/Reports/WeeklyResetReport'
import { syntheticResetReport } from '@/lib/weeklyResetReportFixture'

// Reads the weekly Reset report with synthetic data, no login and no database.
// 404 in production unless NEXT_PUBLIC_RB_REPORT_PREVIEW=1, so nothing public is added.
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

// privateText is dropped here because props to a client component are serialised into the page source.
const shareSafeReport = {
  ...syntheticResetReport,
  records: syntheticResetReport.records.map((record) => ({
    date: record.date,
    feature: record.feature,
    label: record.label,
    detail: record.detail,
  })),
}

export default function ResetReportPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_RB_REPORT_PREVIEW !== '1') notFound()

  return (
    <div className="min-h-screen bg-slate-900">
      <p className="mx-auto max-w-6xl px-4 pt-6 text-sm text-amber-200 print:hidden">
        Preview with made-up data. Nothing here is a real member record.
      </p>
      <WeeklyResetReport previewReport={shareSafeReport} />
    </div>
  )
}
