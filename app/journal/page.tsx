import { redirect } from "next/navigation"

export const metadata = {
  title: "Daily History",
  description: "Review your daily journal, peptides, nutrition, workouts, breath practice, and mindset modules in one place.",
}

export default function JournalPage() {
  redirect('/daily-history')
}
