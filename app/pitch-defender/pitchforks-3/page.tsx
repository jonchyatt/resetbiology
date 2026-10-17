'use client'

import dynamic from 'next/dynamic'
import styles from '@/components/PitchDefender/PitchforksPlayLayout.module.css'
import { BUILD_SHA } from '@/lib/buildIdentity'

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
      <span
        data-testid="pf3-build-identity"
        title={`Deployed build ${BUILD_SHA}`}
        aria-label={`Deployed build ${BUILD_SHA}`}
        className="pointer-events-none fixed bottom-1 right-1 z-[60] font-mono text-[8px] text-white/25"
      >
        build {BUILD_SHA}
      </span>
    </div>
  )
}
