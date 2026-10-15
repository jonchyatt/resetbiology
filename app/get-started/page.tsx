import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth0 } from "@/lib/auth0"
import { GetStartedForm } from "@/components/GetStarted/GetStartedForm"

export const metadata: Metadata = { title: "Start free", description: "Create your free Reset Biology account: daily check-in, nutrition, breath and mind training, journal. No payment, ever.", alternates: { canonical: "/get-started" } }

export const dynamic = "force-dynamic"

export default async function GetStartedPage() {
  // Already signed in? Skip the intake entirely — never re-ask.
  const session = await auth0.getSession()
  if (session?.user) redirect("/portal")

  return <GetStartedForm />
}
