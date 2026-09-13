import { notFound } from 'next/navigation'
import Gradesheet from './Gradesheet'

export const metadata = {
  title: 'Pitchforks III procedure gradesheet',
}

export default function ProcedureGradesheetPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return <Gradesheet />
}
