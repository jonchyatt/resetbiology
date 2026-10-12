import { redirect } from "next/navigation"
import { auth0 } from "@/lib/auth0"
import { ConnectDriveSetup } from "@/components/Vault/ConnectDriveSetup"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Vault Setup — Reset Biology",
  description:
    // src: RULING-2026-10-11 Drive option A
    "Optional: connect Google Drive to keep your own copy of your data, save progress photos, and take your data with you.",
}

export default async function ConnectDrivePage() {
  const session = await auth0.getSession()

  if (!session) {
    redirect("/auth/login?returnTo=/connect-drive")
  }

  return <ConnectDriveSetup />
}
