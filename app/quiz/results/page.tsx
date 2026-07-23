import { redirect } from "next/navigation"

// Old Auth0 returnTo target. Land finished users in the portal —
// never back at the quiz (the old localStorage check caused a login loop).
export default function QuizResultsPage() {
  redirect("/portal")
}
