'use client'

import dynamic from 'next/dynamic'
import styles from '@/components/PitchDefender/PitchforksPlayLayout.module.css'

const PitchforksIII = dynamic(
  () => import('@/components/PitchDefender/PitchforksIII'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#070914] flex items-center justify-center">
      <div className="text-cyan-200 text-lg font-medium animate-pulse" style={{ fontFamily: 'monospace' }}>
        CHARGING THE STORM...
      </div>
    </div>
  )}
)

export default function PitchforksIIIPage() {
  return (
    <div className={styles.playRoot}>
      <PitchforksIII />
    </div>
  )
}
