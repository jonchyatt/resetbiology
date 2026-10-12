import type { ReactNode } from 'react'
import { parkCommercePage } from '@/lib/commerce'
export const dynamic = 'force-dynamic'
export default async function Layout({ children }: { children: ReactNode }) {
  await parkCommercePage()
  return <>{children}</>
}
