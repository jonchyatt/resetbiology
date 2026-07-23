import { redirect } from "next/navigation"

// Retired intake: /get-started is the one front door.
export default function AssessmentPage() {
  redirect("/get-started")
}
